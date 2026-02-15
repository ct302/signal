import type { VercelRequest, VercelResponse } from '@vercel/node';

// Free tier configuration
const FREE_TIER_DAILY_LIMIT = 5;
const FREE_TIER_DEFAULT_MODEL = 'google/gemini-2.0-flash-exp:free';
const FREE_TIER_MODELS = [
  'xiaomi/mimo-v2-flash:free',
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.3-70b-instruct:free'
];

// ============================================
// KV STORAGE (optional - falls back to in-memory)
// ============================================

// Lazy-loaded KV client (only loads if env vars are present)
let kvClient: any = null;
let kvInitialized = false;

async function getKV() {
  if (kvInitialized) return kvClient;
  kvInitialized = true;

  // Only try to load KV if env vars are present
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const { kv } = await import('@vercel/kv');
      kvClient = kv;
    } catch (error) {
      console.warn('Vercel KV not available, using in-memory tracking:', error);
    }
  } else {
    console.warn('KV env vars not set, using in-memory usage tracking');
  }

  return kvClient;
}

// In-memory fallback for usage tracking (resets on cold starts, but better than crashing)
const memoryUsageStore = new Map<string, { count: number; date: string }>();

function getClientIP(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0] || 'unknown';
  return ip.trim();
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD in UTC
}

async function getDailyUsage(ip: string): Promise<number> {
  const kv = await getKV();
  const today = getTodayString();

  if (kv) {
    try {
      const key = `signal:usage:${ip}:${today}`;
      const count = await kv.get<number>(key);
      return count || 0;
    } catch (error) {
      console.error('KV read error:', error);
      // Fall through to memory
    }
  }

  // In-memory fallback
  const record = memoryUsageStore.get(ip);
  if (record && record.date === today) {
    return record.count;
  }
  return 0;
}

async function incrementDailyUsage(ip: string): Promise<number> {
  const kv = await getKV();
  const today = getTodayString();

  if (kv) {
    try {
      const key = `signal:usage:${ip}:${today}`;
      const newCount = await kv.incr(key);
      if (newCount === 1) {
        await kv.expire(key, 86400); // 24hr TTL
      }
      return newCount;
    } catch (error) {
      console.error('KV write error:', error);
      // Fall through to memory
    }
  }

  // In-memory fallback
  const record = memoryUsageStore.get(ip);
  if (record && record.date === today) {
    record.count++;
    return record.count;
  }
  memoryUsageStore.set(ip, { count: 1, date: today });
  return 1;
}

// ============================================
// BURST RATE LIMITING (in-memory)
// ============================================

const burstStore = new Map<string, { count: number; resetTime: number }>();
const BURST_WINDOW_MS = 60 * 1000;
const BURST_MAX = 10;

function checkBurstLimit(ip: string): boolean {
  const now = Date.now();
  const record = burstStore.get(ip);

  if (!record || now > record.resetTime) {
    burstStore.set(ip, { count: 1, resetTime: now + BURST_WINDOW_MS });
    return true;
  }

  if (record.count >= BURST_MAX) return false;
  record.count++;
  return true;
}

// ============================================
// REQUEST HANDLER
// ============================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const clientIP = getClientIP(req);

  // Burst protection
  if (!checkBurstLimit(clientIP)) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.', retryAfter: 60 });
  }

  // Get API key from environment
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY not set');
    return res.status(500).json({ error: 'Server not configured. Please add your own API key in Settings.' });
  }

  try {
    let { model, messages, response_format, plugins } = req.body;

    if (!messages) {
      return res.status(400).json({ error: 'Missing required field: messages' });
    }

    // Default to free model if none specified
    if (!model || !model.trim()) {
      model = FREE_TIER_DEFAULT_MODEL;
    }

    // Enforce free-tier model whitelist
    if (!FREE_TIER_MODELS.includes(model)) {
      return res.status(403).json({
        error: `Model "${model}" requires your own API key. Add it in Settings for unlimited access.`,
        code: 'PREMIUM_MODEL'
      });
    }

    // Check daily usage limit
    const currentUsage = await getDailyUsage(clientIP);
    if (currentUsage >= FREE_TIER_DAILY_LIMIT) {
      res.setHeader('X-Free-Remaining', '0');
      res.setHeader('X-Free-Limit', FREE_TIER_DAILY_LIMIT.toString());
      return res.status(403).json({
        error: `You've used your ${FREE_TIER_DAILY_LIMIT} free searches for today. Add your own API key for unlimited access!`,
        code: 'FREE_TIER_EXHAUSTED',
        remaining: 0,
        limit: FREE_TIER_DAILY_LIMIT
      });
    }

    // Build and forward request to OpenRouter
    const openRouterBody: Record<string, any> = { model, messages };
    if (response_format) openRouterBody.response_format = response_format;
    if (plugins) openRouterBody.plugins = plugins;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://signal-app.com',
        'X-Title': 'Signal Analogy Engine'
      },
      body: JSON.stringify(openRouterBody)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenRouter error:', response.status, data);
      return res.status(response.status).json({
        error: data.error?.message || 'API request failed',
        code: data.error?.code
      });
    }

    // Success - increment usage
    const newUsage = await incrementDailyUsage(clientIP);
    const remaining = Math.max(0, FREE_TIER_DAILY_LIMIT - newUsage);
    res.setHeader('X-Free-Remaining', remaining.toString());
    res.setHeader('X-Free-Limit', FREE_TIER_DAILY_LIMIT.toString());

    return res.status(200).json(data);

  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
