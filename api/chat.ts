import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

// Free tier configuration
const FREE_TIER_DAILY_LIMIT = 5;
const FREE_TIER_MODELS = [
  'xiaomi/mimo-v2-flash:free',
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.3-70b-instruct:free'
];

// Fallback in-memory rate limiting (burst protection)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const BURST_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const BURST_LIMIT_MAX = 10; // 10 requests per minute max

function getClientIP(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0] || 'unknown';
  return ip.trim();
}

function checkBurstLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + BURST_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= BURST_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

function getTodayKey(ip: string): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD in UTC
  return `signal:usage:${ip}:${today}`;
}

async function getDailyUsage(ip: string): Promise<number> {
  try {
    const key = getTodayKey(ip);
    const count = await kv.get<number>(key);
    return count || 0;
  } catch (error) {
    console.error('KV read error:', error);
    return 0; // Fail open - allow request if KV is down
  }
}

async function incrementDailyUsage(ip: string): Promise<number> {
  try {
    const key = getTodayKey(ip);
    const newCount = await kv.incr(key);
    // Set TTL to 24 hours if this is the first request of the day
    if (newCount === 1) {
      await kv.expire(key, 86400); // 24 hours
    }
    return newCount;
  } catch (error) {
    console.error('KV write error:', error);
    return 1; // Fail open
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIP = getClientIP(req);

  // Check burst rate limit (prevents rapid-fire abuse)
  if (!checkBurstLimit(clientIP)) {
    return res.status(429).json({
      error: 'Too many requests. Please slow down.',
      retryAfter: 60
    });
  }

  // Get API key from environment
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.error('OPENROUTER_API_KEY environment variable not set');
    return res.status(500).json({
      error: 'Server configuration error. API key not configured.'
    });
  }

  try {
    const { model, messages, response_format, plugins } = req.body;

    // Validate required fields
    if (!model || !messages) {
      return res.status(400).json({ error: 'Missing required fields: model, messages' });
    }

    // Check if using free tier (proxy with shared key)
    // Users with their own key bypass the proxy entirely

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
      // Use 403 (not 429) so the client doesn't retry - this is a permanent limit, not rate limiting
      return res.status(403).json({
        error: `You've used your ${FREE_TIER_DAILY_LIMIT} free searches for today. Add your own API key for unlimited access!`,
        code: 'FREE_TIER_EXHAUSTED',
        remaining: 0,
        limit: FREE_TIER_DAILY_LIMIT
      });
    }

    // Build request to OpenRouter
    const openRouterBody: Record<string, any> = {
      model,
      messages
    };

    if (response_format) {
      openRouterBody.response_format = response_format;
    }

    if (plugins) {
      openRouterBody.plugins = plugins;
    }

    // Forward request to OpenRouter
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

    // Get response
    const data = await response.json();

    // Forward status and response
    if (!response.ok) {
      console.error('OpenRouter error:', data);
      return res.status(response.status).json({
        error: data.error?.message || 'API request failed',
        code: data.error?.code
      });
    }

    // Success - increment usage counter
    const newUsage = await incrementDailyUsage(clientIP);
    const remaining = Math.max(0, FREE_TIER_DAILY_LIMIT - newUsage);

    // Include remaining count in response headers
    res.setHeader('X-Free-Remaining', remaining.toString());
    res.setHeader('X-Free-Limit', FREE_TIER_DAILY_LIMIT.toString());

    return res.status(200).json(data);

  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
}
