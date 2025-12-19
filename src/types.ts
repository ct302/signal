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

export {};
