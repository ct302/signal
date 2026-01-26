import { DEFAULT_OLLAMA_ENDPOINT, STORAGE_KEYS, DOMAIN_CATEGORIES, OPENROUTER_FALLBACK_MODELS, RATE_LIMIT_CONFIG } from '../constants';
import { fetchWithRetry, safeJsonParse, ApiError } from '../utils';
import { stripMathSymbols } from '../utils/text';
import { AmbiguityResult, QuizData, QuizDifficulty, ProviderConfig, OllamaModel, ProximityResult, MasteryKeyword, EvaluationResult, MasteryStage, ConceptMapItem, ImportanceMapItem, MasteryStory, MasteryChatMessage, RoutingDecision, EnrichedContext, CachedDomainEnrichment } from '../types';

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
  return {
    provider: 'cloud' as const,
    apiKey: '',
    model: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    ollamaEndpoint: DEFAULT_OLLAMA_ENDPOINT
  };
};

// Validate that API key is present (throws user-friendly error if missing)
const validateApiKey = (config: ProviderConfig): void => {
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
  // Cloud provider - use baseUrl (defaults to OpenRouter)
  const baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
  return `${baseUrl}/chat/completions`;
};

// Options for API calls
interface ApiCallOptions {
  jsonMode?: boolean;
  webSearch?: boolean; // Enable OpenRouter web search plugin
  searchPrompt?: string; // Custom prompt for how to integrate web search results
  maxResults?: number; // Number of web search results (default 3, max 10 for Mastery Mode)
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
    headers['Authorization'] = `Bearer ${config.apiKey}`;
    // OpenRouter-specific headers (ignored by other providers)
    headers['HTTP-Referer'] = 'https://signal-app.com';
    headers['X-Title'] = 'Signal Analogy Engine';
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
        onRetry: (attempt, maxAttempts, waitMs, reason) => {
          console.log(`[callApi] ${reason} - retrying ${attempt}/${maxAttempts} in ${Math.round(waitMs / 1000)}s`);
        }
      }
    );

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
      return `IMPORTANT: Write for a 5-year-old child.
- Use ONLY simple words, short sentences, and fun comparisons
- NO technical jargon, NO math notation, NO complex concepts
- Make it playful, engaging, and memorable
- TARGET LENGTH: 200-250 words for EACH explanation (tech and analogy)
- Focus on WHY this matters and make it stick!`;
    case 100:
      return `IMPORTANT: This is ELI100 - the ADVANCED level for experts who want the FULL picture.

TARGET AUDIENCE: Graduate students, professionals, and experts who want depth, precision, and insight.

DOMAIN INTEGRATION REQUIREMENT:
Your explanation must weave ${domain || 'the chosen domain'} throughout - not as decoration, but as the STRUCTURAL BACKBONE.
Write as if you're an expert who deeply understands BOTH the technical concept AND ${domain || 'the domain'}.
Your voice should sound like: "Just as [${domain || 'domain'} experts] intuitively [do X], this concept formalizes that same logic..."
The ${domain || 'domain'} integration should feel NATURAL, not forced - like you're genuinely passionate about both fields.

REQUIRED STRUCTURE FOR technical_explanation (400-500 words):

1. FORMAL DEFINITION (1 paragraph)
   - Precise mathematical/technical definition with proper LaTeX notation
   - Key equations or formal relationships
   - This IS the advanced level - use real math: $\\\\int$, $\\\\nabla$, $\\\\partial$, matrices, etc.

2. DOMAIN-GROUNDED EXPLANATION (2 paragraphs)
   - Explain the concept THROUGH THE LENS of ${domain || 'the chosen domain'}
   - Show how ${domain || 'domain'} experts intuitively do what this concept formalizes
   - Use ${domain || 'domain'} vocabulary naturally alongside technical terms
   - Make the reader think "Oh, I already understand this from ${domain || 'my domain knowledge'}!"

3. DEEPER INSIGHT - THE "AHA MOMENT" (1 paragraph)
   - A NON-OBVIOUS connection or insight that rewards the advanced learner
   - Something that makes an expert say "I never thought of it that way"
   - Connect to broader patterns, historical context, or surprising applications
   - This is what separates ELI100 from Wikipedia

4. WHERE THIS LEADS (2-3 sentences)
   - What concepts build on this? What doors does understanding this open?
   - Give the learner a roadmap for going deeper

QUALITY BAR: The explanation should feel like a conversation with a brilliant professor who happens to love ${domain || 'the domain'} - not a textbook, not a Wikipedia stub.`;
    default:
      return `Write for a general adult audience with some familiarity with the subject.
- Balance clarity with technical accuracy
- TARGET LENGTH: 280-330 words for EACH explanation (tech and analogy)
- Include WHAT it is, WHY it matters, and a practical example`;
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
  const latexInstruction = topicIsSTEM
    ? 'Include mathematical notation in LaTeX ($...$) where appropriate for formulas and equations.'
    : 'Use PLAIN ENGLISH ONLY - NO mathematical symbols, NO Greek letters (α, β, Σ), NO set notation (∈, ∪, ⊂), NO LaTeX. Write "in" not ∈, "sum" not Σ, "and" not ∧.';

  const prompt = `${webSearchContext}Create a comprehensive learning module for "${topic}" using "${shortDomain}" as an analogical lens.

TOPIC SCOPING - CRITICAL INSTRUCTION:
When the topic is a BROAD FIELD (like "calculus", "physics", "linear algebra", "machine learning", "chemistry"):
- Provide an OVERVIEW of the entire topic - what it IS as a field, its main branches, and its core purpose
- Do NOT arbitrarily pick one subtopic (like only covering "differentiation" when asked about "calculus")
- The header should reflect the ACTUAL topic requested ("Calculus" not "Differentiation")
- Cover the topic at the level of specificity the user requested

When the topic is SPECIFIC (like "derivatives", "Taylor series", "gradient descent"):
- Dive deep into that specific topic as requested

Examples:
- Topic "calculus" → Overview of calculus as a field (limits, derivatives, integrals, their relationship)
- Topic "differentiation" → Deep dive on differentiation specifically
- Topic "neural networks" → Overview of neural network architectures and principles
- Topic "backpropagation" → Deep dive on backpropagation specifically

${complexityInstructions}

REQUIRED JSON STRUCTURE (strict compliance):
{
  "technical_explanation": "Thorough technical explanation (3-4 paragraphs, 250+ words). MUST include: (1) WHAT it is - clear definition and core concept, (2) WHY it matters - its purpose and significance, (3) HOW it works - the mechanism or process. ${latexInstruction} This section is for the TECHNICAL side only - give real substance, not generic word salad.",
  "analogy_explanation": "A PURE NARRATIVE STORY from REAL ${shortDomain} history. ZERO technical terms allowed - write ONLY in ${shortDomain} vocabulary. The reader should feel like they're reading a ${shortDomain} documentary or sports article, NOT a technical explanation. Through this story, they will intuitively understand ${topic} without seeing any technical jargon. (3-4 paragraphs, 250+ words)",
  "segments": [
    {
      "tech": "A single sentence or concept from the technical explanation",
      "analogy": "The corresponding ${shortDomain} narrative moment - written in PURE ${shortDomain} vocabulary with NO technical terms",
      "narrative": "A brief story element (1-2 sentences) with real ${shortDomain} references - NO technical jargon"
    }
  ],
  "concept_map": [
    {
      "id": 0,
      "tech_term": "technical term from tech text",
      "analogy_term": "${shortDomain}-native equivalent from analogy text",
      "six_word_definition": "EXACTLY six words defining the tech_term in plain English (domain-agnostic, describes what it IS)",
      "narrative_mapping": "2-3 sentence vivid mini-story showing HOW these concepts connect through a specific ${shortDomain} scenario. Not generic - use real ${shortDomain} vocabulary and situations.",
      "causal_explanation": "First-principles explanation of WHY this mapping works structurally - what shared mechanics, properties, or patterns make these concepts genuinely analogous (not just superficially similar).",
      "why_it_matters": {
        "connection": "One sentence explaining WHY these two concepts structurally connect—what shared pattern or mechanism links them (not just THAT they connect, but WHY).",
        "importance": "One sentence explaining WHY mastering THIS specific mapping matters for understanding the system—be specific to the tech_term and analogy_term, not generic.",
        "critical": "One sentence explaining WHY the system would fail without this concept—what PURPOSE does it serve, what problem does it solve?"
      }
    }
  ],
  "importance_map": [
    {"term": "key term", "importance": 0.0-1.0}
  ],
  "attention_map": {
    "tech": [
      {"word": "each significant word from technical_explanation", "weight": 0.0-1.0}
    ],
    "analogy": [
      {"word": "each significant word from analogy_explanation", "weight": 0.0-1.0}
    ]
  },
  "context": {
    "header": "Topic header",
    "emoji": "🎯 (single relevant emoji)",
    "why": "2-3 sentences on why this concept matters in real life",
    "real_world": "2-3 sentences with a specific real-world application",
    "narrative": "A memorable one-liner or mental hook for the concept"
  },
  "synthesis": {
    "summary": "2-3 sentence integration of both perspectives",
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
  }
}

${topicIsSTEM ? `LaTeX RULES FOR technical_explanation (SIMPLIFIED - FOLLOW EXACTLY):
ALLOWED LaTeX (use these ONLY):
- Variables and subscripts: $x$, $T_{ij}$, $v^k$
- Greek letters: $\\\\alpha$, $\\\\beta$, $\\\\nabla$, $\\\\partial$
- Simple fractions: $\\\\frac{a}{b}$
- Sums/integrals: $\\\\sum_{i}$, $\\\\int$
- Simple operators: $\\\\times$, $\\\\cdot$, $\\\\rightarrow$, $=$
- Superscripts/subscripts: $x^2$, $a_n$

FORBIDDEN (DO NOT USE):
- \\\\array, \\\\matrix, \\\\begin, \\\\end (these are environments, not inline math)
- \\\\tilde, \\\\hat, \\\\bar as standalone words (wrong: "a \\\\tilde of x")
- Complex nested environments
- Any LaTeX command used as an English word
- NEVER use \\\\in to mean "in" (write the word "in")
- NEVER use \\\\to to mean "to" (write the word "to")

EXAMPLES:
- WRONG: "A tensor is a \\\\array of numbers" or "the \\\\matrix representation"
- WRONG: "apply the \\\\tilde transformation"
- WRONG: "x is \\\\in the set" (use "x is in the set")
- RIGHT: "A tensor is an array of numbers"
- RIGHT: "the transformation $\\\\tilde{T}_{ij}$" (command inside $ delimiters)
- RIGHT: "the metric tensor $g_{\\\\mu\\\\nu}$"

Keep LaTeX simple. When in doubt, use plain English.` : `CRITICAL - NO MATHEMATICAL SYMBOLS (This is NOT a STEM topic):
Since "${topic}" is not a mathematical/scientific topic, use ONLY plain English:
- NO LaTeX: No $...$ blocks, no \\\\frac, \\\\sum, \\\\int, etc.
- NO Greek letters: No α, β, γ, δ, Σ, etc.
- NO set notation: No ∈, ∪, ∩, ⊂, etc. (write "in", "and", "or" instead)
- NO arrows: No →, ←, ⟶ (write "to", "from", "leads to" instead)
- NO subscripts/superscripts: No x₁, x², etc.

EXAMPLES FOR NON-STEM TOPICS:
- WRONG: "The note ∈ the chord" → RIGHT: "The note in the chord"
- WRONG: "Voice leading → resolution" → RIGHT: "Voice leading leads to resolution"
- WRONG: "The ∑ of intervals" → RIGHT: "The sum of intervals"

Write as if for a general audience magazine - clear, readable English only.`}

ABSOLUTE RULE - ZERO TECHNICAL JARGON IN ANALOGY (THIS IS CRITICAL):
The analogy_explanation and all "analogy" fields in segments must contain ZERO technical terminology:
- NO parenthetical technical terms like "(covariant)" or "(tensor)"
- NO technical vocabulary whatsoever - not even simple terms like "function" or "variable"
- ONLY ${shortDomain} vocabulary that a ${shortDomain} enthusiast would use
- Write as if you're a ${shortDomain} journalist writing about ${shortDomain} - you wouldn't mention math!
- The technical concepts should be IMPLICIT through the story structure, not EXPLICIT through terminology

FORBIDDEN WORDS IN ANALOGY (never use these - use ${shortDomain} equivalents only):
tensor, vector, scalar, matrix, array, coordinate, dimension, transformation,
covariant, contravariant, derivative, integral, function, variable, equation,
component, index, rank, metric, manifold, space, field, operator, mapping,
linear, nonlinear, invariant, gradient, divergence, curl, differential,
parameter, coefficient, basis, eigenvalue, eigenvector, projection, orthogonal,
limit, infinity, continuous, discrete, rate, slope, tangent, area, curve,
sum, summation, product, series, sequence, convergence, divergence

FORBIDDEN SYMBOLS IN ANALOGY - THIS IS A HARD REQUIREMENT:
⚠️ ZERO SYMBOLS ALLOWED - The analogy MUST be plain English text only:
- NO arrows of any kind: → ← ↔ ⟶ ⇒ ⇔ (write "to", "from", "leads to" instead)
- NO mathematical operators: ∑ ∫ ∂ ∇ × ÷ ± ∞ ≈ ≠ ≤ ≥ (write words instead)
- NO set notation: ∈ ∉ ⊂ ⊃ ∪ ∩ (write "in", "contains", "and" instead)
- NO LaTeX or math notation: $...$ blocks, \\frac, \\sum, \\int, etc.
- NO subscripts/superscripts: x₁, x², aₙ, etc.
- NO Greek letters: α, β, γ, δ, Δ, θ, π, σ, Σ
- NO special Unicode math characters whatsoever

The analogy text must look like it came from a ${shortDomain} magazine or newspaper article.
If a ${shortDomain} journalist wouldn't write it, don't include it.

EXAMPLE OF WHAT NOT TO DO:
❌ "The quarterback's throw → the receiver" (has arrow symbol)
❌ "Each play ∈ the drive" (has set notation)
❌ "The ∑ of all yards" (has summation symbol)

CORRECT APPROACH:
✅ "The quarterback's throw reached the receiver"
✅ "Each play within the drive"
✅ "The total of all yards"

If you catch yourself writing ANY symbol in the analogy, STOP and rewrite using ONLY plain English words.

CRITICAL: STORY vs TERMINOLOGY SOUP

You MUST write a NARRATIVE STORY with characters, setting, conflict, and resolution.
You must NOT write "terminology soup" - generic vocabulary definitions strung together.

❌ BAD EXAMPLE (terminology soup - NO STORY, just vocabulary):
"A [${shortDomain} term] is a collection of [${shortDomain} term] that [generic action]. The [${shortDomain} term] shows how many [${shortDomain} term] are needed for each [${shortDomain} term]. Each [${shortDomain} term] is defined by the [${shortDomain} term]."

This pattern is BAD because:
- No specific people, names, dates, or events - just generic vocabulary
- Reads like a dictionary/glossary, not a story
- No narrative arc (beginning, middle, end)
- No characters the reader can follow
- Sentences are definitions, not plot points

✅ GOOD STORY STRUCTURE (what you MUST do):
"On [SPECIFIC DATE], [REAL PERSON by name] faced [SPECIFIC SITUATION]. As [EVENT UNFOLDED], [PERSON] noticed [OBSERVATION]. [ACTION TAKEN]. [REACTION/CONSEQUENCE]. This [OUTCOME] became [SIGNIFICANCE]."

This pattern is GOOD because:
- Opens with specific date/time anchoring the story
- Names a real person the reader can look up
- Describes a specific situation with stakes
- Has cause and effect (action → reaction)
- Ends with resolution or significance
- Reads like a documentary or journalism piece

FOR ${shortDomain} SPECIFICALLY:
Think of a FAMOUS moment, person, or event from ${shortDomain} history. Build your story around that real moment. The reader should be able to verify the facts you mention.

NARRATIVE STORYTELLING REQUIREMENT:
The analogy_explanation must read like a ${shortDomain} DOCUMENTARY - real people, real events, real moments:

CRITICAL - NAMED INDIVIDUALS REQUIRED:
- You MUST name specific PEOPLE (with full names), not just organizations/teams/groups
- ❌ WRONG: "The Raiders' offense shifted formation" (no individual named)
- ✅ RIGHT: "Rich Gannon dropped back, scanning the field as Jerry Rice cut across the middle"
- ❌ WRONG: "The chef prepared the dish" (generic role, no name)
- ✅ RIGHT: "Julia Child lifted the copper pan, letting the butter foam and sizzle"
- The story must feature at least 2-3 NAMED INDIVIDUALS that ${shortDomain} enthusiasts would recognize

SPECIFIC DETAILS REQUIRED:
- PICK A SPECIFIC MOMENT: Choose ONE memorable event, performance, or turning point from ${shortDomain}
- Use REAL names: actual people WITH THEIR NAMES (not just roles like "the quarterback" or "the chef")
- Use REAL events: actual moments that happened and can be verified
- Use REAL details: specific dates, scores, statistics, or measurable facts
- NEVER use generic phrases - always reference SPECIFIC ${shortDomain} moments
- Tell a STORY that happens to teach the concept through its structure
- The story needs a NARRATIVE ARC: setup, development, climax/resolution

CONCEPT_MAP RULES:
The concept_map creates a vocabulary mapping between technical terms and ${shortDomain} terms.
IMPORTANT: You MUST provide AT LEAST 10 concept mappings for comprehensive coverage (Mastery Mode requires 10).
- tech_term: appears in technical_explanation
- analogy_term: appears in analogy_explanation (must be ${shortDomain} vocabulary, NOT technical)
- six_word_definition: EXACTLY 6 words that define the tech_term in plain English. This is domain-agnostic (same definition regardless of analogy domain). Focus on WHAT the concept IS, not what it does. Examples:
  - "tensor components" → "Numbers describing multi-directional physical quantities"
  - "covariant derivative" → "Rate of change respecting curved space"
  - "eigenvalue" → "Scaling factor for special direction vectors"
- narrative_mapping: A 2-3 sentence VIVID MINI-STORY showing HOW these concepts connect through a SPECIFIC ${shortDomain} scenario. NOT generic templates - use real ${shortDomain} vocabulary, names, situations. The reader should think "Oh, THAT'S what it means!" Examples:
  - Bad: "defensive assignments is like tensor components because they both track multiple things"
  - Good: "When Monte Kiffin designed the Tampa 2, each defender's gap responsibility was a component in his defensive tensor—change one assignment, and the entire coverage matrix shifts."
- causal_explanation: First-principles reasoning for WHY this analogy works at a deep structural level. Not just "they're similar" but the underlying mechanics that make them genuinely isomorphic. What shared patterns, constraints, or dynamics do both concepts obey? Examples:
  - Bad: "Both involve tracking multiple things"
  - Good: "Both systems must satisfy a conservation constraint - in tensors, component transformations preserve magnitude; in zone defense, assignment shifts must preserve total coverage. The math of 'nothing leaks through' is identical."

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

ATTENTION_MAP RULES (CRITICAL FOR VISUAL HIGHLIGHTING):
The attention_map provides word-level importance weights for the attention-based highlighting system.
This simulates transformer attention - showing which words carry semantic weight vs. which are just connectors.

WEIGHT GUIDELINES:
- 1.0: Core concept terms, key technical vocabulary, central ideas (e.g., "derivative", "quarterback", "algorithm")
- 0.8-0.9: Important supporting terms, action verbs central to meaning (e.g., "calculates", "intercepted", "transforms")
- 0.6-0.7: Descriptive words that add meaning (e.g., "instantaneous", "crucial", "complex")
- 0.4-0.5: Common verbs and adjectives (e.g., "shows", "different", "important")
- 0.2-0.3: Generic words with low semantic load (e.g., "very", "also", "just", "really")
- 0.1: Function words / connectors (e.g., "the", "a", "is", "in", "of", "and", "to", "with", "that")

MULTI-WORD ENTITY RULE (CRITICAL):
Keep multi-word entities as SINGLE entries - they are ONE semantic unit:
- Full names: "Tom Brady" (not separate "Tom" and "Brady")
- Compound terms: "running back", "offensive line", "gradient descent"
- Technical phrases: "covariant derivative", "Taylor series", "neural network"
- Place names: "Gillette Stadium", "New England"
- Team names: "New England Patriots" or just "Patriots"
Examples:
  {"word": "Tom Brady", "weight": 0.9}
  {"word": "gradient descent", "weight": 1.0}
  {"word": "Super Bowl", "weight": 0.85}

REQUIREMENTS:
- Include EVERY content word from both explanations (not just key terms)
- For technical_explanation: cover ALL nouns, verbs, adjectives (50-100+ words)
- For analogy_explanation: cover ALL nouns, verbs, adjectives (50-100+ words)
- Skip only: articles (a, an, the), prepositions (in, on, at, of), conjunctions (and, or, but)
- Multi-word entities count as ONE entry (e.g., "Tom Brady" = 1 entry, not 2)
- Proper nouns (names, places) should be 0.7-0.9 depending on centrality to the narrative

CRITICAL RULES:
1. Segments MUST cover ALL content from both explanations - no gaps
2. concept_map: tech_term and analogy_term must be DIFFERENT words (never the same)
3. importance_map should include ALL significant terms (15-25 items)
4. attention_map must cover ALL content words (50-100+ per explanation)
5. LaTeX FORMATTING (JSON ESCAPING): use \\\\ not \\ for backslashes
6. Return ONLY valid JSON, no markdown code blocks`;

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
 * Check input for ambiguity or typos with enhanced context detection
 */
export const checkAmbiguity = async (text: string, contextType: string): Promise<AmbiguityResult> => {
  const prompt = `Analyze user input for an analogy-based learning app: "${text}"
Context type: ${contextType}

Your task:
1. Check for TYPOS: If the input appears to be a misspelling, suggest corrections
2. Check for AMBIGUITY: If the input could refer to multiple distinct things, list them with brief descriptions

IMPORTANT: For ambiguous inputs, format each option as "[Name] (brief description)" to help user choose.

Examples of ambiguous inputs:
- "King of Queens" → ["The King of Queens (TV sitcom with Kevin James)", "King (playing card rank in Queens deck)"]
- "GOT" → ["Game of Thrones (HBO fantasy TV series)", "Got (English verb, past tense of 'get')"]
- "Python" → ["Python (programming language)", "Python (snake species)"]
- "Apex" → ["Apex Legends (video game)", "Apex (general term for peak/summit)"]
- "Hamilton" → ["Hamilton (Broadway musical)", "Hamilton (founding father Alexander Hamilton)"]

Examples of typos:
- "nfll" → options: ["NFL (National Football League)"]
- "basebal" → options: ["Baseball (sport)"]

Only set isAmbiguous: true if:
1. There's a likely typo that needs correction, OR
2. The input genuinely refers to multiple well-known distinct things

Return JSON: { "isValid": bool, "isAmbiguous": bool, "options": [string] (max 4 options with descriptions), "corrected": string (best guess), "emoji": string (relevant emoji) }

Return ONLY valid JSON, no other text.`;

  try {
    const responseText = await callApi(prompt, { jsonMode: true });
    const result = safeJsonParse(responseText);
    return result || { isValid: true, isAmbiguous: false, corrected: text, emoji: "⚡" };
  } catch {
    return { isValid: true, isAmbiguous: false, corrected: text, emoji: "⚡" };
  }
};

/**
 * Fetch definition for a term
 * Word count targets:
 * - ELI5: 80-100 words (simple, engaging, memorable)
 * - ELI50: 130-150 words (balanced, clear, practical)
 * - ELI100: 150-180 words (thorough, technical, precise)
 */
export const fetchDefinition = async (term: string, context: string, level: number) => {
  // Word count and style guidance per level
  const levelConfig = {
    5: {
      name: "ELI5 (Explain like I'm 5)",
      words: "80-100 words",
      style: `STRICT RULES FOR ELI5:
- NO technical terms AT ALL. If you write "modulus", "congruent", "algorithm", "cryptography" - you've failed.
- NO math notation or LaTeX
- Use everyday language a non-expert would actually say
- Be creative! Don't default to "imagine you're a child with toys"
- Just explain it SIMPLY and CLEARLY

GOOD ELI5 examples:
- "Modular arithmetic" → "It's clock math. After 12 comes 1 again, not 13. Numbers wrap around."
- "Neural network" → "A guessing machine that gets better by being told when it's wrong."
- "Encryption" → "Scrambling a message so only the right person can unscramble it."

Make it click instantly. No textbook voice.`
    },
    50: {
      name: "Standard (General Audience)",
      words: "130-150 words",
      style: "Balance clarity with substance. Include WHAT it is, WHY it matters, and a practical example. CRITICAL LaTeX rules: ALL math MUST be in $...$ delimiters with proper backslashes. Use $\\mathbf{x}$ not mathbf x, $\\frac{a}{b}$ not frac."
    },
    100: {
      name: "Advanced Academic",
      words: "150-180 words",
      style: "Include technical depth, mathematical notation where appropriate, precise terminology, and nuanced explanations. Cover the concept thoroughly with WHAT/WHY/HOW. CRITICAL LaTeX rules: ALL math MUST be in $...$ delimiters with proper backslashes."
    }
  };

  const config = levelConfig[level as keyof typeof levelConfig] || levelConfig[50];

  let promptText = `Define "${term}" in context of: "${context}".

LEVEL: ${config.name}
TARGET LENGTH: ${config.words} (IMPORTANT: Don't be terse! Give a substantive explanation)

${config.style}`;

  try {
    return await callApi(promptText);
  } catch {
    return "Could not load definition.";
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

Return ONLY this JSON:
{"question": "your question about ${topic}", "options": ["Text option", "Another option", "Third option", "Fourth option"], "correctIndex": 0, "explanation": "why correct", "concept": "${retryMode.concept}"}`;
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

GOOD question example: "What is the derivative of $f(x) = x^2$?"
BAD question example: "Which NFL player is like an eigenvector?" (meaningless)

Return ONLY this JSON:
{"question": "your question with $math$ inline", "options": ["Text with $math$ if needed", "Plain text option", "Another option", "Fourth option"], "correctIndex": 0, "explanation": "why correct", "difficulty": "${difficulty}", "concept": "2-5 word concept name"}`;
  }

  try {
    const text = await callApi(prompt, { jsonMode: true });
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
    const response = await callApi(prompt);
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
    const responseText = await callApi(prompt, { jsonMode: true });
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
    const text = await callApi(prompt, { jsonMode: true });
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

    // Fallback: generate basic keywords from concept map
    return topConcepts.map((c, idx) => ({
      id: idx,
      term: c.tech_term,
      analogyTerm: c.analogy_term,
      techDefinition3: 'Core concept here',
      analogyDefinition3: 'Core meaning here',
      techDefinition6: 'The fundamental essence of this concept',
      analogyDefinition6: 'The fundamental essence in domain terms',
      importance: c.importance
    }));
  } catch (error) {
    console.error('Failed to generate mastery keywords:', error);
    // Return basic fallback
    return topConcepts.slice(0, 10).map((c, idx) => ({
      id: idx,
      term: c.tech_term,
      analogyTerm: c.analogy_term,
      techDefinition3: 'Core concept here',
      analogyDefinition3: 'Core meaning here',
      techDefinition6: 'The fundamental essence of this concept',
      analogyDefinition6: 'The fundamental essence in domain terms',
      importance: c.importance
    }));
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
    const text = await callApi(prompt, { jsonMode: true });
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
    const text = await callApi(prompt, { jsonMode: true });
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
  previousStory?: string // For continuity in stages 2-3
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

  // Web search context - different prompts for granular (specific event) vs general domains
  // Both get web search, but granular domains are more constrained to the exact event
  const webSearchContext = isGranularDomain
    ? `CRITICAL - WEB SEARCH FOR SPECIFIC EVENT ACCURACY:

SEARCH FOR THIS SPECIFIC EVENT: "${domain}"
Search queries to use:
1. "${domain} game results score"
2. "${domain} key players highlights"
3. "${domain} date opponent final score"

YOU MUST USE ONLY FACTS FROM THE SEARCH RESULTS.
- The story MUST be about THIS EXACT EVENT - "${domain}"
- Do NOT use generic knowledge about this domain
- Do NOT fabricate or guess any details
- If search results mention specific people, dates, scores, or events - USE THOSE EXACT FACTS

REQUIRED FACTUAL ELEMENTS (extract from search results):
- Specific date of the event
- Names of key individuals involved (WITH FULL NAMES)
- Specific outcome/result (scores, statistics, achievements)
- Key moments that happened during this specific event

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

NARRATIVE SCOPE: Tell the story of a GAME/MATCH/EVENT - the overall arc, who was involved, what happened.
Example: "The 2011 playoff series between the Grizzlies and Spurs..." - broad strokes, key players, the outcome.

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
- Include SPECIFIC details: dates, numbers, statistics, records, achievements
- Ground the story in ${domain} history that enthusiasts would recognize
- NO fictional scenarios - this must reference real ${domain} moments that actually happened
- Write as if creating a documentary about ${domain} that happens to explain the technical concept

Return ONLY the story text (no JSON, no explanations, just the story).`;

  try {
    // Build search prompt to guide how web results are used
    // We're getting 8 sources - synthesize them into accurate, verifiable narratives
    const searchPromptText = isGranularDomain
      ? `STRICT REQUIREMENT: Synthesize facts from these 8 web search results about "${domain}".

The story MUST be about THIS SPECIFIC EVENT: "${domain}"
- Cross-reference the search results to extract VERIFIED facts
- Use the EXACT date, opponent/participants, score/outcome from search results
- Extract SPECIFIC player/character names mentioned in search results
- Extract KEY MOMENTS described in search results

SYNTHESIS RULES:
- If multiple sources agree on a fact, use it confidently
- If sources disagree, pick the most commonly cited version
- NEVER fabricate details that don't appear in the search results
- The story must be verifiable against the search results provided.`
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

    const storyContent = await callApi(prompt, {
      webSearch: true, // ALWAYS enable web search for Mastery Mode
      searchPrompt: searchPromptText,
      maxResults: 8 // Fetch 8 sources for comprehensive factual grounding
    });

    // Clean up the response
    const cleanContent = storyContent
      .trim()
      .replace(/^["']|["']$/g, '') // Remove surrounding quotes if any
      .replace(/^Story:\s*/i, ''); // Remove "Story:" prefix if any

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
    // Return fallback story
    return {
      stage,
      content: `Imagine ${topic} as a ${domain} scenario. The fundamental principles work similarly to what you already know from ${domain}.`,
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
    const response = await callApi(prompt);
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
    const text = await callApi(prompt, { jsonMode: true });
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
