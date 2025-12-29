import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Eye,
  Zap,
  AlignLeft,
  MoveHorizontal,
  Sparkles,
  BookOpenText,
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
  Snowflake,
  Coffee,
  Network,
  Columns,
  Type,
  GraduationCap,
  Medal,
  List,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';

// Types
import {
  Segment,
  ConceptMapItem,
  ImportanceMapItem,
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
  CachedDomainEnrichment
} from './types';

// Constants
import {
  STOP_WORDS,
  LATEX_REGEX,
  CONCEPT_COLORS,
  CONCEPT_BG_COLORS,
  MAX_TUTOR_HISTORY,
  QUICK_START_DOMAINS
} from './constants';

// Utils
import { cleanText, fixUnicode, wrapBareLatex, sanitizeLatex, findContext, stripMathSymbols, ApiError } from './utils';

// Hooks
import { useMobile, useKatex, useDrag, useHistory } from './hooks';

// Services
import {
  generateAnalogy,
  checkAmbiguity,
  checkDomainProximity,
  fetchDefinition as fetchDefinitionApi,
  generateQuiz,
  askTutor,
  enrichDomainOnSelection
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
  MasterySessionCache
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

// Tech Morph Tooltip - Shows definitions on hover in Tech Locked mode
// Features: Draggable, LaTeX rendering, concept mapping
const TechMorphTooltip: React.FC<{
  term: string;
  position: { x: number; y: number };
  conceptMap: ConceptMapItem[];
  domain: string;
  isDarkMode: boolean;
  onClose: () => void;
  renderRichText: (text: string, colorClass?: string) => React.ReactNode;
}> = ({ term, position, conceptMap, domain, isDarkMode, onClose, renderRichText }) => {
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [tooltipPos, setTooltipPos] = useState({
    x: Math.min(position.x, window.innerWidth - 320),
    y: position.y + 20
  });

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - tooltipPos.x,
      y: e.clientY - tooltipPos.y
    });
  };

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setTooltipPos({
        x: Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 320)),
        y: Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 200))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Find matching concept from map - improved matching
  const cleanTerm = term.toLowerCase().replace(/[.,!?;:'"()[\]{}\\$^_]/g, '').trim();
  const matchedConcept = conceptMap.find(c => {
    const techLower = c.tech_term.toLowerCase();
    const analogyLower = c.analogy_term.toLowerCase();
    return (
      techLower === cleanTerm ||
      techLower.includes(cleanTerm) ||
      cleanTerm.includes(techLower) ||
      analogyLower === cleanTerm ||
      analogyLower.includes(cleanTerm)
    );
  });

  // Check if this is a Greek/math symbol for hybrid definition
  const symbolDef = getSymbolDefinition(term);

  // Display term - use matched concept's tech_term if available, cleaned otherwise
  const displayTerm = matchedConcept?.tech_term || term.replace(/[\$\\]/g, '').trim();

  const bgColor = isDarkMode ? 'bg-neutral-800' : 'bg-white';
  const borderColor = isDarkMode ? 'border-neutral-700' : 'border-neutral-200';
  const textColor = isDarkMode ? 'text-neutral-200' : 'text-neutral-800';
  const mutedColor = isDarkMode ? 'text-neutral-400' : 'text-neutral-500';

  return (
    <div
      className={`fixed z-[200] ${bgColor} ${borderColor} border rounded-xl shadow-xl p-4 max-w-xs select-none`}
      style={{
        left: tooltipPos.x,
        top: tooltipPos.y,
      }}
    >
      {/* Draggable Header */}
      <div
        className={`flex items-center gap-2 mb-3 pb-2 border-b ${borderColor} cursor-move`}
        onMouseDown={handleMouseDown}
      >
        <span className="text-lg">🔬</span>
        <span className={`font-bold ${textColor} flex-1`}>
          {renderRichText(displayTerm, textColor)}
        </span>
        <button
          onClick={onClose}
          className={`${mutedColor} hover:text-red-400 transition-colors p-1`}
          title="Close (or drag header to move)"
        >
          ✕
        </button>
      </div>

      {/* Content: Narrative > Symbol > Fallback */}
      {matchedConcept?.narrative_mapping ? (
        <div className="space-y-3">
          {/* Narrative Story */}
          <div>
            <div className={`text-xs uppercase font-bold ${mutedColor} mb-2`}>
              📖 The Story
            </div>
            <p className={`text-sm ${textColor} leading-relaxed`}>
              {matchedConcept.narrative_mapping}
            </p>
          </div>

          {/* Symbol Technical Meaning - Add if it's a symbol */}
          {symbolDef && (
            <div className={`pt-2 border-t ${borderColor}`}>
              <div className={`text-xs uppercase font-bold ${mutedColor} mb-1`}>
                🔣 Symbol Meaning
              </div>
              <p className={`text-sm ${textColor}`}>{symbolDef.technical}</p>
            </div>
          )}

          {/* Compact Mapping */}
          <div className={`pt-2 border-t ${borderColor}`}>
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-purple-500 font-medium">{renderRichText(matchedConcept.tech_term, 'text-purple-500')}</span>
              <span className={mutedColor}>↔</span>
              <span className="text-emerald-500 font-medium">{matchedConcept.analogy_term}</span>
            </div>
          </div>
        </div>
      ) : symbolDef ? (
        /* Symbol-only definition - hybrid technical + domain hint */
        <div className="space-y-3">
          {/* Symbol Technical Meaning */}
          <div>
            <div className={`text-xs uppercase font-bold ${mutedColor} mb-1`}>
              📐 Technical
            </div>
            <p className={`text-sm ${textColor}`}>{symbolDef.technical}</p>
          </div>

          {/* Domain Hint */}
          <div>
            <div className={`text-xs uppercase font-bold ${mutedColor} mb-1`}>
              🎯 Think of it as
            </div>
            <p className={`text-sm text-emerald-500`}>"{symbolDef.domainHint}"</p>
          </div>

          {/* Visual Symbol */}
          <div className={`pt-2 border-t ${borderColor} text-center`}>
            <span className={`text-2xl ${textColor}`}>{symbolDef.symbol}</span>
          </div>
        </div>
      ) : (
        /* Fallback for older content without narrative_mapping */
        <div className="space-y-3">
          {/* Technical Definition */}
          <div>
            <div className={`text-xs uppercase font-bold ${mutedColor} mb-1`}>
              📐 Technical
            </div>
            <p className={`text-sm ${textColor}`}>
              {matchedConcept
                ? <span>Core concept: {renderRichText(matchedConcept.tech_term, textColor)}</span>
                : `Technical term in this context`
              }
            </p>
          </div>

          {/* Analogy Definition */}
          {matchedConcept && (
            <div>
              <div className={`text-xs uppercase font-bold ${mutedColor} mb-1`}>
                🎯 {domain} Equivalent
              </div>
              <p className={`text-sm ${textColor}`}>
                Maps to "{renderRichText(matchedConcept.analogy_term, 'text-emerald-500 font-medium')}" in {domain}
              </p>
            </div>
          )}

          {/* Mapping Arrow */}
          {matchedConcept && (
            <div className={`pt-2 border-t ${borderColor} flex items-center justify-center gap-2 text-sm`}>
              <span className="text-purple-500 font-medium">{renderRichText(matchedConcept.tech_term, 'text-purple-500')}</span>
              <span className={mutedColor}>↔</span>
              <span className="text-emerald-500 font-medium">{matchedConcept.analogy_term}</span>
            </div>
          )}
        </div>
      )}

      {/* Drag hint */}
      <div className={`mt-2 text-[10px] ${mutedColor} text-center`}>
        Drag header to move
      </div>
    </div>
  );
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

  // Content State
  const [segments, setSegments] = useState<Segment[]>([]);
  const [conceptMap, setConceptMap] = useState<ConceptMapItem[]>([]);
  const [importanceMap, setImportanceMap] = useState<ImportanceMapItem[]>([]);
  const [processedWords, setProcessedWords] = useState<ProcessedWord[]>([]);
  const [contextData, setContextData] = useState<ContextData | null>(null);
  const [condensedData, setCondensedData] = useState<CondensedData | null>(null);
  const [synthesisSummary, setSynthesisSummary] = useState("");
  const [synthesisCitation, setSynthesisCitation] = useState("");

  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null); // User-visible API error
  const [hasStarted, setHasStarted] = useState(false);
  const [isViewingFromHistory, setIsViewingFromHistory] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showContext, setShowContext] = useState(false);
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

  // Tech Morph Tooltip State (hover definitions in Tech Locked mode)
  const [techMorphTerm, setTechMorphTerm] = useState<{ term: string; position: { x: number; y: number }; conceptIndex?: number } | null>(null);
  // Track which concept is being hovered for multi-word term underlining
  const [hoveredConceptIndex, setHoveredConceptIndex] = useState<number | null>(null);

  // Tutor State
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpQuery, setFollowUpQuery] = useState("");
  const [tutorResponse, setTutorResponse] = useState<TutorResponse | null>(null);
  const [isTutorLoading, setIsTutorLoading] = useState(false);
  const [tutorHistory, setTutorHistory] = useState<TutorHistoryEntry[]>([]);

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
  const [ambianceMode, setAmbianceMode] = useState<'none' | 'study' | 'holiday'>('none');
  const [showStudyControls, setShowStudyControls] = useState(true);
  const [brownNoiseEnabled, setBrownNoiseEnabled] = useState(false);
  const [deskLampEnabled, setDeskLampEnabled] = useState(true);
  const [vignetteEnabled, setVignetteEnabled] = useState(true);
  const brownNoiseRef = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);
  const [showShortcutsLegend, setShowShortcutsLegend] = useState(false);
  const [isConstellationMode, setIsConstellationMode] = useState(false);
  const [isDualPaneMode, setIsDualPaneMode] = useState(false);
  const [isMasteryMode, setIsMasteryMode] = useState(false);
  const [masteryHistory, setMasteryHistory] = useState<CompleteMasteryHistory[]>([]);
  const [showMasteryHistory, setShowMasteryHistory] = useState(false);
  const [selectedMasteryEntry, setSelectedMasteryEntry] = useState<CompleteMasteryHistory | null>(null);
  const [masterySessionCache, setMasterySessionCache] = useState<MasterySessionCache | null>(null);

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
  const techMorphHoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const condensedMorphTimerRef = useRef<NodeJS.Timeout | null>(null);

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
        tech: cleanText(fixUnicode(s.tech || s.technical || "")),
        // Strip math symbols from analogy/narrative at load time to ensure pure prose in ALL display paths
        analogy: stripMathSymbols(cleanText(fixUnicode(s.analogy || s.nfl || ""))),
        narrative: stripMathSymbols(cleanText(fixUnicode(s.narrative || "")))
      })));
    }

    if (conceptMapArray && Array.isArray(conceptMapArray)) {
      // Filter out invalid mappings where tech_term equals analogy_term (not a true isomorphism)
      const validMappings = conceptMapArray
        .map((c: any, i: number) => ({
          id: c.id ?? i,
          tech_term: cleanText(c.tech_term || c.techTerm || ""),
          analogy_term: cleanText(c.analogy_term || c.analogyTerm || "")
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

    if (context) {
      setContextData({
        header: cleanText(fixUnicode(context.header || topicName)),
        emoji: fixUnicode(context.emoji || "💡"),
        // Strip math symbols from context fields - they should be pure prose
        why: stripMathSymbols(cleanText(fixUnicode(context.why || ""))),
        real_world: stripMathSymbols(cleanText(fixUnicode(context.real_world || context.realWorld || ""))),
        narrative: stripMathSymbols(cleanText(fixUnicode(context.narrative || "")))
      });
      setShowContext(false); // Collapsed by default - user clicks to expand
    }

    if (synthesis) {
      setSynthesisSummary(cleanText(fixUnicode(synthesis.summary || "")));
      setSynthesisCitation(cleanText(fixUnicode(synthesis.citation || "")));
    }

    // Parse condensed view data (WHAT/WHY + bullet points)
    const condensed = findContext(data, ["condensed"]);
    if (condensed) {
      setCondensedData({
        what: cleanText(fixUnicode(condensed.what || "")),
        why: cleanText(fixUnicode(condensed.why || "")),
        bullets: Array.isArray(condensed.bullets)
          ? condensed.bullets.map((b: string) => cleanText(fixUnicode(b || "")))
          : []
      });
    } else {
      setCondensedData(null);
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
    setShowContext(false); // Keep collapsed until user clicks to expand
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

  const calculateIntelligentWeight = (word: string, map: ConceptMapItem[], impMap: ImportanceMapItem[], isAnalogy: boolean): number => {
    const cleanedWord = cleanText(word).toLowerCase();
    if (STOP_WORDS.has(cleanedWord) || cleanedWord.length < 3) return 0.1;

    const terms = isAnalogy
      ? map.map(c => cleanText(c.analogy_term).toLowerCase())
      : map.map(c => cleanText(c.tech_term).toLowerCase());

    if (terms.some(t => t.includes(cleanedWord) || cleanedWord.includes(t))) return 1.0;

    const importanceEntry = impMap.find(m =>
      cleanText(m.term).toLowerCase().includes(cleanedWord) ||
      cleanedWord.includes(cleanText(m.term).toLowerCase())
    );
    if (importanceEntry) return importanceEntry.importance;

    if (cleanedWord.length > 6) return 0.55;
    return 0.3;
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
      setDefComplexity(level);
    }

    try {
      const result = await fetchDefinitionApi(term, context, level);
      if (isMini) setMiniDefText(result);
      else setDefText(result);
    } catch (e) {
      const errText = "Could not load definition.";
      if (isMini) setMiniDefText(errText);
      else setDefText(errText);
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
          // Story mode toggle
          if (!hasStarted) return;
          setIsNarrativeMode(!isNarrativeMode);
          break;
        case 'b':
          // Bullet point mode toggle (only works in Tech Lock mode)
          if (!hasStarted || viewMode !== 'tech') return;
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
        case '2':
          // Holiday mode
          setAmbianceMode(ambianceMode === 'holiday' ? 'none' : 'holiday');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasStarted, showQuizModal, showSynthesis, miniDefPosition, defPosition, showControls, showFollowUp, disambiguation, isNarrativeMode, isDarkMode, isImmersive, showHistory, isQuizLoading, isLoading, showShortcutsLegend, isConstellationMode, isDualPaneMode, isMasteryMode, ambianceMode, textScale, viewMode, isBulletMode]);

  // Brown noise audio for Study Mode
  useEffect(() => {
    if (ambianceMode === 'study' && brownNoiseEnabled) {
      // Create deep brown noise using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const bufferSize = 4096;
      const brownNoise = audioContext.createScriptProcessor(bufferSize, 1, 1);
      let lastOut = 0.0;

      // Generate deeper brown noise with lower coefficient
      brownNoise.onaudioprocess = (e) => {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          // Lower coefficient (0.008) = deeper/bassier brown noise
          output[i] = (lastOut + (0.008 * white)) / 1.008;
          lastOut = output[i];
          output[i] *= 5.0; // Boost volume to compensate for lower coefficient
        }
      };

      // Add low-pass filter for extra depth
      const lowPassFilter = audioContext.createBiquadFilter();
      lowPassFilter.type = 'lowpass';
      lowPassFilter.frequency.value = 250; // Cut high frequencies for rumbling bass
      lowPassFilter.Q.value = 0.7;

      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.25; // Slightly higher volume for deep bass

      brownNoise.connect(lowPassFilter);
      lowPassFilter.connect(gainNode);
      gainNode.connect(audioContext.destination);

      brownNoiseRef.current = { ctx: audioContext, gain: gainNode };

      return () => {
        brownNoise.disconnect();
        lowPassFilter.disconnect();
        gainNode.disconnect();
        audioContext.close();
        brownNoiseRef.current = null;
      };
    } else if (brownNoiseRef.current) {
      brownNoiseRef.current.ctx.close();
      brownNoiseRef.current = null;
    }
  }, [ambianceMode, brownNoiseEnabled]);

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

    const conversationContext = tutorHistory.map(entry =>
      `${entry.role === 'user' ? 'User' : 'Tutor'}: ${entry.text}`
    ).join('\n');

    try {
      const result = await askTutor(lastSubmittedTopic, analogyDomain, query, conversationContext);
      if (result) {
        setTutorResponse({ question: query, answer: result, mode: "Tutor" });
        setFollowUpQuery("");
        setTutorHistory(prev => [
          ...prev,
          { role: 'user' as const, text: query },
          { role: 'model' as const, text: result }
        ].slice(-MAX_TUTOR_HISTORY));
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
    setShowContext(false); // Keep collapsed - user clicks to expand
  };

  // Return to home - clears history view mode and resets for new search
  const returnToHome = () => {
    setIsViewingFromHistory(false);
    setHasStarted(false);
    setTopic("");
    setProcessedWords([]);
    setSegments([]);
    setContextData(null);
    setCondensedData(null);
  };

  // Check if morph should be locked (definition popup open OR user is selecting text)
  const isDefinitionPopupOpen = !!(defPosition || miniDefPosition);
  const isMorphLocked = isDefinitionPopupOpen || morphLockedForSelection;

  const handleMouseEnterWrapper = () => {
    if (isMobile) return;
    setIsMouseInside(true);

    if (!hasStarted || viewMode !== 'morph' || isScrolling) return;
    // Lock morph when definition popup is open or user is selecting
    if (isMorphLocked) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setIsHovering(true), 150);
  };

  const handleMouseLeaveWrapper = () => {
    if (isMobile) return;
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
      // Transition INTO first principles
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
    setProcessedWords([]);
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
    setShowContext(false);
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
      return <span key={i} className={colorClass}>{part}</span>;
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
                const weight = calculateIntelligentWeight(word, activeMap, importanceMap, false);
                const isImportant = weight >= currentThreshold;

                let colorClassName = "";
                if (isColorMode && isImportant) {
                  const conceptId = getConceptId(word, activeMap);
                  if (conceptId !== -1) {
                    colorClassName = CONCEPT_COLORS[conceptId % CONCEPT_COLORS.length];
                  } else if (weight > 0.6) {
                    colorClassName = "text-neutral-500";
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

  const renderWord = (item: ProcessedWord, index: number) => {
    const wordId = `word-${index}`;
    if (item.isSpace) return <span key={index}>{item.text}</span>;

    const isImportant = item.weight >= threshold;
    // Only show clickable cursor in locked modes (not morph mode)
    const isClickableMode = viewMode !== 'morph';
    let style: React.CSSProperties = {
      display: 'inline-block',
      // Smooth morph transitions with cubic bezier easing
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
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
          const intensity = Math.min((item.weight - threshold) / (1 - threshold), 1);
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

    // Red highlight for concept_map terms on mouse enter in Tech Lock mode
    const hasConceptMapping = item.conceptIndex !== undefined && item.conceptIndex >= 0;
    const cleanTextForMatch = item.text.toLowerCase().replace(/[.,!?;:'"()[\]{}\\$^_]/g, '').trim();
    const matchesConceptMap = conceptMap.some(c =>
      c.tech_term.toLowerCase().includes(cleanTextForMatch) ||
      cleanTextForMatch.includes(c.tech_term.toLowerCase()) ||
      c.analogy_term.toLowerCase().includes(cleanTextForMatch)
    );
    const isTechConceptTerm = isImportant && (hasConceptMapping || matchesConceptMap);

    if (viewMode === 'tech' && isMouseInside && isTechConceptTerm && !isSelected) {
      style.color = '#dc2626'; // Tailwind red-600
      style.fontWeight = 700;
    }

    let classes = "";
    if (isImportant && isIsomorphicMode && item.conceptIndex !== undefined && item.conceptIndex >= 0) {
      if (mode === 'heatmap') {
        classes = heatmapColorClass;
        style.backgroundColor = undefined;
      } else {
        classes = segmentColorClass;
      }
    }

    let contentToRender = item.text;
    let forceRender = false;
    if (!item.isLatex && /^\\[a-zA-Z]+/.test(item.text)) {
      contentToRender = `$${item.text}$`;
      forceRender = true;
    }

    // Tech Morph hover handler - shows tooltip with definitions in Tech Locked mode
    // Only trigger for words that are actual technical terms (have conceptIndex or match conceptMap)
    // Uses debounce to prevent jittery behavior
    const handleTechMorphHover = (e: React.MouseEvent) => {
      // Clear any pending hover timer
      if (techMorphHoverTimerRef.current) {
        clearTimeout(techMorphHoverTimerRef.current);
      }

      if (viewMode === 'tech' && isImportant) {
        // Only show tooltip for actual technical terms - those with a concept mapping
        const hasConceptMapping = item.conceptIndex !== undefined && item.conceptIndex >= 0;

        // Also check if term matches any concept in the map (fallback for unmapped but technical words)
        const cleanText = item.text.toLowerCase().replace(/[.,!?;:'"()[\]{}\\$^_]/g, '').trim();
        const matchesConceptMap = conceptMap.some(c =>
          c.tech_term.toLowerCase().includes(cleanText) ||
          cleanText.includes(c.tech_term.toLowerCase()) ||
          c.analogy_term.toLowerCase().includes(cleanText)
        );

        // Check if this is a Greek/math symbol (also hoverable)
        const isSymbol = item.isLatex || getSymbolDefinition(item.text) !== null;

        // Skip common non-technical words
        const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their', 'we', 'us', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'which', 'who', 'whom', 'where', 'when', 'why', 'how', 'what', 'if', 'then', 'else', 'so', 'not', 'no', 'yes', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'same', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'where', 'about', 'into', 'over', 'after', 'before', 'between', 'under', 'again', 'further', 'once'];
        const isCommonWord = commonWords.includes(cleanText);

        if ((hasConceptMapping || matchesConceptMap || isSymbol) && !isCommonWord) {
          // Get element position for stable tooltip placement
          const target = e.currentTarget as HTMLElement;
          const rect = target.getBoundingClientRect();

          // Set hovered concept immediately for underline styling (no debounce)
          if (item.conceptIndex !== undefined && item.conceptIndex >= 0) {
            setHoveredConceptIndex(item.conceptIndex);
          }

          // Debounce: wait 150ms before showing tooltip to prevent jitter
          techMorphHoverTimerRef.current = setTimeout(() => {
            setTechMorphTerm({
              term: item.text,
              // Position below the word, not at mouse cursor (more stable)
              position: { x: rect.left, y: rect.bottom },
              conceptIndex: item.conceptIndex
            });
          }, 150);
        }
      }
    };

    const handleTechMorphLeave = () => {
      // Clear pending hover timer
      if (techMorphHoverTimerRef.current) {
        clearTimeout(techMorphHoverTimerRef.current);
        techMorphHoverTimerRef.current = null;
      }
      // Clear hovered concept for underline styling
      setHoveredConceptIndex(null);
      // Delay closing to allow moving to tooltip
      setTimeout(() => {
        setTechMorphTerm(null);
      }, 200);
    };

    if (item.isLatex || forceRender) {
      let latexContent = contentToRender.replace(/\\\\/g, "\\");
      let rawContent = latexContent.startsWith('$$')
        ? latexContent.slice(2, -2)
        : latexContent.startsWith('$')
          ? latexContent.slice(1, -1)
          : latexContent;

      // Add hover class for important clickable words (only in locked modes)
      // Also apply underline when any word in the same concept group is hovered (multi-word term support)
      const isPartOfHoveredConcept = hoveredConceptIndex !== null && item.conceptIndex === hoveredConceptIndex;
      const hoverClass = isImportant && isClickableMode ? 'hover:underline hover:decoration-dotted hover:decoration-current cursor-help' : '';
      const activeUnderline = isPartOfHoveredConcept ? 'underline decoration-dotted' : '';

      if (!isKatexLoaded || !window.katex) {
        return <span id={wordId} key={index} className={`${classes} ${hoverClass} ${activeUnderline}`} title="Math loading...">{rawContent}</span>;
      }

      try {
        const html = window.katex.renderToString(rawContent, { throwOnError: false, displayMode: false });
        const mathStyle = { ...style, display: 'inline-block', margin: '0 4px' };
        return (
          <span
            id={wordId}
            key={index}
            style={mathStyle}
            className={`${classes} ${hoverClass} ${activeUnderline} not-italic normal-case`}
            dangerouslySetInnerHTML={{ __html: html }}
            onMouseEnter={handleTechMorphHover}
            onMouseLeave={handleTechMorphLeave}
          />
        );
      } catch (e) {
        return <span id={wordId} key={index} style={style} className={`${classes} ${hoverClass} ${activeUnderline}`}>{item.text}</span>;
      }
    }

    // Add hover class for important clickable words (only in locked modes)
    // Also apply underline when any word in the same concept group is hovered (multi-word term support)
    const isPartOfHoveredConcept = hoveredConceptIndex !== null && item.conceptIndex === hoveredConceptIndex;
    const hoverClass = isImportant && isClickableMode ? 'hover:underline hover:decoration-dotted hover:decoration-current cursor-help' : '';
    const activeUnderline = isPartOfHoveredConcept ? 'underline decoration-dotted' : '';

    return (
      <span
        id={wordId}
        key={index}
        style={style}
        className={`${classes} ${hoverClass} ${activeUnderline}`}
        onMouseEnter={handleTechMorphHover}
        onMouseLeave={handleTechMorphLeave}
      >
        {item.text}
      </span>
    );
  };

  // Process words effect
  useEffect(() => {
    if (!segments.length || isLoading) return;

    const allTokens: ProcessedWord[] = [];
    let fallbackCounter = -1;

    segments.forEach((segment, segmentIndex) => {
      const textToParse = isNarrativeMode ? segment.narrative : (isAnalogyVisualMode ? segment.analogy : segment.tech);
      if (!textToParse) return;

      // Only apply LaTeX processing to technical text
      // Analogy/narrative should be pure prose - no LaTeX conversion
      // (otherwise "to" becomes "\to" → "→" and "end" becomes "\end" → red error)
      const isTechnicalMode = !isNarrativeMode && !isAnalogyVisualMode;

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
          allTokens.push({ text: part, weight: 1.0, isSpace: false, isLatex: true, segmentIndex });
        } else {
          part.split(/(\s+)/).forEach(word => {
            if (!word) return;
            if (/^\s+$/.test(word)) {
              allTokens.push({ text: word, weight: 0, isSpace: true, segmentIndex });
              return;
            }
            const weight = calculateIntelligentWeight(word, conceptMap, importanceMap, isAnalogyVisualMode);
            let cIdx = getConceptId(word, conceptMap);
            const mappedId = getConceptId(word, conceptMap);
            if (mappedId !== -1) {
              cIdx = mappedId;
            } else if (weight > 0.6) {
              fallbackCounter++;
              cIdx = fallbackCounter;
            }
            allTokens.push({ text: word, weight, isSpace: false, isLatex: false, segmentIndex, conceptIndex: cIdx });
          });
        }
      });

      if (segmentIndex < segments.length - 1) {
        allTokens.push({ text: " ", weight: 0, isSpace: true, segmentIndex });
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
  }, [segments, isAnalogyVisualMode, isNarrativeMode, conceptMap, importanceMap, defPosition]);

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
          setHasSelectedDomain(false);
          setTempDomainInput("");
        }}
        onSubmit={handleSubmit}
        isViewingFromHistory={isViewingFromHistory}
        onReturnHome={returnToHome}
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

      {/* Main Content */}
      <main ref={scrollRef} className={`flex-1 overflow-y-auto transition-all duration-500 ${isImmersive ? 'pt-0' : 'pt-4'}`}>
        <div className={`max-w-4xl mx-auto px-4 pb-32 transition-all duration-500 ${isImmersive ? 'max-w-none px-8' : ''}`}>
          {/* Loading State */}
          {isLoading && (
            <div className={`rounded-2xl p-12 text-center ${isDarkMode ? 'bg-neutral-800' : 'bg-white border border-neutral-200'}`}>
              <Loader2 className={`mx-auto animate-spin mb-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`} size={48} />
              <p className={isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}>Generating your personalized analogy...</p>
            </div>
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
              {/* Context Card */}
              {contextData && (
                <ContextCard
                  contextData={contextData}
                  showContext={showContext}
                  setShowContext={setShowContext}
                  isDarkMode={isDarkMode}
                />
              )}

              {/* Main Content Card */}
              <div
                className={`rounded-2xl shadow-lg overflow-hidden border transition-all duration-300 ${
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
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-amber-900/50 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                        Selecting...
                      </span>
                    )}
                    {hasStarted && (
                      <button
                        onClick={() => setIsNarrativeMode(!isNarrativeMode)}
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
                        onClick={() => setIsBulletMode(!isBulletMode)}
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
                    {/* First Principles Mode - Only in Tech Lock when condensed data available */}
                    {hasStarted && viewMode === 'tech' && condensedData && (
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
                            className={`px-2 py-1 text-[10px] font-bold transition-colors ${
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
                      <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                        <Loader2 size={10} className="animate-spin" />
                        Regenerating...
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsIsomorphicMode(!isIsomorphicMode)}
                      className={`p-2 rounded-lg transition-colors ${
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
                      className={`absolute inset-0 z-10 p-6 md:p-8 rounded-xl transition-all duration-300 ease-out ${
                        isDarkMode ? 'bg-neutral-900/95' : 'bg-white/95'
                      } backdrop-blur-sm ${
                        showCondensedView && !isCondensedMorphing
                          ? 'opacity-100 blur-0 scale-100'
                          : 'opacity-0 blur-md scale-[0.98]'
                      }`}
                    >
                      <div className="space-y-5">
                        {/* WHAT Section */}
                        <div>
                          <div className={`text-xs uppercase font-bold tracking-wider mb-2 ${
                            isDarkMode ? 'text-purple-400' : 'text-purple-600'
                          }`}>
                            📐 WHAT
                          </div>
                          <p
                            className={`font-medium leading-relaxed ${isDarkMode ? 'text-neutral-100' : 'text-neutral-800'}`}
                            style={{ fontSize: `${1.25 * textScale}rem` }}
                          >
                            {condensedData.what}
                          </p>
                        </div>

                        {/* WHY Section */}
                        <div>
                          <div className={`text-xs uppercase font-bold tracking-wider mb-2 ${
                            isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                          }`}>
                            🎯 WHY
                          </div>
                          <p
                            className={`font-medium leading-relaxed ${isDarkMode ? 'text-neutral-100' : 'text-neutral-800'}`}
                            style={{ fontSize: `${1.25 * textScale}rem` }}
                          >
                            {condensedData.why}
                          </p>
                        </div>

                        {/* First Principles Bullets - with heatmap importance colors */}
                        {condensedData.bullets.length > 0 && (
                          <div>
                            <div className={`text-xs uppercase font-bold tracking-wider mb-3 ${
                              isDarkMode ? 'text-orange-400' : 'text-orange-600'
                            }`}>
                              ⚡ First Principles
                            </div>
                            <ul className="space-y-3">
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
                                    className="flex gap-3 items-start px-3 py-2 rounded-lg border-l-4 transition-all"
                                    style={{
                                      backgroundColor: colors.bg,
                                      borderLeftColor: colors.border
                                    }}
                                  >
                                    <span
                                      className="flex-shrink-0 font-bold"
                                      style={{
                                        fontSize: `${1 * textScale}rem`,
                                        marginTop: '0.125rem',
                                        color: colors.num
                                      }}
                                    >
                                      {i + 1}.
                                    </span>
                                    <span
                                      style={{
                                        fontSize: `${1.125 * textScale}rem`,
                                        lineHeight: '1.6',
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
                        <span className="text-neutral-400 text-[10px]">
                          ({pendingSelection.split(/\s+/).length} words)
                        </span>
                      )}
                    </button>
                  )}
                </div>

                {/* Content Footer */}
                <div className={`px-4 py-3 border-t ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-neutral-50 border-neutral-200'}`}>
                  {/* Selection hint - only show when not in morph mode */}
                  {viewMode !== 'morph' && (
                    <div className={`flex items-center justify-center gap-1.5 mb-2 text-[10px] ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      <BookOpen size={10} />
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
              </div>

              {/* Follow-up Section */}
              {showFollowUp && (
                <div className={`rounded-xl p-4 border ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <MessageCircle size={16} className={isDarkMode ? 'text-blue-400' : 'text-blue-500'} />
                    <span className={`font-medium text-sm ${isDarkMode ? 'text-white' : ''}`}>Ask a follow-up question</span>
                  </div>
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
                  {tutorResponse && (
                    <div className={`mt-3 p-3 rounded-lg text-sm ${isDarkMode ? 'bg-neutral-700' : 'bg-blue-50'}`}>
                      <p className={`font-medium mb-1 ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>Q: {tutorResponse.question}</p>
                      <div className={isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}>{renderRichText(tutorResponse.answer)}</div>
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
        <div ref={controlsPanelRef} className={`fixed bottom-20 right-6 z-50 rounded-xl shadow-xl p-4 space-y-3 w-56 ${isDarkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}>
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

      {/* Tech Morph Tooltip - Hover definitions in Tech Locked mode */}
      {techMorphTerm && viewMode === 'tech' && (
        <TechMorphTooltip
          term={techMorphTerm.term}
          position={techMorphTerm.position}
          conceptMap={conceptMap}
          domain={analogyDomain}
          isDarkMode={isDarkMode}
          onClose={() => setTechMorphTerm(null)}
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
        <button
          onClick={() => setAmbianceMode(ambianceMode === 'holiday' ? 'none' : 'holiday')}
          className={`p-3 rounded-full shadow-lg border transition-colors ${
            ambianceMode === 'holiday'
              ? 'bg-red-500 border-red-600 text-white'
              : (isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-red-400' : 'bg-white border-neutral-200 text-neutral-500 hover:text-red-500')
          }`}
          title="Holiday Mode (2)"
        >
          <Snowflake size={20} />
        </button>
        {hasStarted && (
          <button
            onClick={resetAll}
            className={`p-3 rounded-full shadow-lg border transition-colors ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-red-400' : 'bg-white border-neutral-200 text-neutral-500 hover:text-red-500'}`}
            title="Clear Text"
          >
            <RotateCcw size={20} />
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
                <div className={`flex items-center gap-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  <kbd className={`px-2 py-1 rounded text-xs font-mono ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-100'}`}>2</kbd>
                  <span>Holiday Mode</span>
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

            {/* Strong Blue Vignette - late night studying feel */}
            {vignetteEnabled && (
              <div
                className="absolute inset-0 animate-study-pulse"
                style={{
                  background: 'radial-gradient(ellipse at center, transparent 0%, transparent 30%, rgba(30, 58, 138, 0.35) 60%, rgba(23, 37, 84, 0.55) 85%, rgba(15, 23, 42, 0.7) 100%)'
                }}
              />
            )}

            {/* Desk Lamp Spotlight - centered on content area */}
            {deskLampEnabled && (
              <div
                className="absolute inset-0 animate-lamp-flicker"
                style={{
                  background: 'radial-gradient(ellipse 60% 50% at 50% 55%, rgba(255, 251, 235, 0.35) 0%, rgba(254, 243, 199, 0.2) 30%, rgba(251, 191, 36, 0.1) 50%, transparent 70%)',
                  mixBlendMode: 'screen'
                }}
              />
            )}
          </div>

          {/* Study Mode Control Panel - only shown when showStudyControls is true */}
          {showStudyControls && (
            <div className="fixed bottom-24 right-6 z-[10000] pointer-events-auto">
              <div className="bg-neutral-900/95 backdrop-blur-sm rounded-xl p-3 border border-neutral-700 shadow-2xl flex flex-col gap-2">
                {/* Header with close button */}
                <div className="flex items-center justify-between pb-2 border-b border-neutral-700 mb-1">
                  <span className="text-xs font-medium text-neutral-300">Study Mode</span>
                  <button
                    onClick={() => {
                      setAmbianceMode('none');
                      setShowStudyControls(true); // Reset for next time
                    }}
                    className="p-1 hover:bg-red-600 rounded text-neutral-400 hover:text-white transition-colors"
                    title="Exit Study Mode"
                  >
                    <X size={14} />
                  </button>
                </div>

                <button
                  onClick={() => setBrownNoiseEnabled(!brownNoiseEnabled)}
                  className={`px-3 py-2 text-xs rounded-lg transition-all flex items-center gap-2 ${
                    brownNoiseEnabled
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700'
                  }`}
                  title="Toggle Brown Noise"
                >
                  <span className="text-sm">🎵</span>
                  <span>Brown Noise</span>
                </button>
                <button
                  onClick={() => setDeskLampEnabled(!deskLampEnabled)}
                  className={`px-3 py-2 text-xs rounded-lg transition-all flex items-center gap-2 ${
                    deskLampEnabled
                      ? 'bg-yellow-500 text-neutral-900 shadow-lg shadow-yellow-500/30'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700'
                  }`}
                  title="Toggle Desk Lamp Spotlight"
                >
                  <span className="text-sm">💡</span>
                  <span>Desk Lamp</span>
                </button>
                <button
                  onClick={() => setVignetteEnabled(!vignetteEnabled)}
                  className={`px-3 py-2 text-xs rounded-lg transition-all flex items-center gap-2 ${
                    vignetteEnabled
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700'
                  }`}
                  title="Toggle Blue Vignette"
                >
                  <span className="text-sm">🌙</span>
                  <span>Night Mode</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {ambianceMode === 'holiday' && (
        <div className="fixed inset-0 pointer-events-none z-[5] overflow-hidden">
          {/* Base holiday tint - red and green */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, rgba(185, 28, 28, 0.12) 0%, transparent 50%, rgba(22, 101, 52, 0.12) 100%)'
            }}
          />
          {/* Snow particles - larger and more visible */}
          <div className="absolute inset-0">
            {Array.from({ length: 60 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full animate-snowfall"
                style={{
                  left: `${(i * 1.7) % 100}%`,
                  width: `${3 + (i % 4)}px`,
                  height: `${3 + (i % 4)}px`,
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  boxShadow: '0 0 4px rgba(255, 255, 255, 0.5)',
                  animationDelay: `${(i * 0.15) % 10}s`,
                  animationDuration: `${4 + (i % 6)}s`,
                }}
              />
            ))}
          </div>
          {/* Twinkling Christmas lights along edges */}
          <div className="absolute top-0 left-0 right-0 h-2 flex justify-around">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={`light-top-${i}`}
                className="w-2 h-2 rounded-full animate-twinkle"
                style={{
                  backgroundColor: i % 3 === 0 ? '#ef4444' : i % 3 === 1 ? '#22c55e' : '#facc15',
                  boxShadow: `0 0 8px ${i % 3 === 0 ? '#ef4444' : i % 3 === 1 ? '#22c55e' : '#facc15'}`,
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-2 flex justify-around">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={`light-bottom-${i}`}
                className="w-2 h-2 rounded-full animate-twinkle"
                style={{
                  backgroundColor: i % 3 === 0 ? '#22c55e' : i % 3 === 1 ? '#ef4444' : '#facc15',
                  boxShadow: `0 0 8px ${i % 3 === 0 ? '#22c55e' : i % 3 === 1 ? '#ef4444' : '#facc15'}`,
                  animationDelay: `${i * 0.15 + 0.5}s`,
                }}
              />
            ))}
          </div>
          {/* Holiday vignette */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(127, 29, 29, 0.15) 100%)'
            }}
          />
        </div>
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
