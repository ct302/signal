import { API_KEY, GEMINI_API_URL } from '../constants';
import { fetchWithRetry, safeJsonParse } from '../utils';
import { AmbiguityResult, QuizData } from '../types';

const buildUrl = () => `${GEMINI_API_URL}?key=${API_KEY}`;

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
5. The analogy should feel natural, not forced`;

  const response = await fetchWithRetry(buildUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });

  const data = await response.json();
  return safeJsonParse(data.candidates?.[0]?.content?.parts?.[0]?.text);
};

/**
 * Check input for ambiguity or typos
 */
export const checkAmbiguity = async (text: string, contextType: string): Promise<AmbiguityResult> => {
  const prompt = `Analyze user input: "${text}". Context: ${contextType}. Check for typos or ambiguity (e.g., 'nfll' -> 'NFL'). If typo, set isAmbiguous: true and provide corrections in options. Return JSON { "isValid": bool, "isAmbiguous": bool, "options": [string] (max 3), "corrected": string, "emoji": string }.`;

  const response = await fetchWithRetry(buildUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });

  const data = await response.json();
  const result = safeJsonParse(data.candidates?.[0]?.content?.parts?.[0]?.text);
  return result || { isValid: true, isAmbiguous: false, corrected: text, emoji: "⚡" };
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

  const response = await fetchWithRetry(buildUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }]
    })
  });

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Could not load definition.";
};

/**
 * Generate quiz question
 */
export const generateQuiz = async (topic: string, domain: string, context: string): Promise<QuizData | null> => {
  const prompt = `Based on this content about "${topic}" using ${domain} analogy:\n${context}\n\nGenerate a quiz question. Return JSON:\n{"question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0-3, "explanation": "Why correct answer is right"}`;

  const response = await fetchWithRetry(buildUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });

  const data = await response.json();
  return safeJsonParse(data.candidates?.[0]?.content?.parts?.[0]?.text);
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

  const response = await fetchWithRetry(buildUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text;
};
