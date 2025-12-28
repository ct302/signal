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
  Medal
} from 'lucide-react';

// Types
import {
  Segment,
  ConceptMapItem,
  ImportanceMapItem,
  ProcessedWord,
  Position,
  ContextData,
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
import { cleanText, fixUnicode, wrapBareLatex, sanitizeLatex, findContext, stripMathSymbols } from './utils';

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
  MasteryMode
} from './components';

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
  const [synthesisSummary, setSynthesisSummary] = useState("");
  const [synthesisCitation, setSynthesisCitation] = useState("");

  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [showSynthesis, setShowSynthesis] = useState(false);
  const [isMouseInside, setIsMouseInside] = useState(false);

  // View Mode State
  const [viewMode, setViewMode] = useState<'morph' | 'nfl' | 'tech'>('morph');
  const [mode, setMode] = useState<'opacity' | 'size' | 'heatmap'>('opacity');
  const [threshold, setThreshold] = useState(0.3);
  const [isIsomorphicMode, setIsIsomorphicMode] = useState(true);
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

    const result = await checkAmbiguity(topic, 'topic');
    if (result.isAmbiguous || (result.options && result.options.length > 0)) {
      setDisambiguation({ type: 'topic', options: result.options || [], original: topic });
      return;
    }
    if (!result.isValid) {
      setDomainError("Invalid topic or typo.");
      return;
    }

    const confirmedTopic = result.corrected || topic;

    // Check if topic is too close to the domain
    const proximityResult = await checkDomainProximity(confirmedTopic, analogyDomain);
    if (proximityResult.isTooClose) {
      setProximityWarning({ topic: confirmedTopic, result: proximityResult });
      return;
    }

    await fetchAnalogy(confirmedTopic);
  };

  const fetchAnalogy = async (confirmedTopic: string, complexity: number = 50) => {
    setIsLoading(true);
    setShowContext(false); // Keep collapsed until user clicks to expand
    setShowFollowUp(false);
    setTutorResponse(null);
    setContextData(null);

    try {
      const parsed = await generateAnalogy(confirmedTopic, analogyDomain, complexity, cachedDomainEnrichment || undefined);
      if (parsed) {
        loadContent(parsed, confirmedTopic);
        saveToHistory(parsed, confirmedTopic, analogyDomain);
      }
    } catch (e) {
      console.error("API call failed", e);
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
  }, [hasStarted, showQuizModal, showSynthesis, miniDefPosition, defPosition, showControls, showFollowUp, disambiguation, isNarrativeMode, isDarkMode, isImmersive, showHistory, isQuizLoading, isLoading, showShortcutsLegend, isConstellationMode, isDualPaneMode, isMasteryMode, ambianceMode, textScale]);

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
    setShowContext(false); // Keep collapsed - user clicks to expand
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
    if (isNarrativeMode) return { text: "Story Mode", icon: <BookOpenText size={14} /> };
    if (viewMode === 'morph') return { text: "Morph On", icon: <Unlock size={14} /> };
    if (viewMode === 'nfl') return { text: "Expt Locked", icon: <span className="text-xs">{domainEmoji}</span> };
    return { text: "Tech Locked", icon: <Lock size={14} /> };
  };

  // Comprehensive state reset - clears everything except history and domain selection
  const resetAllState = (options: { keepDomain?: boolean; keepTopic?: boolean } = {}) => {
    // Content State
    setSegments([]);
    setConceptMap([]);
    setImportanceMap([]);
    setProcessedWords([]);
    setContextData(null);
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

    if (item.isLatex || forceRender) {
      let latexContent = contentToRender.replace(/\\\\/g, "\\");
      let rawContent = latexContent.startsWith('$$')
        ? latexContent.slice(2, -2)
        : latexContent.startsWith('$')
          ? latexContent.slice(1, -1)
          : latexContent;

      // Add hover class for important clickable words (only in locked modes)
      const hoverClass = isImportant && isClickableMode ? 'hover:underline hover:decoration-dotted hover:decoration-current' : '';

      if (!isKatexLoaded || !window.katex) {
        return <span id={wordId} key={index} className={`${classes} ${hoverClass}`} title="Math loading...">{rawContent}</span>;
      }

      try {
        const html = window.katex.renderToString(rawContent, { throwOnError: false, displayMode: false });
        const mathStyle = { ...style, display: 'inline-block', margin: '0 4px' };
        return <span id={wordId} key={index} style={mathStyle} className={`${classes} ${hoverClass} not-italic normal-case`} dangerouslySetInnerHTML={{ __html: html }} />;
      } catch (e) {
        return <span id={wordId} key={index} style={style} className={`${classes} ${hoverClass}`}>{item.text}</span>;
      }
    }

    // Add hover class for important clickable words (only in locked modes)
    const hoverClass = isImportant && isClickableMode ? 'hover:underline hover:decoration-dotted hover:decoration-current' : '';

    return <span id={wordId} key={index} style={style} className={`${classes} ${hoverClass}`}>{item.text}</span>;
  };

  // Process words effect
  useEffect(() => {
    if (!segments.length || isLoading) return;

    const allTokens: ProcessedWord[] = [];
    let fallbackCounter = -1;

    segments.forEach((segment, segmentIndex) => {
      const textToParse = isNarrativeMode ? segment.narrative : (isAnalogyVisualMode ? segment.analogy : segment.tech);
      if (!textToParse) return;

      // Note: Math symbols are already stripped from analogy/narrative at data load time (loadContent)
      // Sanitize first to fix malformed LaTeX, then wrap bare commands
      const sanitizedText = sanitizeLatex(textToParse);
      const processedText = wrapBareLatex(sanitizedText);
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={cycleViewMode}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        viewMode === 'morph' && !isNarrativeMode
                          ? (isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700')
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
                  <p
                    className={`leading-relaxed transition-all duration-500 ease-in-out ${
                      isTransitioning
                        ? 'opacity-0 blur-sm scale-[0.98] translate-y-1'
                        : 'opacity-100 blur-0 scale-100 translate-y-0'
                    } ${isDarkMode ? 'text-neutral-100' : 'text-neutral-800'}`}
                    style={{
                      fontSize: `${1.125 * textScale}rem`,
                      lineHeight: textScale >= 1.5 ? '1.8' : '1.75',
                    }}
                  >
                    {processedWords.map((word, i) => renderWord(word, i))}
                  </p>

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
          {!isLoading && !hasStarted && (
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
            <button
              onClick={() => setSelectedMasteryEntry(null)}
              className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-neutral-800 hover:bg-red-500 text-neutral-300 hover:text-white' : 'bg-neutral-100 hover:bg-red-500 text-neutral-600 hover:text-white'}`}
            >
              <X size={20} />
            </button>
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
