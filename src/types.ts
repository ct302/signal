// Extend Window interface for KaTeX
declare global {
  interface Window {
    katex?: {
      renderToString: (latex: string, options?: { throwOnError?: boolean; displayMode?: boolean }) => string;
    };
  }
}

export interface Segment {
  tech: string;
  analogy: string;
  narrative?: string;
}

export interface ConceptMapItem {
  id: number;
  tech_term: string;
  analogy_term: string;
}

export interface ImportanceMapItem {
  term: string;
  importance: number;
}

export interface ProcessedWord {
  text: string;
  weight: number;
  isSpace: boolean;
  isLatex?: boolean;
  segmentIndex?: number;
  conceptIndex?: number;
}

export interface Position {
  top: number | string;
  left: number | string;
  placement?: string;
}

export interface Size {
  width: number;
}

export interface ContextData {
  header: string;
  emoji: string;
  why: string;
  real_world: string;
  narrative: string;
}

export interface TutorHistoryEntry {
  role: 'user' | 'model';
  text: string;
}

export interface TutorResponse {
  question: string;
  answer: string;
  mode: string;
}

export interface QuizData {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  difficulty?: QuizDifficulty;
  concept?: string; // The core concept being tested (for retry rephrasing)
}

export type QuizDifficulty = 'easy' | 'medium' | 'hard' | 'advanced';

export interface QuizState {
  questionNumber: number;
  retryCount: number;
  maxRetries: number;
  currentConcept?: string;
  currentCorrectAnswer?: string;
}

export interface DisambiguationData {
  type: 'domain' | 'topic';
  options: string[];
  original: string;
}

export interface HistoryItem {
  id: number;
  topic: string;
  domain: string;
  data: any;
  timestamp: string;
}

export interface AmbiguityResult {
  isValid: boolean;
  isAmbiguous: boolean;
  options?: string[];
  corrected?: string;
  emoji?: string;
}

// Provider Configuration Types
export type ProviderType = 'google' | 'openai' | 'anthropic' | 'ollama';

export interface ProviderConfig {
  provider: ProviderType;
  apiKey: string;
  model: string;
  ollamaEndpoint?: string;
}

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

export const DEFAULT_MODELS: Record<ProviderType, string[]> = {
  google: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  ollama: []
};

export {};
