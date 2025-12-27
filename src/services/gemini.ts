import { DEFAULT_OLLAMA_ENDPOINT, STORAGE_KEYS, DEFAULT_GEMINI_API_KEY, DEFAULT_OPENROUTER_API_KEY, DOMAIN_CATEGORIES } from '../constants';
import { fetchWithRetry, safeJsonParse } from '../utils';
import { AmbiguityResult, QuizData, QuizDifficulty, ProviderConfig, OllamaModel, ProximityResult, MasteryKeyword, EvaluationResult, MasteryStage, ConceptMapItem, ImportanceMapItem, MasteryStory, MasteryChatMessage } from '../types';

// Get stored provider config
const getProviderConfig = (): ProviderConfig => {
  const stored = localStorage.getItem(STORAGE_KEYS.PROVIDER_CONFIG);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Use stored API key if present, otherwise fall back to defaults
      if (parsed.provider === 'google' && !parsed.apiKey) {
        parsed.apiKey = DEFAULT_GEMINI_API_KEY;
      }
      if (parsed.provider === 'openrouter' && !parsed.apiKey) {
        parsed.apiKey = DEFAULT_OPENROUTER_API_KEY;
      }
      return parsed;
    } catch {
      // Fall through to default
    }
  }
  // Default to OpenRouter with Gemini 2.0 Flash (free tier)
  return {
    provider: 'openrouter',
    apiKey: DEFAULT_OPENROUTER_API_KEY,
    model: 'google/gemini-2.0-flash-exp:free',
    ollamaEndpoint: DEFAULT_OLLAMA_ENDPOINT
  };
};

// Build API URL based on provider
const buildApiUrl = (config: ProviderConfig): string => {
  switch (config.provider) {
    case 'google':
      return `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
    case 'openai':
      return 'https://api.openai.com/v1/chat/completions';
    case 'anthropic':
      return 'https://api.anthropic.com/v1/messages';
    case 'ollama':
      return `${config.ollamaEndpoint || DEFAULT_OLLAMA_ENDPOINT}/api/generate`;
    case 'openrouter':
      return 'https://openrouter.ai/api/v1/chat/completions';
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
};

// Build request body based on provider
const buildRequestBody = (prompt: string, config: ProviderConfig, jsonMode: boolean = false): object => {
  switch (config.provider) {
    case 'google':
      return {
        contents: [{ parts: [{ text: prompt }] }],
        ...(jsonMode && { generationConfig: { responseMimeType: "application/json" } })
      };
    case 'openai':
      return {
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        ...(jsonMode && { response_format: { type: 'json_object' } })
      };
    case 'anthropic':
      return {
        model: config.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      };
    case 'ollama':
      return {
        model: config.model,
        prompt: prompt,
        stream: false,
        ...(jsonMode && { format: 'json' })
      };
    case 'openrouter':
      return {
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        ...(jsonMode && { response_format: { type: 'json_object' } })
      };
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
};

// Build headers based on provider
const buildHeaders = (config: ProviderConfig): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  switch (config.provider) {
    case 'openai':
      headers['Authorization'] = `Bearer ${config.apiKey}`;
      break;
    case 'anthropic':
      headers['x-api-key'] = config.apiKey;
      headers['anthropic-version'] = '2023-06-01';
      break;
    case 'openrouter':
      headers['Authorization'] = `Bearer ${config.apiKey}`;
      headers['HTTP-Referer'] = 'https://signal-app.com';
      headers['X-Title'] = 'Signal Analogy Engine';
      break;
  }

  return headers;
};

// Extract response text based on provider
const extractResponseText = (data: any, config: ProviderConfig): string => {
  switch (config.provider) {
    case 'google':
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    case 'openai':
      return data.choices?.[0]?.message?.content || '';
    case 'anthropic':
      return data.content?.[0]?.text || '';
    case 'ollama':
      return data.response || '';
    case 'openrouter':
      return data.choices?.[0]?.message?.content || '';
    default:
      return '';
  }
};

// Unified API call
const callApi = async (prompt: string, jsonMode: boolean = false): Promise<string> => {
  const config = getProviderConfig();
  
  if (!config.apiKey && config.provider !== 'ollama') {
    throw new Error(`No API key configured for ${config.provider}. Please add your API key in Settings.`);
  }

  const url = buildApiUrl(config);
  const headers = buildHeaders(config);
  const body = buildRequestBody(prompt, config, jsonMode);

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  const data = await response.json();
  return extractResponseText(data, config);
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
 */
const getComplexityPrompt = (level: number): string => {
  switch (level) {
    case 5:
      return `IMPORTANT: Write for a 5-year-old child. Use ONLY simple words, short sentences, and fun comparisons. NO technical jargon, NO math notation, NO complex concepts. Make it playful and easy to understand.`;
    case 100:
      return `Write for an advanced academic audience. Include technical depth, mathematical notation where appropriate, precise terminology, and nuanced explanations.`;
    default:
      return `Write for a general adult audience with some familiarity with the subject. Balance clarity with technical accuracy.`;
  }
};

/**
 * Generate analogy content for a topic
 */
export const generateAnalogy = async (topic: string, domain: string, complexity: number = 50) => {
  const complexityInstructions = getComplexityPrompt(complexity);

  const prompt = `Create a comprehensive learning module for "${topic}" using "${domain}" as an analogical lens.

${complexityInstructions}

REQUIRED JSON STRUCTURE (strict compliance):
{
  "technical_explanation": "Thorough technical explanation (2-3 paragraphs, 200+ words). Include mathematical notation in LaTeX ($...$) where appropriate.",
  "analogy_explanation": "Vivid ${domain} analogy that parallels the technical content (2-3 paragraphs, 200+ words). Make it engaging and relatable. Use ${domain}-native vocabulary for concepts, NOT technical terms.",
  "segments": [
    {
      "tech": "A single sentence or concept from the technical explanation",
      "analogy": "The corresponding ${domain} analogy sentence",
      "narrative": "A brief story element (1-2 sentences) that makes this concept memorable"
    }
  ],
  "concept_map": [
    {"id": 0, "tech_term": "technical term from tech text", "analogy_term": "${domain}-native equivalent from analogy text"}
  ],
  "importance_map": [
    {"term": "key term", "importance": 0.0-1.0}
  ],
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
  }
}

CONCEPT_MAP RULES (CRITICAL - THIS IS AN ISOMORPHIC MAPPING):
The concept_map creates an ANALOGICAL ISOMORPHISM - mapping technical concepts to their ${domain} equivalents.
Each mapping should connect a technical term to what a ${domain} expert would call the equivalent concept.

✅ GOOD concept_map examples (for NFL domain):
  - {"tech_term": "Jacobian matrix", "analogy_term": "play-calling chart"}
  - {"tech_term": "partial derivative", "analogy_term": "individual route adjustment"}
  - {"tech_term": "gradient", "analogy_term": "optimal drive direction"}
  - {"tech_term": "eigenvalue", "analogy_term": "key player impact rating"}

❌ BAD concept_map examples (NEVER do this):
  - {"tech_term": "Jacobian matrix", "analogy_term": "Jacobian matrix"} ← WRONG: same term!
  - {"tech_term": "derivative", "analogy_term": "derivative"} ← WRONG: not a ${domain} term!
  - {"tech_term": "matrix", "analogy_term": "mathematical matrix"} ← WRONG: still technical!

The analogy_term MUST be:
1. A term native to ${domain} vocabulary (something a ${domain} fan would recognize)
2. DIFFERENT from the tech_term (never the same word)
3. Functionally equivalent in the analogy (plays the same role)

CRITICAL RULES:
1. Segments MUST cover ALL content from both explanations - no gaps
2. concept_map: tech_term must appear in technical_explanation, analogy_term must appear in analogy_explanation
3. concept_map: analogy_term must NEVER equal tech_term - they must be different words
4. importance_map should include ALL significant terms (15-25 items)
5. LaTeX FORMATTING (CRITICAL - JSON ESCAPING REQUIRED):
   - ALL math MUST be wrapped in dollar signs: $...$
   - In JSON strings, backslashes MUST be doubled: use \\\\ not \\
   - WRONG: "$mathbf{x}$" or "$\\mathbf{x}$"
   - RIGHT: "$\\\\mathbf{x}$", "$\\\\frac{a}{b}$", "$\\\\cdot$"
   - Simple variables don't need backslash: "$x$", "$n$", "$e_i$"
   - Example: encryption "$E(m) = m \\\\cdot s + e$"
6. The analogy should feel natural, not forced
7. Return ONLY valid JSON, no markdown code blocks`;

  const text = await callApi(prompt, true);
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
    const responseText = await callApi(prompt, true);
    const result = safeJsonParse(responseText);
    return result || { isValid: true, isAmbiguous: false, corrected: text, emoji: "⚡" };
  } catch {
    return { isValid: true, isAmbiguous: false, corrected: text, emoji: "⚡" };
  }
};

/**
 * Fetch definition for a term
 */
export const fetchDefinition = async (term: string, context: string, level: number) => {
  let promptText = `Define "${term}" in context of: "${context}". Level: ${level === 5 ? "ELI5 (Explain like I'm 5)" : level === 100 ? "Advanced Academic" : "Concise"}.`;

  if (level === 5) {
    promptText += " STRICT CONSTRAINT: DO NOT use LaTeX. DO NOT use technical jargon. DO NOT use math notation ($...$). Use ONLY simple English analogies and 5-year-old appropriate language. Get to the core essence immediately.";
  } else {
    promptText += " CRITICAL LaTeX rules: ALL math MUST be in $...$ delimiters with proper backslashes. Use $\\mathbf{x}$ not mathbf x, $\\frac{a}{b}$ not frac, $\\cdot$ not cdot. Variables like x, n, e_i should be $x$, $n$, $e_i$.";
  }

  try {
    return await callApi(promptText, false);
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
6. Use LaTeX ($...$) for ALL mathematical notation in questions, options, and explanations

Return ONLY this JSON:
{"question": "your question about ${topic}", "options": ["A", "B", "C", "D"], "correctIndex": 0, "explanation": "why correct", "concept": "${retryMode.concept}"}`;
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
6. Use LaTeX ($...$) for ALL mathematical notation in questions, options, and explanations

GOOD question example: "What is the derivative of $f(x) = x^2$?"
BAD question example: "Which NFL player is like an eigenvector?" (meaningless)

Return ONLY this JSON:
{"question": "your question", "options": ["$option1$", "$option2$", "$option3$", "$option4$"], "correctIndex": 0, "explanation": "why correct", "difficulty": "${difficulty}", "concept": "2-5 word concept name"}`;
  }

  try {
    const text = await callApi(prompt, true);
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
  const prompt = `Tutor this user on "${topic}" via analogy "${domain}". Context: ${conversationContext}. Question: "${query}". Keep it short.`;

  try {
    return await callApi(prompt, false);
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
    const responseText = await callApi(prompt, true);
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
 * Generate 10 mastery keywords with dual definitions from concept_map
 * Each keyword has:
 * - 3-word definitions (for Stage 2)
 * - 6-word definitions (for Stage 3)
 * - Both technical and analogy domain definitions
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

  const prompt = `You are generating mastery keywords for a learning exercise about "${topic}" using "${domain}" as the analogy domain.

CONTEXT (the analogy explanation):
${analogyText.slice(0, 1500)}

CONCEPT MAPPINGS TO USE:
${topConcepts.map((c, i) => `${i + 1}. "${c.tech_term}" ↔ "${c.analogy_term}"`).join('\n')}

For each concept mapping, generate TWO sets of definitions:
1. A 3-word definition (first-principles, core essence) - for Stage 2
2. A 6-word definition (first-principles, core essence) - for Stage 3

CRITICAL RULES:
- Each definition must be EXACTLY the word count specified (3 or 6 words)
- Definitions must capture the CORE ESSENCE (first principles)
- Technical definitions explain what it IS in technical terms
- Analogy definitions explain what it IS in ${domain} terms (NO technical jargon)
- Be concise and precise - every word must count

Return ONLY this JSON (no markdown):
{
  "keywords": [
    {
      "id": 0,
      "term": "technical term",
      "analogyTerm": "${domain} equivalent term",
      "techDefinition3": "exactly three words",
      "analogyDefinition3": "exactly three words",
      "techDefinition6": "exactly six words here now",
      "analogyDefinition6": "exactly six words here now",
      "importance": 0.95
    }
  ]
}`;

  try {
    const text = await callApi(prompt, true);
    const result = safeJsonParse(text);

    if (result?.keywords && Array.isArray(result.keywords)) {
      return result.keywords.map((k: any, idx: number) => ({
        id: k.id ?? idx,
        term: k.term || topConcepts[idx]?.tech_term || '',
        analogyTerm: k.analogyTerm || topConcepts[idx]?.analogy_term || '',
        techDefinition3: k.techDefinition3 || '',
        analogyDefinition3: k.analogyDefinition3 || '',
        techDefinition6: k.techDefinition6 || '',
        analogyDefinition6: k.analogyDefinition6 || '',
        importance: k.importance ?? topConcepts[idx]?.importance ?? 0.5
      }));
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
    1: `STAGE 1 EVALUATION (Pure Intuition):
The user had NO keywords available. They are explaining "${topic}" using their understanding of the "${domain}" analogy.
- Evaluate if they captured the CORE ESSENCE of the concept
- Score generously for directional correctness and intuitive understanding
- They should explain in NARRATIVE STORY form using ${domain} vocabulary
- NO technical jargon expected - this is pure intuition
- Look for: Did they understand the fundamental concept? Can they explain it naturally?`,

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
1. Did they capture the core concept correctly?
2. Is their explanation in narrative/story form (not technical jargon)?
3. ${stage > 1 ? `Did they use at least ${requiredKeywords} keywords naturally?` : 'Did they show intuitive understanding?'}
4. Is their explanation coherent and demonstrates real understanding?

PROCTOR STYLE:
- Be concise and helpful, not verbose
- No hand-holding, but constructive
- Point out what they got right AND what they missed
- Score fairly: 70+ to pass

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
    const text = await callApi(prompt, true);
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
 */
export const generateMasteryStory = async (
  topic: string,
  domain: string,
  stage: MasteryStage,
  keywords: MasteryKeyword[],
  previousStory?: string // For continuity in stages 2-3
): Promise<MasteryStory> => {
  const stageInstructions: Record<MasteryStage, string> = {
    1: `STAGE 1 - PURE NARRATIVE (ZERO TECHNICAL JARGON):
Create a narrative story that explains the CONCEPT of "${topic}" using ONLY ${domain} vocabulary.

CRITICAL RULES:
- NO technical terms whatsoever - not even simple ones
- The story must capture the ESSENCE of "${topic}" through a ${domain} analogy
- Write as if explaining to someone who only knows ${domain}
- Make it engaging, memorable, and roughly 150-200 words
- The reader should understand the core concept WITHOUT any technical language`,

    2: `STAGE 2 - SAME STORY WITH 6 TECHNICAL TERMS:
Take the previous story and LIGHTLY enhance it by naturally weaving in 6 technical terms.

PREVIOUS STORY (maintain this structure):
${previousStory || '(Generate fresh story with terms)'}

TECHNICAL TERMS TO INCLUDE (use their ${domain} equivalents in the story, with technical terms in parentheses):
${keywords.slice(0, 6).map(k => `- "${k.analogyTerm}" (${k.term})`).join('\n')}

CRITICAL RULES:
- Keep 95% of the original story intact
- Naturally insert the 6 terms - don't force them
- When using a term, you may add the technical word in parentheses: "${domain} term (technical term)"
- The story should still read naturally and flow well
- Roughly 150-200 words`,

    3: `STAGE 3 - FULL STORY WITH ALL 10 TECHNICAL TERMS:
Take the previous story and enhance it by naturally weaving in ALL 10 technical terms.

PREVIOUS STORY (maintain this structure):
${previousStory || '(Generate fresh story with all terms)'}

ALL 10 TECHNICAL TERMS TO INCLUDE:
${keywords.map(k => `- "${k.analogyTerm}" (${k.term})`).join('\n')}

CRITICAL RULES:
- Keep the core structure and flow of the story
- Naturally integrate ALL 10 terms
- Use the ${domain} equivalent terms with technical terms in parentheses
- The story should feel cohesive, not like a term-stuffing exercise
- Roughly 180-250 words for the fuller version`
  };

  const prompt = `You are creating a ${domain} narrative story to teach "${topic}" through analogy.

${stageInstructions[stage]}

STORY REQUIREMENTS:
1. Written in present tense, active voice
2. Uses vivid ${domain}-specific imagery and scenarios
3. Captures the ESSENCE of the technical concept through the analogy
4. Engaging and memorable - not dry or academic
5. The ${domain} elements should map directly to the technical concept

Return ONLY the story text (no JSON, no explanations, just the story).`;

  try {
    const storyContent = await callApi(prompt, false);

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
    const response = await callApi(prompt, false);
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
    const text = await callApi(prompt, true);
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
