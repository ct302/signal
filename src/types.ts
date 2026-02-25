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
  intuitions?: string[]; // 3 memorable one-liner insights for the Intuition Mode modal
}

export interface ConceptMapItem {
  id: number;
  tech_term: string;
  analogy_term: string;
  six_word_definition?: string; // Exactly 6 words defining the tech_term (domain-agnostic)
  narrative_mapping?: string; // 2-3 sentence vivid mini-story bridging tech to analogy (domain-specific)
  causal_explanation?: string; // First-principles explanation of WHY the mapping works structurally
  why_it_matters?: {
    connection: string;      // WHY these two concepts structurally connect
    importance: string;      // WHY mastering this specific mapping matters
    critical: string;        // WHY the system would fail without this concept
  };
}

export interface ImportanceMapItem {
  term: string;
  importance: number;
}

// Symbol Guide - API-generated context-aware symbol explanations
export interface SymbolGuideEntry {
  symbol: string;        // The symbol itself: "A", "λ", "∫"
  name: string;          // Context-aware name: "Coordinate Ring" not "Matrix A"
  meaning: string;       // Technical meaning in THIS context
  simple: string;        // Plain English for learners
  formula?: string;      // KaTeX expression showing compound usage, e.g. "$\\frac{\\partial f}{\\partial x}$"
  domain_analogy?: string; // Domain-mapped isomorphic intuition (e.g., NFL, cooking)
}

export interface AttentionMapItem {
  word: string;
  weight: number;
  entityId?: number; // For multi-word entities, all words share the same entityId
}

export interface AttentionMap {
  tech: AttentionMapItem[];
  analogy: AttentionMapItem[];
}

// Expanded lookup for individual words within multi-word entities
export interface EntityWordLookup {
  [word: string]: {
    weight: number;
    entityId: number;
    fullEntity: string; // The complete multi-word phrase
  };
}

export interface ProcessedWord {
  text: string;
  weight: number;
  isSpace: boolean;
  isLatex?: boolean;
  segmentIndex?: number;
  conceptIndex?: number;
  entityId?: number; // For consistent coloring of multi-word entities
}

export interface Position {
  top: number | string;
  left: number | string;
  placement?: string;
}

export interface Size {
  width: number;
  height?: number;
}

export interface ContextData {
  header: string;
  emoji: string;
  why: string;
  real_world: string;
  narrative: string;
}

export interface MnemonicData {
  phrase: string;           // The memorable phrase/acronym (e.g., "EEDDR")
  breakdown: string[];      // What each letter means (matching bullets order)
}

export interface CondensedData {
  what: string;
  why: string;
  bullets: string[];
  mnemonic?: MnemonicData;  // Memorable phrase/acronym with breakdown
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
  analogyBridge?: {
    hint: string;            // 1-2 sentence domain-lens reframing of the question
    optionHints?: string[];  // Per-option domain analogy (3-8 words each)
  };
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
export type ProviderType = 'cloud' | 'ollama';

export interface ProviderConfig {
  provider: ProviderType;
  apiKey: string;
  model: string;
  baseUrl?: string;           // For cloud: defaults to OpenRouter
  ollamaEndpoint?: string;    // For local: defaults to localhost:11434
}

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

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

/**
 * Story versions for each mastery stage
 * Stage 1: Pure narrative, zero technical jargon
 * Stage 2: Same story with ~6 technical terms woven in
 * Stage 3: Same story with all 10 technical terms
 */
export interface MasteryStory {
  stage: MasteryStage;
  content: string;                    // The narrative story text
  highlightedTerms: string[];         // Technical terms embedded in this version
  generatedAt: Date;
}

/**
 * A keyword position in the story for highlighting
 */
export interface StoryKeywordPosition {
  term: string;
  analogyTerm: string;
  startIndex: number;
  endIndex: number;
  techDefinition3: string;
  analogyDefinition3: string;
  techDefinition6: string;
  analogyDefinition6: string;
}

/**
 * Chat message in mastery mode conversation
 */
export interface MasteryChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * Complete mastery history entry with full data for Overview mode
 */
export interface CompleteMasteryHistory {
  id: string;
  topic: string;
  domain: string;
  domainEmoji: string;
  completedAt: Date;
  startedAt: Date;

  // Stories for each stage
  stories: {
    stage1: MasteryStory;
    stage2: MasteryStory;
    stage3: MasteryStory;
  };

  // User responses for each stage
  userResponses: {
    stage1: string;
    stage2: string;
    stage3: string;
  };

  // AI intuition extractions for each stage
  intuitions: {
    stage1: ExtractedIntuition;
    stage2: ExtractedIntuition;
    stage3: ExtractedIntuition;
  };

  // Full glossary with all 10 keywords and 4 definitions each
  glossary: MasteryKeyword[];

  // Final scores
  finalScores: {
    stage1: number;
    stage2: number;
    stage3: number;
  };

  // Overall mastery summary from AI
  masterySummary: {
    keyStrength: string;           // User's unique strength in understanding
    coreIntuition: string;         // The main intuition they demonstrated
    uniqueApproach: string;        // What made their explanation unique
  };
}

/**
 * Share data for generating share links
 */
export interface MasteryShareData {
  topic: string;
  domain: string;
  domainEmoji: string;
  completedAt: string;
  finalScores: {
    stage1: number;
    stage2: number;
    stage3: number;
  };
  masterySummary: {
    keyStrength: string;
    coreIntuition: string;
  };
}

// ============================================
// FUNCTIONGEMMA ROUTING TYPES
// ============================================

export type RoutingAction = 'none' | 'web_search' | 'get_statistics' | 'verify_facts';

/**
 * Routing decision from FunctionGemma
 * Determines if we need to fetch external data before generating content
 */
export interface RoutingDecision {
  action: RoutingAction;
  query?: string;              // Search query if action requires it
  reason: string;              // Why this decision was made
  confidence: number;          // 0-1 confidence in the decision
}

/**
 * Enriched context after routing/fetching
 * Passed to main LLM for grounded generation
 */
export interface EnrichedContext {
  originalTopic: string;
  originalDomain: string;
  wasEnriched: boolean;
  routingDecision: RoutingDecision;
  fetchedData?: string;        // Raw data from web search if fetched
  enrichedPromptContext?: string; // Formatted context for LLM
}

/**
 * Cached domain enrichment - checked once when domain is selected,
 * used to determine if web search should be enabled for generations
 * Note: Actual web data fetching is handled by OpenRouter's native plugin
 */
export interface CachedDomainEnrichment {
  domain: string;              // The domain this enrichment is for
  shortDomain: string;         // Short name (without disambiguation)
  wasEnriched: boolean;        // Whether domain has granularity signals (enables web search)
  enrichedAt: Date;            // When this was checked
}

// ============================================
// STUDY GUIDE TYPES
// ============================================

export type StudyGuideDepth = 'core' | 'complete';

export interface StudyGuideConcept {
  id: number;
  tech_term: string;           // e.g., "The Agent"
  analogy_term: string;        // e.g., "The Quarterback (Kurt Warner)"
  one_liner: string;           // 1-sentence hook blending both domains
  category?: string;           // Optional grouping: "Core Components", "Training Loop", etc.
}

export interface StudyGuideOutline {
  topic: string;
  domain: string;
  depth: StudyGuideDepth;
  concepts: StudyGuideConcept[];
  generated_at: string;
}

export interface StudyGuideDetail {
  concept_id: number;
  tech_explanation: string;    // 2-3 sentences, pure technical
  analogy_explanation: string; // 2-3 sentences, through domain lens with specific references
  why_it_maps: string;         // 1-2 sentences, structural connection
  key_insight: string;         // Memorable one-liner for intuition tattooing
}

// ============================================
// FONT PRESET TYPES
// ============================================

export interface FontPreset {
  id: string;
  name: string;
  emoji: string;
  fontFamily: string;       // CSS font-family value (with fallbacks)
  fontWeight: number;        // Default weight for body text
  letterSpacing: string;     // CSS letter-spacing value
  lineHeightMultiplier: number; // Multiplied with base line-height
  googleFontUrl?: string;    // CDN link to load, undefined = system font
}

export {};
