import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Eye,
  Zap,
  AlignLeft,
  MoveHorizontal,
  Sparkles,
  BookOpenText,
  Eraser,
  RotateCcw,
  Maximize2,
  Minimize2,
  Trophy,
  Unlock,
  Lock,
  MessageCircle,
  Palette,
  Loader2,
  BrainCircuit,
  BookOpen,
  HelpCircle,
  X,
  Coffee,
  Network,
  Columns,
  Type,
  GraduationCap,
  Medal,
  List,
  Copy,
  Check,
  AlertCircle,
  Dices,
  History,
  ChevronUp,
  ChevronDown,
  Minus,
  GripHorizontal,
  Lightbulb
} from 'lucide-react';

// Types
import {
  Segment,
  ConceptMapItem,
  ImportanceMapItem,
  AttentionMap,
  AttentionMapItem,
  EntityWordLookup,
  ProcessedWord,
  Position,
  ContextData,
  CondensedData,
  TutorHistoryEntry,
  TutorResponse,
  QuizData,
  QuizDifficulty,
  DisambiguationData,
  HistoryItem,
  ProximityResult,
  CompleteMasteryHistory,
  CachedDomainEnrichment,
  SymbolGuideEntry
} from './types';

// Constants
import {
  STOP_WORDS,
  LATEX_REGEX,
  CONCEPT_COLORS,
  CONCEPT_BG_COLORS,
  MAX_TUTOR_HISTORY,
  QUICK_START_DOMAINS,
  SYMBOL_GLOSSARY
} from './constants';

// Utils
import { cleanText, fixUnicode, wrapBareLatex, sanitizeLatex, findContext, stripMathSymbols, ApiError, unescapeControlSequences } from './utils';

// Hooks
import { useMobile, useKatex, useDrag, useHistory, useSpeechRecognition } from './hooks';

// Services
import {
  generateAnalogy,
  checkAmbiguity,
  checkDomainProximity,
  fetchDefinition as fetchDefinitionApi,
  generateQuiz,
  askTutor,
  enrichDomainOnSelection,
  generateFoundationalMapping,
  getFreeTierState,
  subscribeToFreeTier,
  isOnFreeTier,
  FreeTierExhaustedError
} from './services';

// Components
import {
  DomainSelection,
  Header,
  HistoryPanel,
  ContextCard,
  DisambiguationModal,
  QuizModal,
  SynthesisModal,
  DefinitionPopup,
  MiniDefinitionPopup,
  ConstellationMode,
  IsomorphicDualPane,
  ProximityWarningModal,
  MasteryMode,
  MasterySessionCache,
  SkeletonLoader
} from './components';

// Greek and Math Symbol Lookup Table - Technical meanings for hybrid definitions
const SYMBOL_DEFINITIONS: Record<string, { symbol: string; technical: string; domainHint: string }> = {
  // Greek Letters
  'alpha': { symbol: 'α', technical: 'First parameter, learning rate, or angle of rotation', domainHint: 'the starting point or primary factor' },
  'beta': { symbol: 'β', technical: 'Second parameter, momentum, or standardized coefficient', domainHint: 'the secondary factor or adjustment' },
  'gamma': { symbol: 'γ', technical: 'Discount factor, third parameter, or Euler-Mascheroni constant', domainHint: 'how much future matters vs present' },
  'delta': { symbol: 'Δ/δ', technical: 'Change in value, small increment, or error term', domainHint: 'the amount of change or difference' },
  'epsilon': { symbol: 'ε', technical: 'Very small quantity, error bound, or exploration rate', domainHint: 'a tiny wiggle room or margin' },
  'theta': { symbol: 'θ', technical: 'Model parameters, angle, or phase', domainHint: 'the adjustable knobs or settings' },
  'lambda': { symbol: 'λ', technical: 'Eigenvalue, regularization strength, or rate parameter', domainHint: 'a scaling factor or penalty' },
  'mu': { symbol: 'μ', technical: 'Mean (average), coefficient of friction, or micro prefix', domainHint: 'the center or typical value' },
  'sigma': { symbol: 'σ/Σ', technical: 'Standard deviation (σ) or summation (Σ)', domainHint: 'spread/variability (σ) or adding up all (Σ)' },
  'pi': { symbol: 'π', technical: 'Circle ratio (3.14159...) or policy function', domainHint: 'the constant ratio or strategy' },
  'phi': { symbol: 'φ/Φ', technical: 'Golden ratio, feature transform, or potential function', domainHint: 'transformation or hidden structure' },
  'psi': { symbol: 'ψ/Ψ', technical: 'Wave function, digamma, or auxiliary variable', domainHint: 'hidden state or helper variable' },
  'omega': { symbol: 'ω/Ω', technical: 'Angular frequency, sample space, or weight', domainHint: 'speed of oscillation or full range' },
  'rho': { symbol: 'ρ', technical: 'Correlation coefficient, density, or spectral radius', domainHint: 'how tightly things move together' },
  'tau': { symbol: 'τ', technical: 'Time constant, Kendall rank correlation, or torque', domainHint: 'characteristic time or rotation force' },
  'eta': { symbol: 'η', technical: 'Learning rate, efficiency, or viscosity', domainHint: 'step size or how fast to learn' },
  'kappa': { symbol: 'κ', technical: 'Curvature, condition number, or concentration', domainHint: 'how curved or sensitive' },
  'chi': { symbol: 'χ', technical: 'Chi-squared distribution, susceptibility', domainHint: 'goodness of fit or responsiveness' },
  // Math Operators
  'sum': { symbol: 'Σ', technical: 'Summation - add up all values in a sequence', domainHint: 'total of everything combined' },
  'prod': { symbol: 'Π', technical: 'Product - multiply all values in a sequence', domainHint: 'everything multiplied together' },
  'int': { symbol: '∫', technical: 'Integral - continuous sum, area under curve', domainHint: 'accumulated total over a range' },
  'partial': { symbol: '∂', technical: 'Partial derivative - rate of change in one direction', domainHint: 'sensitivity to one factor' },
  'nabla': { symbol: '∇', technical: 'Gradient - vector of all partial derivatives', domainHint: 'direction of steepest increase' },
  'infty': { symbol: '∞', technical: 'Infinity - unbounded quantity', domainHint: 'without limit or end' },
  'in': { symbol: '∈', technical: 'Element of - membership in a set', domainHint: 'belongs to or is part of' },
  'forall': { symbol: '∀', technical: 'For all - universal quantifier', domainHint: 'applies to every single one' },
  'exists': { symbol: '∃', technical: 'There exists - existential quantifier', domainHint: 'at least one exists' },
  'approx': { symbol: '≈', technical: 'Approximately equal', domainHint: 'roughly the same as' },
  'neq': { symbol: '≠', technical: 'Not equal to', domainHint: 'different from' },
  'leq': { symbol: '≤', technical: 'Less than or equal to', domainHint: 'at most' },
  'geq': { symbol: '≥', technical: 'Greater than or equal to', domainHint: 'at least' },
  'cdot': { symbol: '·', technical: 'Dot product or multiplication', domainHint: 'combining by multiplication' },
  'times': { symbol: '×', technical: 'Cross product or multiplication', domainHint: 'combining perpendicular components' },
  'sqrt': { symbol: '√', technical: 'Square root - number that squares to input', domainHint: 'undoing a square' },
  'frac': { symbol: 'a/b', technical: 'Fraction - division or ratio', domainHint: 'portion or rate' },
  'vec': { symbol: '→', technical: 'Vector - quantity with magnitude and direction', domainHint: 'arrow pointing somewhere' },
  'hat': { symbol: '^', technical: 'Unit vector or estimator', domainHint: 'normalized or predicted' },
  'bar': { symbol: '—', technical: 'Mean/average or complement', domainHint: 'average value or opposite' },
  'prime': { symbol: "'", technical: 'Derivative or transformed variable', domainHint: 'rate of change or modified version' },
  'log': { symbol: 'log', technical: 'Logarithm - inverse of exponentiation', domainHint: 'how many times to multiply' },
  'exp': { symbol: 'e^x', technical: 'Exponential function - rapid growth/decay', domainHint: 'compound growth' },
  'lim': { symbol: 'lim', technical: 'Limit - value approached as input changes', domainHint: 'where things tend toward' },
  'max': { symbol: 'max', technical: 'Maximum - largest value', domainHint: 'the biggest one' },
  'min': { symbol: 'min', technical: 'Minimum - smallest value', domainHint: 'the smallest one' },
  'argmax': { symbol: 'argmax', technical: 'Argument of maximum - input that gives largest output', domainHint: 'what causes the best result' },
  'argmin': { symbol: 'argmin', technical: 'Argument of minimum - input that gives smallest output', domainHint: 'what causes the least result' },
};

// Helper to detect if a term is a Greek/math symbol
const getSymbolDefinition = (term: string): { symbol: string; technical: string; domainHint: string } | null => {
  // Clean the term - remove LaTeX formatting
  const clean = term.toLowerCase()
    .replace(/[\$\\{}^_]/g, '')
    .replace(/\s+/g, '')
    .trim();

  // Direct match
  if (SYMBOL_DEFINITIONS[clean]) {
    return SYMBOL_DEFINITIONS[clean];
  }

  // Check if term contains a known symbol (e.g., "\sigma_x" contains "sigma")
  for (const [key, def] of Object.entries(SYMBOL_DEFINITIONS)) {
    if (clean.includes(key) || term.toLowerCase().includes(`\\${key}`)) {
      return def;
    }
  }

  // Check for actual Greek characters
  const greekChars: Record<string, string> = {
    'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'ε': 'epsilon',
    'θ': 'theta', 'λ': 'lambda', 'μ': 'mu', 'σ': 'sigma', 'Σ': 'sigma',
    'π': 'pi', 'φ': 'phi', 'Φ': 'phi', 'ψ': 'psi', 'Ψ': 'psi',
    'ω': 'omega', 'Ω': 'omega', 'ρ': 'rho', 'τ': 'tau', 'η': 'eta',
    'κ': 'kappa', 'χ': 'chi', '∞': 'infty', '∈': 'in', '∀': 'forall',
    '∃': 'exists', '∇': 'nabla', '∂': 'partial', '∫': 'int', '≈': 'approx'
  };

  for (const [char, key] of Object.entries(greekChars)) {
    if (term.includes(char) && SYMBOL_DEFINITIONS[key]) {
      return SYMBOL_DEFINITIONS[key];
    }
  }

  return null;
};

export default function App() {
  // Custom Hooks
  const isMobile = useMobile();
  const isKatexLoaded = useKatex();
  const {
    history,
    showHistory,
    setShowHistory,
    saveToHistory,
    deleteHistoryItem
  } = useHistory();
  const {
    defPos,
    setDefPos,
    quizPos,
    synthPos,
    defSize,
    miniDefSize,
    miniDefPosition,
    setMiniDefPosition,
    startDrag,
    startResize,
    handleMiniHeaderMouseDown
  } = useDrag({ isMobile });
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    isBrowserSupported: isMicSupported
  } = useSpeechRecognition();

  // Domain State
  const [analogyDomain, setAnalogyDomain] = useState("NFL");
  const [tempDomainInput, setTempDomainInput] = useState("");
  const [domainEmoji, setDomainEmoji] = useState("🏈");
  const [hasSelectedDomain, setHasSelectedDomain] = useState(false);
  const [isSettingDomain, setIsSettingDomain] = useState(false);
  const [domainError, setDomainError] = useState("");
  const [cachedDomainEnrichment, setCachedDomainEnrichment] = useState<CachedDomainEnrichment | null>(null);

  // Topic State
  const [topic, setTopic] = useState("");
  const [lastSubmittedTopic, setLastSubmittedTopic] = useState("");

  // Voice input: auto-populate search when speech recognition completes
  useEffect(() => {
    if (transcript) {
      setTopic(transcript);
    }
  }, [transcript]);

  // Content State
  const [segments, setSegments] = useState<Segment[]>([]);
  const [conceptMap, setConceptMap] = useState<ConceptMapItem[]>([]);
  const [importanceMap, setImportanceMap] = useState<ImportanceMapItem[]>([]);
  const [attentionMap, setAttentionMap] = useState<AttentionMap | null>(null);
  const [entityLookup, setEntityLookup] = useState<{ tech: EntityWordLookup; analogy: EntityWordLookup } | null>(null);
  const [processedWords, setProcessedWords] = useState<ProcessedWord[]>([]);
  const [contextData, setContextData] = useState<ContextData | null>(null);
  const [condensedData, setCondensedData] = useState<CondensedData | null>(null);
  const [synthesisSummary, setSynthesisSummary] = useState("");
  const [synthesisCitation, setSynthesisCitation] = useState("");
  const [symbolGuide, setSymbolGuide] = useState<SymbolGuideEntry[]>([]);
  const [defSymbolGuide, setDefSymbolGuide] = useState<SymbolGuideEntry[]>([]);
  const [technicalExplanation, setTechnicalExplanation] = useState<string>(""); // Full 250+ word technical explanation
  const [analogyExplanation, setAnalogyExplanation] = useState<string>(""); // Full 250+ word analogy explanation

  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null); // User-visible API error
  const [isExtendedLoading, setIsExtendedLoading] = useState(false); // Shows after 5s of loading
  const [hasStarted, setHasStarted] = useState(false);
  const [isViewingFromHistory, setIsViewingFromHistory] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showSynthesis, setShowSynthesis] = useState(false);
  const [isMouseInside, setIsMouseInside] = useState(false);
  const [showCondensedView, setShowCondensedView] = useState(false); // Actual visibility of condensed overlay
  const [isCondensedMorphing, setIsCondensedMorphing] = useState(false); // Transition state for diffusion effect
  const [isFirstPrinciplesMode, setIsFirstPrinciplesMode] = useState(false); // Button-toggled first principles view

  // View Mode State
  const [viewMode, setViewMode] = useState<'morph' | 'nfl' | 'tech'>('morph');
  const [mode, setMode] = useState<'opacity' | 'size' | 'heatmap'>('opacity');
  const [threshold, setThreshold] = useState(0.3);
  const [isIsomorphicMode, setIsIsomorphicMode] = useState(true);
  const [isBulletMode, setIsBulletMode] = useState(false); // Bullet point mode for Tech Lock
  const [isNarrativeMode, setIsNarrativeMode] = useState(false);
  const [textScale, setTextScale] = useState<1 | 1.25 | 1.5 | 2>(1); // Text scale multiplier

  // Definition State
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [defPosition, setDefPosition] = useState<Position | null>(null);
  const [defText, setDefText] = useState("");
  const [defComplexity, setDefComplexity] = useState(50);
  const [isLoadingDef, setIsLoadingDef] = useState(false);
  const [defThreshold, setDefThreshold] = useState(0.3);
  const [isDefColorMode, setIsDefColorMode] = useState(false);

  // Mini Definition State
  const [miniSelectedTerm, setMiniSelectedTerm] = useState<string | null>(null);
  const [miniDefText, setMiniDefText] = useState("");
  const [miniDefComplexity, setMiniDefComplexity] = useState(50);
  const [isLoadingMiniDef, setIsLoadingMiniDef] = useState(false);
  const [miniDefThreshold, setMiniDefThreshold] = useState(0.3);
  const [isMiniDefColorMode, setIsMiniDefColorMode] = useState(false);

  // Tutor State
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpQuery, setFollowUpQuery] = useState("");
  const [tutorResponse, setTutorResponse] = useState<TutorResponse | null>(null);
  const [isTutorLoading, setIsTutorLoading] = useState(false);
  const [tutorHistory, setTutorHistory] = useState<TutorHistoryEntry[]>([]);
  const [showTutorHistory, setShowTutorHistory] = useState(false);
  const [tutorThreshold, setTutorThreshold] = useState(0.5);
  const [isTutorColorMode, setIsTutorColorMode] = useState(false);
  const [selectedHistoryBranch, setSelectedHistoryBranch] = useState<number | null>(null); // Index of selected Q&A pair for branching
  const MAX_BRANCH_CONTEXT = 5; // Max Q&A pairs per branch context

  // Quiz State
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [quizQuestionNumber, setQuizQuestionNumber] = useState(1);
  const [quizRetryCount, setQuizRetryCount] = useState(0);
  const [quizCurrentConcept, setQuizCurrentConcept] = useState<string>('');
  const [quizCurrentCorrectAnswer, setQuizCurrentCorrectAnswer] = useState<string>('');
  const MAX_QUIZ_RETRIES = 2;

  // Synthesis State
  const [synthesisThreshold, setSynthesisThreshold] = useState(0.3);
  const [isSynthesisColorMode, setIsSynthesisColorMode] = useState(false);

  // Main Content Complexity State
  const [mainComplexity, setMainComplexity] = useState<5 | 50 | 100>(50);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Ambiance Mode State
  const [ambianceMode, setAmbianceMode] = useState<'none' | 'study'>('none');
  const [showStudyControls, setShowStudyControls] = useState(true);
  const [showSymbolGlossary, setShowSymbolGlossary] = useState(false);
  const [symbolGuidePos, setSymbolGuidePos] = useState({ x: 0, y: 0 });
  const [isSymbolGuideMinimized, setIsSymbolGuideMinimized] = useState(false);
  const [isDraggingSymbolGuide, setIsDraggingSymbolGuide] = useState(false);
  const symbolGuideDragStart = useRef({ x: 0, y: 0 });
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);

  // Free Tier State
  const [freeTierRemaining, setFreeTierRemaining] = useState<number | null>(null);
  const [freeTierLimit, setFreeTierLimit] = useState(5);
  const [showFreeTierModal, setShowFreeTierModal] = useState(false);

  // Subscribe to free tier state changes
  useEffect(() => {
    // Initialize from current state
    const initialState = getFreeTierState();
    setFreeTierRemaining(initialState.remaining);
    setFreeTierLimit(initialState.limit);
    if (initialState.isExhausted) {
      setShowFreeTierModal(true);
    }

    // Subscribe to changes
    const unsubscribe = subscribeToFreeTier((state) => {
      setFreeTierRemaining(state.remaining);
      setFreeTierLimit(state.limit);
      if (state.isExhausted) {
        setShowFreeTierModal(true);
      }
    });

    return unsubscribe;
  }, []);

  // Global drag handler for Symbol Guide - attaches to window for smooth dragging
  useEffect(() => {
    if (!isDraggingSymbolGuide) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const newX = e.clientX - symbolGuideDragStart.current.x;
      const newY = e.clientY - symbolGuideDragStart.current.y;
      setSymbolGuidePos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDraggingSymbolGuide(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSymbolGuide]);

  // Noise Generator State
  const [noiseType, setNoiseType] = useState<'none' | 'white' | 'pink' | 'brown'>('none');
  const [noiseVolume, setNoiseVolume] = useState(0.3);
  const noiseRef = useRef<{ ctx: AudioContext; gain: GainNode; processor: ScriptProcessorNode } | null>(null);

  // Desk Lamp State
  const [deskLampEnabled, setDeskLampEnabled] = useState(true);
  const [lampIntensity, setLampIntensity] = useState(0.5);
  const [lampColor, setLampColor] = useState<'warm' | 'white' | 'cool' | 'custom'>('warm');
  const [lampCustomColor, setLampCustomColor] = useState('#fffbeb');

  // Night Mode State
  const [vignetteEnabled, setVignetteEnabled] = useState(true);
  const [nightIntensity, setNightIntensity] = useState<'subtle' | 'medium' | 'deep'>('medium');
  const [nightColor, setNightColor] = useState<'amber' | 'red' | 'lavender' | 'custom'>('amber');
  const [nightCustomColor, setNightCustomColor] = useState('#f59e0b');

  const [showShortcutsLegend, setShowShortcutsLegend] = useState(false);
  const [isConstellationMode, setIsConstellationMode] = useState(false);
  const [isDualPaneMode, setIsDualPaneMode] = useState(false);
  const [isMasteryMode, setIsMasteryMode] = useState(false);
  const [masteryHistory, setMasteryHistory] = useState<CompleteMasteryHistory[]>([]);
  const [showMasteryHistory, setShowMasteryHistory] = useState(false);
  const [selectedMasteryEntry, setSelectedMasteryEntry] = useState<CompleteMasteryHistory | null>(null);
  const [masterySessionCache, setMasterySessionCache] = useState<MasterySessionCache | null>(null);
  const [showIntuitionModal, setShowIntuitionModal] = useState(false); // Intuition Mode modal

  // Disambiguation State
  const [disambiguation, setDisambiguation] = useState<DisambiguationData | null>(null);
  const [isDisambiguating, setIsDisambiguating] = useState(false);

  // Proximity Warning State
  const [proximityWarning, setProximityWarning] = useState<{ topic: string; result: ProximityResult } | null>(null);

  // Copy State
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Selection State (for multi-word definition)
  const [showDefineButton, setShowDefineButton] = useState(false);
  const [defineButtonPosition, setDefineButtonPosition] = useState<Position | null>(null);
  const [pendingSelection, setPendingSelection] = useState<string>("");
  const [isSelectingText, setIsSelectingText] = useState(false);
  const [morphLockedForSelection, setMorphLockedForSelection] = useState(false);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const controlsPanelRef = useRef<HTMLDivElement>(null);
  const controlsButtonRef = useRef<HTMLButtonElement>(null);
  const historyPanelRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const condensedMorphTimerRef = useRef<NodeJS.Timeout | null>(null);
  const extendedLoadingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Extended loading indicator - shows after 5 seconds of loading
  useEffect(() => {
    if (isLoading) {
      // Start timer for extended loading indicator
      extendedLoadingTimerRef.current = setTimeout(() => {
        setIsExtendedLoading(true);
      }, 5000);
    } else {
      // Clear timer and reset extended loading state
      if (extendedLoadingTimerRef.current) {
        clearTimeout(extendedLoadingTimerRef.current);
      }
      setIsExtendedLoading(false);
    }

    return () => {
      if (extendedLoadingTimerRef.current) {
        clearTimeout(extendedLoadingTimerRef.current);
      }
    };
  }, [isLoading]);

  // Computed values
  const isAnalogyVisualMode = viewMode === 'nfl' || (viewMode === 'morph' && isHovering);

  // Load content from API response
  const loadContent = (data: any, topicName: string) => {
    const technicalExplanation = findContext(data, ["technical_explanation", "technicalExplanation", "original", "technical"]);
    const analogyExplanation = findContext(data, ["analogy_explanation", "analogyExplanation", "analogy"]);
    const segmentsArray = findContext(data, ["segments"]);
    const conceptMapArray = findContext(data, ["concept_map", "conceptMap"]);
    const importanceMapArray = findContext(data, ["importance_map", "importanceMap"]);
    const context = findContext(data, ["context"]);
    const synthesis = findContext(data, ["synthesis"]);

    if (segmentsArray && Array.isArray(segmentsArray)) {
      setSegments(segmentsArray.map((s: any) => ({
        // Tech text: keep most math symbols but fix common prose-context issues
        // Must aggressively fix symbols that shouldn't appear in readable prose
        tech: cleanText(fixUnicode(s.tech || s.technical || ""))
          // Fix ∈ when used as prose "in" - broader pattern (before any lowercase word)
          .replace(/∈\s*(?=[a-z])/gi, 'in ')
          // Fix △/▲ triangle symbols to word "triangle" in prose context
          .replace(/[△▲▵⊿]\s*[\/∕]?\s*/g, 'triangle ')
          // Fix /ust → just, /ot → not, etc. - slash replacing first letter from LaTeX artifacts
          .replace(/(?<=\s|^)\/ust\b/gi, 'just')
          .replace(/(?<=\s|^)\/ot\b/gi, 'not')
          // Fix stray "/" between words that should be "not"
          .replace(/\s+[\/∕]\s+(?=[a-z])/gi, ' not ')
          .replace(/\s+[\/∕]\s*(?=just|only|merely|simply)\b/gi, ' not '),
        // Strip math symbols from analogy/narrative at load time to ensure pure prose in ALL display paths
        analogy: stripMathSymbols(cleanText(fixUnicode(s.analogy || s.nfl || ""))),
        narrative: stripMathSymbols(cleanText(fixUnicode(s.narrative || ""))),
        // 3 memorable one-liner intuitions for the Intuition Mode modal
        intuitions: Array.isArray(s.intuitions)
          ? s.intuitions.map((i: string) => cleanText(i || "")).filter((i: string) => i.length > 0)
          : s.tattoo ? [cleanText(s.tattoo)] : [] // Backwards compatibility with old tattoo field
      })));
    }

    // Store full explanations (250+ words each) - these are the main content
    // Apply unescapeControlSequences to convert literal \n sequences to actual newlines
    if (technicalExplanation) {
      setTechnicalExplanation(
        unescapeControlSequences(
          cleanText(fixUnicode(technicalExplanation))
            .replace(/∈\s*(?=[a-z])/gi, 'in ')
            .replace(/[△▲▵⊿]\s*[\/∕]?\s*/g, 'triangle ')
        )
      );
    }
    if (analogyExplanation) {
      setAnalogyExplanation(
        unescapeControlSequences(
          stripMathSymbols(cleanText(fixUnicode(analogyExplanation)))
        )
      );
    }

    if (conceptMapArray && Array.isArray(conceptMapArray)) {
      // Filter out invalid mappings where tech_term equals analogy_term (not a true isomorphism)
      const validMappings = conceptMapArray
        .map((c: any, i: number) => ({
          id: c.id ?? i,
          tech_term: cleanText(c.tech_term || c.techTerm || ""),
          analogy_term: cleanText(c.analogy_term || c.analogyTerm || ""),
          // Load the new fields for rich concept isomorphism display
          six_word_definition: cleanText(c.six_word_definition || c.sixWordDefinition || ""),
          narrative_mapping: cleanText(c.narrative_mapping || c.narrativeMapping || ""),
          causal_explanation: cleanText(c.causal_explanation || c.causalExplanation || "")
        }))
        .filter((c: { tech_term: string; analogy_term: string }) => {
          const techLower = c.tech_term.toLowerCase().trim();
          const analogyLower = c.analogy_term.toLowerCase().trim();
          // Reject if terms are identical or one contains the other entirely
          if (techLower === analogyLower) return false;
          if (techLower.length > 3 && analogyLower.includes(techLower)) return false;
          if (analogyLower.length > 3 && techLower.includes(analogyLower)) return false;
          return true;
        });
      setConceptMap(validMappings);
    }

    if (importanceMapArray && Array.isArray(importanceMapArray)) {
      setImportanceMap(importanceMapArray.map((m: any) => ({
        term: cleanText(m.term || ""),
        importance: m.importance ?? 0.5
      })));
    }

    // Extract attention_map for word-level importance weights
    // Also create entity lookup for multi-word entity handling
    const attentionMapData = findContext(data, ["attention_map", "attentionMap"]);
    if (attentionMapData) {
      const techAttention = Array.isArray(attentionMapData.tech) ? attentionMapData.tech : [];
      const analogyAttention = Array.isArray(attentionMapData.analogy) ? attentionMapData.analogy : [];

      // Helper to process attention items and create entity lookup
      const processAttentionItems = (items: any[], startEntityId: number): {
        processed: AttentionMapItem[];
        lookup: EntityWordLookup;
        nextEntityId: number;
      } => {
        const lookup: EntityWordLookup = {};
        let entityId = startEntityId;

        const processed = items.map((item: any) => {
          const fullPhrase = cleanText(item.word || "").toLowerCase();
          const weight = typeof item.weight === 'number' ? item.weight : 0.5;
          const words = fullPhrase.split(/\s+/).filter(w => w.length > 0);
          const currentEntityId = entityId++;

          // Add each word in the phrase to the lookup
          words.forEach(word => {
            // Only add if not already in lookup, or if this entity has higher weight
            if (!lookup[word] || lookup[word].weight < weight) {
              lookup[word] = {
                weight,
                entityId: currentEntityId,
                fullEntity: fullPhrase
              };
            }
          });

          return {
            word: fullPhrase,
            weight,
            entityId: currentEntityId
          };
        });

        return { processed, lookup, nextEntityId: entityId };
      };

      const techResult = processAttentionItems(techAttention, 0);
      const analogyResult = processAttentionItems(analogyAttention, techResult.nextEntityId);

      setAttentionMap({
        tech: techResult.processed,
        analogy: analogyResult.processed
      });

      setEntityLookup({
        tech: techResult.lookup,
        analogy: analogyResult.lookup
      });
    } else {
      setAttentionMap(null);
      setEntityLookup(null);
    }

    if (context) {
      setContextData({
        header: cleanText(fixUnicode(context.header || topicName)),
        emoji: fixUnicode(context.emoji || "💡"),
        // Strip math symbols from context fields - they should be pure prose
        why: stripMathSymbols(cleanText(fixUnicode(context.why || ""))),
        real_world: stripMathSymbols(cleanText(fixUnicode(context.real_world || context.realWorld || ""))),
        narrative: stripMathSymbols(cleanText(fixUnicode(context.narrative || "")))
      });
    }

    if (synthesis) {
      setSynthesisSummary(stripMathSymbols(cleanText(fixUnicode(synthesis.summary || ""))));
      setSynthesisCitation(stripMathSymbols(cleanText(fixUnicode(synthesis.citation || ""))));
    }

    // Parse condensed view data (WHAT/WHY + bullet points + mnemonic)
    const condensed = findContext(data, ["condensed"]);
    if (condensed) {
      // Parse mnemonic object (phrase + breakdown array)
      let mnemonicData = undefined;
      if (condensed.mnemonic && typeof condensed.mnemonic === 'object') {
        mnemonicData = {
          phrase: stripMathSymbols(cleanText(fixUnicode(condensed.mnemonic.phrase || ""))),
          breakdown: Array.isArray(condensed.mnemonic.breakdown)
            ? condensed.mnemonic.breakdown.map((b: string) => stripMathSymbols(cleanText(fixUnicode(b || ""))))
            : []
        };
      }

      setCondensedData({
        what: stripMathSymbols(cleanText(fixUnicode(condensed.what || ""))),
        why: stripMathSymbols(cleanText(fixUnicode(condensed.why || ""))),
        bullets: Array.isArray(condensed.bullets)
          ? condensed.bullets.map((b: string) => stripMathSymbols(cleanText(fixUnicode(b || ""))))
          : [],
        mnemonic: mnemonicData
      });
    } else {
      // Fallback: Generate basic condensed data from context if available
      // This ensures Essence mode is still accessible even if API doesn't return condensed
      if (context) {
        const fallbackWhat = context.header
          ? `${context.header} - a concept worth understanding deeply.`
          : `${topicName} explained through analogy.`;
        const fallbackWhy = context.why || context.real_world || context.realWorld || 'Understanding this concept opens doors to deeper learning.';

        setCondensedData({
          what: stripMathSymbols(cleanText(fixUnicode(fallbackWhat))),
          why: stripMathSymbols(cleanText(fixUnicode(fallbackWhy))),
          bullets: [], // No bullets in fallback
          mnemonic: undefined
        });
      } else {
        setCondensedData(null);
      }
    }

    // Parse symbol guide (API-generated context-aware symbol explanations)
    const symbolGuideData = findContext(data, ["symbol_guide"]);
    if (symbolGuideData && Array.isArray(symbolGuideData)) {
      setSymbolGuide(symbolGuideData.map((entry: any) => ({
        symbol: entry.symbol || "",
        name: entry.name || "",
        meaning: entry.meaning || "",
        simple: entry.simple || ""
      })));
    } else {
      setSymbolGuide([]);
    }

    setLastSubmittedTopic(topicName);
    setHasStarted(true);

    // Reset quiz state for new topic
    setQuizQuestionNumber(1);
    setQuizRetryCount(0);
    setQuizCurrentConcept('');
    setQuizCurrentCorrectAnswer('');
    setQuizFeedback(null);
    setShowQuizModal(false);
  };

  // Handlers
  const handleSubmit = async () => {
    if (!topic.trim()) return;
    if (disambiguation) setDisambiguation(null);
    if (proximityWarning) setProximityWarning(null);

    // Clear history view mode - this is a fresh search
    setIsViewingFromHistory(false);

    // Immediate loading feedback - user sees spinner instantly
    setIsLoading(true);

    try {
      const result = await checkAmbiguity(topic, 'topic');
      if (result.isAmbiguous || (result.options && result.options.length > 0)) {
        setDisambiguation({ type: 'topic', options: result.options || [], original: topic });
        setIsLoading(false); // Stop loading on disambiguation
        return;
      }
      if (!result.isValid) {
        setDomainError("Invalid topic or typo.");
        setIsLoading(false); // Stop loading on error
        return;
      }

      const confirmedTopic = result.corrected || topic;

      // Check if topic is too close to the domain
      const proximityResult = await checkDomainProximity(confirmedTopic, analogyDomain);
      if (proximityResult.isTooClose) {
        setProximityWarning({ topic: confirmedTopic, result: proximityResult });
        setIsLoading(false); // Stop loading on proximity warning
        return;
      }

      // fetchAnalogy will handle its own loading state
      await fetchAnalogy(confirmedTopic);
    } catch (error) {
      console.error('Submit error:', error);
      setIsLoading(false);
    }
  };

  const fetchAnalogy = async (confirmedTopic: string, complexity: number = 50) => {
    setIsLoading(true);
    setApiError(null); // Clear any previous error
    setLastSubmittedTopic(confirmedTopic); // Set before API call so retry works on failure
    setShowFollowUp(false);
    setTutorResponse(null);
    setContextData(null);
    setCondensedData(null);

    try {
      const parsed = await generateAnalogy(confirmedTopic, analogyDomain, complexity, cachedDomainEnrichment || undefined);
      if (parsed) {
        loadContent(parsed, confirmedTopic);
        saveToHistory(parsed, confirmedTopic, analogyDomain);
        setApiError(null); // Clear error on success
      } else {
        setApiError("No response received. Please check your model settings and try again.");
      }
    } catch (e: unknown) {
      console.error("API call failed", e);

      // Handle FreeTierExhaustedError - show modal instead of error
      if (e instanceof FreeTierExhaustedError) {
        setShowFreeTierModal(true);
        setApiError(null); // Don't show error, modal handles it
        return;
      }

      // Handle ApiError with detailed status codes
      if (e instanceof ApiError) {
        switch (e.status) {
          case 401:
          case 403:
            setApiError("API key issue. Please check your API key in Settings.");
            break;
          case 404:
            setApiError("Model not found. Please check your model name in Settings.");
            break;
          case 429:
            setApiError("Rate limited. The API is busy - please wait a moment and try again.");
            break;
          case 500:
          case 502:
          case 503:
          case 504:
            setApiError("Server error. The API is temporarily unavailable - please try again.");
            break;
          default:
            setApiError(`Request failed (${e.status}): ${e.message.slice(0, 80)}`);
        }
      } else {
        // Handle other errors (network, parsing, etc.)
        const errorMessage = (e as Error)?.message || "Unknown error occurred";
        if (errorMessage.includes("API key")) {
          setApiError("API key issue. Please check your API key in Settings.");
        } else if (errorMessage.includes("Empty response")) {
          setApiError("The model returned an empty response. It may be overloaded - try again.");
        } else if (errorMessage.includes("network") || errorMessage.includes("fetch") || errorMessage.includes("Failed to fetch")) {
          setApiError("Network error. Please check your connection and try again.");
        } else {
          setApiError(`Request failed: ${errorMessage.slice(0, 100)}`);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Regenerate with a different complexity level
  const handleComplexityChange = async (level: 5 | 50 | 100) => {
    if (isRegenerating || isLoading || !lastSubmittedTopic) return;
    if (level === mainComplexity) return;

    setMainComplexity(level);
    setIsRegenerating(true);

    try {
      const parsed = await generateAnalogy(lastSubmittedTopic, analogyDomain, level, cachedDomainEnrichment || undefined);
      if (parsed) {
        loadContent(parsed, lastSubmittedTopic);
      }
    } catch (e) {
      console.error("Regeneration failed", e);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Trigger domain enrichment asynchronously (non-blocking)
  // This fetches verified data about granular domains for use in all subsequent generations
  const triggerDomainEnrichment = async (domain: string) => {
    try {
      console.log(`[Domain Enrichment] Starting enrichment for: ${domain}`);
      const enrichment = await enrichDomainOnSelection(domain);
      setCachedDomainEnrichment(enrichment);
      console.log(`[Domain Enrichment] Complete. Enriched: ${enrichment.wasEnriched}`);
    } catch (error) {
      console.error('[Domain Enrichment] Failed:', error);
      // Non-fatal - continue without enrichment
    }
  };

  const handleSetDomain = async (overrideInput: string | null = null) => {
    const inputToUse = overrideInput || tempDomainInput;
    if (!inputToUse.trim()) return;

    // Clear any previous domain enrichment when changing domains
    setCachedDomainEnrichment(null);
    // Clear mastery session cache when domain changes
    setMasterySessionCache(null);

    // Look up emoji from quick start domains first
    const quickStartMatch = QUICK_START_DOMAINS.find(
      d => d.name.toLowerCase() === inputToUse.toLowerCase()
    );

    if (overrideInput && quickStartMatch) {
      // Use the predefined emoji for quick start domains
      setIsSettingDomain(true);
      setAnalogyDomain(inputToUse);
      setDomainEmoji(quickStartMatch.emoji);
      setHasSelectedDomain(true);
      setDisambiguation(null);
      setIsSettingDomain(false);
      // Trigger enrichment asynchronously (non-blocking)
      triggerDomainEnrichment(inputToUse);
      return;
    }

    if (overrideInput) {
      // For disambiguation selections, still call API to get emoji
      setIsSettingDomain(true);
      setDomainError("");

      const result = await checkAmbiguity(inputToUse, 'domain');
      const finalDomain = result.corrected || inputToUse;
      setDomainEmoji(result.emoji || "🎯");
      setAnalogyDomain(finalDomain);
      setHasSelectedDomain(true);
      setDisambiguation(null);
      setIsSettingDomain(false);
      // Trigger enrichment asynchronously (non-blocking)
      triggerDomainEnrichment(finalDomain);
      return;
    }

    setIsSettingDomain(true);
    setDomainError("");

    const result = await checkAmbiguity(inputToUse, 'domain');
    if (result.isAmbiguous || (result.options && result.options.length > 0)) {
      setDisambiguation({ type: 'domain', options: result.options || [], original: inputToUse });
      setIsSettingDomain(false);
      return;
    }
    if (!result.isValid) {
      setDomainError("Invalid topic.");
      setIsSettingDomain(false);
      return;
    }

    const finalDomain = result.corrected || inputToUse;
    setDomainEmoji(result.emoji || "⚡");
    setAnalogyDomain(finalDomain);
    setHasSelectedDomain(true);
    setIsSettingDomain(false);
    // Trigger enrichment asynchronously (non-blocking)
    triggerDomainEnrichment(finalDomain);
  };

  // Returns both weight and entityId for consistent multi-word entity coloring
  const getWordAttention = (word: string, map: ConceptMapItem[], impMap: ImportanceMapItem[], isAnalogy: boolean): { weight: number; entityId: number | undefined } => {
    const cleanedWord = cleanText(word).toLowerCase();

    // Priority 1: Check entity lookup for multi-word entity support
    if (entityLookup) {
      const lookup = isAnalogy ? entityLookup.analogy : entityLookup.tech;
      if (lookup[cleanedWord]) {
        return {
          weight: lookup[cleanedWord].weight,
          entityId: lookup[cleanedWord].entityId
        };
      }
    }

    // Priority 2: Check LLM-provided attention weights (single words)
    if (attentionMap) {
      const attentionList = isAnalogy ? attentionMap.analogy : attentionMap.tech;
      const attentionEntry = attentionList.find(item =>
        item.word === cleanedWord ||
        item.word.includes(cleanedWord) ||
        cleanedWord.includes(item.word)
      );
      if (attentionEntry) {
        return { weight: attentionEntry.weight, entityId: attentionEntry.entityId };
      }
    }

    // Fallback: Use heuristics if no attention map or word not found
    if (STOP_WORDS.has(cleanedWord) || cleanedWord.length < 3) {
      return { weight: 0.1, entityId: undefined };
    }

    const terms = isAnalogy
      ? map.map(c => cleanText(c.analogy_term).toLowerCase())
      : map.map(c => cleanText(c.tech_term).toLowerCase());

    if (terms.some(t => t.includes(cleanedWord) || cleanedWord.includes(t))) {
      return { weight: 1.0, entityId: undefined };
    }

    const importanceEntry = impMap.find(m =>
      cleanText(m.term).toLowerCase().includes(cleanedWord) ||
      cleanedWord.includes(cleanText(m.term).toLowerCase())
    );
    if (importanceEntry) {
      return { weight: importanceEntry.importance, entityId: undefined };
    }

    if (cleanedWord.length > 6) return { weight: 0.55, entityId: undefined };
    return { weight: 0.3, entityId: undefined };
  };

  // Backward-compatible wrapper that just returns weight
  const calculateIntelligentWeight = (word: string, map: ConceptMapItem[], impMap: ImportanceMapItem[], isAnalogy: boolean): number => {
    return getWordAttention(word, map, impMap, isAnalogy).weight;
  };

  const getConceptId = (word: string, map: ConceptMapItem[]): number => {
    const cleanedWord = cleanText(word).toLowerCase();
    for (const concept of map) {
      if (cleanText(concept.tech_term).toLowerCase().includes(cleanedWord) ||
          cleanedWord.includes(cleanText(concept.tech_term).toLowerCase())) return concept.id;
      if (cleanText(concept.analogy_term).toLowerCase().includes(cleanedWord) ||
          cleanedWord.includes(cleanText(concept.analogy_term).toLowerCase())) return concept.id;
    }
    return -1;
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Disable definitions in Morph mode - only allow in Expert Lock or Tech Lock
    if (viewMode === 'morph') return;

    let target = e.target as HTMLElement;

    // Walk up the DOM tree to find a word span (needed for KaTeX or nested elements)
    let wordSpan: HTMLElement | null = null;
    let currentElement: HTMLElement | null = target;
    for (let i = 0; i < 5 && currentElement; i++) {
      if (currentElement.tagName === 'SPAN' && currentElement.id?.startsWith('word-')) {
        wordSpan = currentElement;
        break;
      }
      currentElement = currentElement.parentElement;
    }

    // Get selected text from the selection or the word span
    const selection = window.getSelection();
    let selectedText = selection?.toString().trim();

    // If we found a word span, use its text content if no selection
    if (wordSpan) {
      if (!selectedText) {
        selectedText = wordSpan.textContent?.trim() || "";
      }
      target = wordSpan;
    } else if (!selectedText) {
      // No word span found and no selection - try using the target's text
      selectedText = target.textContent?.trim() || "";
    }

    if (!selectedText) return;

    const rect = target.getBoundingClientRect();
    const popupMinHeight = 250; // Approximate minimum popup height
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Smart positioning: show above if not enough space below
    const showAbove = spaceBelow < popupMinHeight && spaceAbove > spaceBelow;

    if (defPosition && selectedTerm) {
      setMiniSelectedTerm(selectedText);
      const top = showAbove
        ? rect.top + window.scrollY - popupMinHeight - 10
        : rect.bottom + window.scrollY + 10;
      setMiniDefPosition({ top, left: rect.left + window.scrollX });
      fetchDefinition(selectedText, defText, miniDefComplexity, true);
    } else {
      setSelectedTerm(selectedText);
      const top = showAbove
        ? rect.top + window.scrollY - popupMinHeight - 10
        : rect.bottom + window.scrollY + 10;
      setDefPosition({ top, left: rect.left + window.scrollX, placement: showAbove ? 'above' : 'below' });
      const context = isAnalogyVisualMode
        ? segments.map(s => s.analogy).join(' ')
        : segments.map(s => s.tech).join(' ');
      fetchDefinition(selectedText, context, defComplexity, false);
    }
  };

  const fetchDefinition = async (term: string, context: string, level: number = 50, isMini: boolean = false) => {
    if (isMini) {
      setIsLoadingMiniDef(true);
      setMiniDefText("");
      setMiniDefComplexity(level);
    } else {
      setIsLoadingDef(true);
      setDefText("");
      setDefSymbolGuide([]); // Clear previous symbol guide
      setDefComplexity(level);
    }

    try {
      const result = await fetchDefinitionApi(term, context, level);
      // Result is now { definition: string, symbol_guide: SymbolGuideEntry[] }
      const definition = typeof result === 'string' ? result : (result.definition || "Could not load definition.");
      const symbolGuideData = typeof result === 'object' && result.symbol_guide ? result.symbol_guide : [];

      if (isMini) {
        setMiniDefText(definition);
      } else {
        setDefText(definition);
        setDefSymbolGuide(symbolGuideData);
      }
    } catch (e) {
      const errText = "Could not load definition.";
      if (isMini) setMiniDefText(errText);
      else {
        setDefText(errText);
        setDefSymbolGuide([]);
      }
    } finally {
      if (isMini) setIsLoadingMiniDef(false);
      else setIsLoadingDef(false);
    }
  };

  const handleDefEliClick = (level: number, isMini: boolean = false) => {
    const term = isMini ? miniSelectedTerm : selectedTerm;
    const context = isMini ? defText : (isAnalogyVisualMode ? segments.map(s => s.analogy).join(' ') : segments.map(s => s.tech).join(' '));
    if ((isMini && isLoadingMiniDef) || (!isMini && isLoadingDef) || !term) return;
    fetchDefinition(term, context, level, isMini);
  };

  // Handle word click in definition popup for nested definitions (max 1 level)
  const handleDefWordClick = (word: string, rect: DOMRect) => {
    // Only open mini definition if we're in main definition popup (not already nested)
    if (!defPosition || miniDefPosition) return;

    const popupMinHeight = 200;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const showAbove = spaceBelow < popupMinHeight && spaceAbove > spaceBelow;

    setMiniSelectedTerm(word);
    const top = showAbove
      ? rect.top + window.scrollY - popupMinHeight - 10
      : rect.bottom + window.scrollY + 10;
    setMiniDefPosition({ top, left: rect.left + window.scrollX });
    fetchDefinition(word, defText, miniDefComplexity, true);
  };

  // === Selection Handlers for Multi-Word Definition ===

  // Clear selection state
  const clearSelectionState = useCallback(() => {
    setShowDefineButton(false);
    setDefineButtonPosition(null);
    setPendingSelection("");
    setIsSelectingText(false);
    setMorphLockedForSelection(false);
  }, []);

  // Handle selection start (mousedown/touchstart) - no longer locks morph since definitions disabled in morph mode
  const handleSelectionStart = useCallback(() => {
    // Definitions are disabled in morph mode, so no action needed
    // Selection handling only active in Expert Lock and Tech Lock modes
  }, []);

  // Handle selection end (mouseup/touchend) - detect selection and show button
  const handleSelectionEnd = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Disable definitions in Morph mode - only allow in Expert Lock or Tech Lock
    if (viewMode === 'morph') {
      setMorphLockedForSelection(false);
      setIsSelectingText(false);
      return;
    }

    // Small delay to let the selection complete
    if (selectionTimeoutRef.current) {
      clearTimeout(selectionTimeoutRef.current);
    }

    selectionTimeoutRef.current = setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();

      if (selectedText && selectedText.length > 0) {
        // Get the selection range to position the button
        const range = selection?.getRangeAt(0);
        if (range) {
          const rect = range.getBoundingClientRect();

          // Position the button above the selection (or below if near top)
          const buttonTop = rect.top < 60
            ? rect.bottom + window.scrollY + 8
            : rect.top + window.scrollY - 40;
          const buttonLeft = rect.left + window.scrollX + (rect.width / 2) - 40; // Center the button

          setPendingSelection(selectedText);
          setDefineButtonPosition({
            top: buttonTop,
            left: Math.max(10, buttonLeft), // Don't go off-screen left
            placement: rect.top < 60 ? 'below' : 'above'
          });
          setShowDefineButton(true);
        }
      } else {
        // No selection - clear state but keep morph locked briefly
        setShowDefineButton(false);
        setPendingSelection("");

        // Unlock morph after a brief delay (allows for re-selection attempts)
        setTimeout(() => {
          if (!window.getSelection()?.toString().trim()) {
            setMorphLockedForSelection(false);
            setIsSelectingText(false);
          }
        }, 300);
      }
    }, 10);
  }, [viewMode]);

  // Handle clicking the Define button
  const handleDefineSelection = useCallback(() => {
    if (!pendingSelection) return;

    // Clear the browser selection
    window.getSelection()?.removeAllRanges();

    // Get position for the definition popup
    const buttonPos = defineButtonPosition;
    const popupTop = buttonPos ? (typeof buttonPos.top === 'number' ? buttonPos.top : parseFloat(String(buttonPos.top))) + 50 : 200;
    const popupLeft = buttonPos ? Math.max(20, typeof buttonPos.left === 'number' ? buttonPos.left : parseFloat(String(buttonPos.left))) : 100;

    // Open definition popup
    if (defPosition && selectedTerm) {
      // Already have a popup open - use mini popup
      setMiniSelectedTerm(pendingSelection);
      setMiniDefPosition({ top: popupTop, left: popupLeft });
      fetchDefinition(pendingSelection, defText, miniDefComplexity, true);
    } else {
      // Open main popup
      setSelectedTerm(pendingSelection);
      setDefPosition({ top: popupTop, left: popupLeft, placement: 'below' });
      const context = isAnalogyVisualMode
        ? segments.map(s => s.analogy).join(' ')
        : segments.map(s => s.tech).join(' ');
      fetchDefinition(pendingSelection, context, defComplexity, false);
    }

    // Clear selection state
    clearSelectionState();
  }, [pendingSelection, defineButtonPosition, defPosition, selectedTerm, defText, miniDefComplexity, isAnalogyVisualMode, segments, defComplexity, clearSelectionState]);

  // Close define button when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Don't clear if clicking the define button itself
      const target = e.target as HTMLElement;
      if (target.closest('.define-selection-button')) return;

      // Clear selection state when clicking outside content area
      if (showDefineButton && contentRef.current && !contentRef.current.contains(target)) {
        clearSelectionState();
        window.getSelection()?.removeAllRanges();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDefineButton, clearSelectionState]);

  // Close controls panel when clicking outside
  useEffect(() => {
    if (!showControls) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking the panel itself or the toggle button
      if (controlsPanelRef.current?.contains(target)) return;
      if (controlsButtonRef.current?.contains(target)) return;

      setShowControls(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showControls]);

  // Close history panel when clicking outside
  useEffect(() => {
    if (!showHistory) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking the panel itself
      if (historyPanelRef.current?.contains(target)) return;
      // Don't close if clicking the history toggle button in header
      if (target.closest('[data-history-toggle]')) return;

      setShowHistory(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHistory, setShowHistory]);

  // Load mastery history from localStorage
  useEffect(() => {
    const loadMasteryHistory = () => {
      try {
        const stored = localStorage.getItem('signal_mastery_history');
        if (stored) {
          const history = JSON.parse(stored);
          setMasteryHistory(history);
        }
      } catch (err) {
        console.error('Failed to load mastery history:', err);
      }
    };

    loadMasteryHistory();

    // Listen for storage changes (in case mastery mode updates it)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'signal_mastery_history') {
        loadMasteryHistory();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Reload mastery history when returning from mastery mode
  useEffect(() => {
    if (!isMasteryMode) {
      const stored = localStorage.getItem('signal_mastery_history');
      if (stored) {
        try {
          setMasteryHistory(JSON.parse(stored));
        } catch {
          // ignore
        }
      }
    }
  }, [isMasteryMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case 'escape':
          // Close popups/modals in order of priority
          if (isMasteryMode) setIsMasteryMode(false);
          else if (isDualPaneMode) setIsDualPaneMode(false);
          else if (isConstellationMode) setIsConstellationMode(false);
          else if (showShortcutsLegend) setShowShortcutsLegend(false);
          else if (showQuizModal) setShowQuizModal(false);
          else if (showSynthesis) setShowSynthesis(false);
          else if (miniDefPosition) setMiniDefPosition(null);
          else if (defPosition) {
            setDefPosition(null);
            setSelectedTerm(null);
            setMiniDefPosition(null);
          }
          else if (showControls) setShowControls(false);
          else if (showFollowUp) setShowFollowUp(false);
          else if (disambiguation) setDisambiguation(null);
          break;
        case 'm':
          // Toggle to Morph mode
          if (!hasStarted) return;
          setViewMode('morph');
          setIsNarrativeMode(false);
          break;
        case 'e':
          // Expert Lock (analogy/domain view)
          if (!hasStarted) return;
          setViewMode('nfl');
          setIsNarrativeMode(false);
          break;
        case 't':
          // Tech Lock
          if (!hasStarted) return;
          setViewMode('tech');
          setIsNarrativeMode(false);
          break;
        case 's':
          // Story mode toggle (mutually exclusive with Bullets and Essence)
          if (!hasStarted) return;
          if (!isNarrativeMode) {
            // Turning on Story - disable Bullets and Essence
            setIsBulletMode(false);
            if (isFirstPrinciplesMode) {
              setShowCondensedView(false);
              setIsFirstPrinciplesMode(false);
            }
            // Lock to Expert mode when enabling Story from Morph to prevent transition jitter
            if (viewMode === 'morph') {
              setViewMode('nfl');
            }
          }
          setIsNarrativeMode(!isNarrativeMode);
          break;
        case 'b':
          // Bullet point mode toggle (mutually exclusive with Story and Essence)
          if (!hasStarted || viewMode !== 'tech') return;
          if (!isBulletMode) {
            // Turning on Bullets - disable Story and Essence
            setIsNarrativeMode(false);
            if (isFirstPrinciplesMode) {
              setShowCondensedView(false);
              setIsFirstPrinciplesMode(false);
            }
          }
          setIsBulletMode(!isBulletMode);
          break;
        case 'q':
          // Quiz me
          if (!hasStarted || isQuizLoading || isLoading) return;
          fetchQuiz(false);
          break;
        case 'd':
          // Dark mode toggle
          setIsDarkMode(!isDarkMode);
          break;
        case 'i':
          // Immersive mode toggle
          setIsImmersive(!isImmersive);
          break;
        case 'c':
          // Controls panel toggle
          setShowControls(!showControls);
          break;
        case 'h':
          // History panel toggle
          setShowHistory(!showHistory);
          break;
        case '?':
          // Show keyboard shortcuts legend
          setShowShortcutsLegend(!showShortcutsLegend);
          break;
        case 'g':
          // Toggle constellation/graph mode
          if (!hasStarted) return;
          setIsConstellationMode(!isConstellationMode);
          break;
        case 'p':
          // Toggle dual-pane isomorphic view
          if (!hasStarted) return;
          setIsDualPaneMode(!isDualPaneMode);
          break;
        case 'u':
          // Toggle mastery mode (Test My Understanding)
          if (!hasStarted || isLoading) return;
          setIsMasteryMode(!isMasteryMode);
          break;
        case '1':
          // Study mode
          setAmbianceMode(ambianceMode === 'study' ? 'none' : 'study');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasStarted, showQuizModal, showSynthesis, miniDefPosition, defPosition, showControls, showFollowUp, disambiguation, isNarrativeMode, isDarkMode, isImmersive, showHistory, isQuizLoading, isLoading, showShortcutsLegend, isConstellationMode, isDualPaneMode, isMasteryMode, ambianceMode, textScale, viewMode, isBulletMode]);

  // Noise generator for Study Mode (white, pink, brown noise)
  useEffect(() => {
    if (ambianceMode === 'study' && noiseType !== 'none') {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const bufferSize = 4096;
      const noiseProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);

      // State for noise generation
      let lastOut = 0.0;
      // Pink noise state (Voss-McCartney algorithm)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

      noiseProcessor.onaudioprocess = (e) => {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;

          if (noiseType === 'white') {
            // White noise - pure random
            output[i] = white * 0.5;
          } else if (noiseType === 'pink') {
            // Pink noise - Voss-McCartney algorithm
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
            b6 = white * 0.115926;
          } else if (noiseType === 'brown') {
            // Brown noise - integrated white noise
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 3.5;
          }
        }
      };

      // Create filter chain based on noise type
      const gainNode = audioContext.createGain();
      gainNode.gain.value = noiseVolume;

      if (noiseType === 'brown') {
        // Low-pass filter for brown noise
        const lowPassFilter = audioContext.createBiquadFilter();
        lowPassFilter.type = 'lowpass';
        lowPassFilter.frequency.value = 300;
        lowPassFilter.Q.value = 0.7;
        noiseProcessor.connect(lowPassFilter);
        lowPassFilter.connect(gainNode);
      } else {
        noiseProcessor.connect(gainNode);
      }

      gainNode.connect(audioContext.destination);
      noiseRef.current = { ctx: audioContext, gain: gainNode, processor: noiseProcessor };

      return () => {
        noiseProcessor.disconnect();
        gainNode.disconnect();
        audioContext.close();
        noiseRef.current = null;
      };
    } else if (noiseRef.current) {
      noiseRef.current.ctx.close();
      noiseRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambianceMode, noiseType]); // noiseVolume handled separately to avoid audio restart

  // Update noise volume in real-time
  useEffect(() => {
    if (noiseRef.current) {
      noiseRef.current.gain.gain.value = noiseVolume;
    }
  }, [noiseVolume]);

  // Get difficulty based on question number
  const getQuizDifficulty = (questionNum: number): QuizDifficulty => {
    if (questionNum === 1) return 'easy';
    if (questionNum === 2) return 'medium';
    if (questionNum === 3) return 'hard';
    return 'advanced';
  };

  const fetchQuiz = async (isRetry: boolean = false) => {
    if (isQuizLoading) return;
    setIsQuizLoading(true);
    setQuizFeedback(null);

    const context = segments.map(s => `Technical: ${s.tech} | Analogy: ${s.analogy}`).join('\n');
    const difficulty = getQuizDifficulty(quizQuestionNumber);

    try {
      let quiz: QuizData | null;

      if (isRetry && quizCurrentConcept && quizCurrentCorrectAnswer) {
        // Retry mode - rephrase same question
        quiz = await generateQuiz(
          lastSubmittedTopic,
          analogyDomain,
          context,
          difficulty,
          { concept: quizCurrentConcept, correctAnswer: quizCurrentCorrectAnswer }
        );
      } else {
        // Normal mode - new question
        quiz = await generateQuiz(lastSubmittedTopic, analogyDomain, context, difficulty);
      }

      if (quiz) {
        setQuizData(quiz);
        setShowQuizModal(true);
        // Store concept info for potential retry
        if (!isRetry) {
          setQuizCurrentConcept(quiz.concept || '');
          setQuizCurrentCorrectAnswer(quiz.options[quiz.correctIndex] || '');
        }
      }
    } catch (e) {
      console.error("Quiz failed", e);
    } finally {
      setIsQuizLoading(false);
    }
  };

  const handleQuizRetry = () => {
    setQuizRetryCount(prev => prev + 1);
    fetchQuiz(true);
  };

  const handleNextQuestion = () => {
    setQuizQuestionNumber(prev => prev + 1);
    setQuizRetryCount(0);
    setQuizCurrentConcept('');
    setQuizCurrentCorrectAnswer('');
    fetchQuiz(false);
  };

  const handleQuizOptionClick = (idx: number) => {
    if (!quizData || quizFeedback) return;
    if (idx === quizData.correctIndex) {
      setQuizFeedback(`Correct! ${quizData.explanation || ""}`);
    } else {
      setQuizFeedback(`Incorrect. The answer was: ${quizData.options[quizData.correctIndex]}. ${quizData.explanation || ""}`);
    }
  };

  const handleAskTutor = async (questionToAsk?: string) => {
    const query = questionToAsk || followUpQuery;
    if (!query) return;
    setIsTutorLoading(true);

    // Build context based on whether we're branching or continuing
    let contextHistory: TutorHistoryEntry[];
    if (selectedHistoryBranch !== null) {
      // Branching: use history up to and including the selected branch point
      // Each pair is 2 entries, so branch index N means entries 0 to (N+1)*2-1
      const branchEndIndex = (selectedHistoryBranch + 1) * 2;
      contextHistory = tutorHistory.slice(0, branchEndIndex);
    } else {
      // Not branching: use last MAX_BRANCH_CONTEXT pairs (10 entries)
      contextHistory = tutorHistory.slice(-(MAX_BRANCH_CONTEXT * 2));
    }

    const conversationContext = contextHistory.map(entry =>
      `${entry.role === 'user' ? 'User' : 'Tutor'}: ${entry.text}`
    ).join('\n');

    try {
      const result = await askTutor(lastSubmittedTopic, analogyDomain, query, conversationContext);
      if (result) {
        setTutorResponse({ question: query, answer: result, mode: "Tutor" });
        setFollowUpQuery("");

        // Update history - if branching, truncate to branch point first
        setTutorHistory(prev => {
          let baseHistory: TutorHistoryEntry[];
          if (selectedHistoryBranch !== null) {
            // Truncate to branch point and add new Q&A
            const branchEndIndex = (selectedHistoryBranch + 1) * 2;
            baseHistory = prev.slice(0, branchEndIndex);
          } else {
            baseHistory = prev;
          }
          return [
            ...baseHistory,
            { role: 'user' as const, text: query },
            { role: 'model' as const, text: result }
          ].slice(-MAX_TUTOR_HISTORY);
        });

        // Clear branch selection after asking (we're now at the new end)
        setSelectedHistoryBranch(null);
      }
    } catch (e) {
      console.error("Tutor failed", e);
    } finally {
      setIsTutorLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    }
    document.body.removeChild(textarea);
  };

  // Format mastery summary as Markdown for export
  const formatMasterySummaryAsMarkdown = (entry: CompleteMasteryHistory): string => {
    const lines: string[] = [
      `# ${entry.topic}`,
      `*Mastered via ${entry.domain} ${entry.domainEmoji} on ${new Date(entry.completedAt).toLocaleDateString()}*`,
      '',
      '## 🏆 Your Mastery Summary',
      '',
      '### Key Strength',
      entry.masterySummary.keyStrength,
      '',
      '### Core Intuition',
      entry.masterySummary.coreIntuition,
      '',
      '### What Made You Unique',
      entry.masterySummary.uniqueApproach,
      '',
      '## 📊 Stage Scores',
      '',
      `| Stage | Score |`,
      `|-------|-------|`,
      `| Stage 1 (Pure Intuition) | ${entry.finalScores.stage1}% |`,
      `| Stage 2 (Vocabulary) | ${entry.finalScores.stage2}% |`,
      `| Stage 3 (Full Mastery) | ${entry.finalScores.stage3}% |`,
      '',
      '## 📖 Glossary',
      '',
      '| Technical Term | Analogy Equivalent | Technical Definition |',
      '|----------------|-------------------|---------------------|',
    ];

    entry.glossary.forEach(keyword => {
      lines.push(`| **${keyword.term}** | ${keyword.analogyTerm} | ${keyword.techDefinition6 || keyword.techDefinition3 || ''} |`);
    });

    return lines.join('\n');
  };

  const loadFromHistory = (entry: HistoryItem) => {
    // Reset all state first to prevent stale data bleeding through
    resetAllState({ keepDomain: true });

    // Now load the history entry
    setTopic(entry.topic);
    setLastSubmittedTopic(entry.topic);
    setAnalogyDomain(entry.domain);
    loadContent(entry.data, entry.topic);
    setShowHistory(false);
    setHasStarted(true);
    setIsViewingFromHistory(true); // Lock search bar when viewing saved content
  };

  // Return to home - clears history view mode and resets for new search
  const returnToHome = () => {
    setIsViewingFromHistory(false);
    setHasStarted(false);
    setTopic("");
    setProcessedWords([]);
    setSegments([]);
    setTechnicalExplanation("");
    setAnalogyExplanation("");
    setContextData(null);
    setCondensedData(null);
  };

  // Check if morph should be locked (definition popup open OR user is selecting text)
  const isDefinitionPopupOpen = !!(defPosition || miniDefPosition);
  const isMorphLocked = isDefinitionPopupOpen || morphLockedForSelection;

  const handleMouseEnterWrapper = () => {
    if (isMobile) return;
    if (isDraggingSymbolGuide) return; // Ignore when dragging Symbol Guide
    setIsMouseInside(true);

    if (!hasStarted || viewMode !== 'morph' || isScrolling) return;
    // Lock morph when definition popup is open or user is selecting
    if (isMorphLocked) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setIsHovering(true), 150);
  };

  const handleMouseLeaveWrapper = () => {
    if (isMobile) return;
    if (isDraggingSymbolGuide) return; // Ignore when dragging Symbol Guide
    setIsMouseInside(false);

    // Lock morph when definition popup is open or user is selecting
    if (isMorphLocked) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (viewMode === 'morph') setIsHovering(false);
  };

  // Toggle First Principles view in Tech mode with smooth morph transition
  const toggleFirstPrinciplesMode = () => {
    if (!condensedData) return;

    // Clear any pending timers
    if (condensedMorphTimerRef.current) {
      clearTimeout(condensedMorphTimerRef.current);
    }

    if (isFirstPrinciplesMode) {
      // Transition OUT of first principles
      setIsCondensedMorphing(true);
      condensedMorphTimerRef.current = setTimeout(() => {
        setShowCondensedView(false);
        setIsFirstPrinciplesMode(false);
        setTimeout(() => setIsCondensedMorphing(false), 150);
      }, 200);
    } else {
      // Transition INTO first principles (mutually exclusive with Story and Bullets)
      setIsNarrativeMode(false);
      setIsBulletMode(false);
      // If in Morph mode, switch to Tech mode so Essence view renders
      if (viewMode === 'morph') {
        setViewMode('tech');
      }
      setIsCondensedMorphing(true);
      condensedMorphTimerRef.current = setTimeout(() => {
        setShowCondensedView(true);
        setIsFirstPrinciplesMode(true);
        setTimeout(() => setIsCondensedMorphing(false), 150);
      }, 200);
    }
  };

  const handleTouchToggle = () => {
    // Lock morph when definition popup is open or user is selecting
    if (isMorphLocked) return;
    if (isMobile && viewMode === 'morph' && hasStarted) setIsHovering(!isHovering);
  };

  const cycleViewMode = () => {
    if (isNarrativeMode) { setIsNarrativeMode(false); return; }
    if (viewMode === 'morph') setViewMode('nfl');
    else if (viewMode === 'nfl') setViewMode('tech');
    else setViewMode('morph');
  };

  const getViewModeLabel = () => {
    if (isNarrativeMode) return { text: "Story", icon: <BookOpenText size={14} /> };
    if (viewMode === 'morph') return { text: "Morph", icon: <Unlock size={14} /> };
    if (viewMode === 'nfl') return { text: "Expert", icon: <span className="text-xs">{domainEmoji}</span> };
    return { text: "Tech", icon: <Lock size={14} /> };
  };

  // Comprehensive state reset - clears everything except history and domain selection
  const resetAllState = (options: { keepDomain?: boolean; keepTopic?: boolean } = {}) => {
    // Content State
    setSegments([]);
    setConceptMap([]);
    setImportanceMap([]);
    setAttentionMap(null);
    setEntityLookup(null);
    setProcessedWords([]);
    setTechnicalExplanation("");
    setAnalogyExplanation("");
    setContextData(null);
    setCondensedData(null);
    setSynthesisSummary("");
    setSynthesisCitation("");

    // UI State
    setIsLoading(false);
    setHasStarted(false);
    setIsHovering(false);
    setIsScrolling(false);
    setIsTransitioning(false);
    setShowSynthesis(false);

    // Topic State
    if (!options.keepTopic) {
      setTopic("");
      setLastSubmittedTopic("");
    }

    // Definition State
    setSelectedTerm(null);
    setDefPosition(null);
    setDefText("");
    setIsLoadingDef(false);

    // Mini Definition State
    setMiniSelectedTerm(null);
    setMiniDefPosition(null);
    setMiniDefText("");
    setIsLoadingMiniDef(false);

    // Tutor State
    setShowFollowUp(false);
    setFollowUpQuery("");
    setTutorResponse(null);
    setIsTutorLoading(false);
    setTutorHistory([]);
    setShowTutorHistory(false);
    setTutorThreshold(0.5);
    setIsTutorColorMode(false);
    setSelectedHistoryBranch(null);

    // Quiz State
    setShowQuizModal(false);
    setQuizData(null);
    setQuizFeedback(null);
    setIsQuizLoading(false);
    setQuizQuestionNumber(1);
    setQuizRetryCount(0);
    setQuizCurrentConcept('');
    setQuizCurrentCorrectAnswer('');

    // Disambiguation State
    setDisambiguation(null);
    setIsDisambiguating(false);
    setProximityWarning(null);

    // Selection State
    setShowDefineButton(false);
    setDefineButtonPosition(null);
    setPendingSelection("");
    setIsSelectingText(false);
    setMorphLockedForSelection(false);

    // Complexity State
    setMainComplexity(50);
    setIsRegenerating(false);

    // View modes - reset to defaults
    setViewMode('morph');
    setIsNarrativeMode(false);
    setIsConstellationMode(false);
    setIsDualPaneMode(false);

    // Mastery mode state - clear cached session when content changes
    setIsMasteryMode(false);
    setMasterySessionCache(null);
  };

  // Legacy reset function for backwards compatibility
  const resetAll = () => {
    resetAllState();
  };

  // Render helpers
  const renderRichText = (text: string, colorClass: string = "text-inherit"): React.ReactNode => {
    if (!text) return null;
    // Sanitize first to fix malformed LaTeX, then wrap bare commands
    const sanitized = sanitizeLatex(text);
    const processed = wrapBareLatex(sanitized);
    const parts = processed.split(LATEX_REGEX);

    // Helper to render markdown bold/italic within text
    const renderMarkdown = (str: string, key: string): React.ReactNode => {
      // Split on **bold** and *italic* patterns
      const markdownParts: React.ReactNode[] = [];
      let remaining = str;
      let partIndex = 0;

      while (remaining.length > 0) {
        // Look for **bold** first
        const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
        // Look for *italic*
        const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);

        // Find which comes first
        const boldIdx = boldMatch ? remaining.indexOf(boldMatch[0]) : -1;
        const italicIdx = italicMatch ? remaining.indexOf(italicMatch[0]) : -1;

        if (boldIdx === -1 && italicIdx === -1) {
          // No more markdown, add remaining text
          if (remaining) markdownParts.push(<span key={`${key}-${partIndex++}`}>{remaining}</span>);
          break;
        }

        // Process whichever comes first
        if (boldIdx !== -1 && (italicIdx === -1 || boldIdx <= italicIdx)) {
          // Add text before bold
          if (boldIdx > 0) {
            markdownParts.push(<span key={`${key}-${partIndex++}`}>{remaining.slice(0, boldIdx)}</span>);
          }
          // Add bold text
          markdownParts.push(<strong key={`${key}-${partIndex++}`} className="font-semibold">{boldMatch![1]}</strong>);
          remaining = remaining.slice(boldIdx + boldMatch![0].length);
        } else {
          // Add text before italic
          if (italicIdx > 0) {
            markdownParts.push(<span key={`${key}-${partIndex++}`}>{remaining.slice(0, italicIdx)}</span>);
          }
          // Add italic text
          markdownParts.push(<em key={`${key}-${partIndex++}`}>{italicMatch![1]}</em>);
          remaining = remaining.slice(italicIdx + italicMatch![0].length);
        }
      }

      return markdownParts.length > 0 ? markdownParts : str;
    };

    return parts.map((part, i) => {
      if (!part) return null;
      const isLatex = part.startsWith('$') || part.startsWith('\\(') || part.startsWith('\\[') || (part.startsWith('\\') && part.length > 1);

      if (isLatex) {
        let latexContent = part.replace(/\\\\/g, "\\");
        if (latexContent.startsWith('$$')) latexContent = latexContent.slice(2, -2);
        else if (latexContent.startsWith('$')) latexContent = latexContent.slice(1, -1);

        if (window.katex) {
          try {
            const html = window.katex.renderToString(latexContent, { throwOnError: false });
            return <span key={i} dangerouslySetInnerHTML={{ __html: html }} className="inline-block not-italic normal-case" />;
          } catch (e) {
            return <span key={i}>{latexContent}</span>;
          }
        }
        return <span key={i}>{latexContent}</span>;
      }
      return <span key={i} className={colorClass}>{renderMarkdown(part, `md-${i}`)}</span>;
    });
  };

  const renderAttentiveText = (
    text: string,
    currentThreshold: number,
    setThresholdState: React.Dispatch<React.SetStateAction<number>> | null,
    isColorMode: boolean,
    setColorMode: React.Dispatch<React.SetStateAction<boolean>> | null,
    customMap: ConceptMapItem[] | null,
    textColor: string,
    textScale?: number,
    onWordClick?: (word: string, rect: DOMRect) => void
  ) => {
    if (!text) return null;
    // Sanitize first to fix malformed LaTeX, then wrap bare commands
    const sanitized = sanitizeLatex(text);
    const processed = wrapBareLatex(sanitized);
    const borderColor = textColor.includes("neutral-200") || textColor.includes("white") ? "border-neutral-700" : "border-neutral-300";
    const sliderBg = textColor.includes("neutral-200") || textColor.includes("white") ? "bg-neutral-700" : "bg-neutral-300";
    const sliderAccent = textColor.includes("neutral-200") || textColor.includes("white") ? "accent-blue-400" : "accent-blue-600";
    const btnClass = textColor.includes("neutral-200") || textColor.includes("white") ? "text-neutral-400 hover:text-white" : "text-neutral-500 hover:text-black";
    const btnActiveClass = textColor.includes("neutral-200") || textColor.includes("white") ? "bg-neutral-700 text-white" : "bg-neutral-200 text-black";

    const textSegments = processed.split(LATEX_REGEX);

    return (
      <div>
        <p className={`${textColor} text-sm leading-relaxed`}>
          {textSegments.map((segment, i) => {
            const isLatex = segment.startsWith('$') || segment.startsWith('\\(') || segment.startsWith('\\[') || (segment.startsWith('\\') && segment.length > 1);
            let contentToRender = segment;
            let forceRender = false;
            if (!isLatex && /^\\[a-zA-Z]+/.test(segment)) {
              contentToRender = `$${segment}$`;
              forceRender = true;
            }

            if (isLatex || forceRender) {
              try {
                let latexContent = contentToRender.replace(/\\\\/g, "\\");
                if (latexContent.startsWith('$$')) latexContent = latexContent.slice(2, -2);
                else if (latexContent.startsWith('$')) latexContent = latexContent.slice(1, -1);
                if (window.katex) {
                  const html = window.katex.renderToString(latexContent, { throwOnError: false });
                  return <span key={i} dangerouslySetInnerHTML={{ __html: html }} className="inline-block not-italic normal-case" />;
                }
                return <span key={i}>{latexContent}</span>;
              } catch (e) {
                return <span key={i}>{segment}</span>;
              }
            } else {
              return segment.split(/(\s+)/).map((word, j) => {
                if (!word) return null;
                if (/^\s+$/.test(word)) return <span key={`${i}-${j}`}>{word}</span>;

                const activeMap = customMap || conceptMap;
                // Use getWordAttention for both weight and entityId (for consistent multi-word coloring)
                const { weight, entityId } = getWordAttention(word, activeMap, importanceMap, false);
                // Invert threshold: low slider = high bar, high slider = low bar
                // At 100% (threshold >= 0.99), ALL words should be fully visible
                const effectiveThreshold = 1.1 - currentThreshold;
                const isImportant = currentThreshold >= 0.99 || weight >= effectiveThreshold;

                let colorClassName = "";
                if (isColorMode && isImportant) {
                  // Priority 1: Use entityId for consistent multi-word entity coloring
                  if (entityId !== undefined) {
                    colorClassName = CONCEPT_COLORS[entityId % CONCEPT_COLORS.length];
                  } else {
                    // Fallback: Use conceptId from concept map
                    const conceptId = getConceptId(word, activeMap);
                    if (conceptId !== -1) {
                      colorClassName = CONCEPT_COLORS[conceptId % CONCEPT_COLORS.length];
                    } else if (weight > 0.6) {
                      colorClassName = "text-neutral-500";
                    }
                  }
                }

                const scale = (isImportant ? 1.1 : 0.9) * (textScale || 1);
                const opacity = isImportant ? 1 : 0.7;
                const fontWeight = isImportant ? 600 : 400;
                const cleanWord = word.replace(/[.,!?;:'"()[\]{}]/g, '').trim();
                const isClickable = onWordClick && cleanWord.length > 2;

                return (
                  <span
                    key={`${i}-${j}`}
                    className={`${colorClassName} ${isClickable ? 'cursor-pointer hover:underline hover:decoration-dotted' : ''}`}
                    style={{
                      fontSize: `${scale}em`,
                      opacity: opacity,
                      fontWeight: fontWeight,
                      transition: 'all 0.2s ease',
                      display: 'inline-block'
                    }}
                    onClick={isClickable ? (e) => {
                      e.stopPropagation();
                      const rect = (e.target as HTMLElement).getBoundingClientRect();
                      onWordClick(cleanWord, rect);
                    } : undefined}
                  >
                    {word}
                  </span>
                );
              });
            }
          })}
        </p>
        {setThresholdState && (
          <div className={`pt-3 border-t ${borderColor} flex items-center justify-between gap-4 mt-2`}>
            <div className="flex items-center gap-3 flex-1">
              <Eye size={12} className={textColor} />
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={currentThreshold}
                onChange={(e) => setThresholdState(parseFloat(e.target.value))}
                className={`w-full h-1 ${sliderBg} rounded-lg appearance-none cursor-pointer ${sliderAccent} transition-colors`}
                title="Filter noise"
              />
            </div>
            {setColorMode && (
              <button
                onClick={() => setColorMode(!isColorMode)}
                className={`p-1.5 rounded-md transition-colors ${isColorMode ? btnActiveClass : btnClass}`}
                title="Toggle Isomorphic Colors"
              >
                <Palette size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Group processedWords into sentences for bullet mode
  const groupWordsIntoSentences = (words: ProcessedWord[]): ProcessedWord[][] => {
    const sentences: ProcessedWord[][] = [];
    let currentSentence: ProcessedWord[] = [];

    words.forEach((word, i) => {
      currentSentence.push(word);
      // Check if this word ends a sentence (. ! ? followed by space or end)
      const text = word.text.trim();
      const nextWord = words[i + 1];
      const endsWithPunctuation = /[.!?]$/.test(text);
      const nextIsSpace = nextWord?.isSpace;
      const nextStartsCapital = words[i + 2]?.text.match(/^[A-Z]/);

      if (endsWithPunctuation && (nextIsSpace || !nextWord)) {
        // Include trailing space in sentence
        if (nextIsSpace) {
          currentSentence.push(nextWord);
        }
        // Only split if next word starts with capital (indicates new sentence)
        if (!nextWord || nextStartsCapital) {
          sentences.push([...currentSentence]);
          currentSentence = [];
        }
      }
    });

    // Add remaining words as final sentence
    if (currentSentence.length > 0) {
      sentences.push(currentSentence);
    }

    return sentences.filter(s => s.some(w => !w.isSpace)); // Filter empty sentences
  };

  // Extract unique math symbols from content for glossary
  const extractSymbolsFromContent = useCallback((words: ProcessedWord[]): Array<{ symbol: string; name: string; meaning: string }> => {
    const foundSymbols = new Set<string>();
    const result: Array<{ symbol: string; name: string; meaning: string }> = [];

    // Symbols to look for in content
    const symbolMap: Record<string, { name: string; meaning: string }> = {
      'Σ': { name: 'Sigma', meaning: 'Summation or standard deviation' },
      'σ': { name: 'sigma', meaning: 'Standard deviation or small sigma' },
      '∈': { name: 'Element of', meaning: '"belongs to" or "is in"' },
      '∉': { name: 'Not element of', meaning: '"does not belong to"' },
      '⊂': { name: 'Subset', meaning: 'Is contained within' },
      '⊃': { name: 'Superset', meaning: 'Contains' },
      '∪': { name: 'Union', meaning: 'Combined set of all elements' },
      '∩': { name: 'Intersection', meaning: 'Common elements only' },
      '∀': { name: 'For all', meaning: 'Applies to every element' },
      '∃': { name: 'Exists', meaning: 'At least one exists' },
      '∞': { name: 'Infinity', meaning: 'Without bound or limit' },
      '∂': { name: 'Partial', meaning: 'Partial derivative' },
      '∇': { name: 'Nabla/Del', meaning: 'Gradient operator' },
      '∫': { name: 'Integral', meaning: 'Area under curve / continuous sum' },
      'α': { name: 'Alpha', meaning: 'First parameter or learning rate' },
      'β': { name: 'Beta', meaning: 'Second parameter or coefficient' },
      'γ': { name: 'Gamma', meaning: 'Third parameter or discount factor' },
      'δ': { name: 'Delta', meaning: 'Small change or difference' },
      'Δ': { name: 'Delta', meaning: 'Change in value' },
      'ε': { name: 'Epsilon', meaning: 'Very small quantity or error' },
      'θ': { name: 'Theta', meaning: 'Angle or model parameters' },
      'λ': { name: 'Lambda', meaning: 'Eigenvalue or rate parameter' },
      'μ': { name: 'Mu', meaning: 'Mean (average) value' },
      'π': { name: 'Pi', meaning: 'Circle ratio ≈ 3.14159' },
      'φ': { name: 'Phi', meaning: 'Golden ratio or feature transform' },
      'ψ': { name: 'Psi', meaning: 'Wave function or auxiliary variable' },
      'ω': { name: 'Omega', meaning: 'Angular frequency' },
      'Ω': { name: 'Omega', meaning: 'Sample space or ohm' },
      'ρ': { name: 'Rho', meaning: 'Correlation coefficient or density' },
      'τ': { name: 'Tau', meaning: 'Time constant' },
      '≈': { name: 'Approximately', meaning: 'Roughly equal to' },
      '≠': { name: 'Not equal', meaning: 'Different from' },
      '≤': { name: 'Less or equal', meaning: 'At most' },
      '≥': { name: 'Greater or equal', meaning: 'At least' },
      '→': { name: 'Arrow', meaning: 'Maps to or approaches' },
      '⟹': { name: 'Implies', meaning: 'Therefore or leads to' },
      '⟺': { name: 'If and only if', meaning: 'Equivalent statements' },
    };

    // Scan all words for symbols
    const fullText = words.map(w => w.text).join('');
    for (const [symbol, info] of Object.entries(symbolMap)) {
      if (fullText.includes(symbol) && !foundSymbols.has(symbol)) {
        foundSymbols.add(symbol);
        result.push({ symbol, ...info });
      }
    }

    return result;
  }, []);

  const renderWord = (item: ProcessedWord, index: number) => {
    const wordId = `word-${index}`;
    if (item.isSpace) return <span key={index}>{item.text}</span>;

    // Invert threshold: low slider = high bar (show less), high slider = low bar (show all)
    // At 100% (threshold >= 0.99), ALL words should be fully visible and bold
    const effectiveThreshold = 1.1 - threshold;
    const isImportant = threshold >= 0.99 || item.weight >= effectiveThreshold;
    // Only show clickable cursor in locked modes (not morph mode)
    const isClickableMode = viewMode !== 'morph';
    let style: React.CSSProperties = {
      display: 'inline-block',
      // Only apply morph transitions in morph mode - not in story/tech/nfl modes
      transition: viewMode === 'morph' ? 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
      // Make important words look clickable only in locked modes
      cursor: isImportant && isClickableMode ? 'pointer' : 'default',
    };
    let segmentColorClass = "";
    let heatmapColorClass = "";
    const isSelected = selectedTerm && cleanText(item.text).toLowerCase().includes(selectedTerm.toLowerCase());

    if (isIsomorphicMode && item.conceptIndex !== undefined && item.conceptIndex >= 0) {
      segmentColorClass = CONCEPT_COLORS[item.conceptIndex % CONCEPT_COLORS.length];
      heatmapColorClass = CONCEPT_BG_COLORS[item.conceptIndex % CONCEPT_BG_COLORS.length];
    }

    if (mode === 'opacity') {
      style.opacity = isImportant ? 1 : 0.15;
      style.filter = isImportant ? 'none' : 'blur(0.5px)';
      style.fontWeight = isImportant ? 700 : 400;
    }
    if (mode === 'size') {
      const scale = isImportant ? 1.2 : 0.85;
      style.fontSize = `${scale}em`;
      style.opacity = isImportant ? 1 : 0.6;
      style.fontWeight = isImportant ? 700 : 300;
      style.lineHeight = '1.2';
    }
    if (mode === 'heatmap') {
      if (isImportant) {
        style.color = '#000';
        style.fontWeight = 600;
        style.padding = '0 2px';
        style.borderRadius = '4px';
        if (!isIsomorphicMode) {
          // Use pure weight-based intensity (higher weight = more highlight)
          const intensity = Math.min(item.weight, 1);
          style.backgroundColor = `hsla(50, 100%, 75%, ${0.3 + (intensity * 0.7)})`;
        }
      } else {
        style.color = '#888';
      }
    }

    if (isSelected) {
      style.backgroundColor = '#fef08a';
      style.color = 'black';
      style.borderRadius = '4px';
      style.padding = '0 4px';
    }

    let classes = "";
    if (isImportant && isIsomorphicMode && item.conceptIndex !== undefined && item.conceptIndex >= 0) {
      // Rainbow text colors always apply when isIsomorphicMode is on
      classes = segmentColorClass;

      // Background heatmaps only apply when mode === 'heatmap' (user toggles in features menu)
      if (mode === 'heatmap') {
        classes = `${segmentColorClass} ${heatmapColorClass}`;
        style.backgroundColor = undefined; // Let Tailwind handle the background
        style.padding = '0 2px';
        style.borderRadius = '4px';
      }
    }

    let contentToRender = item.text;
    let forceRender = false;
    if (!item.isLatex && /^\\[a-zA-Z]+/.test(item.text)) {
      contentToRender = `$${item.text}$`;
      forceRender = true;
    }

    if (item.isLatex || forceRender) {
      let latexContent = contentToRender.replace(/\\\\/g, "\\");
      let rawContent = latexContent.startsWith('$$')
        ? latexContent.slice(2, -2)
        : latexContent.startsWith('$')
          ? latexContent.slice(1, -1)
          : latexContent;

      if (!isKatexLoaded || !window.katex) {
        return <span id={wordId} key={index} className={classes} title="Math loading...">{rawContent}</span>;
      }

      try {
        const html = window.katex.renderToString(rawContent, { throwOnError: false, displayMode: false });
        const mathStyle = { ...style, display: 'inline-block', margin: '0 4px' };
        return (
          <span
            id={wordId}
            key={index}
            style={mathStyle}
            className={`${classes} not-italic normal-case`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } catch (e) {
        return <span id={wordId} key={index} style={style} className={classes}>{item.text}</span>;
      }
    }

    return (
      <span
        id={wordId}
        key={index}
        style={style}
        className={classes}
      >
        {item.text}
      </span>
    );
  };

  // Process words effect - uses FULL explanations (250+ words) not short segment snippets
  useEffect(() => {
    // Need either full explanations or segments to display content
    const hasFullExplanation = technicalExplanation || analogyExplanation;
    const hasSegments = segments.length > 0;
    if ((!hasFullExplanation && !hasSegments) || isLoading) return;

    const allTokens: ProcessedWord[] = [];
    let fallbackCounter = -1;

    // Select the appropriate full text based on view mode
    // Priority: Full explanation > Joined segments (fallback)
    let textToParse: string;
    const isTechnicalMode = !isNarrativeMode && !isAnalogyVisualMode;

    if (isNarrativeMode) {
      // Narrative mode: join all narrative segments (no full narrative explanation exists)
      textToParse = segments.map(s => s.narrative).filter(Boolean).join(' ');
    } else if (isAnalogyVisualMode) {
      // Analogy/Expert mode: use full analogy explanation, fall back to joined segments
      textToParse = analogyExplanation || segments.map(s => s.analogy).filter(Boolean).join(' ');
    } else {
      // Technical mode: use full technical explanation, fall back to joined segments
      textToParse = technicalExplanation || segments.map(s => s.tech).filter(Boolean).join(' ');
    }

    if (!textToParse) return;

    // Only apply LaTeX processing to technical text
    // Analogy/narrative should be pure prose - no LaTeX conversion
    let processedText: string;
    if (isTechnicalMode) {
      // Technical mode: fix malformed LaTeX, then wrap bare commands
      const sanitizedText = sanitizeLatex(textToParse);
      processedText = wrapBareLatex(sanitizedText);
    } else {
      // Analogy/narrative mode: pure prose, no LaTeX processing
      processedText = textToParse;
    }

    const parts = processedText.split(LATEX_REGEX);

    parts.forEach(part => {
      if (!part) return;
      const isLatex = part.startsWith('$') || part.startsWith('\\(') || part.startsWith('\\[') || (part.startsWith('\\') && part.length > 1);

      if (isLatex) {
        allTokens.push({ text: part, weight: 1.0, isSpace: false, isLatex: true, segmentIndex: 0 });
      } else {
        part.split(/(\s+)/).forEach(word => {
          if (!word) return;
          if (/^\s+$/.test(word)) {
            allTokens.push({ text: word, weight: 0, isSpace: true, segmentIndex: 0 });
            return;
          }
          // In narrative mode, text uses analogy domain vocabulary, so check against analogy terms
          const useAnalogyTerms = isAnalogyVisualMode || isNarrativeMode;
          // Use getWordAttention for both weight and entityId (for consistent multi-word coloring)
          const { weight, entityId } = getWordAttention(word, conceptMap, importanceMap, useAnalogyTerms);

          // Determine conceptIndex: prioritize entityId, then conceptMap, then fallback
          let cIdx: number | undefined;
          if (entityId !== undefined) {
            // Use entityId for consistent multi-word entity coloring
            cIdx = entityId;
          } else {
            const mappedId = getConceptId(word, conceptMap);
            if (mappedId !== -1) {
              cIdx = mappedId;
            } else if (weight > 0.6) {
              fallbackCounter++;
              cIdx = fallbackCounter;
            }
          }
          allTokens.push({ text: word, weight, isSpace: false, isLatex: false, segmentIndex: 0, conceptIndex: cIdx, entityId });
        });
      }
    });

    setIsTransitioning(true);
    const timer = setTimeout(() => {
      if (defPosition) {
        setIsTransitioning(false);
        return;
      }
      setProcessedWords(allTokens);
      requestAnimationFrame(() => setIsTransitioning(false));
    }, 200);

    return () => clearTimeout(timer);
  }, [segments, isAnalogyVisualMode, isNarrativeMode, conceptMap, importanceMap, defPosition, technicalExplanation, analogyExplanation]);

  const modeLabel = getViewModeLabel();

  // Domain Selection Screen
  if (!hasSelectedDomain) {
    return (
      <DomainSelection
        tempDomainInput={tempDomainInput}
        setTempDomainInput={setTempDomainInput}
        isSettingDomain={isSettingDomain}
        domainError={domainError}
        disambiguation={disambiguation}
        setDisambiguation={setDisambiguation}
        handleSetDomain={handleSetDomain}
      />
    );
  }

  // Main App
  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900' : 'bg-neutral-50'}`}>
      {/* Disambiguation Modal */}
      {disambiguation && (
        <DisambiguationModal
          disambiguation={disambiguation}
          isDarkMode={isDarkMode}
          isLoading={isDisambiguating}
          onSelect={async (opt) => {
            setIsDisambiguating(true);
            // Clear current state before proceeding
            resetAllState({ keepDomain: true, keepTopic: true });

            if (disambiguation.type === 'topic') {
              setTopic(opt);
              setDisambiguation(null);
              await fetchAnalogy(opt);
            } else {
              await handleSetDomain(opt);
            }
            setIsDisambiguating(false);
          }}
          onCancel={() => {
            setDisambiguation(null);
            setIsDisambiguating(false);
          }}
        />
      )}

      {/* Proximity Warning Modal */}
      {proximityWarning && (
        <ProximityWarningModal
          topic={proximityWarning.topic}
          domain={analogyDomain}
          proximityResult={proximityWarning.result}
          isDarkMode={isDarkMode}
          onClose={() => setProximityWarning(null)}
          onSwitchDomain={(newDomain) => {
            handleSetDomain(newDomain);
            setProximityWarning(null);
          }}
          onProceedAnyway={() => {
            const topicToUse = proximityWarning.topic;
            setProximityWarning(null);
            fetchAnalogy(topicToUse);
          }}
        />
      )}

      {/* Header */}
      <Header
        analogyDomain={analogyDomain}
        domainEmoji={domainEmoji}
        topic={topic}
        setTopic={setTopic}
        isLoading={isLoading}
        isImmersive={isImmersive}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        showHistory={showHistory}
        setShowHistory={setShowHistory}
        historyCount={history.length}
        onDomainClick={() => {
          resetAllState({ keepDomain: false });
          setHasSelectedDomain(false);
          setTempDomainInput("");
        }}
        onSubmit={handleSubmit}
        isViewingFromHistory={isViewingFromHistory}
        onReturnHome={returnToHome}
        isListening={isListening}
        onMicClick={isListening ? stopListening : startListening}
        isMicSupported={isMicSupported}
      />

      {/* History Panel */}
      {showHistory && (
        <div ref={historyPanelRef}>
          <HistoryPanel
            history={history}
            isDarkMode={isDarkMode}
            onLoadEntry={loadFromHistory}
            onDeleteEntry={deleteHistoryItem}
          />
        </div>
      )}

      {/* Free Tier Badge */}
      {isOnFreeTier() && freeTierRemaining !== null && !isImmersive && (
        <div className={`max-w-4xl mx-auto px-3 md:px-4 pt-2`}>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            freeTierRemaining === 0
              ? (isDarkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700')
              : freeTierRemaining <= 2
                ? (isDarkMode ? 'bg-amber-900/50 text-amber-300' : 'bg-amber-100 text-amber-700')
                : (isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700')
          }`}>
            <Sparkles size={12} />
            {freeTierRemaining === 0
              ? 'Free searches used'
              : `${freeTierRemaining} of ${freeTierLimit} free searches left today`
            }
            {freeTierRemaining <= 2 && freeTierRemaining > 0 && (
              <button
                onClick={() => setShowFreeTierModal(true)}
                className={`ml-1 underline hover:no-underline ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
              >
                Get unlimited
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main ref={scrollRef} className={`flex-1 overflow-y-auto transition-all duration-500 ${isImmersive ? 'pt-0' : 'pt-4'}`}>
        <div className={`max-w-4xl mx-auto px-3 md:px-4 pb-20 md:pb-32 transition-all duration-500 ${isImmersive ? 'max-w-none px-4 md:px-8' : ''}`}>
          {/* Loading State */}
          {isLoading && (
            <SkeletonLoader isDarkMode={isDarkMode} domain={analogyDomain} />
          )}

          {/* API Error State */}
          {!isLoading && apiError && (
            <div className={`rounded-2xl p-8 text-center border-2 ${
              isDarkMode
                ? 'bg-red-950/30 border-red-800/50'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                isDarkMode ? 'bg-red-900/50' : 'bg-red-100'
              }`}>
                <AlertCircle className={isDarkMode ? 'text-red-400' : 'text-red-500'} size={32} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>
                Something went wrong
              </h3>
              <p className={`text-sm mb-4 ${isDarkMode ? 'text-red-400/80' : 'text-red-600'}`}>
                {apiError}
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setApiError(null)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDarkMode
                      ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-200'
                      : 'bg-neutral-200 hover:bg-neutral-300 text-neutral-700'
                  }`}
                >
                  Dismiss
                </button>
                <button
                  onClick={() => lastSubmittedTopic && fetchAnalogy(lastSubmittedTopic)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDarkMode
                      ? 'bg-red-800 hover:bg-red-700 text-red-100'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Content */}
          {!isLoading && hasStarted && processedWords.length > 0 && (
            <div className="space-y-4">
              {/* Main Content Card */}
              <div
                className={`relative z-10 rounded-2xl shadow-lg overflow-hidden border transition-all duration-300 ${
                  isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'
                } ${
                  viewMode === 'morph' && isHovering
                    ? (isDarkMode ? 'ring-2 ring-blue-500/30' : 'ring-2 ring-blue-400/30')
                    : ''
                }`}
                onMouseEnter={handleMouseEnterWrapper}
                onMouseLeave={handleMouseLeaveWrapper}
                onClick={handleTouchToggle}
              >
                {/* Content Header */}
                <div className={`px-4 py-3 flex items-center justify-between border-b ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-neutral-50 border-neutral-200'}`}>
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-1.5">
                    <button
                      onClick={cycleViewMode}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                        viewMode === 'morph' && !isNarrativeMode
                          ? (isDarkMode ? 'bg-blue-900/50 text-blue-300 ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/20' : 'bg-blue-100 text-blue-700 ring-2 ring-blue-400/50 shadow-lg shadow-blue-500/20')
                          : viewMode === 'tech'
                            ? (isDarkMode ? 'bg-amber-900/50 text-amber-300 ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/20' : 'bg-amber-100 text-amber-700 ring-2 ring-amber-400/50 shadow-lg shadow-amber-500/20')
                            : viewMode === 'nfl'
                              ? (isDarkMode ? 'bg-emerald-900/50 text-emerald-300 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/20' : 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-400/50 shadow-lg shadow-emerald-500/20')
                              : (isDarkMode ? 'bg-neutral-700 text-neutral-300' : 'bg-neutral-200 text-neutral-600')
                      }`}
                    >
                      {modeLabel.icon}
                      <span>{modeLabel.text}</span>
                    </button>
                    {/* Show selecting indicator when morph is locked for selection */}
                    {morphLockedForSelection && viewMode === 'morph' && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-amber-900/50 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                        Selecting...
                      </span>
                    )}
                    {hasStarted && (
                      <button
                        onClick={() => {
                          if (!isNarrativeMode) {
                            // Turning on Story - disable Bullets and Essence
                            setIsBulletMode(false);
                            if (isFirstPrinciplesMode) {
                              setShowCondensedView(false);
                              setIsFirstPrinciplesMode(false);
                            }
                            // Lock to Expert mode when enabling Story from Morph to prevent transition jitter
                            if (viewMode === 'morph') {
                              setViewMode('nfl');
                            }
                          }
                          setIsNarrativeMode(!isNarrativeMode);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          isNarrativeMode
                            ? (isDarkMode ? 'bg-purple-900/50 text-purple-300 ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/20' : 'bg-purple-100 text-purple-700 ring-2 ring-purple-400/50 shadow-lg shadow-purple-500/20')
                            : (isDarkMode ? 'bg-neutral-700 text-neutral-300' : 'bg-neutral-200 text-neutral-600')
                        }`}
                      >
                        <BookOpenText size={14} className={isNarrativeMode ? 'animate-pulse' : ''} />
                        <span className="hidden sm:inline">Story</span>
                      </button>
                    )}
                    {/* Bullet Point Mode - Only in Tech Lock */}
                    {hasStarted && viewMode === 'tech' && (
                      <button
                        onClick={() => {
                          if (!isBulletMode) {
                            // Turning on Bullets - disable Story and Essence
                            setIsNarrativeMode(false);
                            if (isFirstPrinciplesMode) {
                              setShowCondensedView(false);
                              setIsFirstPrinciplesMode(false);
                            }
                          }
                          setIsBulletMode(!isBulletMode);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          isBulletMode
                            ? (isDarkMode ? 'bg-orange-900/50 text-orange-300 ring-2 ring-orange-500/50 shadow-lg shadow-orange-500/20' : 'bg-orange-100 text-orange-700 ring-2 ring-orange-400/50 shadow-lg shadow-orange-500/20')
                            : (isDarkMode ? 'bg-neutral-700 text-neutral-300' : 'bg-neutral-200 text-neutral-600')
                        }`}
                        title="Bullet Point Mode - Condensed single-sentence summaries"
                      >
                        <List size={14} className={isBulletMode ? 'animate-pulse' : ''} />
                        <span className="hidden sm:inline">Bullets</span>
                      </button>
                    )}
                    {/* First Principles Mode - Available in Tech and Morph modes when condensed data available */}
                    {hasStarted && (viewMode === 'tech' || viewMode === 'morph') && condensedData && (
                      <button
                        onClick={toggleFirstPrinciplesMode}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          isFirstPrinciplesMode
                            ? (isDarkMode ? 'bg-cyan-900/50 text-cyan-300 ring-2 ring-cyan-500/50 shadow-lg shadow-cyan-500/20' : 'bg-cyan-100 text-cyan-700 ring-2 ring-cyan-400/50 shadow-lg shadow-cyan-500/20')
                            : (isDarkMode ? 'bg-neutral-700 text-neutral-300' : 'bg-neutral-200 text-neutral-600')
                        }`}
                        title="First Principles Mode - WHAT/WHY essence with atomic insights"
                      >
                        <Zap size={14} className={isFirstPrinciplesMode ? 'animate-pulse' : ''} />
                        <span className="hidden sm:inline">Essence</span>
                      </button>
                    )}
                    {/* ELI Complexity Buttons */}
                    {hasStarted && (
                      <div className={`flex items-center rounded-full overflow-hidden border ${isDarkMode ? 'border-neutral-700 bg-neutral-800' : 'border-neutral-200 bg-neutral-100'}`}>
                        {([5, 50, 100] as const).map((level) => (
                          <button
                            key={level}
                            onClick={() => handleComplexityChange(level)}
                            disabled={isRegenerating || isLoading}
                            className={`px-2 py-2 min-h-touch text-xs font-bold transition-colors ${
                              mainComplexity === level
                                ? (isDarkMode ? 'bg-amber-600 text-white' : 'bg-amber-500 text-white')
                                : (isDarkMode ? 'text-neutral-400 hover:text-white hover:bg-neutral-700' : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200')
                            } ${isRegenerating || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={level === 5 ? "Explain like I'm 5" : level === 100 ? "Advanced Academic" : "Standard"}
                          >
                            ELI{level}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Constellation Mode Button */}
                    {hasStarted && (
                      <button
                        onClick={() => setIsConstellationMode(!isConstellationMode)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          isConstellationMode
                            ? (isDarkMode ? 'bg-purple-900/50 text-purple-300 ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/20' : 'bg-purple-100 text-purple-700 ring-2 ring-purple-400/50 shadow-lg shadow-purple-500/20')
                            : (isDarkMode ? 'bg-neutral-700 text-neutral-300' : 'bg-neutral-200 text-neutral-600')
                        }`}
                        title="Constellation Mode (G)"
                      >
                        <Network size={14} className={isConstellationMode ? 'animate-pulse' : ''} />
                        <span className="hidden sm:inline">Graph</span>
                      </button>
                    )}
                    {/* Dual Pane Mode Button */}
                    {hasStarted && (
                      <button
                        onClick={() => setIsDualPaneMode(!isDualPaneMode)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          isDualPaneMode
                            ? (isDarkMode ? 'bg-cyan-900/50 text-cyan-300 ring-2 ring-cyan-500/50 shadow-lg shadow-cyan-500/20' : 'bg-cyan-100 text-cyan-700 ring-2 ring-cyan-400/50 shadow-lg shadow-cyan-500/20')
                            : (isDarkMode ? 'bg-neutral-700 text-neutral-300' : 'bg-neutral-200 text-neutral-600')
                        }`}
                        title="Dual Pane Isomorphic View (P)"
                      >
                        <Columns size={14} className={isDualPaneMode ? 'animate-pulse' : ''} />
                        <span className="hidden sm:inline">Dual</span>
                      </button>
                    )}
                    {/* Mastery Mode Button */}
                    {hasStarted && conceptMap.length > 0 && (
                      <button
                        onClick={() => setIsMasteryMode(true)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          isMasteryMode
                            ? (isDarkMode ? 'bg-green-900/50 text-green-300 ring-2 ring-green-500/50 shadow-lg shadow-green-500/20' : 'bg-green-100 text-green-700 ring-2 ring-green-400/50 shadow-lg shadow-green-500/20')
                            : (isDarkMode ? 'bg-neutral-700 text-neutral-300' : 'bg-neutral-200 text-neutral-600')
                        }`}
                        title="Test My Understanding (U)"
                      >
                        <GraduationCap size={14} className={isMasteryMode ? 'animate-pulse' : ''} />
                        <span className="hidden sm:inline">Mastery</span>
                      </button>
                    )}
                    {/* Intuition Mode Button - Opens modal with 3 memorable one-liners */}
                    {hasStarted && segments.length > 0 && segments[0].intuitions && segments[0].intuitions.length > 0 && (
                      <button
                        onClick={() => setShowIntuitionModal(true)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          showIntuitionModal
                            ? (isDarkMode ? 'bg-yellow-900/50 text-yellow-300 ring-2 ring-yellow-500/50 shadow-lg shadow-yellow-500/20' : 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-400/50 shadow-lg shadow-yellow-500/20')
                            : (isDarkMode ? 'bg-neutral-700 text-neutral-300' : 'bg-neutral-200 text-neutral-600')
                        }`}
                        title="View Core Intuitions"
                      >
                        <Lightbulb size={14} className={showIntuitionModal ? 'animate-pulse text-yellow-400' : 'text-yellow-500'} />
                        <span className="hidden sm:inline">Intuition</span>
                      </button>
                    )}
                    {/* Regenerate Button - Dice to regenerate description and reset mastery */}
                    {hasStarted && lastSubmittedTopic && (
                      <button
                        onClick={() => {
                          // Reset mastery session cache (clears quiz progress)
                          setMasterySessionCache(null);
                          // Close mastery mode if open
                          setIsMasteryMode(false);
                          // Regenerate content for current topic
                          fetchAnalogy(lastSubmittedTopic);
                        }}
                        disabled={isRegenerating || isLoading}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          isDarkMode ? 'bg-neutral-700 text-neutral-300 hover:bg-orange-900/50 hover:text-orange-300' : 'bg-neutral-200 text-neutral-600 hover:bg-orange-100 hover:text-orange-700'
                        } ${isRegenerating || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Regenerate description and reset mastery progress"
                      >
                        <Dices size={14} className={isRegenerating ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">Reroll</span>
                      </button>
                    )}
                    {/* Mastery History Button - Shows gold medals for mastered topics */}
                    {masteryHistory.length > 0 && (
                      <button
                        onClick={() => setShowMasteryHistory(true)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          showMasteryHistory
                            ? (isDarkMode ? 'bg-yellow-900/50 text-yellow-300 ring-2 ring-yellow-500/50 shadow-lg shadow-yellow-500/20' : 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-400/50 shadow-lg shadow-yellow-500/20')
                            : (isDarkMode ? 'bg-neutral-700 text-neutral-300' : 'bg-neutral-200 text-neutral-600')
                        }`}
                        title={`${masteryHistory.length} Mastered Topics`}
                      >
                        <Medal size={14} className={showMasteryHistory ? 'animate-pulse text-yellow-500' : 'text-yellow-500'} />
                        <span className="hidden sm:inline">{masteryHistory.length}</span>
                      </button>
                    )}
                    {/* Text Scale Control */}
                    {hasStarted && (
                      <button
                        onClick={() => {
                          const scales: (1 | 1.25 | 1.5 | 2)[] = [1, 1.25, 1.5, 2];
                          const currentIndex = scales.indexOf(textScale);
                          setTextScale(scales[(currentIndex + 1) % scales.length]);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          textScale > 1
                            ? (isDarkMode ? 'bg-violet-900/50 text-violet-300 ring-2 ring-violet-500/50 shadow-lg shadow-violet-500/20' : 'bg-violet-100 text-violet-700 ring-2 ring-violet-400/50 shadow-lg shadow-violet-500/20')
                            : (isDarkMode ? 'bg-neutral-700 text-neutral-300' : 'bg-neutral-200 text-neutral-600')
                        }`}
                        title={`Text Size: ${textScale === 1 ? 'Normal' : textScale === 1.25 ? 'Large' : textScale === 1.5 ? 'X-Large' : 'Fill'} (T)`}
                      >
                        <Type size={14} className={textScale > 1 ? 'animate-pulse' : ''} />
                        <span className="hidden sm:inline">{textScale === 1 ? '1x' : textScale === 1.25 ? '1.25x' : textScale === 1.5 ? '1.5x' : '2x'}</span>
                      </button>
                    )}
                    {/* Regenerating indicator */}
                    {isRegenerating && (
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                        <Loader2 size={12} className="animate-spin" />
                        Regenerating...
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsIsomorphicMode(!isIsomorphicMode)}
                      className={`p-2 rounded-lg transition-colors mr-1 ${
                        isIsomorphicMode
                          ? (isDarkMode ? 'bg-emerald-900/50 text-emerald-300' : 'bg-emerald-100 text-emerald-600')
                          : (isDarkMode ? 'text-neutral-500 hover:bg-neutral-700' : 'text-neutral-400 hover:bg-neutral-100')
                      }`}
                      title="Isomorphic Colors"
                    >
                      <Palette size={16} />
                    </button>
                    <button
                      onClick={() => setIsImmersive(!isImmersive)}
                      className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'text-neutral-400 hover:bg-neutral-700' : 'text-neutral-500 hover:bg-neutral-100'}`}
                      title={isImmersive ? "Exit Immersive" : "Immersive Mode"}
                    >
                      {isImmersive ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                  </div>
                </div>

                {/* Content Body */}
                <div
                  ref={contentRef}
                  className="p-6 md:p-8 relative select-text min-h-[400px]"
                  onDoubleClick={handleDoubleClick}
                  onMouseDown={handleSelectionStart}
                  onMouseUp={handleSelectionEnd}
                  onTouchStart={handleSelectionStart}
                  onTouchEnd={handleSelectionEnd}
                >
                  {/* First Principles View - Button-toggled via "Essence" button in Tech mode */}
                  {viewMode === 'tech' && (showCondensedView || isCondensedMorphing) && condensedData && (
                    <div
                      className={`absolute inset-0 z-10 p-5 md:p-6 overflow-y-auto transition-all duration-300 ease-out ${
                        isDarkMode ? 'bg-neutral-900' : 'bg-white'
                      } ${
                        showCondensedView && !isCondensedMorphing
                          ? 'opacity-100 blur-0 scale-100'
                          : 'opacity-0 blur-md scale-[0.98]'
                      }`}
                    >
                      <div className="space-y-4">
                        {/* WHAT Section */}
                        <div className={`pb-3 border-b ${isDarkMode ? 'border-neutral-700/50' : 'border-neutral-200'}`}>
                          <div className={`flex items-center gap-1.5 text-xs uppercase font-semibold tracking-wider mb-1.5 ${
                            isDarkMode ? 'text-purple-400/80' : 'text-purple-500'
                          }`}>
                            <span>📐</span>
                            <span>What</span>
                          </div>
                          <p
                            className={`font-medium leading-snug ${isDarkMode ? 'text-neutral-100' : 'text-neutral-800'}`}
                            style={{ fontSize: `${1.125 * textScale}rem` }}
                          >
                            {condensedData.what}
                          </p>
                        </div>

                        {/* WHY Section */}
                        <div className={`pb-3 border-b ${isDarkMode ? 'border-neutral-700/50' : 'border-neutral-200'}`}>
                          <div className={`flex items-center gap-1.5 text-xs uppercase font-semibold tracking-wider mb-1.5 ${
                            isDarkMode ? 'text-emerald-400/80' : 'text-emerald-500'
                          }`}>
                            <span>🎯</span>
                            <span>Why</span>
                          </div>
                          <p
                            className={`font-medium leading-snug ${isDarkMode ? 'text-neutral-100' : 'text-neutral-800'}`}
                            style={{ fontSize: `${1.125 * textScale}rem` }}
                          >
                            {condensedData.why}
                          </p>
                        </div>

                        {/* First Principles Bullets - with heatmap importance colors */}
                        {condensedData.bullets.length > 0 && (
                          <div>
                            <div className={`flex items-center gap-1.5 text-xs uppercase font-semibold tracking-wider mb-2 ${
                              isDarkMode ? 'text-orange-400/80' : 'text-orange-500'
                            }`}>
                              <span>⚡</span>
                              <span>First Principles</span>
                            </div>
                            <ul className="space-y-1.5">
                              {condensedData.bullets.map((bullet, i) => {
                                // Heatmap colors: first = most important (hot), last = less important (cool)
                                const importance = 1 - (i / Math.max(condensedData.bullets.length - 1, 1));
                                const heatmapColors = isDarkMode
                                  ? [
                                      { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', text: 'rgb(252, 165, 165)', num: 'rgb(248, 113, 113)' },    // red - most important
                                      { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.4)', text: 'rgb(253, 186, 116)', num: 'rgb(251, 146, 60)' },   // orange
                                      { bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.4)', text: 'rgb(253, 224, 71)', num: 'rgb(250, 204, 21)' },      // yellow
                                      { bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.35)', text: 'rgb(134, 239, 172)', num: 'rgb(74, 222, 128)' },    // green
                                      { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.35)', text: 'rgb(147, 197, 253)', num: 'rgb(96, 165, 250)' },  // blue
                                      { bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.35)', text: 'rgb(196, 181, 253)', num: 'rgb(167, 139, 250)' }  // purple - least important
                                    ]
                                  : [
                                      { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: 'rgb(127, 29, 29)', num: 'rgb(220, 38, 38)' },
                                      { bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)', text: 'rgb(124, 45, 18)', num: 'rgb(234, 88, 12)' },
                                      { bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.3)', text: 'rgb(113, 63, 18)', num: 'rgb(202, 138, 4)' },
                                      { bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.25)', text: 'rgb(20, 83, 45)', num: 'rgb(22, 163, 74)' },
                                      { bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.25)', text: 'rgb(30, 58, 138)', num: 'rgb(37, 99, 235)' },
                                      { bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.25)', text: 'rgb(76, 29, 149)', num: 'rgb(124, 58, 237)' }
                                    ];
                                const colorIndex = Math.min(Math.floor((1 - importance) * heatmapColors.length), heatmapColors.length - 1);
                                const colors = heatmapColors[colorIndex];

                                return (
                                  <li
                                    key={i}
                                    className="flex gap-2 items-start px-2.5 py-1.5 rounded-md border-l-3 transition-all"
                                    style={{
                                      backgroundColor: colors.bg,
                                      borderLeftWidth: '3px',
                                      borderLeftColor: colors.border
                                    }}
                                  >
                                    <span
                                      className="flex-shrink-0 font-semibold text-sm"
                                      style={{
                                        fontSize: `${0.875 * textScale}rem`,
                                        color: colors.num
                                      }}
                                    >
                                      {i + 1}.
                                    </span>
                                    <span
                                      style={{
                                        fontSize: `${0.9375 * textScale}rem`,
                                        lineHeight: '1.5',
                                        color: colors.text
                                      }}
                                    >
                                      {bullet}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}

                        {/* Mnemonic Section - Memory Aid with Breakdown */}
                        {condensedData.mnemonic && condensedData.mnemonic.phrase && (
                          <div className={`mt-4 pt-4 border-t border-dashed ${isDarkMode ? 'border-neutral-700/50' : 'border-neutral-300/50'}`}>
                            <div className={`flex items-center gap-1.5 text-xs uppercase font-semibold tracking-wider mb-2 ${
                              isDarkMode ? 'text-pink-400/80' : 'text-pink-500'
                            }`}>
                              <span>🧠</span>
                              <span>Remember It</span>
                            </div>
                            {/* The mnemonic phrase */}
                            <p
                              className={`font-bold italic leading-snug mb-3 ${isDarkMode ? 'text-neutral-100' : 'text-neutral-800'}`}
                              style={{ fontSize: `${1.15 * textScale}rem` }}
                            >
                              "{condensedData.mnemonic.phrase}"
                            </p>
                            {/* Letter breakdown */}
                            {condensedData.mnemonic.breakdown && condensedData.mnemonic.breakdown.length > 0 && (
                              <ul className="space-y-1">
                                {condensedData.mnemonic.breakdown.map((item, i) => (
                                  <li
                                    key={i}
                                    className={`text-sm flex items-start gap-2 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}
                                    style={{ fontSize: `${0.85 * textScale}rem` }}
                                  >
                                    <span className={`font-mono font-bold flex-shrink-0 ${isDarkMode ? 'text-pink-400' : 'text-pink-600'}`}>
                                      {item.charAt(0)}
                                    </span>
                                    <span>{item.substring(item.indexOf('=') + 1).trim()}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bullet Point Mode - Condensed sentence bullets */}
                  {isBulletMode && viewMode === 'tech' ? (
                    <ul
                      className={`space-y-3 transition-all duration-300 ease-in-out ${
                        isTransitioning || isCondensedMorphing
                          ? 'opacity-0 blur-md scale-[0.98] translate-y-1'
                          : 'opacity-100 blur-0 scale-100 translate-y-0'
                      } ${isDarkMode ? 'text-neutral-100' : 'text-neutral-800'}`}
                      style={{
                        fontSize: `${1.125 * textScale}rem`,
                        lineHeight: textScale >= 1.5 ? '1.8' : '1.75',
                      }}
                    >
                      {groupWordsIntoSentences(processedWords).map((sentence, sentenceIndex) => (
                        <li
                          key={sentenceIndex}
                          className={`flex gap-3 items-start pl-2 py-1 rounded-lg transition-colors hover:${isDarkMode ? 'bg-neutral-700/30' : 'bg-neutral-100'}`}
                        >
                          <span className={`flex-shrink-0 mt-1.5 text-lg ${isDarkMode ? 'text-orange-400' : 'text-orange-500'}`}>•</span>
                          <span className="flex-1 flex flex-wrap gap-x-1.5 gap-y-0.5 items-baseline">
                            {sentence.map((word, wordIndex) => {
                              // Skip rendering space tokens since we use gap for spacing
                              if (word.isSpace) return null;
                              return renderWord(word, sentenceIndex * 1000 + wordIndex);
                            })}
                          </span>
                        </li>
                      ))}

                      {/* Symbol Glossary - shows detected math symbols with explanations */}
                      {(() => {
                        const detectedSymbols = extractSymbolsFromContent(processedWords);
                        if (detectedSymbols.length === 0) return null;
                        return (
                          <div className={`mt-6 pt-4 border-t ${isDarkMode ? 'border-neutral-700' : 'border-neutral-200'}`}>
                            <div className={`flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                              <BookOpen size={14} />
                              <span>Symbol Guide</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {detectedSymbols.map(({ symbol, name, meaning }) => (
                                <div
                                  key={symbol}
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                                    isDarkMode
                                      ? 'bg-neutral-800 border border-neutral-700'
                                      : 'bg-neutral-100 border border-neutral-200'
                                  }`}
                                  title={meaning}
                                >
                                  <span className={`font-mono text-base ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>
                                    {symbol}
                                  </span>
                                  <span className={`${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                    {name}
                                  </span>
                                  <span className={`hidden sm:inline ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                                    — {meaning}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </ul>
                  ) : (
                    <p
                      className={`leading-relaxed transition-all duration-300 ease-in-out ${
                        isTransitioning || (viewMode === 'tech' && isCondensedMorphing)
                          ? 'opacity-0 blur-md scale-[0.98] translate-y-1'
                          : 'opacity-100 blur-0 scale-100 translate-y-0'
                      } ${isDarkMode ? 'text-neutral-100' : 'text-neutral-800'}`}
                      style={{
                        fontSize: `${1.125 * textScale}rem`,
                        lineHeight: textScale >= 1.5 ? '1.8' : '1.75',
                      }}
                    >
                      {processedWords.map((word, i) => renderWord(word, i))}
                    </p>
                  )}

                  {/* Floating Define Button */}
                  {showDefineButton && defineButtonPosition && pendingSelection && (
                    <button
                      className="define-selection-button fixed z-[300] flex items-center gap-1.5 px-3 py-2 bg-neutral-900 text-white text-xs font-medium rounded-lg shadow-xl border border-neutral-700 hover:bg-neutral-800 hover:scale-105 active:scale-95 transition-all duration-150"
                      style={{
                        top: defineButtonPosition.top,
                        left: defineButtonPosition.left,
                      }}
                      onClick={handleDefineSelection}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDefineSelection();
                      }}
                    >
                      <BookOpen size={14} />
                      <span>Define</span>
                      {pendingSelection.split(/\s+/).length > 1 && (
                        <span className="text-neutral-400 text-xs">
                          ({pendingSelection.split(/\s+/).length} words)
                        </span>
                      )}
                    </button>
                  )}
                </div>

                {/* Content Footer - Hide when in Essence mode */}
                {!(showCondensedView && isFirstPrinciplesMode) && (
                <div className={`px-4 py-3 border-t ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-neutral-50 border-neutral-200'}`}>
                  {/* Selection hint - only show when not in morph mode */}
                  {viewMode !== 'morph' && (
                    <div className={`flex items-center justify-center gap-1.5 mb-2 text-xs ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      <BookOpen size={12} />
                      <span>Select any text to define • {isMobile ? 'Tap' : 'Double-click'} words for quick definitions</span>
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <Eye size={14} className={isDarkMode ? 'text-neutral-500' : 'text-neutral-400'} />
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={threshold}
                      onChange={(e) => setThreshold(parseFloat(e.target.value))}
                      className={`flex-1 h-1 rounded-lg appearance-none cursor-pointer ${isDarkMode ? 'bg-neutral-700 accent-blue-400' : 'bg-neutral-200 accent-blue-600'}`}
                    />
                    <span className={`text-xs font-mono ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      {Math.round(threshold * 100)}%
                    </span>
                  </div>
                </div>
                )}
              </div>

              {/* Insight Takeaway */}
              {contextData && (
                <ContextCard
                  contextData={contextData}
                  isDarkMode={isDarkMode}
                />
              )}

              {/* Follow-up Section */}
              {showFollowUp && (
                <div className={`rounded-xl p-4 border ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`}>
                  {/* Header with minimize and history buttons */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MessageCircle size={16} className={isDarkMode ? 'text-blue-400' : 'text-blue-500'} />
                      <span className={`font-medium text-sm ${isDarkMode ? 'text-white' : ''}`}>Ask a follow-up question</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* History toggle button - only show if there's history */}
                      {tutorHistory.length > 0 && (
                        <button
                          onClick={() => setShowTutorHistory(!showTutorHistory)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            showTutorHistory
                              ? (isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-600')
                              : (isDarkMode ? 'text-neutral-400 hover:text-white hover:bg-neutral-700' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100')
                          }`}
                          title="View conversation history"
                        >
                          <History size={14} />
                        </button>
                      )}
                      {/* Minimize button */}
                      <button
                        onClick={() => setShowFollowUp(false)}
                        className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-neutral-400 hover:text-white hover:bg-neutral-700' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100'}`}
                        title="Minimize"
                      >
                        <ChevronUp size={14} />
                      </button>
                    </div>
                  </div>

                  {/* History Panel - clickable Q&A pairs for branching */}
                  {showTutorHistory && tutorHistory.length > 0 && (
                    <div className={`mb-3 p-3 rounded-lg max-h-64 overflow-y-auto ${isDarkMode ? 'bg-neutral-900/50 border border-neutral-700' : 'bg-neutral-50 border border-neutral-200'}`}>
                      <div className="space-y-2">
                        {(() => {
                          // Group history into Q&A pairs
                          const pairs: { question: string; answer: string; originalIndex: number }[] = [];
                          for (let i = 0; i < tutorHistory.length; i += 2) {
                            if (tutorHistory[i]?.role === 'user' && tutorHistory[i + 1]?.role === 'model') {
                              pairs.push({
                                question: tutorHistory[i].text,
                                answer: tutorHistory[i + 1].text,
                                originalIndex: Math.floor(i / 2)
                              });
                            }
                          }
                          // Show last 5 pairs
                          const displayPairs = pairs.slice(-5);
                          return displayPairs.map((pair) => {
                            const isSelected = selectedHistoryBranch === pair.originalIndex;
                            return (
                              <div
                                key={pair.originalIndex}
                                onClick={() => {
                                  if (isSelected) {
                                    // Deselect - go back to latest
                                    setSelectedHistoryBranch(null);
                                    // Show the latest response
                                    const lastPair = pairs[pairs.length - 1];
                                    if (lastPair) {
                                      setTutorResponse({ question: lastPair.question, answer: lastPair.answer, mode: "Tutor" });
                                    }
                                  } else {
                                    // Select this branch point
                                    setSelectedHistoryBranch(pair.originalIndex);
                                    // Show full Q&A as current response
                                    setTutorResponse({ question: pair.question, answer: pair.answer, mode: "Tutor" });
                                  }
                                }}
                                className={`text-xs p-2 rounded cursor-pointer transition-all ${
                                  isSelected
                                    ? (isDarkMode ? 'bg-blue-900/50 border border-blue-500/50 ring-1 ring-blue-500/30' : 'bg-blue-100 border border-blue-300')
                                    : (isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-white hover:bg-neutral-50')
                                }`}
                              >
                                <p className={`font-medium mb-1 ${isSelected ? (isDarkMode ? 'text-blue-200' : 'text-blue-700') : (isDarkMode ? 'text-blue-300' : 'text-blue-600')}`}>
                                  Q: {isSelected ? pair.question : (pair.question.length > 80 ? pair.question.slice(0, 80) + '...' : pair.question)}
                                </p>
                                <p className={isSelected ? (isDarkMode ? 'text-neutral-200' : 'text-neutral-700') : (isDarkMode ? 'text-neutral-400' : 'text-neutral-600')}>
                                  A: {isSelected ? stripMathSymbols(pair.answer) : (pair.answer.length > 120 ? stripMathSymbols(pair.answer.slice(0, 120)) + '...' : stripMathSymbols(pair.answer))}
                                </p>
                                {isSelected && (
                                  <p className={`mt-2 text-xs italic ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>
                                    ↳ Branch from here - your next question will continue from this point
                                  </p>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                      {selectedHistoryBranch !== null && (
                        <div className={`mt-2 pt-2 border-t text-xs ${isDarkMode ? 'border-neutral-700 text-amber-400' : 'border-neutral-200 text-amber-600'}`}>
                          ⚡ Branching mode: Next question will fork from selected point
                        </div>
                      )}
                    </div>
                  )}

                  {/* Input area */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={followUpQuery}
                      onChange={(e) => setFollowUpQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAskTutor()}
                      placeholder="e.g., Can you explain this differently?"
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm ${isDarkMode ? 'bg-neutral-700 border-neutral-600 text-white placeholder-neutral-500' : 'border-neutral-200'}`}
                    />
                    <button
                      onClick={() => handleAskTutor()}
                      disabled={isTutorLoading || !followUpQuery.trim()}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
                    >
                      {isTutorLoading ? <Loader2 className="animate-spin" size={16} /> : 'Ask'}
                    </button>
                  </div>

                  {/* Current response with attention controls */}
                  {tutorResponse && (
                    <div className={`mt-3 p-3 rounded-lg text-sm ${isDarkMode ? 'bg-neutral-700' : 'bg-blue-50'}`}>
                      <p className={`font-medium mb-2 ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>Q: {tutorResponse.question}</p>

                      {/* Answer with attention rendering - strip math symbols for clean prose */}
                      <div className={isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}>
                        {renderAttentiveText(
                          stripMathSymbols(tutorResponse.answer),
                          tutorThreshold,
                          setTutorThreshold,
                          isTutorColorMode,
                          setIsTutorColorMode,
                          conceptMap,
                          isDarkMode ? 'text-neutral-200' : 'text-neutral-700',
                          1.0,
                          undefined
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => setShowFollowUp(!showFollowUp)}
                  disabled={isLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    showFollowUp
                      ? (isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700')
                      : (isDarkMode ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200')
                  }`}
                >
                  <MessageCircle size={14} />Ask Question
                </button>
                <button
                  onClick={() => fetchQuiz(false)}
                  disabled={isQuizLoading || isLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'}`}
                >
                  {isQuizLoading ? <Loader2 className="animate-spin" size={14} /> : <Trophy size={14} />}
                  Quiz Me
                </button>
                {synthesisSummary && (
                  <button
                    onClick={() => setShowSynthesis(!showSynthesis)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      showSynthesis
                        ? (isDarkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700')
                        : (isDarkMode ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200')
                    }`}
                  >
                    <BrainCircuit size={14} />Synthesis
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !hasStarted && !apiError && (
            <div className={`rounded-2xl p-12 text-center ${isDarkMode ? 'bg-neutral-800' : 'bg-white border border-neutral-200'}`}>
              <Sparkles className={`mx-auto mb-4 ${isDarkMode ? 'text-neutral-600' : 'text-neutral-300'}`} size={48} />
              <h2 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
                Ready to learn with {analogyDomain}?
              </h2>
              <p className={isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}>
                Type any topic above and press Enter
              </p>
            </div>
          )}

          {/* Fallback State - hasStarted but no content (e.g., after dismissed error) */}
          {!isLoading && hasStarted && processedWords.length === 0 && !apiError && (
            <div className={`rounded-2xl p-12 text-center ${isDarkMode ? 'bg-neutral-800' : 'bg-white border border-neutral-200'}`}>
              <RotateCcw className={`mx-auto mb-4 ${isDarkMode ? 'text-amber-400' : 'text-amber-500'}`} size={48} />
              <h2 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
                Ready to try again?
              </h2>
              <p className={`mb-4 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                The previous request didn't complete. Enter a topic above or try again.
              </p>
              {lastSubmittedTopic && (
                <button
                  onClick={() => fetchAnalogy(lastSubmittedTopic)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDarkMode
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-amber-500 hover:bg-amber-600 text-white'
                  }`}
                >
                  Retry "{lastSubmittedTopic}"
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Controls Panel */}
      {showControls && (
        <div ref={controlsPanelRef} className={`fixed bottom-20 right-3 md:right-6 z-50 rounded-xl shadow-xl p-3 md:p-4 space-y-3 w-48 md:w-56 ${isDarkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}>
          <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
            <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Attention Mode</span>
          </div>
          {(['opacity', 'size', 'heatmap'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                mode === m
                  ? (isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700')
                  : (isDarkMode ? 'text-neutral-300 hover:bg-neutral-700' : 'text-neutral-600 hover:bg-neutral-100')
              }`}
            >
              {m === 'opacity' && <Eye size={14} />}
              {m === 'size' && <AlignLeft size={14} />}
              {m === 'heatmap' && <Zap size={14} />}
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Synthesis Modal */}
      {showSynthesis && synthesisSummary && (
        <SynthesisModal
          synthesisSummary={synthesisSummary}
          synthesisCitation={synthesisCitation}
          synthPos={synthPos}
          isMobile={isMobile}
          synthesisThreshold={synthesisThreshold}
          setSynthesisThreshold={setSynthesisThreshold}
          isSynthesisColorMode={isSynthesisColorMode}
          setIsSynthesisColorMode={setIsSynthesisColorMode}
          onClose={() => setShowSynthesis(false)}
          onStartDrag={startDrag}
          renderAttentiveText={renderAttentiveText}
        />
      )}

      {/* Definition Popup */}
      {defPosition && selectedTerm && (
        <DefinitionPopup
          selectedTerm={selectedTerm}
          defText={defText}
          isLoadingDef={isLoadingDef}
          defPosition={defPosition}
          defPos={defPos}
          defSize={defSize}
          defComplexity={defComplexity}
          defThreshold={defThreshold}
          setDefThreshold={setDefThreshold}
          isDefColorMode={isDefColorMode}
          setIsDefColorMode={setIsDefColorMode}
          isMobile={isMobile}
          copiedId={copiedId}
          symbolGuide={defSymbolGuide}
          onClose={() => {
            setDefPosition(null);
            setSelectedTerm(null);
            setMiniDefPosition(null);
          }}
          onStartDrag={startDrag}
          onStartResize={startResize}
          onEliClick={(level) => handleDefEliClick(level, false)}
          onCopy={copyToClipboard}
          onWordClick={!miniDefPosition ? handleDefWordClick : undefined}
          renderAttentiveText={renderAttentiveText}
          renderRichText={renderRichText}
        />
      )}

      {/* Quiz Modal */}
      {showQuizModal && quizData && (
        <QuizModal
          quizData={quizData}
          quizFeedback={quizFeedback}
          quizPos={quizPos}
          isMobile={isMobile}
          isQuizLoading={isQuizLoading}
          retryCount={quizRetryCount}
          maxRetries={MAX_QUIZ_RETRIES}
          questionNumber={quizQuestionNumber}
          onOptionClick={handleQuizOptionClick}
          onClose={() => setShowQuizModal(false)}
          onStartDrag={startDrag}
          onNextQuestion={handleNextQuestion}
          onRetry={handleQuizRetry}
          renderRichText={renderRichText}
        />
      )}

      {/* Mini Definition Popup */}
      {miniDefPosition && miniSelectedTerm && (
        <MiniDefinitionPopup
          miniSelectedTerm={miniSelectedTerm}
          miniDefText={miniDefText}
          isLoadingMiniDef={isLoadingMiniDef}
          miniDefPosition={miniDefPosition}
          miniDefSize={miniDefSize}
          miniDefComplexity={miniDefComplexity}
          miniDefThreshold={miniDefThreshold}
          setMiniDefThreshold={setMiniDefThreshold}
          isMiniDefColorMode={isMiniDefColorMode}
          setIsMiniDefColorMode={setIsMiniDefColorMode}
          isMobile={isMobile}
          copiedId={copiedId}
          onClose={() => setMiniDefPosition(null)}
          onHeaderMouseDown={handleMiniHeaderMouseDown}
          onStartResize={startResize}
          onEliClick={(level) => handleDefEliClick(level, true)}
          onCopy={copyToClipboard}
          renderAttentiveText={renderAttentiveText}
          renderRichText={renderRichText}
        />
      )}

      {/* Floating Action Buttons */}
      <div className={`fixed bottom-6 right-6 flex gap-2 z-[60] transition-transform duration-500 ${isImmersive ? 'translate-y-24 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
        {/* Shortcuts Help Button */}
        <button
          onClick={() => setShowShortcutsLegend(true)}
          className={`p-3 rounded-full shadow-lg border transition-colors ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-blue-400' : 'bg-white border-neutral-200 text-neutral-500 hover:text-blue-500'}`}
          title="Keyboard Shortcuts (?)"
        >
          <HelpCircle size={20} />
        </button>
        {/* Ambiance Mode Buttons */}
        <button
          onClick={() => {
            if (ambianceMode === 'study') {
              // Exit study mode
              setAmbianceMode('none');
              setShowStudyControls(true); // Reset for next time
            } else {
              // Enter study mode and show controls
              setAmbianceMode('study');
              setShowStudyControls(true);
            }
          }}
          className={`p-3 rounded-full shadow-lg border transition-colors ${
            ambianceMode === 'study'
              ? 'bg-amber-500 border-amber-600 text-white ring-2 ring-amber-400/50'
              : (isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-amber-400' : 'bg-white border-neutral-200 text-neutral-500 hover:text-amber-500')
          }`}
          title={ambianceMode === 'study' ? 'Exit Study Mode' : 'Study Mode (1)'}
        >
          <Coffee size={20} />
        </button>
        {hasStarted && (
          <button
            onClick={() => setShowClearConfirmation(true)}
            className={`p-3 rounded-full shadow-lg border transition-colors ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-red-400' : 'bg-white border-neutral-200 text-neutral-500 hover:text-red-500'}`}
            title="Clear Text"
          >
            <Eraser size={20} />
          </button>
        )}
        {/* Symbol Glossary Button - only show when there's STEM content */}
        {hasStarted && segments.length > 0 && (
          <button
            onClick={() => {
              if (showSymbolGlossary) {
                // Close and reset state (same as X button)
                setShowSymbolGlossary(false);
                setSymbolGuidePos({ x: 0, y: 0 });
                setIsSymbolGuideMinimized(false);
              } else {
                setShowSymbolGlossary(true);
              }
            }}
            className={`p-3 rounded-full shadow-lg border transition-colors ${
              showSymbolGlossary
                ? 'bg-blue-500 border-blue-600 text-white ring-2 ring-blue-400/50'
                : (isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-blue-400' : 'bg-white border-neutral-200 text-neutral-500 hover:text-blue-500')
            }`}
            title="Symbol Guide (∑)"
          >
            <span className="text-base font-bold">∑</span>
          </button>
        )}
        <button
          ref={controlsButtonRef}
          onClick={() => setShowControls(!showControls)}
          className="bg-black text-white p-3 rounded-full shadow-lg hover:scale-105 transition-transform"
          title="Toggle Controls"
        >
          {showControls ? <MoveHorizontal size={20} /> : <Zap size={20} />}
        </button>
      </div>

      {/* Keyboard Shortcuts Legend Modal */}
      {showShortcutsLegend && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowShortcutsLegend(false)}>
          <div
            className={`relative w-full max-w-md mx-4 p-6 rounded-2xl shadow-2xl ${isDarkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowShortcutsLegend(false)}
              className={`absolute top-4 right-4 p-1 rounded-full transition-colors ${isDarkMode ? 'text-neutral-400 hover:text-white hover:bg-neutral-700' : 'text-neutral-500 hover:text-black hover:bg-neutral-100'}`}
            >
              <X size={20} />
            </button>
            <h2 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
              Keyboard Shortcuts
            </h2>
            <div className="space-y-3">
              <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>View Modes</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className={`flex items-center gap-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  <kbd className={`px-2 py-1 rounded text-xs font-mono ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-100'}`}>M</kbd>
                  <span>Morph Mode</span>
                </div>
                <div className={`flex items-center gap-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  <kbd className={`px-2 py-1 rounded text-xs font-mono ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-100'}`}>E</kbd>
                  <span>Expert Lock</span>
                </div>
                <div className={`flex items-center gap-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  <kbd className={`px-2 py-1 rounded text-xs font-mono ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-100'}`}>T</kbd>
                  <span>Tech Lock</span>
                </div>
                <div className={`flex items-center gap-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  <kbd className={`px-2 py-1 rounded text-xs font-mono ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-100'}`}>S</kbd>
                  <span>Story Mode</span>
                </div>
                <div className={`flex items-center gap-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  <kbd className={`px-2 py-1 rounded text-xs font-mono ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-100'}`}>B</kbd>
                  <span>Bullet Mode</span>
                </div>
                <div className={`flex items-center gap-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  <kbd className={`px-2 py-1 rounded text-xs font-mono ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-100'}`}>G</kbd>
                  <span>Graph Mode</span>
                </div>
                <div className={`flex items-center gap-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  <kbd className={`px-2 py-1 rounded text-xs font-mono ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-100'}`}>P</kbd>
                  <span>Dual Pane</span>
                </div>
                <div className={`flex items-center gap-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  <kbd className={`px-2 py-1 rounded text-xs font-mono ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-100'}`}>T</kbd>
                  <span>Text Size</span>
                </div>
              </div>
              <div className={`text-xs font-bold uppercase tracking-wider mb-2 mt-4 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>UI Controls</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className={`flex items-center gap-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  <kbd className={`px-2 py-1 rounded text-xs font-mono ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-100'}`}>D</kbd>
                  <span>Dark Mode</span>
                </div>
                <div className={`flex items-center gap-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  <kbd className={`px-2 py-1 rounded text-xs font-mono ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-100'}`}>I</kbd>
                  <span>Immersive</span>
                </div>
                <div className={`flex items-center gap-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  <kbd className={`px-2 py-1 rounded text-xs font-mono ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-100'}`}>C</kbd>
                  <span>Controls</span>
                </div>
                <div className={`flex items-center gap-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  <kbd className={`px-2 py-1 rounded text-xs font-mono ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-100'}`}>H</kbd>
                  <span>History</span>
                </div>
              </div>
              <div className={`text-xs font-bold uppercase tracking-wider mb-2 mt-4 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>Ambiance</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className={`flex items-center gap-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  <kbd className={`px-2 py-1 rounded text-xs font-mono ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-100'}`}>1</kbd>
                  <span>Study Mode</span>
                </div>
              </div>
              <div className={`text-xs font-bold uppercase tracking-wider mb-2 mt-4 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>Actions</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className={`flex items-center gap-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  <kbd className={`px-2 py-1 rounded text-xs font-mono ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-100'}`}>Q</kbd>
                  <span>Quiz Me</span>
                </div>
                <div className={`flex items-center gap-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  <kbd className={`px-2 py-1 rounded text-xs font-mono ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-100'}`}>Esc</kbd>
                  <span>Close Modal</span>
                </div>
                <div className={`flex items-center gap-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  <kbd className={`px-2 py-1 rounded text-xs font-mono ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-100'}`}>?</kbd>
                  <span>This Menu</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Symbol Glossary Modal - Draggable, No Blur - Hidden in analogy mode */}
      {showSymbolGlossary && !(viewMode === 'morph' && isHovering) && (
        <div
          className={`fixed z-[100] ${isSymbolGuideMinimized ? 'w-64' : 'w-full max-w-lg'} rounded-2xl shadow-2xl ${isDarkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}
          style={{
            left: '50%',
            top: '50%',
            transform: `translate(calc(-50% + ${symbolGuidePos.x}px), calc(-50% + ${symbolGuidePos.y}px))`,
            maxHeight: isSymbolGuideMinimized ? 'auto' : '80vh',
            willChange: isDraggingSymbolGuide ? 'transform' : 'auto',
          }}
        >
          {/* Draggable Header */}
          <div
            className={`px-4 py-3 border-b cursor-move select-none ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'} rounded-t-2xl`}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingSymbolGuide(true);
              symbolGuideDragStart.current = { x: e.clientX - symbolGuidePos.x, y: e.clientY - symbolGuidePos.y };
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripHorizontal size={14} className={isDarkMode ? 'text-neutral-500' : 'text-neutral-400'} />
                <span className="text-xl">∑</span>
                <h2 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
                  Symbol Guide
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsSymbolGuideMinimized(!isSymbolGuideMinimized)}
                  className={`p-1.5 rounded transition-colors ${isDarkMode ? 'text-neutral-400 hover:text-white hover:bg-neutral-700' : 'text-neutral-500 hover:text-black hover:bg-neutral-100'}`}
                  title={isSymbolGuideMinimized ? 'Expand' : 'Minimize'}
                >
                  {isSymbolGuideMinimized ? <Maximize2 size={14} /> : <Minus size={14} />}
                </button>
                <button
                  onClick={() => { setShowSymbolGlossary(false); setSymbolGuidePos({ x: 0, y: 0 }); setIsSymbolGuideMinimized(false); }}
                  className={`p-1.5 rounded transition-colors ${isDarkMode ? 'text-neutral-400 hover:text-white hover:bg-neutral-700' : 'text-neutral-500 hover:text-black hover:bg-neutral-100'}`}
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            {!isSymbolGuideMinimized && (
              <p className={`text-xs mt-1 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Mathematical notation explained in plain English
              </p>
            )}
          </div>

          {/* Symbol Grid - only show when not minimized */}
          {!isSymbolGuideMinimized && (
            <div className="overflow-y-auto max-h-[60vh] p-4">
              {(() => {
                // Detect which symbols are in the current content
                // Use the same text source as displayed content (full explanations, not segments)
                let currentText: string;
                if (isNarrativeMode) {
                  currentText = segments.map(s => s.narrative).filter(Boolean).join(' ');
                } else if (isAnalogyVisualMode) {
                  currentText = analogyExplanation || segments.map(s => s.analogy).filter(Boolean).join(' ');
                } else {
                  currentText = technicalExplanation || segments.map(s => s.tech).filter(Boolean).join(' ');
                }
                const detectedSymbols = SYMBOL_GLOSSARY.filter(entry => {
                  // Single Latin letters (linear algebra) - only match in LaTeX context to avoid false positives
                  const isSingleLatinLetter = /^[A-Za-z]$/.test(entry.symbol);
                  if (isSingleLatinLetter) {
                    // Check for $X$ pattern or within larger LaTeX expressions like $m \times n$
                    const latexPattern = new RegExp(`\\$[^$]*\\b${entry.symbol}\\b[^$]*\\$`);
                    return latexPattern.test(currentText);
                  }
                  // Check Unicode symbol (for non-Latin symbols)
                  if (currentText.includes(entry.symbol)) return true;
                  // Check LaTeX commands (handle both escaped and unescaped backslashes)
                  return entry.latex.some(cmd => {
                    // Check direct match
                    if (currentText.includes(cmd)) return true;
                    // Check with single backslash (in case of different escaping)
                    const unescaped = cmd.replace(/\\\\/g, '\\');
                    if (currentText.includes(unescaped)) return true;
                    // Check within $ delimiters (e.g., $\in$)
                    if (currentText.includes('$' + cmd + '$')) return true;
                    if (currentText.includes('$' + unescaped + '$')) return true;
                    return false;
                  });
                });

                if (detectedSymbols.length === 0) {
                  return (
                    <div className={`text-center py-8 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                      <span className="text-4xl mb-3 block">📐</span>
                      <p>No mathematical symbols detected in the current content.</p>
                    </div>
                  );
                }

                // Group symbols by category
                const greekUpper = detectedSymbols.filter(s => /^[ΣΔΩΘΠΦΨΓΛ]$/.test(s.symbol));
                const greekLower = detectedSymbols.filter(s => /^[σαβγδεθλμπφψωρτηκνχ]$/.test(s.symbol));
                const setLogic = detectedSymbols.filter(s => /^[∈∉⊂⊆∪∩∀∃∅∧∨¬]$/.test(s.symbol));
                const calculus = detectedSymbols.filter(s => /^[∞∂∇∫∑∏′]$/.test(s.symbol));
                const relations = detectedSymbols.filter(s => /^[≈≠≤≥≪≫∝≡]$/.test(s.symbol));
                const arrows = detectedSymbols.filter(s => /^[→←↔⟹⟺]$/.test(s.symbol));
                const operations = detectedSymbols.filter(s => /^[√×÷±·∘⊕⊗]$/.test(s.symbol));
                const linearAlgebra = detectedSymbols.filter(s => /^[UVABXTmnkij]$/.test(s.symbol));
                const other = detectedSymbols.filter(s =>
                  !greekUpper.includes(s) && !greekLower.includes(s) &&
                  !setLogic.includes(s) && !calculus.includes(s) &&
                  !relations.includes(s) && !arrows.includes(s) && !operations.includes(s) &&
                  !linearAlgebra.includes(s)
                );

                const renderCategory = (title: string, symbols: typeof detectedSymbols) => {
                  if (symbols.length === 0) return null;
                  return (
                    <div key={title} className="mb-4">
                      <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                        {title}
                      </h3>
                      <div className="grid grid-cols-1 gap-1.5">
                        {symbols.map(({ symbol, name, meaning, simple }) => (
                          <div
                            key={symbol}
                            className={`flex items-start gap-3 px-3 py-2 rounded-lg ${isDarkMode ? 'bg-neutral-700/50 hover:bg-neutral-700' : 'bg-neutral-50 hover:bg-neutral-100'} transition-colors`}
                          >
                            <span className={`text-xl font-mono w-8 text-center flex-shrink-0 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                              {symbol}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div>
                                <span className={`font-medium text-sm ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
                                  {name}
                                </span>
                                <span className={`text-sm ml-2 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                  — {meaning}
                                </span>
                              </div>
                              {/* Simple explanation */}
                              <p className={`text-xs mt-1 italic ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                💡 {simple}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    <div className={`text-sm mb-4 px-1 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                      Found <span className="font-bold">{detectedSymbols.length}</span> symbols in current content
                    </div>
                    {renderCategory('Linear Algebra', linearAlgebra)}
                    {renderCategory('Greek Letters (Upper)', greekUpper)}
                    {renderCategory('Greek Letters (Lower)', greekLower)}
                    {renderCategory('Set Theory & Logic', setLogic)}
                    {renderCategory('Calculus & Analysis', calculus)}
                    {renderCategory('Comparisons', relations)}
                    {renderCategory('Arrows', arrows)}
                    {renderCategory('Operations', operations)}
                    {renderCategory('Other', other)}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Free Tier Exhausted Modal */}
      {showFreeTierModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowFreeTierModal(false)}>
          <div
            className={`relative w-full max-w-md mx-4 p-6 rounded-2xl shadow-2xl ${isDarkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${isDarkMode ? 'bg-amber-900/50' : 'bg-amber-100'}`}>
                <Sparkles className={isDarkMode ? 'text-amber-400' : 'text-amber-500'} size={32} />
              </div>
              <h2 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
                You've used your {freeTierLimit} free searches!
              </h2>
              <p className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                Get unlimited searches by adding a free API key. It takes less than a minute.
              </p>
            </div>

            <div className={`p-4 rounded-xl mb-6 ${isDarkMode ? 'bg-neutral-750 border border-neutral-700' : 'bg-neutral-50 border border-neutral-200'}`}>
              <h3 className={`font-medium mb-3 ${isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}`}>Quick Setup:</h3>
              <ol className={`text-sm space-y-2 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                <li className="flex gap-2">
                  <span className={`font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>1.</span>
                  <span>Go to <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className={`underline ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'}`}>openrouter.ai/keys</a></span>
                </li>
                <li className="flex gap-2">
                  <span className={`font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>2.</span>
                  <span>Sign up (free) and create an API key</span>
                </li>
                <li className="flex gap-2">
                  <span className={`font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>3.</span>
                  <span>Paste the key in Settings (gear icon)</span>
                </li>
              </ol>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowFreeTierModal(false)}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isDarkMode
                    ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                Maybe Later
              </button>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors text-center"
              >
                Get Free Key →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Clear Text Confirmation Modal */}
      {showClearConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowClearConfirmation(false)}>
          <div
            className={`relative w-full max-w-sm mx-4 p-6 rounded-2xl shadow-2xl ${isDarkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
              Clear All Content?
            </h2>
            <p className={`text-sm mb-6 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
              This will clear your current search results and reset the view. Your search history will be preserved.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirmation(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDarkMode
                    ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  resetAll();
                  setShowClearConfirmation(false);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ambiance Overlay Effects */}
      {ambianceMode === 'study' && (
        <>
          {/* Clickable backdrop - only visible when control panel is open */}
          {showStudyControls && (
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setShowStudyControls(false)}
            />
          )}
          {/* Main overlay container - covers everything including header */}
          <div className="fixed inset-0 pointer-events-none z-[9999]">
            {/* Base dark overlay - simulates dark room */}
            <div
              className="absolute inset-0"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
            />

            {/* Night Mode Vignette - customizable color and intensity */}
            {vignetteEnabled && (() => {
              // Get night mode colors based on selection
              const getNightColors = () => {
                const baseColors = {
                  amber: { mid: '251, 191, 36', deep: '245, 158, 11', edge: '217, 119, 6' },
                  red: { mid: '239, 68, 68', deep: '220, 38, 38', edge: '185, 28, 28' },
                  lavender: { mid: '167, 139, 250', deep: '139, 92, 246', edge: '109, 40, 217' },
                  custom: { mid: '30, 58, 138', deep: '23, 37, 84', edge: '15, 23, 42' }
                };
                return baseColors[nightColor] || baseColors.amber;
              };
              const colors = getNightColors();
              const intensityValues = {
                subtle: { mid: 0.2, deep: 0.35, edge: 0.5 },
                medium: { mid: 0.35, deep: 0.55, edge: 0.7 },
                deep: { mid: 0.5, deep: 0.7, edge: 0.85 }
              };
              const intensity = intensityValues[nightIntensity];
              return (
                <div
                  className="absolute inset-0 animate-study-pulse"
                  style={{
                    background: `radial-gradient(ellipse at center, transparent 0%, transparent 30%, rgba(${colors.mid}, ${intensity.mid}) 60%, rgba(${colors.deep}, ${intensity.deep}) 85%, rgba(${colors.edge}, ${intensity.edge}) 100%)`
                  }}
                />
              );
            })()}

            {/* Desk Lamp Spotlight - customizable intensity and color */}
            {deskLampEnabled && (() => {
              // Get lamp colors based on selection
              const getLampColors = () => {
                const presets = {
                  warm: { inner: '255, 251, 235', mid: '254, 243, 199', outer: '251, 191, 36' },
                  white: { inner: '255, 255, 255', mid: '250, 250, 250', outer: '229, 231, 235' },
                  cool: { inner: '239, 246, 255', mid: '219, 234, 254', outer: '147, 197, 253' },
                  custom: { inner: '255, 251, 235', mid: '254, 243, 199', outer: '251, 191, 36' }
                };
                return presets[lampColor] || presets.warm;
              };
              const colors = getLampColors();
              // Intensity affects opacity (0.2 to 0.6 range)
              const baseOpacity = 0.2 + (lampIntensity * 0.4);
              const midOpacity = baseOpacity * 0.6;
              const outerOpacity = baseOpacity * 0.3;
              // Lamp size based on intensity (50% to 80% coverage)
              const size = 50 + (lampIntensity * 30);
              return (
                <div
                  className="absolute inset-0 animate-lamp-flicker"
                  style={{
                    background: `radial-gradient(ellipse ${size}% ${size * 0.85}% at 50% 55%, rgba(${colors.inner}, ${baseOpacity}) 0%, rgba(${colors.mid}, ${midOpacity}) 30%, rgba(${colors.outer}, ${outerOpacity}) 50%, transparent 70%)`,
                    mixBlendMode: 'screen'
                  }}
                />
              );
            })()}
          </div>

          {/* Study Mode Control Panel - Redesigned with grouped sections */}
          {showStudyControls && (
            <div className="fixed bottom-24 right-6 z-[10000] pointer-events-auto">
              <div className="bg-neutral-900/95 backdrop-blur-md rounded-2xl border border-neutral-700 shadow-2xl w-72 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700 bg-neutral-800/50">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📚</span>
                    <span className="text-sm font-semibold text-white">Study Mode</span>
                  </div>
                  <button
                    onClick={() => setShowStudyControls(false)}
                    className="p-1.5 hover:bg-neutral-700 rounded-lg text-neutral-400 hover:text-white transition-colors"
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                  {/* Noise Generator Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-neutral-300">
                      <span className="text-sm">🎵</span>
                      <span className="text-xs font-medium uppercase tracking-wide">Sound</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['none', 'white', 'pink', 'brown'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setNoiseType(type)}
                          className={`px-2 py-1.5 text-xs rounded-lg transition-all capitalize flex items-center justify-center gap-1 ${
                            noiseType === type
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                              : 'bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700'
                          }`}
                        >
                          {noiseType === type && <Check size={12} />}
                          {type === 'none' ? 'Off' : type}
                        </button>
                      ))}
                    </div>
                    {noiseType !== 'none' && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-neutral-400">
                          <span>Volume</span>
                          <span>{Math.round(noiseVolume * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={noiseVolume}
                          onChange={(e) => setNoiseVolume(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-neutral-700 rounded-full appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Desk Lamp Section */}
                  <div className="space-y-3 pt-3 border-t border-neutral-700/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-neutral-300">
                        <span className="text-sm">💡</span>
                        <span className="text-xs font-medium uppercase tracking-wide">Desk Lamp</span>
                      </div>
                      <button
                        onClick={() => setDeskLampEnabled(!deskLampEnabled)}
                        className={`w-10 h-5 rounded-full transition-all relative ${
                          deskLampEnabled ? 'bg-yellow-500' : 'bg-neutral-700'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                          deskLampEnabled ? 'left-5' : 'left-0.5'
                        }`} />
                      </button>
                    </div>
                    {deskLampEnabled && (
                      <>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-neutral-400">
                            <span>Intensity</span>
                            <span>{Math.round(lampIntensity * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.05"
                            value={lampIntensity}
                            onChange={(e) => setLampIntensity(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-neutral-700 rounded-full appearance-none cursor-pointer accent-yellow-500"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-xs text-neutral-400">Color</span>
                          <div className="grid grid-cols-4 gap-1.5">
                            {([
                              { id: 'warm', color: '#fbbf24', label: 'Warm' },
                              { id: 'white', color: '#ffffff', label: 'White' },
                              { id: 'cool', color: '#93c5fd', label: 'Cool' },
                            ] as const).map((preset) => (
                              <button
                                key={preset.id}
                                onClick={() => setLampColor(preset.id)}
                                className={`flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all ${
                                  lampColor === preset.id
                                    ? 'bg-neutral-700 ring-2 ring-yellow-500'
                                    : 'bg-neutral-800 hover:bg-neutral-700'
                                }`}
                              >
                                <div
                                  className="w-5 h-5 rounded-full border border-neutral-600 flex items-center justify-center"
                                  style={{ backgroundColor: preset.color }}
                                >
                                  {lampColor === preset.id && <Check size={12} className="text-neutral-800" />}
                                </div>
                                <span className="text-xs text-neutral-400">{preset.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Night Mode Section */}
                  <div className="space-y-3 pt-3 border-t border-neutral-700/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-neutral-300">
                        <span className="text-sm">🌙</span>
                        <span className="text-xs font-medium uppercase tracking-wide">Night Mode</span>
                      </div>
                      <button
                        onClick={() => setVignetteEnabled(!vignetteEnabled)}
                        className={`w-10 h-5 rounded-full transition-all relative ${
                          vignetteEnabled ? 'bg-indigo-500' : 'bg-neutral-700'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                          vignetteEnabled ? 'left-5' : 'left-0.5'
                        }`} />
                      </button>
                    </div>
                    {vignetteEnabled && (
                      <>
                        <div className="space-y-1.5">
                          <span className="text-xs text-neutral-400">Intensity</span>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(['subtle', 'medium', 'deep'] as const).map((level) => (
                              <button
                                key={level}
                                onClick={() => setNightIntensity(level)}
                                className={`px-2 py-1.5 text-xs rounded-lg transition-all capitalize flex items-center justify-center gap-1 ${
                                  nightIntensity === level
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700'
                                }`}
                              >
                                {nightIntensity === level && <Check size={12} />}
                                {level}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-xs text-neutral-400">Color Temperature</span>
                          <div className="grid grid-cols-3 gap-1.5">
                            {([
                              { id: 'amber', color: '#f59e0b', label: 'Amber' },
                              { id: 'red', color: '#ef4444', label: 'Red' },
                              { id: 'lavender', color: '#a78bfa', label: 'Lavender' },
                            ] as const).map((preset) => (
                              <button
                                key={preset.id}
                                onClick={() => setNightColor(preset.id)}
                                className={`flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all ${
                                  nightColor === preset.id
                                    ? 'bg-neutral-700 ring-2 ring-indigo-500'
                                    : 'bg-neutral-800 hover:bg-neutral-700'
                                }`}
                              >
                                <div
                                  className="w-5 h-5 rounded-full border border-neutral-600"
                                  style={{ backgroundColor: preset.color }}
                                />
                                <span className="text-xs text-neutral-400">{preset.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Constellation Mode */}
      {isConstellationMode && (
        <ConstellationMode
          conceptMap={conceptMap}
          importanceMap={importanceMap}
          isAnalogyMode={isAnalogyVisualMode}
          isDarkMode={isDarkMode}
          onClose={() => setIsConstellationMode(false)}
          domainName={analogyDomain}
          topicName={lastSubmittedTopic}
          renderRichText={renderRichText}
          onFetchFoundationalMapping={generateFoundationalMapping}
        />
      )}

      {/* Dual Pane Isomorphic View */}
      {isDualPaneMode && (
        <IsomorphicDualPane
          conceptMap={conceptMap}
          importanceMap={importanceMap}
          isDarkMode={isDarkMode}
          analogyDomain={analogyDomain}
          onClose={() => setIsDualPaneMode(false)}
        />
      )}

      {/* Mastery Mode */}
      {isMasteryMode && (
        <MasteryMode
          topic={lastSubmittedTopic}
          domain={analogyDomain}
          domainEmoji={domainEmoji}
          conceptMap={conceptMap}
          importanceMap={importanceMap}
          analogyText={segments.map(s => s.analogy).join(' ')}
          isDarkMode={isDarkMode}
          onClose={() => setIsMasteryMode(false)}
          cachedState={masterySessionCache}
          onStateChange={setMasterySessionCache}
        />
      )}

      {/* Intuition Mode Modal - 3 memorable one-liners */}
      {showIntuitionModal && segments.length > 0 && segments[0].intuitions && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowIntuitionModal(false);
          }}
        >
          {/* Dark blue/black backdrop */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 opacity-95" />

          {/* Modal content */}
          <div className="relative max-w-lg w-full mx-4 p-6 rounded-2xl bg-slate-900/80 border border-blue-500/20 backdrop-blur-sm shadow-2xl shadow-blue-500/10">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Lightbulb className="text-yellow-400" size={24} />
                <h2 className="text-lg font-bold text-white">
                  Core Intuitions
                </h2>
              </div>
              <button
                onClick={() => setShowIntuitionModal(false)}
                className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={20} className="text-neutral-400" />
              </button>
            </div>

            {/* Intuitions List */}
            <div className="space-y-4">
              {segments[0].intuitions.map((intuition, idx) => (
                <div
                  key={idx}
                  className="group relative p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-blue-500/30 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <p className="text-blue-100 text-base leading-relaxed italic flex-1">
                      "{intuition}"
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(intuition);
                        setCopiedId(`intuition-${idx}`);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className={`flex-shrink-0 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
                        copiedId === `intuition-${idx}`
                          ? 'bg-green-500 text-white opacity-100'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                      title="Copy"
                    >
                      {copiedId === `intuition-${idx}` ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <p className="mt-6 text-center text-xs text-slate-500">
              Low-complexity insights — easy to remember, powerful to share
            </p>
          </div>
        </div>
      )}

      {/* Mastery History Modal */}
      {showMasteryHistory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80">
          <div className={`max-w-2xl w-full mx-4 max-h-[80vh] rounded-2xl overflow-hidden flex flex-col ${isDarkMode ? 'bg-neutral-900' : 'bg-white'}`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-neutral-700' : 'border-neutral-200'}`}>
              <div className="flex items-center gap-3">
                <Medal className="text-yellow-500" size={24} />
                <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
                  Mastered Topics
                </h2>
              </div>
              <button
                onClick={() => setShowMasteryHistory(false)}
                className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-neutral-700' : 'hover:bg-neutral-100'}`}
              >
                <X size={20} className={isDarkMode ? 'text-neutral-400' : 'text-neutral-600'} />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid gap-3">
                {masteryHistory.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => {
                      setSelectedMasteryEntry(entry);
                      setShowMasteryHistory(false);
                    }}
                    className={`p-4 rounded-xl text-left transition-all hover:scale-[1.02] ${
                      isDarkMode
                        ? 'bg-neutral-800 hover:bg-neutral-700'
                        : 'bg-neutral-100 hover:bg-neutral-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Medal className="w-10 h-10 text-yellow-500" />
                        <span className="absolute -bottom-1 -right-1 text-lg">{entry.domainEmoji}</span>
                      </div>
                      <div className="flex-1">
                        <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
                          {entry.topic}
                        </div>
                        <div className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                          via {entry.domain} • {new Date(entry.completedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className={`px-2 py-1 rounded text-xs font-medium ${isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                          {entry.finalScores.stage1}%
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-medium ${isDarkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                          {entry.finalScores.stage2}%
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-medium ${isDarkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'}`}>
                          {entry.finalScores.stage3}%
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {masteryHistory.length === 0 && (
                <div className={`text-center py-12 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  <Medal className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>No mastered topics yet</p>
                  <p className="text-sm mt-1">Complete Mastery Mode to earn medals!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selected Mastery Overview */}
      {selectedMasteryEntry && (
        <div className="fixed inset-0 z-[100] flex flex-col" style={{ backgroundColor: isDarkMode ? '#0a0a0a' : '#fafafa' }}>
          {/* Header */}
          <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Medal className="w-10 h-10 text-yellow-500" />
                <span className="absolute -bottom-1 -right-1 text-lg">{selectedMasteryEntry.domainEmoji}</span>
              </div>
              <div>
                <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
                  {selectedMasteryEntry.topic}
                </h2>
                <p className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  Mastered on {new Date(selectedMasteryEntry.completedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Copy Full Page button */}
              <button
                onClick={() => copyToClipboard(formatMasterySummaryAsMarkdown(selectedMasteryEntry), 'mastery-summary')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  copiedId === 'mastery-summary'
                    ? (isDarkMode ? 'bg-green-600 text-white' : 'bg-green-500 text-white')
                    : (isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600')
                }`}
                title="Copy as Markdown for Obsidian/Notes"
              >
                {copiedId === 'mastery-summary' ? <Check size={16} /> : <Copy size={16} />}
                <span className="text-sm font-medium">{copiedId === 'mastery-summary' ? 'Copied!' : 'Copy Full Page'}</span>
              </button>
              <button
                onClick={() => setSelectedMasteryEntry(null)}
                className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-neutral-800 hover:bg-red-500 text-neutral-300 hover:text-white' : 'bg-neutral-100 hover:bg-red-500 text-neutral-600 hover:text-white'}`}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Summary */}
              <div className={`p-6 rounded-xl ${isDarkMode ? 'bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border border-yellow-500/30' : 'bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="text-yellow-500" size={24} />
                  <h3 className={`text-lg font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                    Your Mastery Summary
                  </h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className={`text-xs uppercase font-bold ${isDarkMode ? 'text-yellow-400/70' : 'text-yellow-600'}`}>Key Strength</div>
                    <p className={isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}>{selectedMasteryEntry.masterySummary.keyStrength}</p>
                  </div>
                  <div>
                    <div className={`text-xs uppercase font-bold ${isDarkMode ? 'text-yellow-400/70' : 'text-yellow-600'}`}>Core Intuition</div>
                    <p className={isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}>{selectedMasteryEntry.masterySummary.coreIntuition}</p>
                  </div>
                  <div>
                    <div className={`text-xs uppercase font-bold ${isDarkMode ? 'text-yellow-400/70' : 'text-yellow-600'}`}>What Made You Unique</div>
                    <p className={isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}>{selectedMasteryEntry.masterySummary.uniqueApproach}</p>
                  </div>
                </div>
              </div>

              {/* Scores */}
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((stage) => (
                  <div key={stage} className={`p-4 rounded-xl text-center ${isDarkMode ? 'bg-neutral-800/50' : 'bg-white shadow-sm'}`}>
                    <div className={`text-3xl font-bold ${stage === 1 ? 'text-blue-500' : stage === 2 ? 'text-purple-500' : 'text-green-500'}`}>
                      {selectedMasteryEntry.finalScores[`stage${stage}` as keyof typeof selectedMasteryEntry.finalScores]}%
                    </div>
                    <div className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Stage {stage}</div>
                  </div>
                ))}
              </div>

              {/* Glossary */}
              <div className={`p-6 rounded-xl ${isDarkMode ? 'bg-neutral-800/50' : 'bg-white shadow-sm'}`}>
                <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>Glossary</h3>
                <div className="grid gap-3">
                  {selectedMasteryEntry.glossary.map((keyword) => (
                    <div key={keyword.id} className={`p-3 rounded-lg ${isDarkMode ? 'bg-neutral-900/50' : 'bg-neutral-50'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>{keyword.term}</span>
                        <span className={isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}>↔</span>
                        <span className={`font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{keyword.analogyTerm}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className={isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}>
                          <span className={isDarkMode ? 'text-purple-400' : 'text-purple-600'}>Tech:</span> {keyword.techDefinition6}
                        </div>
                        <div className={isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}>
                          <span className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>Analogy:</span> {keyword.analogyDefinition6}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
