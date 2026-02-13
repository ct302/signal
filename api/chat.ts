import type { VercelRequest, VercelResponse } from '@vercel/node';

// Rate limiting: simple in-memory store (resets on cold starts)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute per IP

function getRateLimitKey(req: VercelRequest): string {
  // Use forwarded IP or fall back to connection IP
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0] || 'unknown';
  return ip.trim();
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count };
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

  // Check rate limit
  const rateLimitKey = getRateLimitKey(req);
  const { allowed, remaining } = checkRateLimit(rateLimitKey);

  res.setHeader('X-RateLimit-Remaining', remaining.toString());

  if (!allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Please wait a moment before trying again.',
      retryAfter: 60
    });
  }

  // Get API key from environment (server-side only - never exposed to client)
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

    return res.status(200).json(data);

  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
}
