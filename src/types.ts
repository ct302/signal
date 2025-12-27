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

export interface ProximityResult {
  isTooClose: boolean;
  reason?: string;
  suggestedDomains?: Array<{ name: string; emoji: string }>;
}

// Provider Configuration Types
export type ProviderType = 'google' | 'openai' | 'anthropic' | 'ollama' | 'openrouter';

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
  ollama: [],
  openrouter: [
    'google/gemini-2.0-flash-exp:free',
    'openai/gpt-oss-120b:free',
    'meta-llama/llama-3.3-70b-instruct:free'
  ]
};

// ============================================
// MASTERY MODE TYPES
// ============================================

export type MasteryStage = 1 | 2 | 3;

/**
 * A keyword with dual definitions (technical + analogy domain)
 * Stage 2: 3-word definitions
 * Stage 3: 6-word definitions
 */
export interface MasteryKeyword {
  id: number;
  term: string;                    // The keyword itself (technical term)
  analogyTerm: string;             // The corresponding analogy domain term
  techDefinition3: string;         // 3-word technical definition (Stage 2)
  analogyDefinition3: string;      // 3-word analogy definition (Stage 2)
  techDefinition6: string;         // 6-word technical definition (Stage 3)
  analogyDefinition6: string;      // 6-word analogy definition (Stage 3)
  importance: number;              // 0-1 ranking for ordering
}

/**
 * AI-extracted intuitions from a user's response
 * Explains WHY their understanding demonstrates mastery
 */
export interface ExtractedIntuition {
  insight: string;                 // The key insight they demonstrated
  keywordsCaptured: string[];      // Which keywords they correctly used
  strength: string;                // What they did well
}

/**
 * A single stage attempt by the user
 */
export interface StageAttempt {
  stage: MasteryStage;
  userResponse: string;            // The user's narrative explanation
  availableKeywords: string[];     // Keywords that were visible at this stage
  requiredKeywordCount: number;    // How many they needed to use (0, 3, or 6)
  keywordsUsed: string[];          // Which keywords they actually used
  score: number;                   // 0-100
  passed: boolean;
  feedback: string;                // AI proctor feedback
  intuitions: ExtractedIntuition;  // AI-extracted learning insights
  timestamp: Date;
}

/**
 * The full mastery session containing all state
 */
export interface MasterySession {
  id: string;
  sourceData: {
    topic: string;
    domain: string;
    domainEmoji: string;
    analogyText: string;           // The original analogy explanation for context
  };
  keywords: MasteryKeyword[];      // All 10 keywords
  currentStage: MasteryStage;
  stageHistory: StageAttempt[];    // All attempts across all stages
  isComplete: boolean;
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Result from the AI proctor evaluation
 */
export interface EvaluationResult {
  score: number;
  passed: boolean;
  feedback: string;
  keywordsDetected: string[];
  missedConcepts: string[];
  strengths: string[];
  intuitions: ExtractedIntuition;
}

/**
 * Persisted mastery history entry for "Review My Learning"
 */
export interface MasteryHistoryEntry {
  id: string;
  topic: string;
  domain: string;
  domainEmoji: string;
  completedAt: Date;
  finalScores: {
    stage1: number;
    stage2: number;
    stage3: number;
  };
  stageAttempts: StageAttempt[];
}

export {};
