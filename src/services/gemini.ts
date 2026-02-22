import { DEFAULT_OLLAMA_ENDPOINT, STORAGE_KEYS, DOMAIN_CATEGORIES, OPENROUTER_FALLBACK_MODELS, RATE_LIMIT_CONFIG } from '../constants';
import { fetchWithRetry, safeJsonParse, ApiError } from '../utils';
import { stripMathSymbols } from '../utils/text';
import { AmbiguityResult, QuizData, QuizDifficulty, ProviderConfig, OllamaModel, ProximityResult, MasteryKeyword, EvaluationResult, MasteryStage, ConceptMapItem, ImportanceMapItem, MasteryStory, MasteryChatMessage, RoutingDecision, EnrichedContext, CachedDomainEnrichment, StudyGuideConcept, StudyGuideOutline, StudyGuideDetail, StudyGuideDepth } from '../types';

// ============================================
// CIRCUIT BREAKER PATTERN
// ============================================

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean; // true = circuit is "open" (blocking requests)
}

// Track circuit breaker state per model
const circuitBreakers: Map<string, CircuitBreakerState> = new Map();

/**
 * Get or create circuit breaker state for a model
 */
const getCircuitBreaker = (model: string): CircuitBreakerState => {
  if (!circuitBreakers.has(model)) {
    circuitBreakers.set(model, { failures: 0, lastFailure: 0, isOpen: false });
  }
  return circuitBreakers.get(model)!;
};

/**
 * Record a failure for a model
 */
const recordFailure = (model: string): void => {
  const cb = getCircuitBreaker(model);
  cb.failures++;
  cb.lastFailure = Date.now();

  if (cb.failures >= RATE_LIMIT_CONFIG.circuitBreakerThreshold) {
    cb.isOpen = true;
    console.log(`[CircuitBreaker] OPENED for model: ${model} (${cb.failures} consecutive failures)`);
  }
};

/**
 * Record a success for a model (resets circuit breaker)
 */
const recordSuccess = (model: string): void => {
  const cb = getCircuitBreaker(model);
  cb.failures = 0;
  cb.isOpen = false;
};

/**
 * Check if a model's circuit breaker is open (should skip this model)
 */
const isCircuitOpen = (model: string): boolean => {
  const cb = getCircuitBreaker(model);

  if (!cb.isOpen) return false;

  // Check if cooldown period has passed
  const timeSinceLastFailure = Date.now() - cb.lastFailure;
  if (timeSinceLastFailure >= RATE_LIMIT_CONFIG.circuitBreakerCooldownMs) {
    // Reset circuit breaker (half-open state - allow one request through)
    cb.isOpen = false;
    cb.failures = 0;
    console.log(`[CircuitBreaker] RESET for model: ${model} (cooldown expired)`);
    return false;
  }

  return true;
};

/**
 * Get the next available model from fallback chain
 */
const getAvailableModel = (preferredModel: string): string => {
  // If preferred model's circuit is not open, use it
  if (!isCircuitOpen(preferredModel)) {
    return preferredModel;
  }

  // Try fallback models
  for (const fallbackModel of OPENROUTER_FALLBACK_MODELS) {
    if (fallbackModel !== preferredModel && !isCircuitOpen(fallbackModel)) {
      console.log(`[CircuitBreaker] Using fallback model: ${fallbackModel} (${preferredModel} circuit is open)`);
      return fallbackModel;
    }
  }

  // All circuits open - try preferred model anyway (last resort)
  console.log(`[CircuitBreaker] All fallbacks exhausted, attempting ${preferredModel} anyway`);
  return preferredModel;
};

// ============================================
// FREE TIER STATE MANAGEMENT
// ============================================

interface FreeTierState {
  remaining: number | null;  // null = unknown (not using proxy)
  limit: number;
  isExhausted: boolean;
}

let freeTierState: FreeTierState = {
  remaining: null,
  limit: 5,
  isExhausted: false
};

// Listeners for free tier state changes
const freeTierListeners: Set<(state: FreeTierState) => void> = new Set();

/**
 * Get current free tier state
 */
export const getFreeTierState = (): FreeTierState => ({ ...freeTierState });

/**
 * Subscribe to free tier state changes
 */
export const subscribeToFreeTier = (listener: (state: FreeTierState) => void): (() => void) => {
  freeTierListeners.add(listener);
  return () => freeTierListeners.delete(listener);
};

/**
 * Update free tier state from response headers
 */
const updateFreeTierFromResponse = (response: Response): void => {
  const remaining = response.headers.get('X-Free-Remaining');
  const limit = response.headers.get('X-Free-Limit');

  if (remaining !== null) {
    freeTierState = {
      remaining: parseInt(remaining, 10),
      limit: limit ? parseInt(limit, 10) : 5,
      isExhausted: parseInt(remaining, 10) <= 0
    };
    // Notify listeners
    freeTierListeners.forEach(listener => listener(freeTierState));
  }
};

/**
 * Check if user is on free tier (using proxy without own key)
 */
export const isOnFreeTier = (): boolean => {
  return shouldUseProxy();
};

/**
 * Reset free tier exhausted state (e.g., after user adds their own key)
 */
export const resetFreeTierState = (): void => {
  freeTierState = { remaining: null, limit: 5, isExhausted: false };
  freeTierListeners.forEach(listener => listener(freeTierState));
};

/**
 * Custom error for free tier exhausted
 */
export class FreeTierExhaustedError extends Error {
  constructor(message: string, public remaining: number = 0, public limit: number = 5) {
    super(message);
    this.name = 'FreeTierExhaustedError';
  }
}

// ============================================
// PRODUCTION PROXY DETECTION
// ============================================

/**
 * Check if we're running in production (deployed) vs local development
 * In production, we use a server-side proxy to keep API keys secure
 */
const isProduction = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  // Local development: localhost, 127.0.0.1, or any .local domain
  const isLocalDev = hostname === 'localhost' ||
                     hostname === '127.0.0.1' ||
                     hostname.endsWith('.local');
  return !isLocalDev;
};

/**
 * Check if user has configured their own API key (for local dev or self-hosted)
 */
const hasUserApiKey = (): boolean => {
  const stored = localStorage.getItem(STORAGE_KEYS.PROVIDER_CONFIG);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return Boolean(parsed.apiKey && parsed.apiKey.trim());
    } catch {
      return false;
    }
  }
  return false;
};

/**
 * Determine if we should use the server-side proxy
 * Use proxy in production UNLESS user has configured their own API key
 */
const shouldUseProxy = (): boolean => {
  return isProduction() && !hasUserApiKey();
};

// Get stored provider config
const getProviderConfig = (): ProviderConfig => {
  const stored = localStorage.getItem(STORAGE_KEYS.PROVIDER_CONFIG);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return parsed;
    } catch {
      // Fall through to default
    }
  }
  // Default config without API key - user must provide their own
  // When using proxy (production, no user key), use the demo tier model
  const defaultModel = shouldUseProxy() ? 'arcee-ai/trinity-large-preview:free' : '';
  return {
    provider: 'cloud' as const,
    apiKey: '',
    model: defaultModel,
    baseUrl: 'https://openrouter.ai/api/v1',
    ollamaEndpoint: DEFAULT_OLLAMA_ENDPOINT
  };
};

// Validate that API key is present (throws user-friendly error if missing)
// In production with proxy, API key is server-side so we don't require it
const validateApiKey = (config: ProviderConfig): void => {
  // Skip validation if using server-side proxy (production mode)
  if (shouldUseProxy()) {
    return;
  }
  if (config.provider === 'cloud' && !config.apiKey) {
    throw new Error(
      'No API key configured. Please open Settings (gear icon) and enter your API key.'
    );
  }
};

// Build API URL based on provider
const buildApiUrl = (config: ProviderConfig): string => {
  if (config.provider === 'ollama') {
    return `${config.ollamaEndpoint || DEFAULT_OLLAMA_ENDPOINT}/api/generate`;
  }
  // In production, use server-side proxy to keep API key secure
  if (shouldUseProxy()) {
    return '/api/chat';
  }
  // Cloud provider (local dev or user has own API key) - use baseUrl
  const baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
  return `${baseUrl}/chat/completions`;
};

// Options for API calls
interface ApiCallOptions {
  jsonMode?: boolean;
  webSearch?: boolean; // Enable OpenRouter web search plugin
  searchPrompt?: string; // Custom prompt for how to integrate web search results
  maxResults?: number; // Number of web search results (default 3, max 10 for Mastery Mode)
  isEnrichment?: boolean; // Enrichment calls don't count against free tier daily limit
}

// Build request body based on provider
const buildRequestBody = (prompt: string, config: ProviderConfig, options: ApiCallOptions = {}): object => {
  const { jsonMode = false, webSearch = false, searchPrompt, maxResults = 3 } = options;

  if (config.provider === 'ollama') {
    return {
      model: config.model,
      prompt: prompt,
      stream: false,
      ...(jsonMode && { format: 'json' })
    };
  }

  // Cloud provider - OpenAI-compatible format (works with OpenRouter, OpenAI, Groq, Together, etc.)
  const body: Record<string, any> = {
    model: config.model,
    messages: [{ role: 'user', content: prompt }],
    ...(jsonMode && { response_format: { type: 'json_object' } })
  };

  // Add web search plugin when enabled (OpenRouter's built-in web search)
  // Pricing: $4 per 1000 results, with max_results: 8 = ~$0.032 per request
  if (webSearch) {
    const webPlugin: Record<string, any> = { id: 'web', max_results: maxResults };
    if (searchPrompt) {
      webPlugin.search_prompt = searchPrompt;
    }
    body.plugins = [webPlugin];
    console.log(`[Cloud API] Web search enabled with max_results: ${maxResults}` + (searchPrompt ? ', custom search_prompt' : ''));
  }

  return body;
};

// Build headers based on provider
const buildHeaders = (config: ProviderConfig): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (config.provider === 'cloud') {
    // In production proxy mode, don't send API key - server handles it
    if (!shouldUseProxy()) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
      // OpenRouter-specific headers (ignored by other providers)
      headers['HTTP-Referer'] = 'https://signal-app.com';
      headers['X-Title'] = 'Signal Analogy Engine';
    }
  }
  // Ollama doesn't need auth headers

  return headers;
};

// Extract response text based on provider
const extractResponseText = (data: any, config: ProviderConfig): string => {
  if (config.provider === 'ollama') {
    return data.response || '';
  }
  // Cloud provider - OpenAI-compatible response format
  return data.choices?.[0]?.message?.content || '';
};

// Unified API call with enhanced error handling and circuit breaker
const callApi = async (prompt: string, options: ApiCallOptions = {}): Promise<string> => {
  const baseConfig = getProviderConfig();

  // Validate API key is present (throws user-friendly error if missing)
  validateApiKey(baseConfig);

  // For cloud providers, use circuit breaker to select available model (fallback chain)
  const effectiveModel = baseConfig.provider === 'cloud'
    ? getAvailableModel(baseConfig.model)
    : baseConfig.model;

  // Create effective config with potentially different model
  const config: ProviderConfig = {
    ...baseConfig,
    model: effectiveModel
  };

  if (effectiveModel !== baseConfig.model) {
    console.log(`[callApi] Using fallback model: ${effectiveModel} (original: ${baseConfig.model})`);
  }

  const url = buildApiUrl(config);
  const headers = buildHeaders(config);
  // Enrichment calls send a header so the proxy skips usage counting
  if (options.isEnrichment && shouldUseProxy()) {
    headers['X-Signal-Enrichment'] = 'true';
  }
  const body = buildRequestBody(prompt, config, options);

  try {
    // fetchWithRetry now throws ApiError for non-2xx responses
    // and handles retries with exponential backoff + jitter
    const response = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      },
      {
        // Use defaults from RATE_LIMIT_CONFIG
        // Only log retries in development - suppress technical messages in production
        onRetry: process.env.NODE_ENV !== 'production'
          ? (attempt, maxAttempts, waitMs, reason) => {
              console.log(`[callApi] ${reason} - retrying ${attempt}/${maxAttempts} in ${Math.round(waitMs / 1000)}s`);
            }
          : undefined
      }
    );

    // Update free tier state from response headers (when using proxy)
    if (shouldUseProxy()) {
      updateFreeTierFromResponse(response);
    }

    const data = await response.json();
    const result = extractResponseText(data, config);

    // Check for empty response (some models return empty on overload)
    if (!result || result.trim() === '') {
      recordFailure(effectiveModel);
      throw new Error('Empty response received from API. The model may be overloaded.');
    }

    // Success! Record it for circuit breaker
    recordSuccess(effectiveModel);
    return result;

  } catch (error) {
    // Check for free tier exhausted error (403 with FREE_TIER_EXHAUSTED code)
    if (error instanceof ApiError && error.status === 403 && error.responseBody) {
      try {
        const body = JSON.parse(error.responseBody);
        if (body.code === 'FREE_TIER_EXHAUSTED') {
          // Update free tier state
          freeTierState = { remaining: 0, limit: body.limit || 5, isExhausted: true };
          freeTierListeners.forEach(listener => listener(freeTierState));
          // Throw specialized error
          throw new FreeTierExhaustedError(body.error, 0, body.limit || 5);
        }
      } catch (parseError) {
        if (parseError instanceof FreeTierExhaustedError) throw parseError;
        // If parsing fails, continue with original error
      }
    }

    // Record failure for circuit breaker (only for rate limit or server errors)
    if (error instanceof ApiError && (error.status === 429 || error.status >= 500)) {
      recordFailure(effectiveModel);
    }
    throw error;
  }
};

// ============================================
// ROUTING LAYER (Web search via OpenRouter)
// ============================================

/**
 * Check if routing is enabled - now always uses OpenRouter web search
 */
export const isRoutingEnabled = (): boolean => {
  return false; // Routing now handled via OpenRouter web search
};

/**
 * Detect granularity signals that suggest we need fresh data
 * Domain-agnostic: works for any expertise domain (sports, TV, music, cooking, etc.)
 * Returns separate signals for the text analyzed
 */
const detectGranularitySignalsInText = (text: string): { isGranular: boolean; signals: string[] } => {
  const textLower = text.toLowerCase();
  const signals: string[] = [];

  // Year patterns (specific seasons, years, decades)
  const yearMatch = textLower.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    signals.push(`specific year: ${yearMatch[0]}`);
  }

  // Season/Episode patterns (TV shows, podcasts, series)
  if (/\b(s\d+e\d+|season\s*\d+|episode\s*\d+|ep\s*\d+|chapter\s*\d+|volume\s*\d+|part\s*\d+)\b/i.test(textLower)) {
    signals.push('specific episode/season/chapter reference');
  }

  // Numbered events (games, rounds, editions, issues)
  if (/\b(game\s*\d+|match\s*\d+|round\s*\d+|edition\s*\d+|issue\s*#?\d+|book\s*\d+|album\s*\d+|week\s*\d+)\b/i.test(textLower)) {
    signals.push('specific numbered event/item');
  }

  // Championship/finale patterns (domain-agnostic)
  if (/\b(finals?|championship|premiere|finale|pilot|debut|opener|closer|super\s*bowl)\b/i.test(textLower)) {
    signals.push('significant event reference');
  }

  // Statistical/measurable indicators (works across domains)
  if (/\b(stats?|statistics|record|score|rating|ranking|chart|sales|views|downloads|streams)\b/i.test(textLower)) {
    signals.push('statistical/measurable data');
  }

  // Recent time indicators
  if (/\b(recent|latest|current|this\s+year|last\s+year|202[3-9]|today|yesterday|this\s+week)\b/i.test(textLower)) {
    signals.push('recent/current data requested');
  }

  // Specific proper nouns with context (names + verifiable context)
  if (/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b.*\b(career|biography|history|timeline|discography|filmography|bibliography)\b/i.test(text)) {
    signals.push('biographical/historical reference');
  }

  // Award/recognition patterns
  if (/\b(award|grammy|oscar|emmy|pulitzer|nobel|mvp|winner|nominated|nomination)\b/i.test(textLower)) {
    signals.push('award/recognition reference');
  }

  // Location-specific patterns
  if (/\b(at\s+the|in\s+the|held\s+at|performed\s+at|filmed\s+at|recorded\s+at)\b/i.test(textLower)) {
    signals.push('location-specific reference');
  }

  return {
    isGranular: signals.length > 0,
    signals
  };
};

/**
 * Detect granularity signals separately for domain and topic
 * Domain granularity triggers web search for historical context
 * Topic granularity is rarely needed (most concepts are timeless)
 */
const detectGranularitySignals = (topic: string, domain: string): {
  isGranular: boolean;
  signals: string[];
  domainGranularity: { isGranular: boolean; signals: string[] };
  topicGranularity: { isGranular: boolean; signals: string[] };
} => {
  const domainGranularity = detectGranularitySignalsInText(domain);
  const topicGranularity = detectGranularitySignalsInText(topic);

  return {
    // Combined for backward compatibility
    isGranular: domainGranularity.isGranular || topicGranularity.isGranular,
    signals: [...domainGranularity.signals, ...topicGranularity.signals],
    // Separate results for smarter decisions
    domainGranularity,
    topicGranularity
  };
};

/**
 * Route query using heuristic detection
 * Note: FunctionGemma API calls are disabled in browser due to CORS restrictions.
 * The heuristic detection works well for most use cases.
 * For server-side implementations, FunctionGemma can be enabled.
 */
export const routeQuery = async (
  topic: string,
  domain: string
): Promise<RoutingDecision> => {
  // Use heuristic detection (works in browser without CORS issues)
  const { isGranular, signals } = detectGranularitySignals(topic, domain);

  if (isGranular) {
    // Construct a search query from the granular signals
    const shortDomain = domain.indexOf('(') > 0
      ? domain.substring(0, domain.indexOf('(')).trim()
      : domain;
    const searchQuery = `${shortDomain} ${topic}`.slice(0, 100);
    return {
      action: 'web_search',
      query: searchQuery,
      reason: `Detected: ${signals.join(', ')}`,
      confidence: 0.7
    };
  }

  return {
    action: 'none',
    reason: 'No granularity signals detected',
    confidence: 0.6
  };
};

/**
 * Main enrichment function - checks routing signals
 * Note: Actual web data fetching is now handled by OpenRouter's native web search plugin
 * which is enabled via the `plugins` parameter when granularity signals are detected.
 * This function is kept for backward compatibility and logging purposes.
 */
export const enrichWithRouting = async (
  topic: string,
  domain: string
): Promise<EnrichedContext> => {
  // Get routing decision (checks for granularity signals)
  const routingDecision = await routeQuery(topic, domain);

  // Note: OpenRouter's web search plugin handles data fetching automatically
  // when the webSearch option is passed to callApi
  return {
    originalTopic: topic,
    originalDomain: domain,
    wasEnriched: routingDecision.action === 'web_search',
    routingDecision
  };
};

/**
 * Extract short domain name (before parentheses disambiguation)
 */
const getShortDomain = (domain: string): string => {
  const parenIndex = domain.indexOf('(');
  return parenIndex > 0 ? domain.substring(0, parenIndex).trim() : domain;
};

/**
 * Detect if a topic is STEM-related (should allow mathematical notation)
 * Non-STEM topics should use plain English only - no LaTeX, no Greek letters, no math symbols
 */
const isSTEMTopic = (topic: string): boolean => {
  const topicLower = topic.toLowerCase();

  // STEM keywords that warrant mathematical notation
  const stemKeywords = [
    // Math
    'math', 'calculus', 'algebra', 'geometry', 'trigonometry', 'statistics', 'probability',
    'derivative', 'integral', 'equation', 'matrix', 'vector', 'tensor', 'polynomial',
    'logarithm', 'exponential', 'function', 'theorem', 'proof', 'set theory', 'topology',
    // Physics
    'physics', 'quantum', 'relativity', 'thermodynamics', 'mechanics', 'electromagnetism',
    'optics', 'wave', 'particle', 'force', 'energy', 'momentum', 'gravity', 'entropy',
    // Computer Science
    'algorithm', 'data structure', 'complexity', 'sorting', 'graph theory', 'automata',
    'compiler', 'neural network', 'machine learning', 'deep learning', 'backpropagation',
    'gradient descent', 'optimization', 'regression', 'classification', 'clustering',
    // Engineering
    'engineering', 'circuit', 'signal processing', 'control system', 'fourier',
    'laplace', 'differential equation', 'linear system',
    // Chemistry
    'chemistry', 'chemical', 'molecular', 'atomic', 'reaction', 'bond', 'electron',
    'orbital', 'periodic', 'stoichiometry',
    // Biology (quantitative)
    'genetics', 'genomics', 'bioinformatics', 'population dynamics', 'epidemiology',
    // Economics (quantitative)
    'econometrics', 'game theory', 'optimization', 'utility function', 'equilibrium'
  ];

  return stemKeywords.some(keyword => topicLower.includes(keyword));
};

/**
 * Enrich domain on selection - called once when user selects their expertise domain
 * Returns cached enrichment data to be reused for all subsequent generations
 * Note: Actual web data is now fetched by OpenRouter's native web search plugin
 */
export const enrichDomainOnSelection = async (domain: string): Promise<CachedDomainEnrichment> => {
  const shortDomain = getShortDomain(domain);

  // Check for granularity signals in the domain itself
  const { isGranular, signals } = detectGranularitySignals('', domain);

  if (isGranular) {
    console.log(`[Domain Enrichment] Detected granular domain: ${signals.join(', ')}`);
    console.log(`[Domain Enrichment] Web search will be enabled for generations with: ${shortDomain}`);
  }

  // Return domain info - actual web search is handled by OpenRouter's plugin
  return {
    domain,
    shortDomain,
    wasEnriched: isGranular, // Marks that this domain has granular signals
    enrichedAt: new Date()
  };
};

/**
 * Fetch available Ollama models
 */
export const fetchOllamaModels = async (endpoint?: string): Promise<OllamaModel[]> => {
  const baseUrl = endpoint || DEFAULT_OLLAMA_ENDPOINT;
  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) throw new Error('Failed to fetch Ollama models');
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    return [];
  }
};

/**
 * Get complexity level description for prompt
 * Each level has explicit word count targets to ensure substantive explanations
 * ELI100 gets special treatment with domain integration requirements
 */
const getComplexityPrompt = (level: number, domain?: string): string => {
  switch (level) {
    case 5:
      return `CRITICAL: TRUE ELI5 MODE - Explain like talking to a curious 5-year-old!

ABSOLUTE BANS (violating these = failure):
- NO formulas, equations, or math symbols ($, \\\\frac, \\\\sum, etc.)
- NO set notation or Unicode math symbols (∈, ∪, ⊂, ∀, ∃, →, ⟹, ≤, ≥, ≠, ∞, ∂, ∇, etc.)
  Write "in" not ∈, "for all" not ∀, "leads to" not →, "less than" not ≤
- NO technical jargon (algorithm, coefficient, derivative, modulus, vector, matrix, etc.)
- NO acronyms or abbreviations users wouldn't know
- NO chemical formulas (H2O is fine, C6H12O6 is NOT)
- NO Greek letters (alpha, beta, sigma, etc.) — not even spelled out in technical context
- NO "imagine you're a scientist" framing - they're 5!
- NO LaTeX notation of any kind — not even inline $x$

REQUIRED STYLE:
- Use words a kindergartener knows: big, small, fast, slow, push, pull, mix, share
- Compare to things kids experience: toys, snacks, playground, family, animals, colors
- Short sentences. One idea at a time.
- Make it FUN and MEMORABLE - like a storybook explanation
- Use "you" and "your" to make it personal

GOOD EXAMPLES:
- "Photosynthesis" → "Plants eat sunlight! They use sunshine to make their own food, like having a snack that's made of light."
- "Gravity" → "Earth is like a big magnet for everything! It pulls you down so you don't float away."
- "Encryption" → "It's like writing a secret message that only your best friend can read."

NUMBER FORMAT: Write numbers as digits: "5 cookies" not "five cookies", "2 pieces" not "two pieces"

TARGET LENGTH: 150-200 words for EACH explanation
Remember: If a 5-year-old would say "huh?" - rewrite it simpler!`;
    case 100:
      return `IMPORTANT: This is ELI100 - the ADVANCED level for experts who want the FULL picture.

TARGET AUDIENCE: Graduate students, professionals, and experts who want depth, precision, and insight.

DOMAIN INTEGRATION REQUIREMENT:
Your explanation must weave ${domain || 'the chosen domain'} throughout - not as decoration, but as the STRUCTURAL BACKBONE.
Write as if you're an expert who deeply understands BOTH the technical concept AND ${domain || 'the domain'}.
Your voice should sound like: "Just as [${domain || 'domain'} experts] intuitively [do X], this concept formalizes that same logic..."
The ${domain || 'domain'} integration should feel NATURAL, not forced - like you're genuinely passionate about both fields.

REQUIRED STRUCTURE FOR technical_explanation (200-280 words MAX):

IMPORTANT: Be CONCISE. Every sentence must earn its place. No filler, no repetition, no restating what was just said.

1. CORE DEFINITION (2-3 sentences)
   - What is it? Give a precise, tight definition with key LaTeX notation.
   - Include the essential equation or relationship if applicable.

2. HOW IT WORKS (1 short paragraph)
   - The key mechanism or process, explained clearly.
   - Use ${domain || 'domain'} intuition to ground it: "Think of it like [domain analogy]..."
   - DO NOT enumerate every property — focus on the ONE central insight.

3. WHY IT MATTERS (2-3 sentences)
   - One practical application or deeper insight.
   - What doors does understanding this open?

WRITING RULES:
- NEVER repeat information. If you said "A decomposes into B" don't say "This decomposition produces B" in the next sentence.
- NEVER use filler phrases: "It is important to note that", "In other words", "Essentially", "Fundamentally"
- Prefer SHORT sentences. Break up long compound sentences.
- Use LaTeX ONLY for actual math expressions. Don't use LaTeX commands for normal words.
- NEVER use \\n, \\\\, or line break commands in your output. Use normal paragraph spacing.
- Use NUMERIC format for all numbers, dates, years, and scores: "February 2, 2002" NOT "February two thousand two", "17" NOT "seventeen", "3rd" NOT "third"

QUALITY BAR: A brilliant professor explaining to a sharp grad student over coffee — clear, tight, no wasted words.`;
    default:
      return `Write for a general adult audience with some familiarity with the subject.
- Balance clarity with technical accuracy
- TARGET LENGTH: 150-220 words for EACH explanation (tech and analogy)
- Be CONCISE - no filler phrases, no repetition. Every sentence adds new information.
- Include WHAT it is, WHY it matters, and a practical example
- Do NOT use \\n or \\\\ for line breaks. Use normal paragraph spacing.
- Use NUMERIC format for all numbers, dates, years, and scores: "February 2, 2002" NOT "February two thousand two", "17" NOT "seventeen", "3rd" NOT "third"`;
  }
};

/**
 * Generate analogy content for a topic
 * Web search is triggered by DOMAIN granularity (e.g., "2002 NFL Week 4")
 * NOT by topic granularity (e.g., "tensor calculus" doesn't need web search)
 */
export const generateAnalogy = async (
  topic: string,
  domain: string,
  complexity: number = 50,
  cachedDomainEnrichment?: CachedDomainEnrichment
) => {
  const shortDomain = getShortDomain(domain);
  const complexityInstructions = getComplexityPrompt(complexity, shortDomain);

  // Check if this is a STEM topic that warrants mathematical notation
  const topicIsSTEM = isSTEMTopic(topic);
  console.log(`[generateAnalogy] Topic "${topic}" is ${topicIsSTEM ? 'STEM' : 'non-STEM'} - ${topicIsSTEM ? 'allowing' : 'disabling'} LaTeX`);

  // Check granularity separately for domain and topic
  // Web search is triggered by DOMAIN granularity - specific events need real historical data
  // General domains (NFL, Cooking, Chess) don't need web search - LLM has good general knowledge
  // Granular domains (1999 NFL Season, Tuck Rule Game, Episode 4) need web search for accuracy
  const { domainGranularity, topicGranularity } = detectGranularitySignals(topic, domain);
  const needsWebSearch = domainGranularity.isGranular; // Only search for specific/granular domains

  if (needsWebSearch) {
    console.log(`[generateAnalogy] DOMAIN has granularity signals: ${domainGranularity.signals.join(', ')}`);
    console.log(`[generateAnalogy] Enabling web search for historically-specific ${shortDomain} content`);
  } else {
    console.log(`[generateAnalogy] General domain "${shortDomain}" - using LLM knowledge (no web search)`);
  }
  if (topicGranularity.isGranular) {
    console.log(`[generateAnalogy] Topic "${topic}" has granularity signals but NOT triggering web search (concepts are timeless)`);
  }

  // Front-load domain context for web search (only for granular domains)
  // General domains don't need web search - LLM has good general knowledge
  const webSearchContext = domainGranularity.isGranular
    ? `CRITICAL - WEB SEARCH REQUIRED FOR HISTORICAL ACCURACY:

SEARCH FOR THIS SPECIFIC EVENT: "${domain}"
Search queries to use:
1. "${domain} game results score"
2. "${domain} key players highlights"
3. "${domain} date opponent final score"

YOU MUST USE ONLY FACTS FROM THE SEARCH RESULTS.
- The story MUST be about THIS EXACT EVENT - "${domain}"
- Do NOT use generic ${shortDomain} knowledge
- Do NOT fabricate or guess any details
- If search results mention specific people, dates, scores, or events - USE THOSE EXACT FACTS

REQUIRED FACTUAL ELEMENTS (extract from search results):
- Specific date of the event
- Names of key individuals involved (players, coaches, characters - WITH FULL NAMES)
- Specific outcome/result (scores, statistics, achievements)
- Key moments that happened during this specific event

---

`
    : ''; // No web search for general domains - use LLM knowledge

  // LaTeX instruction depends on whether topic is STEM-related
  const latexInstruction = (topicIsSTEM && complexity !== 5)
    ? 'Include mathematical notation in LaTeX ($...$) where appropriate for formulas and equations.'
    : 'Use PLAIN ENGLISH ONLY - NO mathematical symbols, NO Greek letters (α, β, Σ), NO set notation (∈, ∪, ⊂, ∀, ∃), NO LaTeX. Write "in" not ∈, "sum" not Σ, "and" not ∧, "for all" not ∀.';

  const prompt = `${webSearchContext}Create a comprehensive learning module for "${topic}" using "${shortDomain}" as an analogical lens.

TOPIC SCOPING:
- BROAD topics (e.g. "calculus"): Provide an OVERVIEW of the entire field, its branches, and core purpose. Do NOT pick one subtopic arbitrarily.
- SPECIFIC topics (e.g. "derivatives"): Dive deep into that specific topic.
- The header must reflect the ACTUAL topic requested.

${complexityInstructions}

REQUIRED JSON STRUCTURE (strict compliance):
{
  "technical_explanation": "${complexity === 5
    ? `Super simple explanation a 5-year-old would understand (1-2 SHORT paragraphs, 80-120 words MAX). Use ONLY words a kindergartener knows — big, small, fast, slow, push, pull, mix, share. NO jargon, NO formulas, NO Greek letters, NO equations. Compare everything to toys, snacks, playgrounds, building blocks, animals. One idea per sentence. Make it FUN like a storybook. Do NOT use \\n or \\\\ for line breaks.`
    : `CONCISE technical explanation (2-3 short paragraphs, 150-250 words MAX). Cover: (1) WHAT - tight definition with key equation, (2) HOW - the core mechanism, (3) WHY it matters. ${latexInstruction} Be DIRECT - no filler, no repetition. Every sentence must add new information. Do NOT use \\n or \\\\ for line breaks.`}",
  "analogy_explanation": "${complexity === 5
    ? `A fun, SHORT story from ${shortDomain} that a kid would love hearing at bedtime (1-2 paragraphs, 100-150 words MAX). Use simple words only. Make it feel like a storybook, NOT a textbook. Through this story, the kid understands the idea without any hard words. ZERO technical terms.`
    : `A PURE NARRATIVE STORY from REAL ${shortDomain} history. ZERO technical terms allowed - write ONLY in ${shortDomain} vocabulary. The reader should feel like they're reading a ${shortDomain} documentary or sports article, NOT a technical explanation. Through this story, they will intuitively understand ${topic} without seeing any technical jargon. (3-4 paragraphs, 250+ words)`}",
  "segments": [
    {
      "tech": "${complexity === 5 ? 'A super simple sentence about the idea using kid-friendly words only' : 'A single sentence or concept from the technical explanation'}",
      "analogy": "${complexity === 5 ? `The matching ${shortDomain} story moment — simple words only, fun and memorable` : `The corresponding ${shortDomain} narrative moment - written in PURE ${shortDomain} vocabulary with NO technical terms`}",
      "narrative": "${complexity === 5 ? `A fun story bit (1-2 sentences) with ${shortDomain} references a kid would enjoy` : `A brief story element (1-2 sentences) with real ${shortDomain} references - NO technical jargon`}",
      "intuitions": [
        "First memorable one-liner (under 12 words). Format: '[Tech concept] is like [${shortDomain} analogy]'",
        "Second memorable one-liner - different angle or metaphor on the same concept",
        "Third memorable one-liner - the 'aha' moment phrasing that sticks forever"
      ]
    }
  ],
  "concept_map": [
    {
      "id": 0,
      "tech_term": "${complexity === 5 ? 'Simple name for the idea (use the easiest word possible)' : 'technical term from tech text'}",
      "analogy_term": "${shortDomain}-native equivalent from analogy text",
      "six_word_definition": "${complexity === 5 ? 'EXACTLY six simple words a kid would understand explaining what this thing IS' : 'EXACTLY six words defining the tech_term in plain English (domain-agnostic, describes what it IS)'}",
      "narrative_mapping": "${complexity === 5 ? `A fun 1-2 sentence story connecting the idea to ${shortDomain} using simple words a kid knows` : `2-3 sentence vivid mini-story showing HOW these concepts connect through a specific ${shortDomain} scenario. Not generic - use real ${shortDomain} vocabulary and situations.`}",
      "causal_explanation": "${complexity === 5 ? 'Simple explanation of WHY these two things are alike — use words like because, just like, same as' : `First-principles explanation of WHY this mapping works structurally - what shared mechanics, properties, or patterns make these concepts genuinely analogous (not just superficially similar).`}",
      "why_it_matters": {
        "connection": "One sentence explaining WHY these two concepts structurally connect—what shared pattern or mechanism links them (not just THAT they connect, but WHY).",
        "importance": "One sentence explaining WHY understanding the specific link between THIS tech_term and THIS analogy_term unlocks deeper understanding. Be SPECIFIC: name what concepts become easier, what confusion it prevents, or what capability it enables. NEVER use generic phrases like 'this is foundational', 'key bridge', or 'cornerstone concept'.",
        "critical": "One sentence explaining WHY the system would fail without this concept—what PURPOSE does it serve, what problem does it solve?"
      }
    }
  ],
  "importance_map": [
    {"term": "key term", "importance": 0.0-1.0}
  ],
  "attention_map": {
    "tech": [
      {"word": "significant word or multi-word phrase (keep compound concepts together: 'vector calculus' not 'vector','calculus'; keep proper nouns together: 'Tom Brady' not 'Tom','Brady')", "weight": 0.0-1.0}
    ],
    "analogy": [
      {"word": "significant word or multi-word phrase (keep compound concepts together; keep names together: 'New England Patriots' not 'New','England','Patriots')", "weight": 0.0-1.0}
    ]
  },
  CONTEXT CARD RULES:
  - The "context" object MUST be about "${topic}" specifically — NOT about any other concept
  - Generate ORIGINAL content. Do NOT copy examples from these instructions.
  - "why" and "real_world" must reference ${topic} by name at least once

  "context": {
    "header": "Topic header",
    "emoji": "🎯 (single relevant emoji)",
    "why": "2-3 sentences explaining WHY ${topic} matters — grounded in the user's domain (${domain || 'everyday life'}). Write like explaining to a friend using THEIR world. Must be SPECIFICALLY about ${topic}, not any other concept.",
    "real_world": "2-3 sentences with a VIVID, SPECIFIC, EVERYDAY scenario showing ${topic} in action using ${domain || 'daily life'} vocabulary. Make it visceral and relatable. Must demonstrate how ${topic} works in practice — not a different concept.",
    "narrative": "A punchy one-liner mapping ${topic} to ${domain || 'real life'} — visceral, memorable, zero jargon. Must be ABOUT ${topic} specifically."
  },
  "synthesis": {
    "one_liner": "ONE punchy sentence — the simplest possible bridge between ${topic} and ${domain || 'real life'}. Visceral, zero jargon, a complete 'aha' in one breath.",
    "core": "2-3 sentence integration showing HOW ${topic} connects to ${domain || 'real life'} through specific shared mechanics. Build on the one_liner with concrete detail.",
    "deep": "3-4 sentences revealing the STRUCTURAL mechanics — WHY this mapping works at a fundamental level. What shared patterns, constraints, or dynamics drive both ${topic} and ${domain || 'real life'} concepts. This is the 'engineer\\'s view' of the analogy.",
    "citation": "A memorable quote or principle that ties it together"
  },
  "condensed": {
    "what": "One simple sentence: WHAT this concept is in its purest form",
    "why": "One simple sentence: WHY this matters or when you'd use it",
    "bullets": [
      "First-principle point 1 - irreducibly simple truth",
      "First-principle point 2 - another atomic insight",
      "First-principle point 3 - core mechanism",
      "First-principle point 4 - key relationship",
      "First-principle point 5 - essential limitation or edge case"
    ],
    "mnemonic": {
      "phrase": "A catchy memorable phrase where each word starts with the first letter of each bullet point. Make it vivid, silly, or surprising - the weirder the better for memory! (e.g., 'Every Expert Dances Daily, Rejoicing' for EEDDR)",
      "breakdown": [
        "E = [First word of phrase] → [Key concept from bullet 1]",
        "E = [Second word] → [Key concept from bullet 2]",
        "D = [Third word] → [Key concept from bullet 3]",
        "D = [Fourth word] → [Key concept from bullet 4]",
        "R = [Fifth word] → [Key concept from bullet 5]"
      ]
    }
  },
  "symbol_guide": [
    {
      "symbol": "the symbol exactly as written (e.g., 'A', 'λ', '∫', 'f(x)')",
      "name": "Context-specific name for THIS topic (e.g., 'Coordinate Ring' not 'Matrix A' if A represents a ring)",
      "meaning": "What this symbol represents in THIS specific context",
      "simple": "Plain English explanation a beginner would understand",
      "formula": "$LaTeX expression showing this symbol used in a compound expression from your technical_explanation$ (ONLY include for symbols that appear in fractions, sums, integrals, or other compound expressions — omit entirely for standalone symbols like Greek letters)"${domain ? `,
      "domain_analogy": "One visceral sentence mapping THIS symbol's role to ${domain}. Reference a SPECIFIC moment, character, or element — never generic."` : ''}
    }
  ]
}

${domain ? `SYMBOL_GUIDE DOMAIN_ANALOGY RULES:
- Map each symbol to a SPECIFIC ${domain} moment/character — visceral, one sentence, zero jargon
- Each symbol MUST reference a DIFFERENT ${domain} element — never reuse the same analogy
- Must be so specific it could ONLY apply to ${domain} (no generic filler)
` : ''}${topicIsSTEM ? `LaTeX RULES (technical_explanation only):
ALLOWED: $x$, $T_{ij}$, $\\\\frac{a}{b}$, $\\\\sum_{i}$, $\\\\int$, $\\\\alpha$, $\\\\nabla$, $x^2$ — simple inline math only.
FORBIDDEN: \\\\array, \\\\matrix, \\\\begin/\\\\end environments, LaTeX commands as English words (write "in" not \\\\in, "to" not \\\\to), \\n or \\\\\\\\ for line breaks, raw Unicode math symbols (∈, ∑, →).
Keep LaTeX simple — when in doubt, use plain English.` : `NON-STEM TOPIC: Use ONLY plain English — NO LaTeX ($...$), NO Greek letters, NO math symbols (∈, →, ∑), NO subscripts/superscripts. Write as for a general audience magazine.`}

ZERO JARGON IN ANALOGY (HARD RULE):
All analogy_explanation and "analogy" segment fields must use ONLY ${shortDomain} vocabulary — write as a ${shortDomain} journalist who has never studied math.
- ZERO technical terms (no tensor, vector, function, variable, derivative, integral, equation, parameter, etc.)
- ZERO symbols (no →, ∈, ∑, ∫, $...$, Greek letters, subscripts, LaTeX — only standard English characters)
- Technical concepts are conveyed IMPLICITLY through the story structure, never explicitly
- Test: if a character is not a letter, digit, or basic punctuation (.,;:!?'"-), rewrite the sentence

NARRATIVE STORYTELLING (NOT TERMINOLOGY SOUP):
The analogy_explanation must be a REAL ${shortDomain} STORY — like a documentary, not a glossary:
- Pick ONE famous ${shortDomain} moment/event and build the story around it
- Name 2-3 REAL PEOPLE with FULL NAMES (not just roles like "the quarterback")
- Include REAL dates, scores, statistics (use digits: "February 2, 2002", "21-17")
- Structure: setup → development → climax/resolution (narrative arc)
- ❌ BAD: "The team's offense shifted formation" (generic, no names, no story)
- ✅ GOOD: "On [DATE], [FULL NAME] faced [SITUATION]... [ACTION]... [OUTCOME]"
- The ${shortDomain} fan reading this should recognize the story and be able to verify the facts

CONCEPT_MAP RULES:
Provide AT LEAST 10 concept mappings (Mastery Mode requires 10).
- tech_term: from technical_explanation; analogy_term: from analogy_explanation (${shortDomain} vocabulary, NOT technical)
- six_word_definition: EXACTLY 6 words defining the tech_term in plain English (domain-agnostic, what it IS)
- narrative_mapping: 2-3 sentence vivid mini-story connecting these concepts through a SPECIFIC ${shortDomain} scenario with real names/situations
- causal_explanation: First-principles WHY this analogy works structurally — shared mechanics/patterns, not just surface similarity

CONDENSED VIEW RULES:
The "condensed" object provides a stripped-down, first-principles view of the concept:
- "what": Distill the concept to its PUREST form - one sentence, no jargon, maximum clarity
- "why": Explain when/why someone would use or encounter this - practical relevance
- "bullets": 5 irreducibly simple truths that form the foundation of understanding:
  - Each bullet = ONE atomic insight that can't be simplified further
  - Aim for "Kolmogorov complexity" - the shortest possible description of an essential truth
  - No fluff, no examples - just the core principle
  - If you removed any bullet, understanding would be incomplete
  - Order them from most fundamental to most nuanced

ATTENTION_MAP RULES:
Weights: 1.0=core concepts, 0.8-0.9=important terms, 0.6-0.7=descriptive, 0.4-0.5=common words, 0.1-0.3=function words/connectors.
- Keep multi-word entities as ONE entry: "Tom Brady" not "Tom","Brady"; "gradient descent" not separate words
- Cover ALL content words (nouns, verbs, adjectives) from BOTH explanations — 50-100+ per explanation
- Skip only articles, prepositions, conjunctions

SYMBOL_GUIDE RULES:
- Include ALL symbols from technical_explanation; names must be CONTEXT-SPECIFIC (e.g. if 'A' is a coordinate ring, name it "Coordinate Ring")
- "formula" field: only for symbols in compound expressions (fractions, sums, integrals) — omit for standalone symbols
- For non-STEM topics: return empty array "symbol_guide": []

CRITICAL RULES:
1. Segments MUST cover ALL content from both explanations - no gaps
2. concept_map: tech_term and analogy_term must be DIFFERENT words (never the same)
3. importance_map should include ALL significant terms (15-25 items)
4. attention_map must cover ALL content words (50-100+ per explanation)
5. LaTeX FORMATTING (JSON ESCAPING): use \\\\ not \\ for backslashes
6. Return ONLY valid JSON, no markdown code blocks
7. symbol_guide must have CONTEXT-SPECIFIC names (never generic like "Matrix A" unless it truly is a generic matrix)`;

  // Build search prompt to guide how web results are used
  // For granular domains, constrain to the specific event
  // For general domains, use search to find famous moments to reference
  const searchPromptText = domainGranularity.isGranular
    ? `STRICT REQUIREMENT: Use ONLY facts from these web search results about "${domain}".

The analogy_explanation MUST be about THIS SPECIFIC EVENT: "${domain}"
- Extract the EXACT date, opponent/participants, score/outcome from search results
- Extract SPECIFIC player/character names mentioned in search results
- Extract KEY MOMENTS described in search results

DO NOT use your general knowledge - ONLY use facts explicitly stated in the search results.
The story must be verifiable against the search results provided.`
    : `USE THE WEB SEARCH RESULTS to ground your ${shortDomain} story in REAL history.

REQUIREMENTS:
- Pick ONE famous moment or story from the search results
- Use REAL names of people mentioned in the results (with full names)
- Reference ACTUAL events, dates, scores, or statistics from the results
- The ${shortDomain} fan reading this should recognize the story

Your analogy_explanation must read like a ${shortDomain} documentary featuring REAL people and REAL events.
Do NOT write generic scenarios - use the SPECIFIC historical content from search results.`;

  const text = await callApi(prompt, {
    jsonMode: true,
    webSearch: needsWebSearch,
    searchPrompt: searchPromptText
  });
  return safeJsonParse(text);
};

/**
 * CORE: Generate the essential content users see immediately.
 * Returns: technical_explanation, analogy_explanation, segments, attention_map
 * Designed to be fast (~5-10s with paid model) — core fields only, trimmed prompt.
 */
export const generateAnalogyCore = async (
  topic: string,
  domain: string,
  complexity: number = 50,
  cachedDomainEnrichment?: CachedDomainEnrichment
) => {
  const shortDomain = getShortDomain(domain);
  const complexityInstructions = getComplexityPrompt(complexity, shortDomain);
  const topicIsSTEM = isSTEMTopic(topic);

  const { domainGranularity } = detectGranularitySignals(topic, domain);
  const needsWebSearch = domainGranularity.isGranular;

  const webSearchContext = domainGranularity.isGranular
    ? `CRITICAL - WEB SEARCH REQUIRED: Search for "${domain}" to get real facts (dates, names, scores). Use ONLY search results — do NOT fabricate details.\n\n---\n\n`
    : '';

  const latexInstruction = (topicIsSTEM && complexity !== 5)
    ? 'Include mathematical notation in LaTeX ($...$) where appropriate for formulas and equations.'
    : 'Use PLAIN ENGLISH ONLY - NO mathematical symbols, NO Greek letters, NO LaTeX.';

  const corePrompt = `${webSearchContext}Create a learning module for "${topic}" using "${shortDomain}" as an analogical lens.

TOPIC SCOPING:
- BROAD topics (e.g. "calculus"): Provide an OVERVIEW of the entire field.
- SPECIFIC topics (e.g. "derivatives"): Dive deep into that specific topic.

${complexityInstructions}

REQUIRED JSON STRUCTURE:
{
  "technical_explanation": "${complexity === 5
    ? `Super simple explanation a 5-year-old would understand (1-2 SHORT paragraphs, 80-120 words MAX). Use ONLY words a kindergartener knows. Compare everything to toys, snacks, playgrounds. Make it FUN. Do NOT use \\n or \\\\ for line breaks.`
    : `CONCISE technical explanation (2-3 short paragraphs, 150-250 words MAX). Cover: (1) WHAT - definition with key equation, (2) HOW - core mechanism, (3) WHY it matters. ${latexInstruction} Be DIRECT - no filler. Do NOT use \\n or \\\\ for line breaks.`}",
  "analogy_explanation": "${complexity === 5
    ? `A fun, SHORT story from ${shortDomain} that a kid would love (1-2 paragraphs, 100-150 words MAX). Simple words only. ZERO technical terms.`
    : `A PURE NARRATIVE STORY from REAL ${shortDomain} history. ZERO technical terms — write ONLY in ${shortDomain} vocabulary. The reader should feel like reading a ${shortDomain} documentary. (3-4 paragraphs, 250+ words)`}",
  "segments": [
    {
      "tech": "${complexity === 5 ? 'Simple sentence using kid-friendly words' : 'A single concept from the technical explanation'}",
      "analogy": "${complexity === 5 ? `Matching ${shortDomain} story moment — simple words` : `Corresponding ${shortDomain} narrative moment - PURE ${shortDomain} vocabulary, NO technical terms`}",
      "narrative": "Brief story element (1-2 sentences) with real ${shortDomain} references",
      "intuitions": [
        "First one-liner (under 12 words): '[Tech concept] is like [${shortDomain} analogy]'",
        "Second one-liner - different angle",
        "Third one-liner - the 'aha' moment"
      ]
    }
  ],
  "attention_map": {
    "tech": [ {"word": "significant word or multi-word phrase", "weight": 0.0-1.0} ],
    "analogy": [ {"word": "significant word or multi-word phrase", "weight": 0.0-1.0} ]
  }
}

${topicIsSTEM ? `LaTeX RULES: ALLOWED: $x$, $T_{ij}$, $\\\\frac{a}{b}$, $\\\\sum_{i}$, $\\\\int$, $\\\\alpha$, $\\\\nabla$, $x^2$ — simple inline math only.
FORBIDDEN: \\\\array, \\\\matrix, \\\\begin/\\\\end environments, LaTeX commands as English words, \\n or \\\\\\\\ for line breaks, raw Unicode symbols.` : `NON-STEM: Use ONLY plain English — NO LaTeX, NO Greek letters, NO math symbols.`}

ZERO JARGON IN ANALOGY: All analogy fields must use ONLY ${shortDomain} vocabulary — zero technical terms, zero symbols. Write as a ${shortDomain} journalist.

NARRATIVE STORYTELLING: The analogy must be a REAL ${shortDomain} STORY with 2-3 NAMED people (full names), real dates/scores, and a narrative arc (setup → climax → resolution).

ATTENTION MAP: Weights 1.0=core concepts, 0.8-0.9=important, 0.6-0.7=descriptive, 0.1-0.3=connectors. Keep multi-word entities as ONE entry ("Tom Brady" not "Tom","Brady"). Cover ALL content words from BOTH explanations (50-100+ each).

RULES:
1. Segments MUST cover ALL content from both explanations
2. LaTeX escaping: use \\\\ not \\ for backslashes
3. Return ONLY valid JSON, no markdown code blocks`;

  const searchPromptText = domainGranularity.isGranular
    ? `Use ONLY facts from search results about "${domain}". Extract exact dates, names, scores, key moments.`
    : `Use search results to ground the ${shortDomain} story in REAL history with real names and events.`;

  const text = await callApi(corePrompt, {
    jsonMode: true,
    webSearch: needsWebSearch,
    searchPrompt: searchPromptText
  });
  return safeJsonParse(text);
};

/**
 * ENRICHMENT: Generate metadata for secondary views (concept map, synthesis, context, etc.).
 * Takes the core explanations as context so generated terms match the actual content.
 * Fires in the background after core content is displayed. Does NOT count against free tier.
 */
export const generateAnalogyEnrichment = async (
  topic: string,
  domain: string,
  complexity: number = 50,
  coreResult: { technical_explanation: string; analogy_explanation: string }
) => {
  const shortDomain = getShortDomain(domain);
  const topicIsSTEM = isSTEMTopic(topic);

  const enrichmentPrompt = `Given the following learning content about "${topic}" using "${shortDomain}" as an analogical lens, generate enrichment metadata. All terms in concept_map MUST reference actual words from the provided explanations.

TECHNICAL EXPLANATION:
${coreResult.technical_explanation}

ANALOGY EXPLANATION:
${coreResult.analogy_explanation}

Generate ONLY this JSON:
{
  "concept_map": [
    {
      "id": 0,
      "tech_term": "technical term from the explanation above",
      "analogy_term": "${shortDomain}-native equivalent from the analogy above",
      "six_word_definition": "EXACTLY six words defining the tech_term in plain English",
      "narrative_mapping": "2-3 sentence vivid mini-story showing HOW these concepts connect through ${shortDomain}",
      "causal_explanation": "WHY this mapping works structurally — shared mechanics/patterns",
      "why_it_matters": {
        "connection": "WHY these concepts structurally connect",
        "importance": "WHY understanding this link unlocks deeper understanding",
        "critical": "WHY the system would fail without this concept"
      }
    }
  ],
  "importance_map": [ {"term": "key term", "importance": 0.0-1.0} ],
  "context": {
    "header": "Topic header",
    "emoji": "🎯",
    "why": "2-3 sentences on WHY ${topic} matters, using ${domain || 'everyday life'} vocabulary",
    "real_world": "2-3 sentences with a vivid scenario showing ${topic} in action",
    "narrative": "Punchy one-liner mapping ${topic} to ${domain || 'real life'}"
  },
  "synthesis": {
    "one_liner": "ONE punchy sentence bridging ${topic} and ${domain || 'real life'}",
    "core": "2-3 sentences showing HOW ${topic} connects to ${domain || 'real life'}",
    "deep": "3-4 sentences on WHY this mapping works at a structural level",
    "citation": "A memorable quote or principle"
  },
  "condensed": {
    "what": "One sentence: WHAT this concept is",
    "why": "One sentence: WHY this matters",
    "bullets": ["5 irreducibly simple truths about ${topic}"],
    "mnemonic": {
      "phrase": "Catchy phrase where each word starts with first letter of each bullet",
      "breakdown": ["E = Word → Concept from bullet"]
    }
  },
  "symbol_guide": [${topicIsSTEM ? `
    {
      "symbol": "symbol as written",
      "name": "Context-specific name for THIS topic",
      "meaning": "What it represents in this context",
      "simple": "Plain English explanation",
      "formula": "$LaTeX compound expression$ (only for symbols in fractions/sums/integrals)"${domain ? `,
      "domain_analogy": "One sentence mapping this symbol to ${domain}"` : ''}
    }` : ''}
  ]
}

CONCEPT_MAP RULES:
- Provide AT LEAST 10 concept mappings. tech_term and analogy_term must be DIFFERENT words.
- six_word_definition: EXACTLY 6 words, domain-agnostic, what the concept IS
- narrative_mapping: Use SPECIFIC ${shortDomain} scenarios with real names

CONTEXT must be specifically about "${topic}". Generate ORIGINAL content.
${topicIsSTEM ? '' : `For non-STEM topics: symbol_guide should be an empty array [].`}
${domain ? `SYMBOL domain_analogy: Map each symbol to a SPECIFIC ${domain} moment — visceral, unique, never reuse.` : ''}
importance_map: 15-25 significant terms with weights 0.0-1.0.
Return ONLY valid JSON.`;

  const text = await callApi(enrichmentPrompt, {
    jsonMode: true,
    isEnrichment: true // Don't count against free tier daily limit
  });
  return safeJsonParse(text);
};

/**
 * Generate a semantic word→concept color map via a lightweight second-pass API call.
 * The AI reads the generated explanation texts and the concept list, then returns
 * which words belong to which concept — handling synonyms, abbreviations, and
 * morphological variants that the rule-based stemming system misses.
 *
 * Returns null on any failure (never throws). Caller uses this as a non-blocking
 * overlay on top of the existing fallback coloring system.
 */
export const generateSemanticColorMap = async (
  technicalText: string,
  analogyText: string,
  conceptMap: ConceptMapItem[]
): Promise<{ tech: Map<string, number>; analogy: Map<string, number> } | null> => {
  try {
    if (!technicalText && !analogyText) return null;

    // Truncate texts to keep the request cheap and fast
    const techSlice = (technicalText || '').slice(0, 1500);
    const analSlice = (analogyText || '').slice(0, 1500);

    const hasConceptMap = conceptMap && conceptMap.length > 0;

    let prompt: string;
    if (hasConceptMap) {
      // Mode 1: Concept map exists — tag words to known concepts
      const conceptList = conceptMap.map(c =>
        `${c.id}: "${c.tech_term}" / "${c.analogy_term}"`
      ).join('\n');

      prompt = `You are a word-level concept tagger for a learning app. Given two explanation texts and a numbered concept list, identify which individual words from the texts belong to which concept.

CONCEPTS:
${conceptList}

TECHNICAL TEXT:
${techSlice}

ANALOGY TEXT:
${analSlice}

For each concept, list the INDIVIDUAL words (lowercase, no punctuation) from both texts that semantically relate to that concept. Include:
- The exact words from the concept name (e.g., "singular", "value", "decomposition")
- Synonyms and abbreviations used in the text (e.g., "SVD", "factorize" for decomposition)
- Morphological variants (e.g., "matrices" for "matrix", "decomposed" for "decomposition")
- Domain-specific terms the text uses to explain that concept

Return ONLY this JSON — no other text:
{"concept_colors":[{"id":0,"tech_words":["word1","word2"],"analogy_words":["word3","word4"]},{"id":1,"tech_words":["word5"],"analogy_words":["word6"]}]}

Rules:
- All words lowercase, no punctuation
- Each word belongs to at most ONE concept (pick the most relevant)
- Skip common stop words (the, a, is, are, and, or, it, to, of, in, for, by, etc.)
- Include 3-8 words per concept per text where applicable
- If a concept isn't mentioned in a text, use an empty array for that text`;
    } else {
      // Mode 2: No concept map — identify concepts AND tag words in one shot
      prompt = `You are a concept identifier and word-level tagger for a learning app. Given a technical explanation and its analogy, identify 5-10 key concepts, then tag which words belong to each concept.

TECHNICAL TEXT:
${techSlice}

ANALOGY TEXT:
${analSlice}

Step 1: Identify 5-10 KEY CONCEPTS from the technical text (important ideas, entities, processes).
Step 2: For each concept, find the INDIVIDUAL words (lowercase, no punctuation) in BOTH texts that relate to it.

Return ONLY this JSON — no other text:
{"concept_colors":[{"id":0,"tech_words":["word1","word2"],"analogy_words":["word3","word4"]},{"id":1,"tech_words":["word5"],"analogy_words":["word6"]}]}

Rules:
- Use sequential IDs starting from 0
- All words lowercase, no punctuation
- Each word belongs to at most ONE concept (pick the most relevant)
- Skip common stop words (the, a, is, are, and, or, it, to, of, in, for, by, etc.)
- Include 3-8 words per concept per text where applicable
- Group multi-word terms together: tag each word of "singular value decomposition" under the same concept
- In the analogy text, find the CORRESPONDING words that map to the same concept`;
    }

    const text = await callApi(prompt, { jsonMode: true });
    const result = safeJsonParse(text);
    if (!result || !Array.isArray(result.concept_colors)) return null;

    // Build valid concept ID set for validation
    const validIds = hasConceptMap
      ? new Set(conceptMap.map(c => c.id))
      : new Set(result.concept_colors.map((c: any) => c.id).filter((id: any) => typeof id === 'number'));

    const techMap = new Map<string, number>();
    const analogyMap = new Map<string, number>();

    for (const entry of result.concept_colors) {
      const id = entry.id;
      if (typeof id !== 'number' || !validIds.has(id)) continue;

      if (Array.isArray(entry.tech_words)) {
        for (const word of entry.tech_words) {
          if (typeof word === 'string' && word.length > 1) {
            const cleaned = word.toLowerCase().trim().replace(/[^a-z0-9'-]/g, '');
            if (cleaned && !techMap.has(cleaned)) {
              techMap.set(cleaned, id);
            }
          }
        }
      }
      if (Array.isArray(entry.analogy_words)) {
        for (const word of entry.analogy_words) {
          if (typeof word === 'string' && word.length > 1) {
            const cleaned = word.toLowerCase().trim().replace(/[^a-z0-9'-]/g, '');
            if (cleaned && !analogyMap.has(cleaned)) {
              analogyMap.set(cleaned, id);
            }
          }
        }
      }
    }

    // Only return if we got meaningful results
    if (techMap.size === 0 && analogyMap.size === 0) return null;

    return { tech: techMap, analogy: analogyMap };
  } catch (e) {
    console.warn('Semantic color map generation failed (non-critical):', e);
    return null;
  }
};

/**
 * Check input for ambiguity or typos with enhanced context detection
 */
export const checkAmbiguity = async (text: string, contextType: string): Promise<AmbiguityResult> => {
  const prompt = `You are a search intent classifier for an analogy-based learning app. A user typed: "${text}"
Context: This is a ${contextType} (either a topic they want to LEARN about, or an expert domain they already know).

TASK: Determine if this input needs clarification before we can generate a good analogy. Check ALL of the following:

1. TYPOS & CASING: Fix misspellings and wrong capitalization of known terms.
   - "SVd" → "SVD (Singular Value Decomposition)" (wrong case)
   - "nfll" → "NFL (National Football League)" (misspelling)
   - "basebal" → "Baseball (sport)" (misspelling)
   - "machien learning" → "Machine Learning" (misspelling)
   - "eigan values" → "Eigenvalues (linear algebra)" (misspelling)

2. AMBIGUOUS TERMS: Could refer to multiple distinct, well-known things.
   - "Python" → ["Python (programming language)", "Python (snake species)"]
   - "Apex" → ["Apex Legends (battle royale video game)", "Apex (general term for peak/summit)"]
   - "Hamilton" → ["Hamilton (Broadway musical by Lin-Manuel Miranda)", "Alexander Hamilton (founding father)"]
   - "GOT" → ["Game of Thrones (HBO fantasy TV series)", "Got (past tense of get)"]
   - "Mercury" → ["Mercury (planet)", "Mercury (element)", "Freddie Mercury (musician)"]

3. COMPOUND TERMS WITH YEARS/NUMBERS: These are VERY often ambiguous — a year + topic can mean different things!
   - "NFL 2002" → ["2002 NFL Season (the actual football season)", "NFL 2K2 / Madden 2002 (video game)", "Super Bowl XXXVI (2002 Super Bowl)"]
   - "NBA 2024" → ["2023-24 NBA Season", "NBA 2K24 (video game)", "2024 NBA Draft"]
   - "World Cup 2022" → ["2022 FIFA World Cup (tournament in Qatar)", "FIFA World Cup 2022 (video game)"]
   - "Zelda 2023" → ["Tears of the Kingdom (2023 Zelda game)", "The Legend of Zelda (franchise overview)"]

4. BROAD TOPICS: If the input is very broad, offer focused sub-areas.
   - "Calculus" → ["Differential Calculus (derivatives, rates of change)", "Integral Calculus (areas, accumulation)", "Multivariable Calculus (3D, partial derivatives)"]
   - "Chemistry" → ["Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry", "Biochemistry"]

RULES:
- Set isAmbiguous: true if ANY of the above apply (typo, ambiguity, compound term, or broad topic)
- Format each option as "[Specific Name] (brief clarifying description)"
- Max 4 options, ordered by most likely interpretation first
- "corrected" should be your best single guess if forced to pick one
- For typos with only one obvious correction, still set isAmbiguous: true so user confirms

Return JSON: { "isValid": bool, "isAmbiguous": bool, "options": [string] (max 4), "corrected": string (best guess), "emoji": string (a SINGLE emoji that BEST represents this specific topic/domain - e.g., 🏈 for NFL, 🧬 for genetics, 🎸 for guitar, 🍳 for cooking, 🎮 for gaming, 💻 for programming, ⚽ for soccer, 🎬 for movies, 📐 for geometry. MUST be specific and relevant to the topic, NEVER use generic emojis like ⚡ or 🎯) }

Return ONLY valid JSON, no markdown, no explanation.`;

  try {
    const responseText = await callApi(prompt, { jsonMode: true});
    const result = safeJsonParse(responseText);
    return result || { isValid: true, isAmbiguous: false, corrected: text, emoji: "🧠" };
  } catch {
    return { isValid: true, isAmbiguous: false, corrected: text, emoji: "🧠" };
  }
};

/**
 * Fetch definition for a term
 * Word count targets:
 * - ELI5: 80-100 words (simple, engaging, memorable)
 * - ELI50: 130-150 words (balanced, clear, practical)
 * - ELI100: 220-280 words (graduate-level, formal, dense)
 */
export const fetchDefinition = async (term: string, context: string, level: number, domain?: string) => {
  // Word count and style guidance per level
  const levelConfig = {
    5: {
      name: "ELI5 (Explain like I'm 5)",
      words: "80-100 words",
      style: `TRUE ELI5 - Explain to a curious 5-year-old!

BANNED (using these = failure):
- NO formulas, equations, or math symbols
- NO technical words (algorithm, coefficient, derivative, vector, etc.)
- NO chemical formulas (except H2O)
- NO Greek letters

USE INSTEAD:
- Simple words: big, small, fast, slow, mix, share, push, pull
- Kid comparisons: toys, snacks, playground, animals, colors
- Short sentences. One idea per sentence.
- Make it FUN like a storybook!

EXAMPLES:
- "Modular arithmetic" → "Clock math! After 12 comes 1 again, not 13."
- "Neural network" → "A guessing game that gets better when you tell it 'warmer' or 'colder'."
- "Encryption" → "A secret code only your best friend knows how to read."

Make it click instantly. If a 5-year-old would say "huh?" - simpler!`
    },
    50: {
      name: "Standard (General Audience)",
      words: "130-150 words",
      style: "Balance clarity with substance. Include WHAT it is, WHY it matters, and a practical example. CRITICAL LaTeX rules: ALL math MUST be in $...$ delimiters with proper backslashes. Use $\\mathbf{x}$ not mathbf x, $\\frac{a}{b}$ not frac."
    },
    100: {
      name: "Advanced Academic (Graduate Level)",
      words: "220-280 words",
      style: `TARGET: A graduate student or expert who wants FULL technical depth.

REQUIREMENTS:
- Begin with a FORMAL DEFINITION using precise mathematical/scientific notation in LaTeX
- Include the governing equation, theorem statement, or formal relationship
- Explain the mechanism/proof sketch - HOW and WHY it works at a fundamental level
- Note edge cases, limitations, or common misconceptions
- Reference connections to related advanced concepts

WRITING STYLE: Dense, precise, no hand-holding. Write like a top textbook author - every sentence earns its place. Use domain-specific jargon freely.

CRITICAL LaTeX rules: ALL math MUST be in $...$ delimiters with proper backslashes. Use $\\mathbf{x}$ not mathbf x, $\\frac{a}{b}$ not frac.`
    }
  };

  const config = levelConfig[level as keyof typeof levelConfig] || levelConfig[50];

  // For ELI5, we don't need symbol_guide (no math symbols)
  const includeSymbolGuide = level !== 5;
  const includeDomain = domain && domain.trim() && level !== 5;

  let promptText = `Define "${term}" in context of: "${context}".

LEVEL: ${config.name}
TARGET LENGTH: ${config.words} (IMPORTANT: Don't be terse! Give a substantive explanation)

${config.style}

Return JSON in this EXACT format:
{
  "title": "Concise 2-5 word canonical name for this concept. If the user selected a long phrase, distill it to the proper term (e.g. 'Instantaneous Rate of Change' or 'Derivative'). If a single word, just capitalize it.",
  "definition": "Your definition here...",${includeDomain ? `
  "domain_intuition": "One visceral sentence mapping this ENTIRE concept to ${domain}. Must feel like an 'aha' moment — physical, gut-level, zero jargon. Must be SPECIFICALLY about the concept being defined.",` : ''}
  "symbol_guide": [${includeSymbolGuide ? `
    {
      "symbol": "symbol as written",
      "name": "Context-specific name for THIS definition (not generic)",
      "meaning": "What it represents in THIS context",
      "simple": "Plain English for beginners",
      "formula": "$LaTeX compound expression from your definition$ (only for symbols in fractions/sums/integrals — omit for standalone)"${includeDomain ? `,
      "domain_analogy": "One visceral sentence mapping THIS symbol's role to ${domain}. Reference a SPECIFIC moment, character, or element — never generic."` : ''}
    }
  ` : ''}]
}

SYMBOL_GUIDE RULES:
- Include ONLY symbols that appear in YOUR definition
- Names must be CONTEXT-SPECIFIC (if 'x' is an input value, call it "Input Value", not "Variable X")
- For ELI5 with no math symbols, return empty array: "symbol_guide": []
- The "simple" field should genuinely help beginners understand
- The "formula" field shows the ACTUAL compound expression from your definition — only include when the symbol appears in a fraction, sum, integral, etc.
${includeDomain ? `
DOMAIN_ANALOGY RULES:
- Map each symbol to a specific ${domain} concept — visceral and physical, not abstract
- One sentence maximum, make it hit the gut
- CRITICAL: Every symbol MUST reference a DIFFERENT moment/character/element from ${domain} — NEVER reuse the same analogy
- If the domain is a specific episode, season, or event, reference specific scenes, characters, or plot points unique to it
- NO generic filler — every analogy must be specific to ${domain}

DOMAIN_INTUITION RULES (top-level field):
- One sentence mapping the ENTIRE concept to ${domain}
- Must be DIFFERENT from any individual symbol's domain_analogy
- Must feel like an "aha" moment connecting the abstract to lived ${domain} experience
` : ''}
Return ONLY valid JSON, no markdown code blocks.`;

  try {
    let response = await callApi(promptText, {});

    // Strip markdown code blocks if the API wrapped the response
    response = response.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(response);
      return parsed;
    } catch {
      // If parsing fails, return the raw text as definition (backwards compatibility)
      return { definition: response, symbol_guide: [] };
    }
  } catch {
    return { definition: "Could not load definition.", symbol_guide: [] };
  }
};

/**
 * Generate foundational mapping explanation for a concept
 * Called lazily when user selects a concept in Knowledge Bridge
 * Provides first-principles, pragmatic explanation of why this specific mapping matters
 */
export const generateFoundationalMapping = async (
  techTerm: string,
  analogyTerm: string,
  domainName: string,
  topicName: string,
  importance: number
): Promise<{ foundationalMapping: string }> => {
  const importanceLevel = importance >= 0.7
    ? 'HIGH-importance concept - explain why mastering this specific link accelerates understanding of many related ideas'
    : importance >= 0.4
    ? 'MEDIUM-importance concept - explain how this connection reinforces the overall mental model'
    : 'SUPPORTING concept - explain how this fills in gaps for complete comprehension';

  const prompt = `You are explaining WHY understanding the connection between "${techTerm}" and "${analogyTerm}" (from ${domainName}) matters for learning ${topicName}.

CRITICAL RULES:
1. Use FIRST-ORDER PRINCIPLES - fundamental reasoning from basic truths
2. Be PRAGMATIC - explain real, tangible benefits for the learner
3. NO abstract jargon (NEVER say "foundational", "cornerstone", "key bridge", "unlocks", "essential")
4. NO generic praise (NEVER say "this is important because...", "understanding this will help...")
5. Be SPECIFIC about what becomes easier or what confusion is prevented
6. Write in second person - speak directly to the learner

IMPORTANCE LEVEL: ${Math.round(importance * 100)}% - ${importanceLevel}

EXPLAIN IN 2-3 SENTENCES:
Why does understanding ${techTerm} through the lens of ${analogyTerm} give the learner an advantage? What specific capability do they gain? What specific confusion does this prevent?

EXAMPLES OF GOOD RESPONSES:
- "Once you see that gradients work like water flowing downhill, you stop asking 'which direction?' and start predicting it. The steepest slope in ${domainName} and the steepest slope in optimization are the same instinct."
- "Without this link, learners often confuse velocity with speed. Seeing it through ${analogyTerm} makes the distinction obvious—in ${domainName}, those are clearly different things you track separately."

Return ONLY valid JSON: { "foundationalMapping": "Your 2-3 sentence explanation here" }`;

  try {
    const response = await callApi(prompt, { jsonMode: true});
    const parsed = safeJsonParse(response);
    if (parsed && parsed.foundationalMapping) {
      return { foundationalMapping: parsed.foundationalMapping };
    }
    return { foundationalMapping: '' };
  } catch {
    return { foundationalMapping: '' };
  }
};

/**
 * Get difficulty description for prompt
 */
const getDifficultyPrompt = (difficulty: QuizDifficulty): string => {
  switch (difficulty) {
    case 'easy':
      return 'EASY: Ask a basic factual question about the core concept. Test if the user understands the fundamental definition or purpose.';
    case 'medium':
      return 'MEDIUM: Ask an application question. Test if the user can apply the concept to a simple scenario or identify when it would be used.';
    case 'hard':
      return 'HARD: Ask about relationships between concepts, trade-offs, or why something works the way it does.';
    case 'advanced':
      return 'ADVANCED: Ask about edge cases, limitations, or require synthesizing multiple concepts together.';
    default:
      return 'EASY: Ask a basic factual question about the core concept.';
  }
};

/**
 * Generate quiz question with difficulty and retry support
 */
export const generateQuiz = async (
  topic: string,
  domain: string,
  context: string,
  difficulty: QuizDifficulty = 'easy',
  retryMode?: { concept: string; correctAnswer: string }
): Promise<QuizData | null> => {
  let prompt: string;

  if (retryMode) {
    // Retry mode: Rephrase the same question with same concept and answer
    prompt = `You are creating an educational quiz about "${topic}".

CONTEXT (for reference only):
${context}

RETRY MODE: The user got the previous question wrong. Create a NEW question testing the SAME concept but phrased differently.

Concept being tested: "${retryMode.concept}"
Correct answer concept: "${retryMode.correctAnswer}"

CRITICAL RULES:
1. Ask about the TECHNICAL concept "${topic}" directly
2. The ${domain} analogy is just for context - do NOT ask "what ${domain} thing equals what technical thing"
3. Rephrase the question from a different angle
4. Reword all answer options but keep the same correct answer meaning
5. Shuffle the correct answer position
6. Use LaTeX ($...$) ONLY for mathematical symbols - NOT for prose text!
   - CORRECT: "The value is $x = 5$"
   - WRONG: "$The value is x = 5$"
7. The "analogyBridge" helps the user THINK through their ${domain} knowledge to arrive at the technical answer — NEVER give away which option is correct

Return ONLY this JSON:
{"question": "your question about ${topic}", "options": ["Text option", "Another option", "Third option", "Fourth option"], "correctIndex": 0, "explanation": "why correct", "concept": "${retryMode.concept}", "analogyBridge": {"hint": "1-2 sentence hint reframing the question through ${domain} — help them think, don't reveal the answer", "optionHints": ["${domain} analogy for option A (3-8 words)", "${domain} analogy for B", "${domain} analogy for C", "${domain} analogy for D"]}}`;
  } else {
    // Normal mode: Generate new question with difficulty
    const difficultyPrompt = getDifficultyPrompt(difficulty);

    prompt = `You are creating an educational quiz about "${topic}".

CONTEXT (the ${domain} analogy is for reference to help frame the question):
${context}

${difficultyPrompt}

CRITICAL RULES:
1. Test understanding of the TECHNICAL concept "${topic}" - NOT the analogy
2. DO NOT ask "which ${domain} thing corresponds to X" - that's meaningless
3. Ask questions that someone who understands ${topic} could answer
4. Wrong answers should be plausible but clearly wrong to someone who knows the material
5. The question must make logical sense and have one clearly correct answer
6. Use LaTeX ($...$) ONLY for mathematical symbols and equations - NOT for prose text!
   - CORRECT: "The resulting equation is $x = 10$"
   - WRONG: "$The resulting equation is x = 10$" (entire text in LaTeX breaks rendering)
7. The "analogyBridge" helps the user THINK through their ${domain} knowledge to arrive at the technical answer — NEVER give away which option is correct through the hint

GOOD question example: "What is the derivative of $f(x) = x^2$?"
BAD question example: "Which NFL player is like an eigenvector?" (meaningless)

Return ONLY this JSON:
{"question": "your question with $math$ inline", "options": ["Text with $math$ if needed", "Plain text option", "Another option", "Fourth option"], "correctIndex": 0, "explanation": "why correct", "difficulty": "${difficulty}", "concept": "2-5 word concept name", "analogyBridge": {"hint": "1-2 sentence hint reframing the question through ${domain} — help the user think using their ${domain} knowledge without revealing the answer", "optionHints": ["${domain} analogy for option A (3-8 words)", "${domain} analogy for B", "${domain} analogy for C", "${domain} analogy for D"]}}`;
  }

  try {
    const text = await callApi(prompt, { jsonMode: true});
    const result = safeJsonParse(text);
    if (result) {
      result.difficulty = difficulty;
    }
    return result;
  } catch {
    return null;
  }
};

/**
 * Ask tutor a follow-up question
 */
export const askTutor = async (
  topic: string,
  domain: string,
  query: string,
  conversationContext: string
) => {
  const prompt = `Tutor this user on "${topic}" via analogy "${domain}". Context: ${conversationContext}. Question: "${query}". Keep it short. IMPORTANT: Use plain text only - no mathematical symbols, Greek letters, or LaTeX. Write "cup" not ∪, "in" not ∈, "and" not ∧, "sum" not Σ.`;

  try {
    const response = await callApi(prompt, {});
    // Sanitize math symbols from response (∪ → and, ∈ → in, etc.)
    return stripMathSymbols(response);
  } catch {
    return "Sorry, I couldn't process that question.";
  }
};

/**
 * Check if a topic is too close to the selected analogy domain
 * Returns suggestions for alternative domains if too close
 */
export const checkDomainProximity = async (topic: string, domain: string): Promise<ProximityResult> => {
  const topicLower = topic.toLowerCase().trim();
  const domainLower = domain.toLowerCase().trim();

  // Quick check: exact match or direct substring
  if (topicLower === domainLower ||
      topicLower.includes(domainLower) ||
      domainLower.includes(topicLower)) {
    return getProximityResult(domain, `"${topic}" is essentially the same as your analogy domain "${domain}".`);
  }

  // Find which category the domain belongs to
  let domainCategory: string | null = null;
  for (const [category, data] of Object.entries(DOMAIN_CATEGORIES)) {
    if (data.keywords.some(kw => domainLower.includes(kw) || kw.includes(domainLower))) {
      domainCategory = category;
      break;
    }
  }

  // Check if topic falls in the same category as the domain
  if (domainCategory) {
    const categoryData = DOMAIN_CATEGORIES[domainCategory];
    const topicMatchesCategory = categoryData.keywords.some(kw =>
      topicLower.includes(kw) || kw.includes(topicLower)
    );

    if (topicMatchesCategory) {
      return getProximityResult(domain, `"${topic}" is in the same category as "${domain}" - try learning something outside of ${domainCategory}!`);
    }
  }

  // For edge cases, use LLM to check semantic similarity
  const prompt = `You are checking if a learning topic is too close to an analogy domain for an educational app.

The app explains unfamiliar topics using familiar domains as analogies. If the topic IS the domain, there's no learning bridge to build.

Domain (what user knows): "${domain}"
Topic (what user wants to learn): "${topic}"

Is this topic too close to or essentially the same as the domain?

Examples:
- Domain: "NFL", Topic: "Tom Brady" → TOO CLOSE (Tom Brady is part of NFL)
- Domain: "NFL", Topic: "Quantum Computing" → OK (completely different)
- Domain: "Cooking", Topic: "How recipes work" → TOO CLOSE (recipes are cooking)
- Domain: "Cooking", Topic: "Machine Learning" → OK (different domain)
- Domain: "Chess", Topic: "Opening gambits" → TOO CLOSE (that's chess)
- Domain: "NFL", Topic: "Physics of a football throw" → OK (physics is different, football is just context)

Return ONLY this JSON (no markdown):
{"isTooClose": true/false, "reason": "brief explanation if too close"}`;

  try {
    const responseText = await callApi(prompt, { jsonMode: true});
    const result = safeJsonParse(responseText);

    if (result?.isTooClose) {
      return getProximityResult(domain, result.reason || `"${topic}" is too similar to "${domain}".`);
    }

    return { isTooClose: false };
  } catch {
    // If LLM fails, allow the request (fail open)
    return { isTooClose: false };
  }
};

/**
 * Helper to build proximity result with suggested domains
 */
const getProximityResult = (domain: string, reason: string): ProximityResult => {
  const domainLower = domain.toLowerCase();

  // Find the category for this domain
  for (const [, data] of Object.entries(DOMAIN_CATEGORIES)) {
    if (data.keywords.some(kw => domainLower.includes(kw) || kw.includes(domainLower))) {
      // Filter out the current domain from suggestions
      const suggestions = data.related.filter(d =>
        d.name.toLowerCase() !== domainLower
      ).slice(0, 4);

      return {
        isTooClose: true,
        reason,
        suggestedDomains: suggestions
      };
    }
  }

  // Default suggestions if no category matched
  return {
    isTooClose: true,
    reason,
    suggestedDomains: [
      { name: 'Cooking', emoji: '🍳' },
      { name: 'Music', emoji: '🎵' },
      { name: 'Movies', emoji: '🎬' },
      { name: 'Nature', emoji: '🌿' }
    ]
  };
};

// ============================================
// MASTERY MODE API FUNCTIONS
// ============================================

/**
 * Generate 10 mastery keywords with CONTEXTUAL definitions from concept_map
 * Each keyword has:
 * - 3-word definitions (for Stage 2) - tied to specific story elements
 * - 6-word definitions (for Stage 3) - tied to specific story elements
 * - Both technical and analogy domain definitions
 *
 * CRITICAL: Definitions must reference SPECIFIC players, events, or moments from the story
 */
export const generateMasteryKeywords = async (
  topic: string,
  domain: string,
  conceptMap: ConceptMapItem[],
  importanceMap: ImportanceMapItem[],
  analogyText: string
): Promise<MasteryKeyword[]> => {
  // Sort concept map by importance
  const sortedConcepts = [...conceptMap].map((c, idx) => {
    const importance = importanceMap.find(
      imp => imp.term.toLowerCase().includes(c.tech_term.toLowerCase()) ||
             c.tech_term.toLowerCase().includes(imp.term.toLowerCase())
    )?.importance ?? 0.5;
    return { ...c, importance, originalIndex: idx };
  }).sort((a, b) => b.importance - a.importance);

  // Take top 10 (or all if less than 10)
  const topConcepts = sortedConcepts.slice(0, 10);
  const shortDomain = getShortDomain(domain);

  const prompt = `You are generating mastery keywords for a learning exercise about "${topic}" using "${domain}" as the analogy domain.

THE STORY (use these SPECIFIC details in your definitions):
${analogyText.slice(0, 2000)}

CONCEPT MAPPINGS TO USE:
${topConcepts.map((c, i) => `${i + 1}. "${c.tech_term}" ↔ "${c.analogy_term}"`).join('\n')}

CRITICAL REQUIREMENT: CONTEXTUAL DEFINITIONS
Your definitions must reference SPECIFIC elements from the story above:
- Use ACTUAL NAMES of people/players/characters from the story
- Reference SPECIFIC MOMENTS or events described in the story
- The definition should feel like it's describing THAT story, not a generic concept

EXAMPLE OF WHAT WE WANT:
❌ GENERIC (bad): "Direction of steepest increase"
✅ CONTEXTUAL (good): "Brady scanning rightward finding gaps"

❌ GENERIC (bad): "A framework for measurement"
✅ CONTEXTUAL (good): "Belichick's adaptive defensive scheme"

For each concept mapping, generate TWO sets of definitions:
1. A 3-word definition - tied to the story
2. A 6-word definition - tied to the story

⚠️ UNIQUENESS REQUIREMENT - CRITICAL:
- Each keyword MUST have a UNIQUE definition - NO DUPLICATES ALLOWED
- NO two keywords can share the same techDefinition3, techDefinition6, analogyDefinition3, or analogyDefinition6
- Each concept is DIFFERENT - their definitions must reflect their DISTINCT meanings
- Example of WRONG (duplicate definitions):
  - "vector": "Magnitude and direction defining position"
  - "vector space": "Magnitude and direction defining position" ❌ SAME = BAD
- Example of RIGHT (unique definitions):
  - "vector": "Arrow showing direction magnitude"
  - "vector space": "Collection of all possible vectors" ✅ DIFFERENT = GOOD

SEMANTIC DISTINCTION:
- "vector" vs "vector space" are DIFFERENT concepts - define them differently
- "matrix" vs "transformation" are DIFFERENT concepts - define them differently
- Think about what makes EACH concept unique before writing its definition

CRITICAL RULES:
- Each definition must be EXACTLY the word count specified (3 or 6 words)
- Technical definitions: Core essence in technical terms
- Analogy definitions: MUST reference specific players/events from the story
- Analogy definitions must feel like they're describing the story, not a textbook
- Use NAMES, not generic roles (say "Brady" not "the quarterback")
- Be concise - every word must count
- VERIFY: Before returning, check that NO definitions are duplicated across keywords

Return ONLY this JSON (no markdown):
{
  "keywords": [
    {
      "id": 0,
      "term": "technical term",
      "analogyTerm": "${shortDomain} equivalent term",
      "techDefinition3": "exactly three words",
      "analogyDefinition3": "Name-specific three words",
      "techDefinition6": "exactly six technical words here",
      "analogyDefinition6": "Name-referencing six words here now",
      "importance": 0.95
    }
  ]
}`;

  try {
    const text = await callApi(prompt, { jsonMode: true});
    const result = safeJsonParse(text);

    if (result?.keywords && Array.isArray(result.keywords)) {
      const keywords = result.keywords.map((k: any, idx: number) => ({
        id: k.id ?? idx,
        term: k.term || topConcepts[idx]?.tech_term || '',
        analogyTerm: k.analogyTerm || topConcepts[idx]?.analogy_term || '',
        techDefinition3: k.techDefinition3 || '',
        analogyDefinition3: k.analogyDefinition3 || '',
        techDefinition6: k.techDefinition6 || '',
        analogyDefinition6: k.analogyDefinition6 || '',
        importance: k.importance ?? topConcepts[idx]?.importance ?? 0.5
      }));

      // Post-process: ensure no duplicate definitions
      // Track seen definitions and modify duplicates
      const seenDefs = new Set<string>();
      return keywords.map((kw: MasteryKeyword, _idx: number) => {
        const modified = { ...kw };

        // Check and fix techDefinition6 duplicates
        if (seenDefs.has(modified.techDefinition6.toLowerCase())) {
          modified.techDefinition6 = `${modified.term}: ${modified.techDefinition6.split(' ').slice(0, 4).join(' ')}...`;
        }
        seenDefs.add(modified.techDefinition6.toLowerCase());

        // Check and fix analogyDefinition6 duplicates
        if (seenDefs.has(modified.analogyDefinition6.toLowerCase())) {
          modified.analogyDefinition6 = `${modified.analogyTerm}: ${modified.analogyDefinition6.split(' ').slice(0, 4).join(' ')}...`;
        }
        seenDefs.add(modified.analogyDefinition6.toLowerCase());

        return modified;
      });
    }

    // Smart fallback: generate definitions from existing concept map data
    return topConcepts.map((c, idx) => {
      // Use existing six_word_definition or create from tech_term
      const sixWordDef = c.six_word_definition || `Core concept of ${c.tech_term} explained`;
      const words = sixWordDef.split(/\s+/);
      const threeWordDef = words.slice(0, 3).join(' ') || c.tech_term;

      // Derive analogy definitions from narrative_mapping if available
      let analogyDef6 = '';
      let analogyDef3 = '';

      if (c.narrative_mapping) {
        // Extract first clause from narrative_mapping
        const firstClause = c.narrative_mapping.split(/[.,]/)[0].trim();
        const clauseWords = firstClause.split(/\s+/);
        analogyDef6 = clauseWords.slice(0, 6).join(' ') || `${c.analogy_term} in action here`;
        analogyDef3 = clauseWords.slice(0, 3).join(' ') || c.analogy_term;
      } else {
        // Fallback to analogy_term based definitions
        analogyDef6 = `The ${c.analogy_term} equivalent concept explained`;
        analogyDef3 = c.analogy_term.split(/\s+/).slice(0, 3).join(' ') || c.analogy_term;
      }

      return {
        id: idx,
        term: c.tech_term,
        analogyTerm: c.analogy_term,
        techDefinition3: threeWordDef,
        analogyDefinition3: analogyDef3,
        techDefinition6: sixWordDef,
        analogyDefinition6: analogyDef6,
        importance: c.importance
      };
    });
  } catch (error) {
    console.error('Failed to generate mastery keywords:', error);
    // Smart fallback: use existing concept map data instead of placeholders
    return topConcepts.slice(0, 10).map((c, idx) => {
      const sixWordDef = c.six_word_definition || `Core concept of ${c.tech_term} explained`;
      const threeWordDef = sixWordDef.split(/\s+/).slice(0, 3).join(' ') || c.tech_term;

      let analogyDef6 = '';
      let analogyDef3 = '';

      if (c.narrative_mapping) {
        const firstClause = c.narrative_mapping.split(/[.,]/)[0].trim();
        const clauseWords = firstClause.split(/\s+/);
        analogyDef6 = clauseWords.slice(0, 6).join(' ') || `${c.analogy_term} in action`;
        analogyDef3 = clauseWords.slice(0, 3).join(' ') || c.analogy_term;
      } else {
        analogyDef6 = `The ${c.analogy_term} equivalent explained`;
        analogyDef3 = c.analogy_term.split(/\s+/).slice(0, 3).join(' ') || c.analogy_term;
      }

      return {
        id: idx,
        term: c.tech_term,
        analogyTerm: c.analogy_term,
        techDefinition3: threeWordDef,
        analogyDefinition3: analogyDef3,
        techDefinition6: sixWordDef,
        analogyDefinition6: analogyDef6,
        importance: c.importance
      };
    });
  }
};

/**
 * Regenerate keyword definitions based on the actual mastery story content
 * This ensures definitions reference specific players/events from the generated story
 * NOT from the initial analogy (which might be about different characters)
 */
export const regenerateContextualDefinitions = async (
  topic: string,
  domain: string,
  keywords: MasteryKeyword[],
  masteryStoryContent: string
): Promise<MasteryKeyword[]> => {
  const prompt = `You are updating keyword definitions to match a SPECIFIC story.

THE MASTERY STORY (reference ONLY this story for definitions):
${masteryStoryContent}

KEYWORDS TO UPDATE:
${keywords.map((k, i) => `${i + 1}. "${k.term}" ↔ "${k.analogyTerm}"`).join('\n')}

CRITICAL: Update the analogy definitions to reference SPECIFIC elements from the story above:
- Use ACTUAL NAMES of people/players/characters mentioned in the story
- Reference SPECIFIC MOMENTS or events described in the story
- Definitions should feel like they're describing THAT specific story, not generic concepts

EXAMPLE:
Story mentions "Patrick Mahomes threw to Travis Kelce in the 4th quarter"
❌ GENERIC: "quarterback throwing to receiver"
✅ CONTEXTUAL: "Mahomes finding Kelce's seam"

For each keyword, generate:
1. A 3-word analogy definition (referencing the story)
2. A 6-word analogy definition (referencing the story)

Technical definitions should remain general/accurate.

Return ONLY this JSON (no markdown):
{
  "definitions": [
    {
      "id": 0,
      "techDefinition3": "three word tech",
      "analogyDefinition3": "story-specific three words",
      "techDefinition6": "six word technical definition here",
      "analogyDefinition6": "story-referencing six word definition here"
    }
  ]
}`;

  try {
    const text = await callApi(prompt, { jsonMode: true});
    const result = safeJsonParse(text);

    if (result?.definitions && Array.isArray(result.definitions)) {
      // Merge new definitions with existing keywords
      return keywords.map((keyword, idx) => {
        const newDef = result.definitions.find((d: any) => d.id === idx) || result.definitions[idx];
        if (newDef) {
          return {
            ...keyword,
            techDefinition3: newDef.techDefinition3 || keyword.techDefinition3,
            analogyDefinition3: newDef.analogyDefinition3 || keyword.analogyDefinition3,
            techDefinition6: newDef.techDefinition6 || keyword.techDefinition6,
            analogyDefinition6: newDef.analogyDefinition6 || keyword.analogyDefinition6
          };
        }
        return keyword;
      });
    }

    return keywords; // Return unchanged if parsing fails
  } catch (error) {
    console.error('Failed to regenerate contextual definitions:', error);
    return keywords; // Return unchanged on error
  }
};

/**
 * Evaluate a user's mastery response
 * Stage 1: General understanding, no keywords required
 * Stage 2: Must incorporate 3 of 6 visible keywords
 * Stage 3: Must incorporate 6 of 10 visible keywords
 */
export const evaluateMasteryResponse = async (
  topic: string,
  domain: string,
  stage: MasteryStage,
  userResponse: string,
  availableKeywords: MasteryKeyword[],
  analogyText: string
): Promise<EvaluationResult> => {
  const requiredKeywords = stage === 1 ? 0 : stage === 2 ? 3 : 6;
  const keywordTerms = availableKeywords.map(k => k.term);
  const analogyTerms = availableKeywords.map(k => k.analogyTerm);

  const stageInstructions: Record<MasteryStage, string> = {
    1: `STAGE 1 EVALUATION (Pure Intuition - STRENGTH-BASED PASSING):
The user had NO keywords available. They are explaining "${topic}" purely through ${domain} vocabulary.

THIS IS THE PURE INTUITION STAGE - NO TECHNICAL TERMS EXPECTED OR WANTED.

PASSING CRITERIA (if they hit 2+ of these, they PASS with 70+):
✓ Used ${domain} vocabulary naturally (not technical jargon)
✓ Captured directional correctness (understood the general idea)
✓ Told a coherent narrative/story
✓ Made meaningful analogical connections
✓ Demonstrated intuitive grasp of the concept's essence

⚠️ CRITICAL - WHAT NOT TO DO:
- DO NOT list technical terms in "missedConcepts" - Stage 1 forbids technical jargon
- DO NOT penalize for not mentioning "vector addition", "transformation", "components", etc.
- DO NOT expect ANY technical vocabulary whatsoever
- "missedConcepts" should ONLY contain narrative/storytelling gaps, NOT technical concepts
- If they used technical jargon, that's actually BAD for Stage 1 (defeats the purpose)

WHAT SUCCESS LOOKS LIKE:
- A student who explains tensors as "Tom Brady adjusting to defensive shifts" = PASS
- A student who uses domain metaphors to capture transformation/change = PASS
- A student who shows directional understanding without technical terms = PASS
- Any coherent ${domain} narrative that captures the essence = PASS

"missedConcepts" SHOULD ONLY INCLUDE things like:
- "Could have added more vivid ${domain} details"
- "Narrative lacked a clear beginning/middle/end"
- "Could strengthen the analogy connection"
NEVER include technical terms like "vector", "matrix", "derivative", etc.`,

    2: `STAGE 2 EVALUATION (Guided Recall - 3 of 6 keywords):
The user had these 6 keywords available: ${keywordTerms.slice(0, 6).join(', ')}
(With ${domain} equivalents: ${analogyTerms.slice(0, 6).join(', ')})
- They must incorporate AT LEAST 3 keywords naturally into their narrative
- Evaluate if they correctly integrated these terms
- They should still explain in NARRATIVE STORY form
- Keywords can be used via their ${domain} equivalent terms
- Partial credit for correct intuition with imperfect terminology`,

    3: `STAGE 3 EVALUATION (Full Mastery - 6 of 10 keywords):
The user had all 10 keywords with definitions available:
${keywordTerms.map((t, i) => `- ${t} (${analogyTerms[i]})`).join('\n')}
- They must incorporate AT LEAST 6 keywords naturally into their narrative
- Evaluate technical precision while maintaining narrative flow
- This is the final mastery test - be thorough but fair
- Keywords can be used via their ${domain} equivalent terms`
  };

  const prompt = `You are a smart, concise proctor evaluating a student's understanding of "${topic}" through the lens of "${domain}".

ORIGINAL ANALOGY CONTEXT:
${analogyText.slice(0, 1000)}

${stageInstructions[stage]}

USER'S EXPLANATION:
"${userResponse}"

EVALUATION CRITERIA:
${stage === 1 ? `FOR STAGE 1 (strength-based - NO TECHNICAL EXPECTATIONS):
1. Count their STRENGTHS (narrative quality, domain vocabulary, analogical thinking, directional correctness)
2. If they have 2+ strengths, score 70+ and PASS them
3. DO NOT fail them for missing technical concepts - Stage 1 FORBIDS technical jargon
4. PENALIZE if they used too much technical jargon (wrong approach for Stage 1)
5. "missedConcepts" must be EMPTY or contain only NARRATIVE gaps (not technical terms)
   - WRONG: ["vector addition", "resultant force", "components"]
   - RIGHT: ["could add more vivid imagery", "narrative needed clearer arc"] or []` : `FOR STAGE ${stage}:
1. Did they capture the core concept correctly?
2. Did they use at least ${requiredKeywords} keywords naturally?
3. Is their explanation coherent and demonstrates real understanding?
4. Keywords can appear as technical terms OR their ${domain} equivalents`}

PROCTOR STYLE:
- Be concise and helpful, not verbose
- No hand-holding, but constructive
- Point out what they got right AND what they missed
- ${stage === 1 ? 'Score 70+ if they show 2-3 narrative/analogical strengths' : 'Score fairly: 70+ to pass'}

Detect which keywords from this list appear in their response (check both technical and ${domain} terms):
Technical terms: ${keywordTerms.join(', ')}
${domain} terms: ${analogyTerms.join(', ')}

Return ONLY this JSON:
{
  "score": 0-100,
  "passed": true/false (true if score >= 70),
  "feedback": "2-3 sentences of constructive feedback",
  "keywordsDetected": ["list", "of", "keywords", "they", "used"],
  "missedConcepts": ["key", "concepts", "they", "missed"],
  "strengths": ["what", "they", "did", "well"],
  "intuitions": {
    "insight": "The key understanding they demonstrated in 1-2 sentences",
    "keywordsCaptured": ["keywords", "they", "understood"],
    "strength": "Their strongest point of understanding"
  }
}`;

  try {
    const text = await callApi(prompt, { jsonMode: true});
    const result = safeJsonParse(text);

    if (result) {
      return {
        score: result.score ?? 50,
        passed: result.passed ?? (result.score >= 70),
        feedback: result.feedback ?? 'Unable to evaluate response.',
        keywordsDetected: result.keywordsDetected ?? [],
        missedConcepts: result.missedConcepts ?? [],
        strengths: result.strengths ?? [],
        intuitions: result.intuitions ?? {
          insight: 'Understanding demonstrated.',
          keywordsCaptured: [],
          strength: 'Effort shown.'
        }
      };
    }

    return getDefaultEvaluationResult();
  } catch (error) {
    console.error('Failed to evaluate mastery response:', error);
    return getDefaultEvaluationResult();
  }
};

/**
 * Default evaluation result for error cases
 */
const getDefaultEvaluationResult = (): EvaluationResult => ({
  score: 50,
  passed: false,
  feedback: 'We had trouble evaluating your response. Please try again.',
  keywordsDetected: [],
  missedConcepts: [],
  strengths: [],
  intuitions: {
    insight: 'Unable to extract insights.',
    keywordsCaptured: [],
    strength: 'Unable to determine.'
  }
});

/**
 * Smart keyword detection - checks if keywords appear in text
 * Handles variations, plurals, and analogy equivalents
 */
export const detectKeywordsInText = (
  text: string,
  keywords: MasteryKeyword[]
): string[] => {
  const textLower = text.toLowerCase();
  const detected: string[] = [];

  for (const keyword of keywords) {
    const termLower = keyword.term.toLowerCase();
    const analogyLower = keyword.analogyTerm.toLowerCase();

    // Check for technical term
    if (textLower.includes(termLower)) {
      detected.push(keyword.term);
      continue;
    }

    // Check for analogy term
    if (textLower.includes(analogyLower)) {
      detected.push(keyword.term);
      continue;
    }

    // Check for word stems (simple approach)
    const termStem = termLower.replace(/s$|ing$|ed$|ly$/, '');
    const analogyStem = analogyLower.replace(/s$|ing$|ed$|ly$/, '');

    if (termStem.length > 3 && textLower.includes(termStem)) {
      detected.push(keyword.term);
      continue;
    }

    if (analogyStem.length > 3 && textLower.includes(analogyStem)) {
      detected.push(keyword.term);
      continue;
    }
  }

  return detected;
};

/**
 * Generate a stage-specific mastery story
 * Stage 1: Pure narrative, ZERO technical jargon
 * Stage 2: Same story structure with ~6 technical terms naturally woven in
 * Stage 3: Same story structure with ALL 10 technical terms
 *
 * CRITICAL: Stories must be historically accurate with real teams, players, and moments
 * Web search is ALWAYS enabled for Mastery Mode to ground stories in factual sources
 * This prevents hallucination and ensures causal logic is grounded in real events
 */
export const generateMasteryStory = async (
  topic: string,
  domain: string,
  stage: MasteryStage,
  keywords: MasteryKeyword[],
  previousStory?: string, // For continuity in stages 2-3
  analogyText?: string // Fallback content for Stage 1 if API fails
): Promise<MasteryStory> => {
  // Web search is ALWAYS enabled for Mastery Mode to prevent hallucination
  // We fetch 8 sources to synthesize into factually accurate narratives
  const shortDomain = getShortDomain(domain);

  // Check if domain is granular (specific event) vs general
  const { domainGranularity } = detectGranularitySignals(topic, domain);
  const isGranularDomain = domainGranularity.isGranular;

  // Always use web search for Mastery Mode - this ensures factual grounding
  console.log(`[generateMasteryStory] Stage ${stage} - ALWAYS enabling web search for factual grounding`);
  console.log(`[generateMasteryStory] Domain: "${shortDomain}" (granular: ${isGranularDomain})`);
  if (isGranularDomain) {
    console.log(`[generateMasteryStory] Granular signals: ${domainGranularity.signals.join(', ')}`);
  }

  // Detect domain type for appropriate search queries and fictional vs real framing
  const domainLower = domain.toLowerCase();
  const isFictionalDomain = /\b(show|series|sitcom|anime|cartoon|movie|film|book|novel|manga|comic|video\s*game)\b/i.test(domainLower)
    || /\b(season|episode|s\d+e\d+)\b/i.test(domainLower);

  let granularSearchQueries: string;
  if (/\b(season|episode|ep\b|s\d+e\d+|series|show|sitcom|drama|anime|cartoon)\b/i.test(domainLower)) {
    granularSearchQueries = `1. "${domain} plot summary recap"\n2. "${domain} characters scenes"\n3. "${domain} episode guide synopsis"`;
  } else if (/\b(album|song|track|concert|tour|band|musician)\b/i.test(domainLower)) {
    granularSearchQueries = `1. "${domain} review tracklist"\n2. "${domain} artists performers"\n3. "${domain} release history background"`;
  } else if (/\b(recipe|dish|cook|cuisine|restaurant|chef)\b/i.test(domainLower)) {
    granularSearchQueries = `1. "${domain} recipe ingredients technique"\n2. "${domain} history origin"\n3. "${domain} famous preparation"`;
  } else if (/\b(game\s*\d|match|playoff|championship|super\s*bowl|world\s*cup|tournament)/i.test(domainLower)) {
    granularSearchQueries = `1. "${domain} game results score"\n2. "${domain} key players highlights"\n3. "${domain} date opponent final score"`;
  } else {
    granularSearchQueries = `1. "${domain} summary overview"\n2. "${domain} key details facts"\n3. "${domain} history background"`;
  }

  // Web search context - different prompts for granular (specific event) vs general domains
  // Both get web search, but granular domains are more constrained to the exact event
  const webSearchContext = isGranularDomain
    ? `WEB SEARCH FOR SPECIFIC EVENT ACCURACY:

SEARCH FOR: "${domain}"
Search queries to use:
${granularSearchQueries}

GROUNDING RULES (in priority order):
1. PREFER facts from the search results — if results contain relevant info about "${domain}", use those facts
2. If search results are sparse or irrelevant for "${domain}", supplement with your general knowledge — but keep facts REAL and VERIFIABLE
3. NEVER refuse to generate a story — always produce an engaging narrative
4. NEVER output apologies, refusals, or meta-commentary about search results — just write the story

The story MUST be about "${domain}".
${isFictionalDomain
    ? '- Since this is fictional source material, "facts" means REAL plot points, character names, and storylines from the actual show/film/book/game'
    : '- If search results mention specific people, dates, scores, or events — USE THOSE EXACT FACTS'}

REQUIRED FACTUAL ELEMENTS (from search results OR your knowledge of "${domain}"):
- Specific details about this ${isFictionalDomain ? 'episode/scene/chapter' : 'event'} (names, ${isFictionalDomain ? 'plot points, character actions' : 'dates, scores, outcomes'})
- Names of key ${isFictionalDomain ? 'characters' : 'individuals'} involved
- What actually happened (${isFictionalDomain ? 'storyline, key scenes, dialogue moments' : 'outcome, key moments, significance'})

---

`
    : `CRITICAL - WEB SEARCH FOR HISTORICAL ACCURACY:

SEARCH FOR FAMOUS ${shortDomain} MOMENTS to ground your story in REAL history.
Search queries to use:
1. "famous ${shortDomain} moments history"
2. "legendary ${shortDomain} stories iconic events"
3. "${shortDomain} greatest moments all time"

YOU MUST BASE YOUR STORY ON FACTS FROM THE SEARCH RESULTS:
- Pick ONE specific, REAL event from the search results
- Use ACTUAL names, dates, and outcomes from the search results
- The story must be about something that ACTUALLY HAPPENED
- ${shortDomain} fans should be able to verify the facts you mention

REQUIRED FACTUAL ELEMENTS (from search results):
- The specific event/game/moment (with date if available)
- Full names of key individuals involved
- What actually happened (outcome, score, achievement)
- Why this moment was significant

DO NOT FABRICATE:
- Do NOT invent fictional scenarios or "typical" examples
- Do NOT make up names or events
- Do NOT guess at scores, dates, or outcomes
- If you can't find specific facts, pick a different famous moment from the results

---

`;

  const stageInstructions: Record<MasteryStage, string> = {
    1: `STAGE 1 - THE BIG PICTURE (ZERO TECHNICAL JARGON):
Create a narrative story that explains the CONCEPT of "${topic}" using ONLY ${domain} vocabulary.

NARRATIVE SCOPE: Tell the story of a REAL moment from ${domain} — the overall arc, who was involved, what happened.
${isFictionalDomain
    ? 'Since this is from fictional source material, use REAL plot points, character names, and storylines from the actual show/film/book/game.'
    : 'Use REAL historical facts, people, and events that enthusiasts would recognize.'}

CRITICAL RULES:
- NO technical terms whatsoever - not even simple ones
- The story must capture the ESSENCE of "${topic}" through a ${domain} analogy
- Write as if explaining to someone who only knows ${domain}
- Make it engaging, memorable, and roughly 150-200 words
- The reader should understand the core concept WITHOUT any technical language
- ESTABLISH the setting, the key players, and the overall situation

FORBIDDEN WORDS (never use these in the story):
tensor, vector, scalar, matrix, array, coordinate, dimension, transformation,
covariant, contravariant, derivative, integral, function, variable, equation,
component, index, rank, metric, manifold, space, field, operator, mapping,
linear, nonlinear, invariant, gradient, divergence, curl, differential,
parameter, coefficient, basis, eigenvalue, eigenvector, projection, orthogonal,
limit, infinity, continuous, discrete, rate, slope, tangent, area, curve,
sum, summation, product, series, sequence, convergence

FORBIDDEN SYMBOLS - HARD REQUIREMENT:
⚠️ ZERO SYMBOLS - The story MUST be plain English text only:
- NO arrows: → ← ↔ ⟶ ⇒ ⇔ (write "to", "from", "leads to" instead)
- NO math operators: ∑ ∫ ∂ ∇ × ÷ ± ∞ ≈ ≠ ≤ ≥ (write words instead)
- NO set notation: ∈ ∉ ⊂ ⊃ ∪ ∩ (write "in", "contains", "and" instead)
- NO LaTeX: $...$ blocks, fractions, etc.
- NO subscripts/superscripts: x₁, x², aₙ, etc.
- NO Greek letters: α, β, γ, δ, Δ, θ, π, σ, Σ

HISTORICAL ACCURACY REQUIREMENT (CRITICAL):
- PICK A SPECIFIC GAME/EVENT: Choose a FAMOUS moment from ${domain} history
- NAMED INDIVIDUALS REQUIRED: You MUST name specific people with their actual names
- Reference ACTUAL historical moments with SPECIFIC details: dates, numbers, scores
- Feature at least 2-3 NAMED INDIVIDUALS that ${domain} enthusiasts would recognize`,

    2: `STAGE 2 - ZOOM INTO A SPECIFIC MOMENT (6 TECHNICAL TERMS):

⚠️ MANDATORY CONTINUITY - READ THE PREVIOUS STORY FIRST:
---
${previousStory || '(No previous story - generate fresh)'}
---

CRITICAL CONTINUITY REQUIREMENT:
You are EXPANDING the story above - NOT creating a new one.
- SAME setting/location as the previous story
- SAME people/characters/entities as the previous story
- SAME event/situation/scenario as the previous story
You are zooming INTO a moment from what already exists.
DO NOT switch to a different game, episode, scene, event, or scenario.

NARRATIVE SCOPE: Focus on ONE SPECIFIC MOMENT within the story above.
Example: If Stage 1 was about "Grizzlies vs Spurs series", Stage 2 zooms into:
"In the 4th quarter of Game 3, Tim Duncan posted up Zach Randolph on the left block.
As Duncan made his move, Tony Allen rotated from the weak side..."

TECHNICAL TERMS TO WEAVE IN (use their ${domain} equivalents, with technical term in parentheses):
${keywords.slice(0, 6).map(k => `- "${k.analogyTerm}" (${k.term})`).join('\n')}

CRITICAL RULES:
- MUST continue the EXACT same scenario from the previous story
- The terms should describe what's happening in THIS specific moment
- Use format: "${domain} term (technical term)" when introducing each term
- Roughly 150-200 words
- MAINTAIN the same people/characters from Stage 1 - now show them in action
- The reader should feel like they're watching a replay of one key moment`,

    3: `STAGE 3 - COMPREHENSIVE DEEP DIVE (ALL 10 TECHNICAL TERMS):

⚠️⚠️ ABSOLUTE CONTINUITY REQUIREMENT - THIS IS THE STORY YOU MUST EXPAND:
===================================================================
${previousStory || '(No previous story - generate fresh)'}
===================================================================

🚫 DO NOT CREATE A NEW STORY. You are DEEPENING the story above.
🚫 DO NOT switch to a different game, match, episode, scene, recipe, performance, or event.
🚫 DO NOT introduce new main characters/people who weren't in the previous story.

WHAT YOU MUST DO:
✓ Continue with the EXACT SAME setting from the story above
✓ Feature the EXACT SAME people/characters from the story above
✓ Analyze the EXACT SAME moment in MORE DETAIL
✓ Think of this as "director's commentary" on the scene above

NARRATIVE SCOPE: This is a detailed breakdown of the SAME moment from Stage 2.
Break down EVERY aspect: the setup, the execution, the reactions, the outcome, and the implications.
Example: If Stage 2 was about "Duncan posting up Randolph", Stage 3 provides the complete picture:
"The play began when Parker initiated the entry pass sequence. Duncan's positioning on the left block
created a sealing angle (basis vectors) that forced Randolph into a reactive stance..."

ALL 10 TECHNICAL TERMS - EVERY ONE MUST APPEAR:
${keywords.map(k => `- "${k.analogyTerm}" (${k.term})`).join('\n')}

CRITICAL RULES:
- SAME MOMENT as Stage 2 - you are adding depth, NOT changing the story
- MUST use ALL 10 technical terms - weave each one naturally into the narrative
- Each term should illuminate WHY and HOW things happened
- Use format: "${domain} term (technical term)" for all terms
- LENGTH: 300-400 words - this is the comprehensive mastery version
- The reader should understand the COMPLETE MECHANICS behind the moment
- Show the interconnections between all elements (terms)
- This is the "full replay analysis" that ties everything together`
  };

  const prompt = `${webSearchContext}You are creating a ${domain} narrative story to teach "${topic}" through analogy.

${stageInstructions[stage]}

STORY REQUIREMENTS:
1. Written in present tense, active voice
2. Uses vivid ${domain}-specific imagery and scenarios
3. Captures the ESSENCE of the technical concept through the analogy
4. Engaging and memorable - not dry or academic
5. The ${domain} elements should map directly to the technical concept

HISTORICAL ACCURACY (MANDATORY):
- Feature REAL people, characters, figures, or entities that ${domain} enthusiasts would recognize
- Reference ACTUAL events, moments, episodes, performances, or achievements from ${domain}
- Include SPECIFIC details: ${isFictionalDomain ? 'character names, plot points, episode details, dialogue moments' : 'dates, numbers, statistics, records, achievements'}
- Ground the story in ${domain} ${isFictionalDomain ? 'canon that fans would recognize' : 'history that enthusiasts would recognize'}
${isFictionalDomain
    ? '- Use REAL plot points and characters from the source material — actual episodes, scenes, and storylines'
    : `- NO fictional scenarios — this must reference real ${domain} moments that actually happened`}
- Write as if creating a documentary about ${domain} that happens to explain the technical concept

Return ONLY the story text (no JSON, no explanations, just the story).`;

  try {
    // Build search prompt to guide how web results are used
    // We're getting 8 sources - synthesize them into accurate, verifiable narratives
    const searchPromptText = isGranularDomain
      ? `GROUNDING GUIDANCE: Use these web search results to enrich your story about "${domain}".

The story should be about "${domain}".
- If results contain relevant facts about "${domain}", weave them into your narrative
- If results are NOT relevant to "${domain}", rely on your general knowledge of "${domain}" instead
- The goal is an ACCURATE, ENGAGING story — not a refusal
- NEVER output apologies, meta-commentary about search quality, or "I'm sorry" — just write the story

SYNTHESIS RULES:
- If multiple sources agree on a fact, use it confidently
- If sources disagree, pick the most commonly cited version
- ${isFictionalDomain ? 'For fictional source material, "facts" = real plot points, characters, and storylines from the show/film/book' : 'Keep all facts verifiable — use real names, dates, and outcomes'}`
      : `SYNTHESIZE these 8 web search results to ground your ${shortDomain} story in REAL history.

SYNTHESIS REQUIREMENTS:
- Review all search results to find a FAMOUS, VERIFIABLE moment from ${shortDomain}
- Cross-reference facts across multiple sources for accuracy
- Use REAL names of people mentioned in the results (with full names)
- Reference ACTUAL events, dates, scores, or statistics from the results
- The ${shortDomain} fan reading this should recognize the story

FACT-CHECKING RULES:
- Only use facts that appear in at least one search result
- When sources provide specific numbers (scores, dates, stats), use those EXACT numbers
- Do NOT round, approximate, or "improve" any facts from the sources
- If a detail isn't in the search results, leave it out rather than guessing

Your story must read like a ${shortDomain} documentary featuring REAL people and REAL events.
Do NOT write generic scenarios - use the SPECIFIC historical content from search results.`;

    // Retry logic for short responses
    const MIN_WORD_COUNT: Record<MasteryStage, number> = { 1: 100, 2: 100, 3: 200 };
    const MAX_RETRIES = 2;

    let cleanContent = '';
    let attempts = 0;

    while (attempts < MAX_RETRIES) {
      attempts++;

      const storyContent = await callApi(prompt, {
        webSearch: true, // ALWAYS enable web search for Mastery Mode
        searchPrompt: searchPromptText,
        maxResults: 8 // Fetch 8 sources for comprehensive factual grounding
      });

      // Clean up the response
      cleanContent = storyContent
        .trim()
        .replace(/^["']|["']$/g, '') // Remove surrounding quotes if any
        .replace(/^Story:\s*/i, ''); // Remove "Story:" prefix if any

      // Detect AI refusal patterns (AI followed strict grounding instructions too literally)
      const refusalPatterns = [
        /^I'm sorry/i, /^I cannot/i, /^I apologize/i,
        /^Unfortunately,?\s+I/i, /^I don't have/i,
        /search results.*do not contain/i, /no information about/i,
        /I'm unable to/i, /cannot generate/i, /cannot create/i
      ];
      const isRefusal = refusalPatterns.some(p => p.test(cleanContent));
      if (isRefusal) {
        console.warn(`[generateMasteryStory] Stage ${stage} attempt ${attempts}: AI refusal detected, retrying...`);
        cleanContent = ''; // Force word count check to fail → triggers retry
        if (attempts < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        continue;
      }

      const wordCount = cleanContent.split(/\s+/).filter(Boolean).length;
      const minWords = MIN_WORD_COUNT[stage];

      if (wordCount >= minWords) {
        console.log(`[generateMasteryStory] Stage ${stage} success: ${wordCount} words (min: ${minWords})`);
        break;
      }

      console.warn(`[generateMasteryStory] Stage ${stage} attempt ${attempts}: only ${wordCount} words (min: ${minWords}), retrying...`);

      // Brief pause before retry
      if (attempts < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // If still too short after retries, log warning but continue
    const finalWordCount = cleanContent.split(/\s+/).filter(Boolean).length;
    if (finalWordCount < MIN_WORD_COUNT[stage]) {
      console.warn(`[generateMasteryStory] Stage ${stage}: final word count ${finalWordCount} below minimum ${MIN_WORD_COUNT[stage]}, using anyway`);
    }

    const highlightedTerms = stage === 1
      ? []
      : stage === 2
        ? keywords.slice(0, 6).map(k => k.term)
        : keywords.map(k => k.term);

    return {
      stage,
      content: cleanContent,
      highlightedTerms,
      generatedAt: new Date()
    };
  } catch (error) {
    console.error('Failed to generate mastery story:', error);

    // Tiered fallback strategy using existing content
    const visibleKeywords = stage === 2 ? keywords.slice(0, 6) : keywords;

    // Stage 1: Use existing analogyText (real, quality content!)
    if (stage === 1 && analogyText && analogyText.trim().length > 100) {
      console.log('[generateMasteryStory] Stage 1 fallback: using existing analogyText');
      return {
        stage: 1,
        content: analogyText.trim(),
        highlightedTerms: [],
        generatedAt: new Date()
      };
    }

    // Stage 2-3: Build on previous story if available
    if (stage > 1 && previousStory && previousStory.trim().length > 100) {
      console.log(`[generateMasteryStory] Stage ${stage} fallback: expanding on previous story`);
      const keywordList = visibleKeywords.map(k => `**${k.analogyTerm}** (${k.term})`).join(', ');
      const expansionNote = stage === 2
        ? `\n\nNow, let's introduce the key players: ${keywordList}. These concepts map directly to what we just explored.`
        : `\n\nLet's go deeper into the technical connections: ${keywordList}. Each of these concepts has precise meaning that mirrors the ${domain} dynamics we've been following.`;

      return {
        stage,
        content: previousStory.trim() + expansionNote,
        highlightedTerms: visibleKeywords.map(k => k.term),
        generatedAt: new Date()
      };
    }

    // Final fallback: Error marker for component to handle
    console.error('[generateMasteryStory] No fallback content available - returning error marker');
    return {
      stage,
      content: '[GENERATION_FAILED] We couldn\'t generate the story. Please try regenerating or selecting a different topic.',
      highlightedTerms: [],
      generatedAt: new Date()
    };
  }
};

/**
 * Generate chat response for mastery mode Q&A
 * Has context about: current story, user responses, keyword definitions
 */
export const generateMasteryChatResponse = async (
  topic: string,
  domain: string,
  currentStage: MasteryStage,
  currentStory: string,
  userResponses: string[],
  keywords: MasteryKeyword[],
  chatHistory: MasteryChatMessage[],
  newMessage: string
): Promise<string> => {
  const recentHistory = chatHistory.slice(-6); // Last 6 messages for context

  const prompt = `You are a helpful tutor assisting a student who is learning "${topic}" through ${domain} analogies.

CURRENT STAGE: ${currentStage}
CURRENT STORY THE STUDENT IS READING:
${currentStory}

${userResponses.length > 0 ? `STUDENT'S PREVIOUS RESPONSES:\n${userResponses.map((r, i) => `Stage ${i + 1}: "${r.slice(0, 200)}..."`).join('\n')}` : ''}

AVAILABLE KEYWORDS AND DEFINITIONS:
${keywords.slice(0, currentStage === 1 ? 0 : currentStage === 2 ? 6 : 10).map(k =>
  `- ${k.term} (${k.analogyTerm}): ${currentStage === 3 ? k.techDefinition6 : k.techDefinition3}`
).join('\n')}

RECENT CHAT:
${recentHistory.map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`).join('\n')}

Student's new message: "${newMessage}"

TUTOR GUIDELINES:
- Be helpful, concise, and encouraging
- Use ${domain} vocabulary when explaining
- If they ask about the analogy correctness, validate or correct their understanding
- If they're confused, clarify using both ${domain} and technical perspectives
- Keep responses to 2-4 sentences unless more detail is needed
- Don't give away answers directly - guide them to understanding

Respond as the tutor (just the response, no "Tutor:" prefix):`;

  try {
    const response = await callApi(prompt, {});
    return response.trim();
  } catch (error) {
    console.error('Failed to generate chat response:', error);
    return "I'm having trouble responding right now. Please try asking again.";
  }
};

/**
 * Generate mastery summary after completing all 3 stages
 * Extracts the user's key strengths and unique approach
 */
export const generateMasterySummary = async (
  topic: string,
  domain: string,
  userResponses: { stage1: string; stage2: string; stage3: string },
  intuitions: { stage1: any; stage2: any; stage3: any }
): Promise<{ keyStrength: string; coreIntuition: string; uniqueApproach: string }> => {
  const prompt = `Analyze this student's mastery journey for learning "${topic}" through ${domain} analogies.

STAGE 1 RESPONSE (Pure Intuition - no keywords):
"${userResponses.stage1}"
Intuition extracted: ${intuitions.stage1?.insight || 'N/A'}

STAGE 2 RESPONSE (6 keywords):
"${userResponses.stage2}"
Intuition extracted: ${intuitions.stage2?.insight || 'N/A'}

STAGE 3 RESPONSE (All 10 keywords):
"${userResponses.stage3}"
Intuition extracted: ${intuitions.stage3?.insight || 'N/A'}

As a teacher, provide an encouraging summary of their learning journey:

Return ONLY this JSON:
{
  "keyStrength": "1-2 sentences about what this student did particularly well - be specific about their understanding",
  "coreIntuition": "1-2 sentences about the core insight they demonstrated about ${topic}",
  "uniqueApproach": "1-2 sentences about what made their explanation unique or memorable"
}`;

  try {
    const text = await callApi(prompt, { jsonMode: true});
    const result = safeJsonParse(text);

    if (result) {
      return {
        keyStrength: result.keyStrength || 'Demonstrated solid understanding through analogical reasoning.',
        coreIntuition: result.coreIntuition || `Grasped the fundamental concept of ${topic} through ${domain}.`,
        uniqueApproach: result.uniqueApproach || 'Used personal perspective to make the concept memorable.'
      };
    }

    return getDefaultMasterySummary(topic, domain);
  } catch (error) {
    console.error('Failed to generate mastery summary:', error);
    return getDefaultMasterySummary(topic, domain);
  }
};

const getDefaultMasterySummary = (topic: string, domain: string) => ({
  keyStrength: 'Successfully completed all three stages of mastery verification.',
  coreIntuition: `Demonstrated understanding of ${topic} through ${domain} analogies.`,
  uniqueApproach: 'Applied personal knowledge to explain complex concepts.'
});

// ============================================
// STUDY GUIDE GENERATION
// ============================================

/**
 * Generate a study guide outline — a full topic decomposition mapped through the user's expert domain.
 * Phase 1 of 2: produces the outline with one-liners (fast, cheap — 1 API call).
 * Phase 2 (expandStudyGuideConcept) expands individual sections on demand.
 */
export const generateStudyGuideOutline = async (
  topic: string,
  domain: string,
  depth: StudyGuideDepth = 'core',
  cachedDomainEnrichment?: CachedDomainEnrichment
): Promise<StudyGuideOutline | null> => {
  const shortDomain = getShortDomain(domain);
  const { domainGranularity } = detectGranularitySignals(topic, domain);
  const needsWebSearch = domainGranularity.isGranular;

  const conceptCount = depth === 'core' ? '8-10' : '25-40';
  const categoryInstruction = depth === 'complete'
    ? `Group concepts into logical categories (e.g., "Core Components", "Training Loop", "Advanced Concepts"). Include a "category" field for each concept.`
    : `Do NOT include a "category" field — just list the concepts in logical learning order.`;

  const prompt = `You are a study guide architect. Your job is to decompose the technical topic "${topic}" into its sub-concepts and map EACH one to a hyper-specific element of the expert domain "${domain}".

TASK: Create a study guide with ${conceptCount} concept mappings.

CRITICAL RULES FOR DOMAIN REFERENCES:
- Every analogy_term MUST be hyper-specific to "${shortDomain}" — use REAL names, REAL events, REAL scenarios
- BAD: "The Quarterback (a football player)" — too generic
- GOOD: "The Quarterback (Kurt Warner)" — specific real person
- BAD: "A defensive play" — too vague
- GOOD: "The Tampa 2 Cover Defense (Monte Kiffin's signature scheme)" — specific and real
- The ${shortDomain} fan reading this should immediately recognize every reference
- Each one_liner must blend BOTH the technical meaning AND the domain reference in a single punchy sentence

${categoryInstruction}

${needsWebSearch ? `USE WEB SEARCH to verify real names, events, and facts about "${domain}". Every domain reference must be historically accurate.` : ''}

Return ONLY this JSON (no markdown, no explanation):
{
  "concepts": [
    {
      "id": 1,
      "tech_term": "The technical sub-concept name",
      "analogy_term": "The specific ${shortDomain} element (with real name/event)",
      "one_liner": "A single punchy sentence that tattoos the intuition by blending both domains"${depth === 'complete' ? ',\n      "category": "Category Name"' : ''}
    }
  ]
}`;

  const searchPromptText = needsWebSearch
    ? `USE WEB SEARCH to find REAL facts about "${domain}" — specific names, events, dates, scores. Every ${shortDomain} reference must be verifiable.`
    : undefined;

  try {
    const text = await callApi(prompt, {
      jsonMode: true,
      webSearch: needsWebSearch,
      searchPrompt: searchPromptText
    });
    const result = safeJsonParse(text);

    if (result && result.concepts && Array.isArray(result.concepts)) {
      // Ensure each concept has an id
      const concepts: StudyGuideConcept[] = result.concepts.map((c: any, i: number) => ({
        id: c.id || i + 1,
        tech_term: c.tech_term || `Concept ${i + 1}`,
        analogy_term: c.analogy_term || shortDomain,
        one_liner: c.one_liner || '',
        ...(c.category ? { category: c.category } : {})
      }));

      return {
        topic,
        domain,
        depth,
        concepts,
        generated_at: new Date().toISOString()
      };
    }

    console.error('[generateStudyGuideOutline] Invalid response structure:', result);
    return null;
  } catch (error) {
    console.error('[generateStudyGuideOutline] Failed:', error);
    throw error; // Let the component handle the error (show message, don't count against free tier)
  }
};

/**
 * Expand a single study guide concept into full detail.
 * Phase 2 of 2: triggered on-demand when user clicks to expand an accordion section.
 */
export const expandStudyGuideConcept = async (
  concept: StudyGuideConcept,
  topic: string,
  domain: string,
  cachedDomainEnrichment?: CachedDomainEnrichment
): Promise<StudyGuideDetail | null> => {
  const shortDomain = getShortDomain(domain);
  const { domainGranularity } = detectGranularitySignals(topic, domain);
  const needsWebSearch = domainGranularity.isGranular;

  const prompt = `You are expanding a study guide entry for someone learning "${topic}" through the lens of "${domain}".

CONCEPT TO EXPAND:
- Technical term: "${concept.tech_term}"
- Domain mapping: "${concept.analogy_term}"
- One-liner: "${concept.one_liner}"

Write 4 pieces:

1. tech_explanation: 2-3 clear sentences explaining "${concept.tech_term}" technically. No jargon soup — explain it like the reader is smart but new to this.

2. analogy_explanation: 2-3 sentences explaining this concept THROUGH "${concept.analogy_term}" using hyper-specific ${shortDomain} references. Use REAL names, REAL events, REAL scenarios. The ${shortDomain} fan should feel at home.

3. why_it_maps: 1-2 sentences explaining the STRUCTURAL reason this mapping works. WHY does "${concept.tech_term}" behave like "${concept.analogy_term}"? What shared structure makes this click?

4. key_insight: ONE memorable sentence — the "tattoo" insight that makes this concept stick forever. It should blend both domains.

${needsWebSearch ? `USE WEB SEARCH to verify facts about "${domain}" — real names, real events, real stats.` : ''}

Return ONLY this JSON:
{
  "concept_id": ${concept.id},
  "tech_explanation": "...",
  "analogy_explanation": "...",
  "why_it_maps": "...",
  "key_insight": "..."
}`;

  const searchPromptText = needsWebSearch
    ? `Search for real facts about "${concept.analogy_term}" in the context of "${domain}".`
    : undefined;

  try {
    const text = await callApi(prompt, {
      jsonMode: true,
      webSearch: needsWebSearch,
      searchPrompt: searchPromptText
    });
    const result = safeJsonParse(text);

    if (result) {
      return {
        concept_id: concept.id,
        tech_explanation: result.tech_explanation || 'Technical explanation unavailable.',
        analogy_explanation: result.analogy_explanation || 'Domain explanation unavailable.',
        why_it_maps: result.why_it_maps || 'Structural mapping explanation unavailable.',
        key_insight: result.key_insight || concept.one_liner
      };
    }

    console.error('[expandStudyGuideConcept] Invalid response:', result);
    return null;
  } catch (error) {
    console.error('[expandStudyGuideConcept] Failed:', error);
    throw error;
  }
};
