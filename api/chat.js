// Free tier configuration
const FREE_TIER_DAILY_LIMIT = 5;

// Primary model: cheap, reliable, paid model (~$0.001 per search)
// Google Gemini 2.5 Flash Lite: $0.10/M in, $0.40/M out - fast, supports JSON mode
const FREE_TIER_DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';

// Fallback chain: try paid cheap models first, then free models as last resort
const FREE_TIER_MODELS = [
  'google/gemini-2.5-flash-lite',        // Primary: cheap + reliable + fast
  'google/gemini-2.0-flash-lite-001',    // Fallback 1: even cheaper
  'meta-llama/llama-4-scout',            // Fallback 2: cheap paid Llama
  'meta-llama/llama-4-scout:free',       // Fallback 3: free (unreliable)
  'openrouter/free'                       // Last resort: auto-router
];

// Statuses that should trigger trying the next model instead of returning error
// 400 = bad request (json mode unsupported), 402 = payment/quota issue on free models
// 404 = model not found, 429 = rate limit, 5xx = server errors
const RETRYABLE_STATUSES = new Set([400, 402, 404, 429, 500, 502, 503, 504]);

// ============================================
// KV STORAGE (optional - falls back to in-memory)
// ============================================

let kvClient = null;
let kvInitialized = false;

async function getKV() {
  if (kvInitialized) return kvClient;
  kvInitialized = true;

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

// In-memory fallback for usage tracking
const memoryUsageStore = new Map();

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded ? forwarded.split(',')[0] : 'unknown');
  return ip.trim();
}

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

async function getDailyUsage(ip) {
  const kv = await getKV();
  const today = getTodayString();

  if (kv) {
    try {
      const key = `signal:usage:${ip}:${today}`;
      const count = await kv.get(key);
      return count || 0;
    } catch (error) {
      console.error('KV read error:', error);
    }
  }

  const record = memoryUsageStore.get(ip);
  if (record && record.date === today) {
    return record.count;
  }
  return 0;
}

async function incrementDailyUsage(ip) {
  const kv = await getKV();
  const today = getTodayString();

  if (kv) {
    try {
      const key = `signal:usage:${ip}:${today}`;
      const newCount = await kv.incr(key);
      if (newCount === 1) {
        await kv.expire(key, 86400);
      }
      return newCount;
    } catch (error) {
      console.error('KV write error:', error);
    }
  }

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

const burstStore = new Map();
const BURST_WINDOW_MS = 60 * 1000;
const BURST_MAX = 10;

function checkBurstLimit(ip) {
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
// OPENROUTER REQUEST HELPER
// ============================================

// Models known to NOT support response_format: { type: "json_object" }
const NO_JSON_MODE_MODELS = new Set([
  'openrouter/free'
]);

async function tryOpenRouterRequest(model, messages, response_format, plugins, apiKey, skipJsonMode) {
  const body = { model, messages };
  // Only add response_format if the model supports it and we haven't been told to skip
  if (response_format && !skipJsonMode && !NO_JSON_MODE_MODELS.has(model)) {
    body.response_format = response_format;
  }
  if (plugins) body.plugins = plugins;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
      'HTTP-Referer': 'https://signal-app.com',
      'X-Title': 'Signal Analogy Engine'
    },
    body: JSON.stringify(body)
  });

  let data = {};
  try {
    data = await response.json();
  } catch (e) {
    data = { error: { message: 'Invalid response from AI provider' } };
  }
  return { ok: response.ok, status: response.status, data: data };
}

// ============================================
// REQUEST HANDLER
// ============================================

module.exports = async function handler(req, res) {
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
    var model = req.body && req.body.model;
    var messages = req.body && req.body.messages;
    var response_format = req.body && req.body.response_format;
    var plugins = req.body && req.body.plugins;
    var skipUsageCount = req.body && req.body.skipUsageCount;

    if (!messages) {
      return res.status(400).json({ error: 'Missing required field: messages' });
    }

    // Default to our primary model if none specified or if a free model is requested
    if (!model || !model.trim()) {
      model = FREE_TIER_DEFAULT_MODEL;
    }

    // Enforce free-tier model whitelist
    if (!FREE_TIER_MODELS.includes(model)) {
      return res.status(403).json({
        error: 'Model "' + model + '" requires your own API key. Add it in Settings for unlimited access.',
        code: 'PREMIUM_MODEL'
      });
    }

    // Check daily usage limit
    var currentUsage = await getDailyUsage(clientIP);
    if (currentUsage >= FREE_TIER_DAILY_LIMIT) {
      res.setHeader('X-Free-Remaining', '0');
      res.setHeader('X-Free-Limit', String(FREE_TIER_DAILY_LIMIT));
      return res.status(403).json({
        error: 'You\'ve used your ' + FREE_TIER_DAILY_LIMIT + ' free searches for today. Add your own API key for unlimited access!',
        code: 'FREE_TIER_EXHAUSTED',
        remaining: 0,
        limit: FREE_TIER_DAILY_LIMIT
      });
    }

    // Build model attempt order: requested model first, then remaining models
    var modelsToTry = [model];
    for (var i = 0; i < FREE_TIER_MODELS.length; i++) {
      if (FREE_TIER_MODELS[i] !== model && modelsToTry.indexOf(FREE_TIER_MODELS[i]) === -1) {
        modelsToTry.push(FREE_TIER_MODELS[i]);
      }
    }

    var lastErrorStatus = 500;
    var lastErrorMessage = 'All models are currently unavailable. Please try again in a moment.';

    var skipJsonMode = false; // Track if we should stop sending response_format

    for (var j = 0; j < modelsToTry.length; j++) {
      var attemptModel = modelsToTry[j];
      try {
        var result = await tryOpenRouterRequest(attemptModel, messages, response_format, plugins, apiKey, skipJsonMode);

        if (result.ok) {
          // SUCCESS - only increment usage for counting calls (main search generation)
          // Validation/supplementary calls (skipUsageCount=true) don't consume credits
          if (!skipUsageCount) {
            var newUsage = await incrementDailyUsage(clientIP);
            var remaining = Math.max(0, FREE_TIER_DAILY_LIMIT - newUsage);
            res.setHeader('X-Free-Remaining', String(remaining));
            res.setHeader('X-Free-Limit', String(FREE_TIER_DAILY_LIMIT));
          } else {
            var currentCount = await getDailyUsage(clientIP);
            var remaining = Math.max(0, FREE_TIER_DAILY_LIMIT - currentCount);
            res.setHeader('X-Free-Remaining', String(remaining));
            res.setHeader('X-Free-Limit', String(FREE_TIER_DAILY_LIMIT));
          }
          return res.status(200).json(result.data);
        }

        // If 400 and we sent response_format, retry SAME model without json mode first
        if (result.status === 400 && response_format && !skipJsonMode) {
          console.warn('OpenRouter 400 with json mode (' + attemptModel + ') - retrying without response_format');
          skipJsonMode = true;
          j--; // Retry same model index
          continue;
        }

        // Retryable error - log and try next model
        if (RETRYABLE_STATUSES.has(result.status)) {
          console.warn('OpenRouter retryable error (' + attemptModel + '): ' + result.status + ' - trying next model');
          lastErrorStatus = result.status;
          lastErrorMessage = (result.data && result.data.error && result.data.error.message) || 'Model unavailable';
          continue;
        }

        // Non-retryable error - return immediately (but do NOT count usage)
        console.error('OpenRouter non-retryable error (' + attemptModel + '):', result.status, result.data);
        return res.status(result.status).json({
          error: (result.data && result.data.error && result.data.error.message) || 'API request failed',
          code: (result.data && result.data.error && result.data.error.code) || undefined
        });

      } catch (fetchError) {
        console.warn('OpenRouter fetch error (' + attemptModel + '):', fetchError);
        lastErrorStatus = 500;
        lastErrorMessage = 'Network error reaching AI provider';
      }
    }

    // All models failed - do NOT count this against the user's limit
    console.error('All demo tier models failed, last status:', lastErrorStatus);
    return res.status(502).json({
      error: 'All models are temporarily unavailable. Please try again in a moment. This attempt was not counted against your free searches.',
      code: 'ALL_MODELS_FAILED'
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
