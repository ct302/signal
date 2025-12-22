import { DEFAULT_OLLAMA_ENDPOINT, STORAGE_KEYS, DEFAULT_GEMINI_API_KEY } from '../constants';
import { fetchWithRetry, safeJsonParse } from '../utils';
import { AmbiguityResult, QuizData, QuizDifficulty, ProviderConfig, OllamaModel } from '../types';

// Get stored provider config
const getProviderConfig = (): ProviderConfig => {
  const stored = localStorage.getItem(STORAGE_KEYS.PROVIDER_CONFIG);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Use stored API key if present, otherwise fall back to default for Google
      if (parsed.provider === 'google' && !parsed.apiKey) {
        parsed.apiKey = DEFAULT_GEMINI_API_KEY;
      }
      return parsed;
    } catch {
      // Fall through to default
    }
  }
  return {
    provider: 'google',
    apiKey: DEFAULT_GEMINI_API_KEY,
    model: 'gemini-2.0-flash',
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
 * Generate analogy content for a topic
 */
export const generateAnalogy = async (topic: string, domain: string) => {
  const prompt = `Create a comprehensive learning module for "${topic}" using "${domain}" as an analogical lens.

REQUIRED JSON STRUCTURE (strict compliance):
{
  "technical_explanation": "Thorough technical explanation (2-3 paragraphs, 200+ words). Include mathematical notation in LaTeX ($...$) where appropriate.",
  "analogy_explanation": "Vivid ${domain} analogy that parallels the technical content (2-3 paragraphs, 200+ words). Make it engaging and relatable.",
  "segments": [
    {
      "tech": "A single sentence or concept from the technical explanation",
      "analogy": "The corresponding ${domain} analogy sentence",
      "narrative": "A brief story element (1-2 sentences) that makes this concept memorable"
    }
  ],
  "concept_map": [
    {"id": 0, "tech_term": "exact term from tech text", "analogy_term": "exact term from analogy text"}
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

CRITICAL RULES:
1. Segments MUST cover ALL content from both explanations - no gaps
2. concept_map terms MUST be exact word matches from the text
3. importance_map should include ALL significant terms (15-25 items)
4. Use LaTeX ($...$) for any mathematical notation
5. The analogy should feel natural, not forced
6. Return ONLY valid JSON, no markdown code blocks`;

  const text = await callApi(prompt, true);
  return safeJsonParse(text);
};

/**
 * Check input for ambiguity or typos
 */
export const checkAmbiguity = async (text: string, contextType: string): Promise<AmbiguityResult> => {
  const prompt = `Analyze user input: "${text}". Context: ${contextType}. Check for typos or ambiguity (e.g., 'nfll' -> 'NFL'). If typo, set isAmbiguous: true and provide corrections in options. Return JSON { "isValid": bool, "isAmbiguous": bool, "options": [string] (max 3), "corrected": string, "emoji": string }. Return ONLY valid JSON.`;

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
    promptText += " Use LaTeX ($...$) for math if applicable.";
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
      return 'EASY difficulty: Basic recall question. Test fundamental understanding with straightforward questions.';
    case 'medium':
      return 'MEDIUM difficulty: Application question. Test ability to apply concepts in simple scenarios.';
    case 'hard':
      return 'HARD difficulty: Connection question. Test understanding of relationships between concepts.';
    case 'advanced':
      return 'ADVANCED difficulty: Synthesis question. Test deep understanding with edge cases or complex scenarios.';
    default:
      return 'EASY difficulty: Basic recall question.';
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
    prompt = `Based on this content about "${topic}" using ${domain} analogy:
${context}

RETRY MODE: The user got the previous question wrong. Create a NEW question testing the SAME concept but with DIFFERENT wording.

Previous concept being tested: "${retryMode.concept}"
The correct answer must still be: "${retryMode.correctAnswer}"

Requirements:
1. Rephrase the question completely - different wording, maybe different angle
2. Reword ALL answer options (but keep the same correct answer concept)
3. Shuffle the position of the correct answer
4. The correct answer meaning must remain "${retryMode.correctAnswer}"

Return JSON:
{
  "question": "rephrased question",
  "options": ["A", "B", "C", "D"],
  "correctIndex": 0-3,
  "explanation": "Why this is correct",
  "concept": "${retryMode.concept}"
}

Return ONLY valid JSON.`;
  } else {
    // Normal mode: Generate new question with difficulty
    const difficultyPrompt = getDifficultyPrompt(difficulty);

    prompt = `Based on this content about "${topic}" using ${domain} analogy:
${context}

Generate a quiz question.

${difficultyPrompt}

Return JSON:
{
  "question": "the question",
  "options": ["A", "B", "C", "D"],
  "correctIndex": 0-3,
  "explanation": "Why correct answer is right",
  "difficulty": "${difficulty}",
  "concept": "the core concept being tested (brief, 2-5 words)"
}

Return ONLY valid JSON.`;
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
