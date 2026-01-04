import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  GraduationCap,
  ChevronRight,
  ChevronDown,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Lightbulb,
  RotateCcw,
  Trophy,
  BookOpen,
  MessageCircle,
  Dices,
  Share2,
  Medal,
  Eye,
  Check,
  AlignLeft,
  Zap,
  Maximize2,
  Minimize2,
  ClipboardCopy,
  FileCode,
  Type,
  Palette
} from 'lucide-react';
import {
  MasterySession,
  MasteryKeyword,
  MasteryStage,
  StageAttempt,
  EvaluationResult,
  ConceptMapItem,
  ImportanceMapItem,
  MasteryStory,
  MasteryChatMessage,
  CompleteMasteryHistory
} from '../types';
import {
  generateMasteryKeywords,
  evaluateMasteryResponse,
  detectKeywordsInText,
  generateMasteryStory,
  generateMasteryChatResponse,
  generateMasterySummary,
  regenerateContextualDefinitions
} from '../services';

// ============================================
// LOGIC VALIDATOR TYPES & SERVICE STUB
// ============================================
type GenerationPhase = 'idle' | 'generating' | 'validating' | 'retrying';

interface ValidationResult {
  isValid: boolean;
  issues: string[];
  severity: 'none' | 'minor' | 'major';
  suggestedFixes?: string;
}

/**
 * Validates the domain logic of a generated story.
 * Checks for logical fallacies and domain-specific inaccuracies.
 *
 * @param story - The generated story content
 * @param domain - The analogy domain (e.g., "NFL", "Cooking")
 * @param topic - The technical topic being taught
 * @param keywords - The mastery keywords to check for proper usage
 * @returns ValidationResult with issues found
 */
const validateDomainLogic = async (
  story: string,
  domain: string,
  topic: string,
  keywords: MasteryKeyword[]
): Promise<ValidationResult> => {
  // Stub implementation - will be enhanced to call LLM for validation
  // For now, performs basic heuristic checks

  const issues: string[] = [];

  // Check 1: Story is too short (likely incomplete)
  if (story.length < 100) {
    issues.push('Story appears too short to adequately cover the concept');
  }

  // Check 2: Story mentions keywords in wrong context
  const storyLower = story.toLowerCase();
  const domainLower = domain.toLowerCase();

  // Check 3: Domain coherence - story should reference the domain
  if (!storyLower.includes(domainLower) &&
      !storyLower.includes(domainLower.replace(/\s+/g, '')) &&
      story.length > 200) {
    // Give some leeway for short stories or embedded domain references
    const domainIndicators = getDomainIndicators(domain);
    const hasDomainIndicator = domainIndicators.some(indicator =>
      storyLower.includes(indicator.toLowerCase())
    );
    if (!hasDomainIndicator) {
      issues.push(`Story lacks clear connection to ${domain} domain`);
    }
  }

  // Check 4: Technical accuracy heuristics
  // Look for common logical fallacy patterns in analogies
  const fallacyPatterns = [
    { pattern: /exactly like|identical to|the same as/gi, issue: 'Overstatement: analogies should highlight similarities, not claim identity' },
    { pattern: /always|never|every single|100%/gi, issue: 'Absolute language may create false expectations' },
  ];

  for (const { pattern, issue } of fallacyPatterns) {
    if (pattern.test(story)) {
      issues.push(issue);
    }
  }

  // Determine severity
  let severity: 'none' | 'minor' | 'major' = 'none';
  if (issues.length > 0) {
    severity = issues.length >= 2 || issues.some(i => i.includes('lacks clear connection')) ? 'major' : 'minor';
  }

  return {
    isValid: severity !== 'major',
    issues,
    severity,
    suggestedFixes: issues.length > 0 ? `Consider: ${issues.join('; ')}` : undefined
  };
};

/**
 * Returns domain-specific indicator words/phrases for coherence checking
 */
const getDomainIndicators = (domain: string): string[] => {
  const indicators: { [key: string]: string[] } = {
    'nfl': ['football', 'quarterback', 'touchdown', 'field', 'team', 'play', 'game', 'coach', 'player', 'yard'],
    'cooking': ['recipe', 'ingredient', 'kitchen', 'chef', 'cook', 'bake', 'dish', 'flavor', 'taste', 'meal'],
    'music': ['melody', 'rhythm', 'song', 'instrument', 'note', 'chord', 'beat', 'compose', 'tune', 'harmony'],
    'basketball': ['court', 'basket', 'dribble', 'shot', 'player', 'team', 'score', 'game', 'pass', 'rebound'],
    'gardening': ['plant', 'seed', 'grow', 'garden', 'soil', 'flower', 'root', 'harvest', 'water', 'bloom'],
    'chess': ['board', 'piece', 'move', 'strategy', 'king', 'queen', 'checkmate', 'pawn', 'game', 'opponent'],
  };

  const domainKey = domain.toLowerCase().replace(/[^a-z]/g, '');
  return indicators[domainKey] || [domain.toLowerCase()];
};

// Cached state for persistence across modal open/close
export interface MasterySessionCache {
  session: MasterySession | null;
  storyHistory: { [key: number]: MasteryStory };
  userResponses: string[];
  currentStory: MasteryStory | null;
  userInput: string;
  currentEvaluation: EvaluationResult | null;
  detectedKeywords: string[];
}

interface MasteryModeProps {
  topic: string;
  domain: string;
  domainEmoji: string;
  conceptMap: ConceptMapItem[];
  importanceMap: ImportanceMapItem[];
  analogyText: string;
  isDarkMode: boolean;
  onClose: () => void;
  // State persistence props
  cachedState?: MasterySessionCache | null;
  onStateChange?: (state: MasterySessionCache) => void;
}

const STORAGE_KEY = 'signal_mastery_history';

// ============================================
// KEYWORD HOVER MODAL COMPONENT
// ============================================
const KeywordHoverModal: React.FC<{
  keyword: MasteryKeyword;
  stage: MasteryStage;
  isDarkMode: boolean;
  position: { x: number; y: number };
  domainEmoji?: string;
}> = ({ keyword, stage, isDarkMode, position, domainEmoji = '🏈' }) => {
  const techDef = stage === 3 ? keyword.techDefinition6 : keyword.techDefinition3;
  const analogyDef = stage === 3 ? keyword.analogyDefinition6 : keyword.analogyDefinition3;

  return (
    <div
      className={`
        fixed z-[200] px-4 py-3 rounded-xl shadow-2xl border max-w-[280px]
        animate-in fade-in zoom-in-95 duration-150
        ${isDarkMode
          ? 'bg-neutral-900 border-neutral-700/50 text-white'
          : 'bg-white border-neutral-200 text-neutral-800 shadow-lg'}
      `}
      style={{
        left: Math.min(position.x, window.innerWidth - 300),
        top: position.y + 12,
      }}
    >
      {/* Term name */}
      <div className={`font-bold text-sm mb-3 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
        {keyword.term}
      </div>

      {/* Definitions */}
      <div className="space-y-2">
        {/* Tech definition */}
        <div className="flex items-start gap-2">
          <span className="text-sm">🔬</span>
          <span className={`text-xs leading-relaxed ${isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}`}>
            {techDef}
          </span>
        </div>

        {/* Analogy definition */}
        <div className="flex items-start gap-2">
          <span className="text-sm">{domainEmoji}</span>
          <span className={`text-xs leading-relaxed ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
            {analogyDef}
          </span>
        </div>
      </div>
    </div>
  );
};

// ============================================
// ATTENTION MODE TYPE
// ============================================
type AttentionMode = 'opacity' | 'size' | 'heatmap';

// Heatmap color palette for visual hierarchy (Stages 2 & 3 - includes RED for keywords)
const HEATMAP_COLORS = [
  'bg-red-500/30 text-red-300',
  'bg-orange-500/30 text-orange-300',
  'bg-amber-500/30 text-amber-300',
  'bg-yellow-500/30 text-yellow-300',
  'bg-lime-500/30 text-lime-300',
  'bg-green-500/30 text-green-300',
  'bg-emerald-500/30 text-emerald-300',
  'bg-teal-500/30 text-teal-300',
  'bg-cyan-500/30 text-cyan-300',
  'bg-blue-500/30 text-blue-300'
];

const HEATMAP_COLORS_LIGHT = [
  'bg-red-100 text-red-700',
  'bg-orange-100 text-orange-700',
  'bg-amber-100 text-amber-700',
  'bg-yellow-100 text-yellow-700',
  'bg-lime-100 text-lime-700',
  'bg-green-100 text-green-700',
  'bg-emerald-100 text-emerald-700',
  'bg-teal-100 text-teal-700',
  'bg-cyan-100 text-cyan-700',
  'bg-blue-100 text-blue-700'
];

// Stage 1 heatmap colors - NO RED (red reserved for keyword highlighting in Stage 2/3)
const HEATMAP_COLORS_STAGE1 = [
  'bg-purple-500/30 text-purple-300',
  'bg-violet-500/30 text-violet-300',
  'bg-indigo-500/30 text-indigo-300',
  'bg-blue-500/30 text-blue-300',
  'bg-cyan-500/30 text-cyan-300',
  'bg-teal-500/30 text-teal-300',
  'bg-emerald-500/30 text-emerald-300',
  'bg-green-500/30 text-green-300',
  'bg-lime-500/30 text-lime-300',
  'bg-yellow-500/30 text-yellow-300'
];

const HEATMAP_COLORS_STAGE1_LIGHT = [
  'bg-purple-100 text-purple-700',
  'bg-violet-100 text-violet-700',
  'bg-indigo-100 text-indigo-700',
  'bg-blue-100 text-blue-700',
  'bg-cyan-100 text-cyan-700',
  'bg-teal-100 text-teal-700',
  'bg-emerald-100 text-emerald-700',
  'bg-green-100 text-green-700',
  'bg-lime-100 text-lime-700',
  'bg-yellow-100 text-yellow-700'
];

// Color mode text colors (for colorful word highlighting)
const COLOR_MODE_COLORS_DARK = [
  'text-red-400', 'text-blue-400', 'text-emerald-400', 'text-purple-400',
  'text-orange-400', 'text-cyan-400', 'text-pink-400', 'text-lime-400',
  'text-indigo-400', 'text-rose-400', 'text-teal-400', 'text-amber-400'
];

const COLOR_MODE_COLORS_LIGHT = [
  'text-red-600', 'text-blue-600', 'text-emerald-600', 'text-purple-600',
  'text-orange-600', 'text-cyan-600', 'text-pink-600', 'text-lime-600',
  'text-indigo-600', 'text-rose-600', 'text-teal-600', 'text-amber-600'
];

// ============================================
// STORY CARD COMPONENT
// ============================================
const StoryCard: React.FC<{
  story: MasteryStory | null;
  keywords: MasteryKeyword[];
  stage: MasteryStage;
  isDarkMode: boolean;
  domain: string;
  isLoading: boolean;
  generationPhase?: GenerationPhase;
  validationAttempts?: number;
  onRegenerate: () => void;
}> = ({ story, keywords, stage, isDarkMode, domain, isLoading, generationPhase = 'idle', validationAttempts = 0, onRegenerate }) => {
  const [hoveredKeyword, setHoveredKeyword] = useState<MasteryKeyword | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [attentionMode, setAttentionMode] = useState<AttentionMode>('opacity');
  const [threshold, setThreshold] = useState(0.3);
  const [showAttentionControls, setShowAttentionControls] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [textScale, setTextScale] = useState<1 | 1.25 | 1.5 | 2>(1);
  const [isColorMode, setIsColorMode] = useState(false);

  // Calculate word importance based on keywords and position
  const calculateWordImportance = (word: string, wordIndex: number, totalWords: number): number => {
    const cleanWord = word.toLowerCase().replace(/[.,!?;:'"()[\]{}]/g, '').trim();
    if (!cleanWord || cleanWord.length < 2) return 0;

    const relevantKeywords = stage === 1 ? keywords : stage === 2 ? keywords.slice(0, 6) : keywords;

    // Check if word matches any keyword (tech or analogy term)
    for (const keyword of relevantKeywords) {
      const techLower = keyword.term.toLowerCase();
      const analogyLower = keyword.analogyTerm.toLowerCase();

      if (cleanWord === techLower || cleanWord === analogyLower) {
        return keyword.importance;
      }

      // Partial match for longer keywords
      if (techLower.includes(cleanWord) || cleanWord.includes(techLower)) {
        return keyword.importance * 0.8;
      }
      if (analogyLower.includes(cleanWord) || cleanWord.includes(analogyLower)) {
        return keyword.importance * 0.8;
      }
    }

    // Position-based importance (words at beginning/end are often more important)
    const positionRatio = wordIndex / totalWords;
    const positionBonus = positionRatio < 0.15 || positionRatio > 0.85 ? 0.1 : 0;

    // Longer words tend to be more significant
    const lengthBonus = cleanWord.length > 6 ? 0.15 : cleanWord.length > 4 ? 0.05 : 0;

    // Base importance for regular words
    return 0.2 + positionBonus + lengthBonus;
  };

  // Get styles for a word based on attention mode and importance
  const getWordStyles = (importance: number, isKeyword: boolean): React.CSSProperties => {
    // At 100% threshold (>= 0.99), ALL words should be fully visible
    const isImportant = threshold >= 0.99 || importance >= threshold;

    const baseStyles: React.CSSProperties = {
      transition: 'all 0.2s ease',
      display: 'inline',
    };

    if (attentionMode === 'opacity') {
      return {
        ...baseStyles,
        opacity: isImportant ? 1 : 0.25,
        filter: isImportant ? 'none' : 'blur(0.3px)',
        fontWeight: isImportant ? (isKeyword ? 700 : 600) : 400,
      };
    }

    if (attentionMode === 'size') {
      const scale = isImportant ? (isKeyword ? 1.15 : 1.05) : 0.9;
      return {
        ...baseStyles,
        fontSize: `${scale}em`,
        opacity: isImportant ? 1 : 0.6,
        fontWeight: isImportant ? (isKeyword ? 700 : 600) : 400,
        lineHeight: '1.4',
      };
    }

    // Heatmap mode - return base styles, color applied via className
    return {
      ...baseStyles,
      fontWeight: isImportant ? (isKeyword ? 700 : 600) : 400,
      borderRadius: '3px',
      padding: isKeyword ? '1px 4px' : '0 2px',
    };
  };

  // Get heatmap color class based on importance
  // Stage 1 uses purple/blue palette (no red), Stage 2/3 uses full spectrum (red = keywords)
  const getHeatmapClass = (importance: number): string => {
    if (attentionMode !== 'heatmap') return '';
    if (importance < threshold) return '';

    // Choose color palette based on stage
    const darkColors = stage === 1 ? HEATMAP_COLORS_STAGE1 : HEATMAP_COLORS;
    const lightColors = stage === 1 ? HEATMAP_COLORS_STAGE1_LIGHT : HEATMAP_COLORS_LIGHT;

    const colorIndex = Math.min(
      Math.floor((1 - importance) * darkColors.length),
      darkColors.length - 1
    );

    return isDarkMode ? darkColors[colorIndex] : lightColors[colorIndex];
  };

  // Get color mode text class based on importance (colorful text highlighting)
  const getColorModeClass = (importance: number, wordIndex: number): string => {
    if (!isColorMode) return '';
    // At 100% threshold, show all words; otherwise only show words above threshold
    const isImportant = threshold >= 0.99 || importance >= threshold;
    if (!isImportant) return '';

    const colors = isDarkMode ? COLOR_MODE_COLORS_DARK : COLOR_MODE_COLORS_LIGHT;
    // Use word index to assign consistent colors across similar importance levels
    const colorIndex = Math.floor(importance * 10) % colors.length;
    return colors[colorIndex];
  };

  // Render story with importance-based styling
  const renderStoryWithImportance = () => {
    if (!story || !story.content || story.content.trim().length === 0) {
      // Show empty state with generate button
      return (
        <div className="flex flex-col items-center justify-center py-8 gap-4">
          <p className={`text-center ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Story not available. Click below to generate.
          </p>
          <button
            onClick={onRegenerate}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-medium"
          >
            <RotateCcw size={16} />
            Generate Story
          </button>
        </div>
      );
    }

    const content = story.content;
    const relevantKeywords = stage === 1 ? [] : stage === 2 ? keywords.slice(0, 6) : keywords;

    // Build keyword lookup for efficient matching
    const keywordLookup = new Map<string, MasteryKeyword>();
    relevantKeywords.forEach(k => {
      keywordLookup.set(k.term.toLowerCase(), k);
      keywordLookup.set(k.analogyTerm.toLowerCase(), k);
    });

    // Build technical term lookup (for parenthetical tech terms like "(vector)")
    const techTermSet = new Set<string>();
    keywords.forEach(k => {
      techTermSet.add(k.term.toLowerCase());
    });

    // Split content to handle parenthetical technical terms
    // Match patterns like "(technical term)" or "(linear transformation)"
    const parts = content.split(/(\([^)]+\))/g);
    let overallWordIndex = 0;
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    return parts.map((part, partIndex) => {
      // Check if this is a parenthetical expression with a technical term
      const parentheticalMatch = part.match(/^\(([^)]+)\)$/);
      if (parentheticalMatch && stage > 1) {
        const innerContent = parentheticalMatch[1].toLowerCase();
        // Check if any tech term is in this parenthetical and find the matching keyword
        let matchingKeyword: MasteryKeyword | undefined;
        keywordLookup.forEach((kw, termKey) => {
          if (!matchingKeyword && (innerContent.includes(termKey) || termKey.includes(innerContent))) {
            matchingKeyword = kw;
          }
        });
        // Also check tech term set if no keyword match found
        const isTechTerm = matchingKeyword || Array.from(techTermSet).some(term =>
          innerContent.includes(term) || term.includes(innerContent)
        );

        if (isTechTerm) {
          // Style as red technical term indicator with hover for definitions
          overallWordIndex++;
          return (
            <span
              key={`part-${partIndex}`}
              className={`font-semibold cursor-help transition-colors ${isDarkMode ? 'text-red-400 hover:text-red-300 hover:bg-red-500/20' : 'text-red-600 hover:text-red-700 hover:bg-red-100'} rounded px-0.5`}
              onMouseEnter={(e) => {
                if (matchingKeyword) {
                  setHoveredKeyword(matchingKeyword);
                  setHoverPosition({ x: e.clientX, y: e.clientY });
                }
              }}
              onMouseLeave={() => setHoveredKeyword(null)}
            >
              {part}
            </span>
          );
        }
      }

      // Split into words while preserving whitespace
      const tokens = part.split(/(\s+)/);

      return tokens.map((token, tokenIndex) => {
        const key = `part-${partIndex}-token-${tokenIndex}`;

        // Preserve whitespace
        if (/^\s+$/.test(token)) {
          return <span key={key}>{token}</span>;
        }

        const cleanToken = token.toLowerCase().replace(/[.,!?;:'"()[\]{}]/g, '').trim();
        const matchedKeyword = keywordLookup.get(cleanToken);
        const importance = calculateWordImportance(token, overallWordIndex, wordCount);
        const styles = getWordStyles(importance, !!matchedKeyword);
        const heatmapClass = getHeatmapClass(importance);
        const colorModeClass = getColorModeClass(importance, overallWordIndex);

        overallWordIndex++;

        if (matchedKeyword) {
          // Keyword with hover functionality - cursor-help indicates definition available
          return (
            <span
              key={key}
              className={`
                cursor-help rounded transition-all duration-200
                ${heatmapClass || (isDarkMode
                  ? 'bg-purple-500/30 text-purple-300 hover:bg-purple-500/50'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200')}
                ${colorModeClass}
              `}
              style={styles}
              onMouseEnter={(e) => {
                setHoveredKeyword(matchedKeyword);
                setHoverPosition({ x: e.clientX, y: e.clientY });
              }}
              onMouseLeave={() => setHoveredKeyword(null)}
            >
              {token}
            </span>
          );
        }

        // Regular word with importance-based styling
        return (
          <span
            key={key}
            className={`${heatmapClass} ${colorModeClass}`}
            style={styles}
          >
            {token}
          </span>
        );
      });
    });
  };

  if (isLoading) {
    // Phase-specific loading messages
    const getLoadingMessage = () => {
      switch (generationPhase) {
        case 'generating':
          return `Crafting your ${domain} story...`;
        case 'validating':
          return 'Checking for domain accuracy...';
        case 'retrying':
          return `Refining story (attempt ${validationAttempts}/3)...`;
        default:
          return `Generating your ${domain} story...`;
      }
    };

    const getLoadingSubtext = () => {
      switch (generationPhase) {
        case 'validating':
          return 'Ensuring logical consistency';
        case 'retrying':
          return 'Previous version had issues, generating fresh content';
        default:
          return null;
      }
    };

    const subtext = getLoadingSubtext();

    return (
      <div className={`rounded-xl p-6 mb-4 ${isDarkMode ? 'bg-neutral-800/50' : 'bg-white shadow-sm'}`}>
        <div className="flex flex-col items-center justify-center gap-2 py-8">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            <span className={isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}>
              {getLoadingMessage()}
            </span>
          </div>
          {subtext && (
            <span className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
              {subtext}
            </span>
          )}
          {/* Phase indicator dots */}
          <div className="flex items-center gap-2 mt-2">
            <div className={`w-2 h-2 rounded-full transition-colors ${
              generationPhase === 'generating' || generationPhase === 'retrying'
                ? 'bg-purple-500'
                : isDarkMode ? 'bg-neutral-600' : 'bg-neutral-300'
            }`} />
            <div className={`w-2 h-2 rounded-full transition-colors ${
              generationPhase === 'validating'
                ? 'bg-green-500'
                : isDarkMode ? 'bg-neutral-600' : 'bg-neutral-300'
            }`} />
          </div>
        </div>
      </div>
    );
  }

  // Fullscreen overlay when maximized
  if (isMaximized) {
    return (
      <div className={`fixed inset-0 z-[100] overflow-auto ${isDarkMode ? 'bg-neutral-900' : 'bg-white'}`}>
        {/* Fullscreen Header */}
        <div className={`fixed top-0 left-0 right-0 z-[101] px-8 py-4 border-b ${isDarkMode ? 'bg-neutral-900/95 border-neutral-800 backdrop-blur-sm' : 'bg-white/95 border-neutral-200 backdrop-blur-sm'}`}>
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen size={22} className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} />
              <span className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
                {stage === 1 ? 'Your Story' : `Stage ${stage} Story`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* Attention Mode Controls in Fullscreen */}
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>Mode:</span>
                {(['opacity', 'size', 'heatmap'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setAttentionMode(m)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                      attentionMode === m
                        ? 'bg-purple-500 text-white'
                        : isDarkMode
                          ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {m === 'opacity' && <Eye size={12} />}
                    {m === 'size' && <AlignLeft size={12} />}
                    {m === 'heatmap' && <Zap size={12} />}
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
              <span className={`text-xs ${isDarkMode ? 'text-neutral-600' : 'text-neutral-300'}`}>|</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>Focus:</span>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-20 h-1.5 rounded-full appearance-none cursor-pointer accent-purple-500"
                  style={{
                    background: isDarkMode
                      ? `linear-gradient(to right, rgb(168, 85, 247) 0%, rgb(168, 85, 247) ${(threshold - 0.1) / 0.8 * 100}%, rgb(64, 64, 64) ${(threshold - 0.1) / 0.8 * 100}%, rgb(64, 64, 64) 100%)`
                      : `linear-gradient(to right, rgb(168, 85, 247) 0%, rgb(168, 85, 247) ${(threshold - 0.1) / 0.8 * 100}%, rgb(229, 231, 235) ${(threshold - 0.1) / 0.8 * 100}%, rgb(229, 231, 235) 100%)`
                  }}
                />
                <span className={`text-xs w-8 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>{Math.round(threshold * 100)}%</span>
              </div>
              <span className={`text-xs ${isDarkMode ? 'text-neutral-600' : 'text-neutral-300'}`}>|</span>
              {/* Text Scale Button */}
              <button
                onClick={() => {
                  const scales: (1 | 1.25 | 1.5 | 2)[] = [1, 1.25, 1.5, 2];
                  const currentIndex = scales.indexOf(textScale);
                  setTextScale(scales[(currentIndex + 1) % scales.length]);
                }}
                className={`p-2 rounded-lg transition-all flex items-center gap-1 ${
                  textScale > 1
                    ? 'bg-purple-500 text-white'
                    : isDarkMode ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'
                }`}
                title={`Text Size: ${textScale === 1 ? 'Normal' : textScale === 1.25 ? 'Large' : textScale === 1.5 ? 'X-Large' : 'Fill'}`}
              >
                <Type size={18} className={textScale > 1 ? 'animate-pulse' : ''} />
                <span className="text-xs font-medium">{textScale === 1 ? '1x' : textScale === 1.25 ? '1.25x' : textScale === 1.5 ? '1.5x' : '2x'}</span>
              </button>
              {/* Color Palette Button */}
              <button
                onClick={() => setIsColorMode(!isColorMode)}
                className={`p-2 rounded-lg transition-all ${
                  isColorMode
                    ? 'bg-purple-500 text-white'
                    : isDarkMode ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'
                }`}
                title={isColorMode ? 'Disable color mode' : 'Enable color mode'}
              >
                <Palette size={18} />
              </button>
              <span className={`text-xs ${isDarkMode ? 'text-neutral-600' : 'text-neutral-300'}`}>|</span>
              <button
                onClick={onRegenerate}
                className={`p-2 rounded-lg transition-all ${isDarkMode ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'}`}
                title="Regenerate story"
              >
                <Dices size={20} />
              </button>
              <button
                onClick={() => setIsMaximized(false)}
                className={`p-2 rounded-lg transition-all ${isDarkMode ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'}`}
                title="Exit fullscreen"
              >
                <Minimize2 size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Fullscreen Content */}
        <div className="max-w-4xl mx-auto px-8 pt-24 pb-12">
          {story?.content ? (
            <div
              className={`leading-relaxed ${isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}`}
              style={{
                fontSize: `${1.125 * textScale}rem`,
                lineHeight: textScale >= 1.5 ? '1.8' : '1.75'
              }}
            >
              {renderStoryWithImportance()}
            </div>
          ) : (
            <div className={`text-center py-16 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
              <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
              <p>Story is loading or unavailable...</p>
              <button
                onClick={onRegenerate}
                className={`mt-4 px-4 py-2 rounded-lg font-medium ${isDarkMode ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-purple-500 text-white hover:bg-purple-600'}`}
              >
                Generate Story
              </button>
            </div>
          )}
        </div>

        {/* Keyword Hover Modal */}
        {hoveredKeyword && (
          <KeywordHoverModal
            keyword={hoveredKeyword}
            stage={stage}
            isDarkMode={isDarkMode}
            position={hoverPosition}
          />
        )}
      </div>
    );
  }

  // Regular (non-maximized) view
  return (
    <div className={`rounded-xl p-6 mb-4 relative ${isDarkMode ? 'bg-neutral-800/50' : 'bg-white shadow-sm'}`}>
      {/* Story Header with Inline Attention Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} />
          <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
            Your Story
          </span>
        </div>

        {/* Inline Attention Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Mode Buttons */}
          <div className="flex items-center gap-1">
            <span className={`text-xs font-medium mr-1 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
              Mode:
            </span>
            {(['opacity', 'size', 'heatmap'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setAttentionMode(mode)}
                className={`
                  flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all
                  ${attentionMode === mode
                    ? 'bg-purple-500 text-white'
                    : isDarkMode
                      ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}
                `}
              >
                {mode === 'opacity' && <Eye size={12} />}
                {mode === 'size' && <AlignLeft size={12} />}
                {mode === 'heatmap' && <Zap size={12} />}
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          <span className={`text-xs ${isDarkMode ? 'text-neutral-700' : 'text-neutral-300'}`}>|</span>

          {/* Focus Slider */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
              Focus:
            </span>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-20 h-1.5 rounded-full appearance-none cursor-pointer accent-purple-500"
              style={{
                background: isDarkMode
                  ? `linear-gradient(to right, rgb(168, 85, 247) 0%, rgb(168, 85, 247) ${(threshold - 0.1) / 0.8 * 100}%, rgb(64, 64, 64) ${(threshold - 0.1) / 0.8 * 100}%, rgb(64, 64, 64) 100%)`
                  : `linear-gradient(to right, rgb(168, 85, 247) 0%, rgb(168, 85, 247) ${(threshold - 0.1) / 0.8 * 100}%, rgb(229, 231, 235) ${(threshold - 0.1) / 0.8 * 100}%, rgb(229, 231, 235) 100%)`
              }}
            />
            <span className={`text-xs w-8 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
              {Math.round(threshold * 100)}%
            </span>
          </div>

          <span className={`text-xs ${isDarkMode ? 'text-neutral-700' : 'text-neutral-300'}`}>|</span>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {/* Text Scale Button */}
            <button
              onClick={() => {
                const scales: (1 | 1.25 | 1.5 | 2)[] = [1, 1.25, 1.5, 2];
                const currentIndex = scales.indexOf(textScale);
                setTextScale(scales[(currentIndex + 1) % scales.length]);
              }}
              className={`
                p-1.5 rounded-lg transition-all duration-200 flex items-center gap-1
                ${textScale > 1
                  ? 'bg-purple-500 text-white'
                  : isDarkMode
                    ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'}
              `}
              title={`Text Size: ${textScale === 1 ? 'Normal' : textScale === 1.25 ? 'Large' : textScale === 1.5 ? 'X-Large' : 'Fill'}`}
            >
              <Type size={14} className={textScale > 1 ? 'animate-pulse' : ''} />
              <span className="text-xs font-medium">{textScale === 1 ? '1x' : textScale === 1.25 ? '1.25x' : textScale === 1.5 ? '1.5x' : '2x'}</span>
            </button>

            {/* Color Palette Button */}
            <button
              onClick={() => setIsColorMode(!isColorMode)}
              className={`
                p-1.5 rounded-lg transition-all duration-200
                ${isColorMode
                  ? 'bg-purple-500 text-white'
                  : isDarkMode
                    ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'}
              `}
              title={isColorMode ? 'Disable color mode' : 'Enable color mode'}
            >
              <Palette size={14} />
            </button>

            {/* Regenerate Button */}
            <button
              onClick={onRegenerate}
              className={`
                p-1.5 rounded-lg transition-all duration-200 group
                ${isDarkMode
                  ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'}
              `}
              title="Regenerate story"
            >
              <Dices size={16} className="group-hover:rotate-180 transition-transform duration-500" />
            </button>

            {/* Maximize Button */}
            <button
              onClick={() => setIsMaximized(true)}
              className={`
                p-1.5 rounded-lg transition-all duration-200
                ${isDarkMode
                  ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'}
              `}
              title="Expand story"
            >
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Story Content */}
      <div
        className={`leading-relaxed ${isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}`}
        style={{
          fontSize: `${1 * textScale}rem`,
          lineHeight: textScale >= 1.5 ? '1.8' : '1.75'
        }}
      >
        {renderStoryWithImportance()}
      </div>

      {/* Keyword Hover Modal */}
      {hoveredKeyword && (
        <KeywordHoverModal
          keyword={hoveredKeyword}
          stage={stage}
          isDarkMode={isDarkMode}
          position={hoverPosition}
        />
      )}
    </div>
  );
};

// ============================================
// CHAT WINDOW COMPONENT
// ============================================
const ChatWindow: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
  topic: string;
  domain: string;
  currentStage: MasteryStage;
  currentStory: string;
  userResponses: string[];
  keywords: MasteryKeyword[];
  isDarkMode: boolean;
}> = ({ isOpen, onToggle, topic, domain, currentStage, currentStory, userResponses, keywords, isDarkMode }) => {
  const [messages, setMessages] = useState<MasteryChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: MasteryChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await generateMasteryChatResponse(
        topic,
        domain,
        currentStage,
        currentStory,
        userResponses,
        keywords,
        messages,
        input.trim()
      );

      const assistantMessage: MasteryChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className={`
          fixed bottom-24 right-6 z-[150] p-4 rounded-full shadow-lg
          transition-all duration-300 hover:scale-110
          bg-gradient-to-br from-purple-500 to-blue-500 text-white
        `}
        title="Chat with tutor"
      >
        <MessageCircle size={24} />
      </button>
    );
  }

  return (
    <div className={`
      fixed bottom-24 right-6 z-[150] w-96 h-[500px] rounded-xl shadow-2xl
      flex flex-col overflow-hidden border
      ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-200'}
    `}>
      {/* Header */}
      <div className={`
        flex items-center justify-between p-4 border-b
        ${isDarkMode ? 'border-neutral-700 bg-neutral-800' : 'border-neutral-200 bg-neutral-50'}
      `}>
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className="text-purple-500" />
          <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
            Chat with Story
          </span>
        </div>
        <button
          onClick={onToggle}
          className={`p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700`}
        >
          <X size={18} className={isDarkMode ? 'text-neutral-400' : 'text-neutral-600'} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className={`text-center py-8 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
            <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Ask me anything about the story or concept!</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`
              p-3 rounded-lg max-w-[85%]
              ${msg.role === 'user'
                ? `ml-auto ${isDarkMode ? 'bg-purple-600 text-white' : 'bg-purple-500 text-white'}`
                : `${isDarkMode ? 'bg-neutral-800 text-neutral-200' : 'bg-neutral-100 text-neutral-800'}`
              }
            `}
          >
            <p className="text-sm">{msg.content}</p>
          </div>
        ))}

        {isLoading && (
          <div className={`p-3 rounded-lg max-w-[85%] ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
            <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`p-4 border-t ${isDarkMode ? 'border-neutral-700' : 'border-neutral-200'}`}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask me anything..."
            className={`
              flex-1 px-3 py-2 rounded-lg outline-none text-sm
              ${isDarkMode
                ? 'bg-neutral-800 text-white placeholder:text-neutral-500 border border-neutral-700 focus:border-purple-500'
                : 'bg-neutral-100 text-neutral-800 placeholder:text-neutral-400 border border-neutral-200 focus:border-purple-500'}
            `}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`
              p-2 rounded-lg transition-all
              ${input.trim() && !isLoading
                ? 'bg-purple-500 text-white hover:bg-purple-600'
                : isDarkMode
                  ? 'bg-neutral-700 text-neutral-500'
                  : 'bg-neutral-200 text-neutral-400'
              }
            `}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// STAGE INDICATOR COMPONENT
// ============================================
const StageIndicator: React.FC<{
  currentStage: MasteryStage;
  stageHistory: StageAttempt[];
  isDarkMode: boolean;
  domain: string;
}> = ({ currentStage, stageHistory, isDarkMode, domain }) => {
  const stages: MasteryStage[] = [1, 2, 3];
  const stageNames = [`Pure ${domain} Intuition`, 'Vocabulary', 'Full Mastery'];

  const getStageStatus = (stage: MasteryStage): 'completed' | 'current' | 'locked' => {
    const stageAttempts = stageHistory.filter(a => a.stage === stage && a.passed);
    if (stageAttempts.length > 0) return 'completed';
    if (stage === currentStage) return 'current';
    return 'locked';
  };

  return (
    <div className={`rounded-xl p-4 mb-4 ${isDarkMode ? 'bg-neutral-800/30' : 'bg-white/50'}`}>
      <div className="flex items-center justify-center gap-2">
        {stages.map((stage, idx) => {
          const status = getStageStatus(stage);
          return (
            <React.Fragment key={stage}>
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
                    transition-all duration-500 relative
                    ${status === 'completed'
                      ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                      : status === 'current'
                        ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-lg shadow-purple-500/30 animate-pulse'
                        : isDarkMode
                          ? 'bg-neutral-800 text-neutral-500'
                          : 'bg-neutral-200 text-neutral-400'
                    }
                  `}
                >
                  {status === 'completed' ? <CheckCircle2 size={20} /> : stage}
                  {status === 'current' && (
                    <div className="absolute inset-0 rounded-full border-2 border-purple-400 animate-ping opacity-50" />
                  )}
                </div>
                <span className={`text-xs mt-1 ${status === 'current' ? 'text-purple-400 font-medium' : isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  {stageNames[idx]}
                </span>
              </div>
              {idx < stages.length - 1 && (
                <div
                  className={`w-12 h-1 rounded-full transition-all duration-500 mb-5 ${
                    getStageStatus(stages[idx + 1]) !== 'locked' || status === 'completed'
                      ? 'bg-gradient-to-r from-green-500 to-blue-500'
                      : isDarkMode
                        ? 'bg-neutral-800'
                        : 'bg-neutral-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// KEYWORD PANEL COMPONENT (Vocabulary Grid)
// ============================================
const KeywordPanel: React.FC<{
  keywords: MasteryKeyword[];
  stage: MasteryStage;
  isDarkMode: boolean;
  domain: string;
  detectedKeywords: string[];
}> = ({ keywords, stage, isDarkMode, domain, detectedKeywords }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (stage === 1) return null;

  const visibleKeywords = stage === 2 ? keywords.slice(0, 6) : keywords;

  // Smart domain abbreviation for card display
  // 1. Extract acronym if present (e.g., "NFL" from "NFL (National Football League...)")
  // 2. Otherwise, use first word or short phrase
  const getShortDomain = (fullDomain: string): string => {
    // Check for acronym pattern: "ABC" or "ABC (full name...)"
    const acronymMatch = fullDomain.match(/^([A-Z]{2,6})(?:\s|\(|$)/);
    if (acronymMatch) return acronymMatch[1];

    // Check for parenthetical: "Something (description)" - use before parenthesis
    const beforeParen = fullDomain.split('(')[0].trim();
    if (beforeParen.length <= 15) return beforeParen;

    // Otherwise just take first word
    return fullDomain.split(' ')[0];
  };

  const shortDomain = getShortDomain(domain);

  return (
    <div className={`rounded-xl overflow-hidden mb-4 ${isDarkMode ? 'bg-neutral-900/80 border border-neutral-800' : 'bg-white shadow-sm border border-neutral-200'}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full px-4 py-3 flex items-center justify-between ${isDarkMode ? 'hover:bg-neutral-800/50' : 'hover:bg-neutral-50'} transition-colors`}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">🔑</span>
          <span className={`font-bold ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
            Technical Vocabulary
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
            Stage {stage}
          </span>
        </div>
        <ChevronDown
          size={18}
          className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}
        />
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          {/* Grid of keyword cards */}
          <div className="grid grid-cols-3 gap-3">
            {visibleKeywords.map((keyword, index) => {
              const isDetected = detectedKeywords.includes(keyword.term);
              const techDef = stage === 2 ? keyword.techDefinition3 : keyword.techDefinition6;
              const analogyDef = stage === 2 ? keyword.analogyDefinition3 : keyword.analogyDefinition6;

              return (
                <div
                  key={keyword.id}
                  className={`
                    relative p-4 rounded-xl transition-all duration-300
                    ${isDetected
                      ? isDarkMode
                        ? 'bg-emerald-500/10 border border-emerald-500/50 ring-1 ring-emerald-500/30'
                        : 'bg-emerald-50 border border-emerald-300'
                      : isDarkMode
                        ? 'bg-neutral-800/60 border border-neutral-700/50 hover:border-neutral-600'
                        : 'bg-neutral-50 border border-neutral-200 hover:border-neutral-300'
                    }
                  `}
                >
                  {/* Detected checkmark */}
                  {isDetected && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    </div>
                  )}

                  {/* Number badge and term */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                      ${isDetected
                        ? 'bg-emerald-500 text-white'
                        : isDarkMode
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-emerald-100 text-emerald-700'
                      }
                    `}>
                      {index + 1}
                    </span>
                    <span className={`font-bold text-sm ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                      {keyword.term}
                    </span>
                  </div>

                  {/* Stage definition label */}
                  <div className={`text-[9px] uppercase tracking-wider font-semibold mb-2 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    Stage {stage} Definition
                  </div>

                  {/* Tech definition */}
                  <div className="mb-2">
                    <span className={`text-[10px] uppercase font-bold ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>
                      TECH:
                    </span>
                    <span className={`text-xs ml-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                      {techDef}
                    </span>
                  </div>

                  {/* Analogy definition */}
                  <div>
                    <span className={`text-[10px] uppercase font-bold ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                      {shortDomain.toUpperCase()}:
                    </span>
                    <span className={`text-xs ml-2 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                      {analogyDef}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// FEEDBACK PANEL COMPONENT
// ============================================
const FeedbackPanel: React.FC<{
  evaluation: EvaluationResult | null;
  isDarkMode: boolean;
  onRetry: () => void;
  onContinue: () => void;
  isComplete: boolean;
}> = ({ evaluation, isDarkMode, onRetry, onContinue, isComplete }) => {
  if (!evaluation) return null;

  const passed = evaluation.passed;

  return (
    <div
      className={`
        rounded-xl p-4 mt-4 border-2 animate-in slide-in-from-bottom-4 duration-300
        ${passed
          ? 'border-green-500 bg-green-500/10'
          : 'border-amber-500 bg-amber-500/10'
        }
      `}
    >
      {/* Score Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {passed ? (
            <CheckCircle2 className="text-green-500" size={24} />
          ) : (
            <XCircle className="text-amber-500" size={24} />
          )}
          <span className={`font-bold text-lg ${passed ? 'text-green-500' : 'text-amber-500'}`}>
            {evaluation.score}%
          </span>
          <span className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
            {passed ? 'Passed!' : 'Not quite - try again'}
          </span>
        </div>
      </div>

      {/* Feedback */}
      <p className={`text-sm mb-3 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
        {evaluation.feedback}
      </p>

      {/* Strengths */}
      {evaluation.strengths.length > 0 && (
        <div className="mb-3">
          <div className={`text-xs font-bold uppercase mb-1 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
            Strengths
          </div>
          <ul className={`text-xs space-y-1 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
            {evaluation.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-green-500">✓</span> {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Intuitions */}
      {evaluation.intuitions && (
        <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-neutral-800' : 'bg-white'} mb-3`}>
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb size={14} className="text-yellow-500" />
            <span className={`text-xs font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
              Key Intuition
            </span>
          </div>
          <p className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
            {evaluation.intuitions.insight}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!passed && (
          <button
            onClick={onRetry}
            className={`
              flex-1 py-2 px-4 rounded-lg font-medium text-sm
              flex items-center justify-center gap-2 transition-all
              ${isDarkMode
                ? 'bg-neutral-700 text-white hover:bg-neutral-600'
                : 'bg-neutral-200 text-neutral-800 hover:bg-neutral-300'
              }
            `}
          >
            <RotateCcw size={16} />
            Try Again
          </button>
        )}
        {passed && !isComplete && (
          <button
            onClick={onContinue}
            className="flex-1 py-2 px-4 rounded-lg font-medium text-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white flex items-center justify-center gap-2 hover:opacity-90 transition-all"
          >
            Next Stage
            <ChevronRight size={16} />
          </button>
        )}
        {passed && isComplete && (
          <div className="flex-1 py-2 px-4 rounded-lg font-medium text-sm bg-gradient-to-r from-green-500 to-emerald-500 text-white flex items-center justify-center gap-2">
            <Trophy size={16} />
            Mastery Complete!
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// GLOSSARY VIEW COMPONENT
// ============================================
const GlossaryView: React.FC<{
  keywords: MasteryKeyword[];
  isDarkMode: boolean;
}> = ({ keywords, isDarkMode }) => {
  return (
    <div className="space-y-3">
      <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
        Complete Glossary
      </h3>

      <div className="grid gap-3">
        {keywords.map((keyword) => (
          <div
            key={keyword.id}
            className={`p-4 rounded-xl ${isDarkMode ? 'bg-neutral-800/50' : 'bg-white shadow-sm'}`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className={`font-bold text-lg ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                {keyword.term}
              </span>
              <span className={isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}>↔</span>
              <span className={`font-bold text-lg ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                {keyword.analogyTerm}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* 3-word definitions */}
              <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-neutral-900/50' : 'bg-neutral-50'}`}>
                <div className={`text-[10px] uppercase font-bold mb-1 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                  Technical (3-word)
                </div>
                <div className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                  {keyword.techDefinition3}
                </div>
              </div>

              <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-neutral-900/50' : 'bg-neutral-50'}`}>
                <div className={`text-[10px] uppercase font-bold mb-1 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  Analogy (3-word)
                </div>
                <div className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                  {keyword.analogyDefinition3}
                </div>
              </div>

              {/* 6-word definitions */}
              <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-neutral-900/50' : 'bg-neutral-50'}`}>
                <div className={`text-[10px] uppercase font-bold mb-1 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                  Technical (6-word)
                </div>
                <div className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                  {keyword.techDefinition6}
                </div>
              </div>

              <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-neutral-900/50' : 'bg-neutral-50'}`}>
                <div className={`text-[10px] uppercase font-bold mb-1 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  Analogy (6-word)
                </div>
                <div className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                  {keyword.analogyDefinition6}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// OVERVIEW MODE COMPONENT
// ============================================
const OverviewMode: React.FC<{
  historyEntry: CompleteMasteryHistory;
  isDarkMode: boolean;
  onClose: () => void;
}> = ({ historyEntry, isDarkMode, onClose }) => {
  const [activeTab, setActiveTab] = useState<'journey' | 'glossary'>('journey');
  const [copied, setCopied] = useState(false);
  const [obsidianCopied, setObsidianCopied] = useState(false);
  const [htmlCopied, setHtmlCopied] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const handleShare = async () => {
    const shareText = `🎓 I mastered ${historyEntry.topic} using ${historyEntry.domain} analogies!\n\n` +
      `📊 Scores: Stage 1: ${historyEntry.finalScores.stage1}% | Stage 2: ${historyEntry.finalScores.stage2}% | Stage 3: ${historyEntry.finalScores.stage3}%\n\n` +
      `💡 Key Insight: ${historyEntry.masterySummary.coreIntuition}\n\n` +
      `#Signal #Learning`;

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('Failed to copy to clipboard');
    }
  };

  // Generate Obsidian-ready markdown export
  const handleObsidianExport = async () => {
    const completedDate = new Date(historyEntry.completedAt).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    let markdown = `# 🎓 Mastery: ${historyEntry.topic}\n\n`;
    markdown += `> Learned through **${historyEntry.domain}** ${historyEntry.domainEmoji} analogies\n\n`;
    markdown += `---\n\n`;

    // Summary Section
    markdown += `## 📊 Summary\n\n`;
    markdown += `- **Completed:** ${completedDate}\n`;
    markdown += `- **Scores:** Stage 1: ${historyEntry.finalScores.stage1}% | Stage 2: ${historyEntry.finalScores.stage2}% | Stage 3: ${historyEntry.finalScores.stage3}%\n\n`;

    markdown += `### 🏆 Mastery Insights\n\n`;
    markdown += `**Key Strength:** ${historyEntry.masterySummary.keyStrength}\n\n`;
    markdown += `**Core Intuition:** ${historyEntry.masterySummary.coreIntuition}\n\n`;
    markdown += `**Unique Approach:** ${historyEntry.masterySummary.uniqueApproach}\n\n`;

    // Journey Section
    markdown += `---\n\n## 📖 Learning Journey\n\n`;

    for (const stage of [1, 2, 3] as const) {
      const stageKey = `stage${stage}` as 'stage1' | 'stage2' | 'stage3';
      const story = historyEntry.stories[stageKey];
      const response = historyEntry.userResponses[stageKey];
      const intuition = historyEntry.intuitions[stageKey];

      // Generate the challenge question for this stage
      const stageQuestion = stage === 1
        ? `Explain "${historyEntry.topic}" in your own words using the ${historyEntry.domain} analogy. No keywords required - just demonstrate your intuitive understanding through storytelling.`
        : stage === 2
          ? `Explain "${historyEntry.topic}" again, but incorporate at least 3 of the 6 keywords shown. Keep it narrative - tell the story using these concepts.`
          : `Final stage! Explain "${historyEntry.topic}" using at least 6 of all 10 keywords. This should be your most complete narrative explanation.`;

      markdown += `### Stage ${stage}: ${stage === 1 ? 'Pure Intuition' : stage === 2 ? 'Vocabulary' : 'Full Mastery'}\n\n`;

      markdown += `**🎯 The Challenge:**\n${stageQuestion}\n\n`;

      if (story?.content) {
        markdown += `**📖 Story Prompt:**\n${story.content}\n\n`;
      }

      if (response) {
        markdown += `**💬 My Answer:**\n> ${response}\n\n`;
      }

      if (intuition?.insight) {
        markdown += `**💡 Key Insight:**\n${intuition.insight}\n\n`;
      }

      if (intuition?.strength) {
        markdown += `**✨ What I Did Well:**\n${intuition.strength}\n\n`;
      }

      if (intuition?.keywordsCaptured?.length > 0) {
        markdown += `**📚 Concepts Demonstrated:** ${intuition.keywordsCaptured.join(', ')}\n\n`;
      }
    }

    // Glossary Section
    markdown += `---\n\n## 📚 Glossary\n\n`;
    markdown += `| Technical Term | ${historyEntry.domain.split(' ')[0]} Equivalent | Definition |\n`;
    markdown += `|----------------|---------------------------|------------|\n`;

    historyEntry.glossary.forEach(keyword => {
      markdown += `| **${keyword.term}** | ${keyword.analogyTerm} | ${keyword.techDefinition6 || keyword.techDefinition3} |\n`;
    });

    markdown += `\n---\n\n*Generated by Signal • ${completedDate}*\n`;

    try {
      await navigator.clipboard.writeText(markdown);
      setObsidianCopied(true);
      setTimeout(() => setObsidianCopied(false), 2000);
    } catch {
      console.error('Failed to copy Obsidian markdown');
    }
  };

  // Generate full HTML export of the entire page
  const handleHtmlExport = async () => {
    const completedDate = new Date(historyEntry.completedAt).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Mastery: ${historyEntry.topic}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; background: #fafafa; color: #333; }
    h1 { color: #7c3aed; margin-bottom: 8px; }
    .subtitle { color: #666; margin-bottom: 24px; }
    .summary-box { background: linear-gradient(135deg, #fef3c7, #fed7aa); border: 1px solid #fcd34d; border-radius: 16px; padding: 24px; margin-bottom: 24px; }
    .summary-box h2 { color: #b45309; display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .summary-item { margin-bottom: 12px; }
    .summary-label { text-transform: uppercase; font-size: 11px; font-weight: 700; color: #b45309; margin-bottom: 4px; }
    .scores { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .score-card { background: white; border-radius: 12px; padding: 16px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .score-value { font-size: 28px; font-weight: 700; }
    .score-value.s1 { color: #3b82f6; }
    .score-value.s2 { color: #a855f7; }
    .score-value.s3 { color: #22c55e; }
    .score-label { font-size: 12px; color: #888; }
    .section { margin-bottom: 32px; }
    .section h3 { color: #7c3aed; border-bottom: 2px solid #e9d5ff; padding-bottom: 8px; margin-bottom: 16px; }
    .stage { background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stage h4 { color: #6b21a8; margin-bottom: 12px; }
    .story { background: #f5f3ff; padding: 16px; border-radius: 8px; margin-bottom: 12px; font-style: italic; }
    .response { border-left: 3px solid #7c3aed; padding-left: 16px; color: #555; }
    .insight { background: #fef3c7; padding: 12px; border-radius: 8px; margin-top: 12px; }
    .insight-icon { color: #f59e0b; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; color: #374151; }
    .tech-term { color: #7c3aed; font-weight: 600; }
    .analogy-term { color: #059669; }
    .footer { text-align: center; color: #888; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <h1>🎓 ${historyEntry.topic}</h1>
  <p class="subtitle">Mastered through <strong>${historyEntry.domain}</strong> ${historyEntry.domainEmoji} analogies • ${completedDate}</p>

  <div class="summary-box">
    <h2>🏆 Your Mastery Summary</h2>
    <div class="summary-item">
      <div class="summary-label">Key Strength</div>
      <p>${historyEntry.masterySummary.keyStrength}</p>
    </div>
    <div class="summary-item">
      <div class="summary-label">Core Intuition</div>
      <p>${historyEntry.masterySummary.coreIntuition}</p>
    </div>
    <div class="summary-item">
      <div class="summary-label">What Made You Unique</div>
      <p>${historyEntry.masterySummary.uniqueApproach}</p>
    </div>
  </div>

  <div class="scores">
    <div class="score-card">
      <div class="score-value s1">${historyEntry.finalScores.stage1}%</div>
      <div class="score-label">Stage 1</div>
    </div>
    <div class="score-card">
      <div class="score-value s2">${historyEntry.finalScores.stage2}%</div>
      <div class="score-label">Stage 2</div>
    </div>
    <div class="score-card">
      <div class="score-value s3">${historyEntry.finalScores.stage3}%</div>
      <div class="score-label">Stage 3</div>
    </div>
  </div>

  <div class="section">
    <h3>📖 Learning Journey</h3>`;

    for (const stage of [1, 2, 3] as const) {
      const stageKey = `stage${stage}` as 'stage1' | 'stage2' | 'stage3';
      const story = historyEntry.stories[stageKey];
      const response = historyEntry.userResponses[stageKey];
      const intuition = historyEntry.intuitions[stageKey];

      // Generate the challenge question for this stage
      const stageQuestion = stage === 1
        ? `Explain "${historyEntry.topic}" in your own words using the ${historyEntry.domain} analogy. No keywords required - just demonstrate your intuitive understanding through storytelling.`
        : stage === 2
          ? `Explain "${historyEntry.topic}" again, but incorporate at least 3 of the 6 keywords shown. Keep it narrative - tell the story using these concepts.`
          : `Final stage! Explain "${historyEntry.topic}" using at least 6 of all 10 keywords. This should be your most complete narrative explanation.`;

      html += `
    <div class="stage">
      <h4>Stage ${stage}: ${stage === 1 ? 'Pure Intuition' : stage === 2 ? 'Vocabulary' : 'Full Mastery'}</h4>
      <div class="insight" style="background: linear-gradient(135deg, ${stage === 1 ? '#dbeafe, #bfdbfe' : stage === 2 ? '#f3e8ff, #e9d5ff' : '#d1fae5, #a7f3d0'}); border-color: ${stage === 1 ? '#3b82f6' : stage === 2 ? '#a855f7' : '#10b981'}; border-left: 4px solid;">
        <span class="insight-icon">🎯</span> <strong>The Challenge:</strong> ${stageQuestion}
      </div>`;

      if (story?.content) {
        html += `
      <div class="story">
        <strong>📖 Story Prompt:</strong><br>
        ${story.content.replace(/\n/g, '<br>')}
      </div>`;
      }

      if (response) {
        html += `
      <div class="response">
        <strong>💬 My Answer:</strong><br>
        ${response.replace(/\n/g, '<br>')}
      </div>`;
      }

      if (intuition?.insight) {
        html += `
      <div class="insight">
        <span class="insight-icon">💡</span> <strong>Key Insight:</strong> ${intuition.insight}
      </div>`;
      }

      if (intuition?.strength) {
        html += `
      <div class="insight" style="background: linear-gradient(135deg, #d1fae5, #a7f3d0); border-color: #34d399;">
        <span class="insight-icon">✨</span> <strong>What You Did Well:</strong> ${intuition.strength}
      </div>`;
      }

      if (intuition?.keywordsCaptured?.length > 0) {
        html += `
      <div class="insight" style="background: linear-gradient(135deg, #dbeafe, #bfdbfe); border-color: #60a5fa;">
        <span class="insight-icon">📚</span> <strong>Concepts Demonstrated:</strong> ${intuition.keywordsCaptured.join(', ')}
      </div>`;
      }

      html += `
    </div>`;
    }

    html += `
  </div>

  <div class="section">
    <h3>📚 Glossary</h3>
    <table>
      <thead>
        <tr>
          <th>Technical Term</th>
          <th>${historyEntry.domain.split(' ')[0]} Equivalent</th>
          <th>Definition</th>
        </tr>
      </thead>
      <tbody>`;

    historyEntry.glossary.forEach(keyword => {
      html += `
        <tr>
          <td class="tech-term">${keyword.term}</td>
          <td class="analogy-term">${keyword.analogyTerm}</td>
          <td>${keyword.techDefinition6 || keyword.techDefinition3}</td>
        </tr>`;
    });

    html += `
      </tbody>
    </table>
  </div>

  <div class="footer">
    Generated by Signal • ${completedDate}
  </div>
</body>
</html>`;

    try {
      await navigator.clipboard.writeText(html);
      setHtmlCopied(true);
      setTimeout(() => setHtmlCopied(false), 2000);
    } catch {
      console.error('Failed to copy HTML');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      {/* Modal Container */}
      <div
        className={`
          flex flex-col overflow-hidden rounded-2xl shadow-2xl
          ${isMaximized ? 'w-full h-full' : 'w-full max-w-4xl max-h-[85vh]'}
          ${isDarkMode ? 'bg-neutral-900' : 'bg-white'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between gap-4 px-6 py-4 border-b ${isDarkMode ? 'border-neutral-800' : 'border-neutral-200'}`}>
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative flex-shrink-0">
              <Medal className="w-10 h-10 text-yellow-500" />
              <span className="absolute -bottom-1 -right-1 text-lg">{historyEntry.domainEmoji}</span>
            </div>
            <div className="min-w-0">
              <h2 className={`text-lg font-bold truncate ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
                {historyEntry.topic}
              </h2>
              <p className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Mastered on {new Date(historyEntry.completedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleObsidianExport}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all shadow-sm whitespace-nowrap
                ${obsidianCopied
                  ? 'bg-green-500 text-white'
                  : isDarkMode
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500'
                    : 'bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600'}
              `}
              title="Copy beautifully formatted markdown notes"
            >
              {obsidianCopied ? <Check size={16} /> : <ClipboardCopy size={16} />}
              {obsidianCopied ? 'Copied!' : 'Copy Notes'}
            </button>
            <button
              onClick={handleShare}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all
                ${isDarkMode ? 'bg-neutral-800 text-white hover:bg-neutral-700' : 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'}
              `}
              title="Share achievement"
            >
              {copied ? <Check size={16} /> : <Share2 size={16} />}
            </button>
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
              title={isMaximized ? "Restore" : "Maximize"}
            >
              {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-neutral-800 text-neutral-300 hover:bg-red-500 hover:text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-red-500 hover:text-white'}`}
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

      {/* Tabs */}
      <div className={`px-6 py-2 border-b ${isDarkMode ? 'border-neutral-800' : 'border-neutral-200'}`}>
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('journey')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'journey'
                ? 'bg-purple-500 text-white'
                : isDarkMode ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            Your Journey
          </button>
          <button
            onClick={() => setActiveTab('glossary')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'glossary'
                ? 'bg-purple-500 text-white'
                : isDarkMode ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            Glossary
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto">
          {activeTab === 'journey' ? (
            <div className="space-y-6">
              {/* Mastery Summary */}
              <div className={`p-6 rounded-xl ${isDarkMode ? 'bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border border-yellow-500/30' : 'bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200'}`}>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="text-yellow-500" size={24} />
                    <h3 className={`text-lg font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                      Your Mastery Summary
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Copy Markdown Notes Button */}
                    <button
                      onClick={handleObsidianExport}
                      className={`
                        flex items-center gap-2 px-3 py-2 rounded-xl font-semibold text-sm transition-all shadow-md
                        ${obsidianCopied
                          ? 'bg-green-500 text-white'
                          : 'bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700'}
                      `}
                      title="Copy as Markdown for Obsidian/Notion"
                    >
                      {obsidianCopied ? <Check size={16} /> : <ClipboardCopy size={16} />}
                      {obsidianCopied ? 'Copied!' : 'Markdown'}
                    </button>
                    {/* Copy Full HTML Page Button */}
                    <button
                      onClick={handleHtmlExport}
                      className={`
                        flex items-center gap-2 px-3 py-2 rounded-xl font-semibold text-sm transition-all shadow-md
                        ${htmlCopied
                          ? 'bg-green-500 text-white'
                          : 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white hover:from-blue-600 hover:to-cyan-700'}
                      `}
                      title="Copy full page as HTML - paste into any document"
                    >
                      {htmlCopied ? <Check size={16} /> : <FileCode size={16} />}
                      {htmlCopied ? 'Copied!' : 'Full Page'}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className={`text-xs uppercase font-bold ${isDarkMode ? 'text-yellow-400/70' : 'text-yellow-600'}`}>
                      Key Strength
                    </div>
                    <p className={`${isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}`}>
                      {historyEntry.masterySummary.keyStrength}
                    </p>
                  </div>

                  <div>
                    <div className={`text-xs uppercase font-bold ${isDarkMode ? 'text-yellow-400/70' : 'text-yellow-600'}`}>
                      Core Intuition
                    </div>
                    <p className={`${isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}`}>
                      {historyEntry.masterySummary.coreIntuition}
                    </p>
                  </div>

                  <div>
                    <div className={`text-xs uppercase font-bold ${isDarkMode ? 'text-yellow-400/70' : 'text-yellow-600'}`}>
                      What Made You Unique
                    </div>
                    <p className={`${isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}`}>
                      {historyEntry.masterySummary.uniqueApproach}
                    </p>
                  </div>
                </div>
              </div>

              {/* Scores */}
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((stage) => (
                  <div
                    key={stage}
                    className={`p-4 rounded-xl text-center ${isDarkMode ? 'bg-neutral-800/50' : 'bg-white shadow-sm'}`}
                  >
                    <div className={`text-3xl font-bold ${
                      stage === 1 ? 'text-blue-500' : stage === 2 ? 'text-purple-500' : 'text-green-500'
                    }`}>
                      {historyEntry.finalScores[`stage${stage}` as keyof typeof historyEntry.finalScores]}%
                    </div>
                    <div className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                      Stage {stage}
                    </div>
                  </div>
                ))}
              </div>

              {/* Stage Details */}
              {[1, 2, 3].map((stage) => {
                // Generate the question/challenge for this stage
                const getStageQuestion = () => {
                  switch (stage) {
                    case 1:
                      return `Explain "${historyEntry.topic}" in your own words using the ${historyEntry.domain} analogy. No keywords required - just demonstrate your intuitive understanding through storytelling.`;
                    case 2:
                      return `Explain "${historyEntry.topic}" again, but incorporate at least 3 of the 6 keywords shown. Keep it narrative - tell the story using these concepts.`;
                    case 3:
                      return `Final stage! Explain "${historyEntry.topic}" using at least 6 of all 10 keywords. This should be your most complete narrative explanation.`;
                    default:
                      return '';
                  }
                };

                return (
                <div
                  key={stage}
                  className={`p-6 rounded-xl ${isDarkMode ? 'bg-neutral-800/50' : 'bg-white shadow-sm'}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center font-bold
                      ${stage === 1 ? 'bg-blue-500' : stage === 2 ? 'bg-purple-500' : 'bg-green-500'} text-white
                    `}>
                      {stage}
                    </div>
                    <h4 className={`font-bold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
                      Stage {stage}: {stage === 1 ? 'Pure Intuition' : stage === 2 ? 'Vocabulary' : 'Full Mastery'}
                    </h4>
                  </div>

                  {/* The Challenge/Question */}
                  <div className={`p-4 rounded-lg mb-4 border-l-4 ${
                    stage === 1
                      ? (isDarkMode ? 'bg-blue-900/20 border-blue-500' : 'bg-blue-50 border-blue-500')
                      : stage === 2
                        ? (isDarkMode ? 'bg-purple-900/20 border-purple-500' : 'bg-purple-50 border-purple-500')
                        : (isDarkMode ? 'bg-green-900/20 border-green-500' : 'bg-green-50 border-green-500')
                  }`}>
                    <div className={`text-xs uppercase font-bold mb-2 ${
                      stage === 1
                        ? (isDarkMode ? 'text-blue-400' : 'text-blue-600')
                        : stage === 2
                          ? (isDarkMode ? 'text-purple-400' : 'text-purple-600')
                          : (isDarkMode ? 'text-green-400' : 'text-green-600')
                    }`}>
                      🎯 The Challenge
                    </div>
                    <p className={`text-sm font-medium ${isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}`}>
                      {getStageQuestion()}
                    </p>
                  </div>

                  {/* Story */}
                  <div className={`p-4 rounded-lg mb-4 ${isDarkMode ? 'bg-neutral-900/50' : 'bg-neutral-50'}`}>
                    <div className={`text-xs uppercase font-bold mb-2 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      📖 The Story Prompt
                    </div>
                    <p className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                      {historyEntry.stories[`stage${stage}` as keyof typeof historyEntry.stories]?.content || 'Story not available'}
                    </p>
                  </div>

                  {/* User Response */}
                  <div className={`p-4 rounded-lg mb-4 ${isDarkMode ? 'bg-purple-900/20 border border-purple-500/30' : 'bg-purple-50 border border-purple-200'}`}>
                    <div className={`text-xs uppercase font-bold mb-2 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                      💬 Your Answer
                    </div>
                    <p className={`text-sm italic ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                      "{historyEntry.userResponses[`stage${stage}` as keyof typeof historyEntry.userResponses] || 'Response not available'}"
                    </p>
                  </div>

                  {/* Intuition - Full Details */}
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-yellow-900/20 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb size={14} className="text-yellow-500" />
                      <span className={`text-xs uppercase font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                        AI-Extracted Insights
                      </span>
                    </div>

                    {/* Main Insight */}
                    <div className="mb-3">
                      <div className={`text-xs font-medium mb-1 ${isDarkMode ? 'text-yellow-500/80' : 'text-yellow-700/80'}`}>
                        💡 Key Insight
                      </div>
                      <p className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                        {historyEntry.intuitions[`stage${stage}` as keyof typeof historyEntry.intuitions]?.insight || 'Intuition not available'}
                      </p>
                    </div>

                    {/* Strength */}
                    {historyEntry.intuitions[`stage${stage}` as keyof typeof historyEntry.intuitions]?.strength && (
                      <div className="mb-3">
                        <div className={`text-xs font-medium mb-1 ${isDarkMode ? 'text-green-500/80' : 'text-green-700/80'}`}>
                          ✨ What You Did Well
                        </div>
                        <p className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                          {historyEntry.intuitions[`stage${stage}` as keyof typeof historyEntry.intuitions]?.strength}
                        </p>
                      </div>
                    )}

                    {/* Keywords Captured */}
                    {historyEntry.intuitions[`stage${stage}` as keyof typeof historyEntry.intuitions]?.keywordsCaptured?.length > 0 && (
                      <div>
                        <div className={`text-xs font-medium mb-1 ${isDarkMode ? 'text-blue-500/80' : 'text-blue-700/80'}`}>
                          📚 Concepts Demonstrated
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {historyEntry.intuitions[`stage${stage}` as keyof typeof historyEntry.intuitions]?.keywordsCaptured?.map((kw: string, i: number) => (
                            <span
                              key={i}
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
              })}
            </div>
          ) : (
            <GlossaryView keywords={historyEntry.glossary} isDarkMode={isDarkMode} />
          )}
        </div>
      </div>
      </div>{/* Close modal container */}
    </div>
  );
};

// ============================================
// COMPLETION CELEBRATION COMPONENT
// ============================================
const CompletionCelebration: React.FC<{
  topic: string;
  domain: string;
  domainEmoji: string;
  finalScores: { stage1: number; stage2: number; stage3: number };
  masterySummary: { keyStrength: string; coreIntuition: string; uniqueApproach: string };
  isDarkMode: boolean;
  onViewOverview: () => void;
  onClose: () => void;
}> = ({ topic, domain, domainEmoji, finalScores, masterySummary, isDarkMode, onViewOverview, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareText = `🎓 I mastered ${topic} using ${domain} analogies!\n\n` +
      `📊 Scores: Stage 1: ${finalScores.stage1}% | Stage 2: ${finalScores.stage2}% | Stage 3: ${finalScores.stage3}%\n\n` +
      `💡 Key Insight: ${masterySummary.coreIntuition}\n\n` +
      `#Signal #Learning`;

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('Failed to copy to clipboard');
    }
  };

  return (
    <div className={`fixed inset-0 z-[110] flex items-center justify-center ${isDarkMode ? 'bg-black/90' : 'bg-white/90'}`}>
      <div className={`max-w-md w-full mx-4 p-8 rounded-2xl text-center ${isDarkMode ? 'bg-neutral-900' : 'bg-white shadow-2xl'}`}>
        {/* Trophy Animation */}
        <div className="relative mb-6">
          <Trophy className="w-24 h-24 mx-auto text-yellow-500 animate-bounce" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-yellow-500/20 animate-ping" />
          </div>
          <span className="absolute bottom-0 right-1/3 text-3xl">{domainEmoji}</span>
        </div>

        <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
          Mastery Complete!
        </h2>

        <p className={`mb-6 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
          You've demonstrated full understanding of <strong>{topic}</strong> through the lens of <strong>{domain}</strong>.
        </p>

        {/* Scores */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3].map((stage) => (
            <div
              key={stage}
              className={`p-3 rounded-lg ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'}`}
            >
              <div className={`text-2xl font-bold ${
                stage === 1 ? 'text-blue-500' : stage === 2 ? 'text-purple-500' : 'text-green-500'
              }`}>
                {finalScores[`stage${stage}` as keyof typeof finalScores]}%
              </div>
              <div className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                Stage {stage}
              </div>
            </div>
          ))}
        </div>

        {/* Key Insight */}
        <div className={`p-4 rounded-lg mb-6 ${isDarkMode ? 'bg-yellow-900/20' : 'bg-yellow-50'}`}>
          <Lightbulb className="w-5 h-5 text-yellow-500 mx-auto mb-2" />
          <p className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
            {masterySummary.coreIntuition}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleShare}
            className={`
              flex-1 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all
              ${isDarkMode ? 'bg-neutral-800 text-white hover:bg-neutral-700' : 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'}
            `}
          >
            {copied ? <Check size={18} /> : <Share2 size={18} />}
            {copied ? 'Copied!' : 'Share'}
          </button>

          <button
            onClick={onViewOverview}
            className="flex-1 py-3 px-4 rounded-lg font-medium bg-gradient-to-r from-purple-500 to-blue-500 text-white flex items-center justify-center gap-2 hover:opacity-90 transition-all"
          >
            <Eye size={18} />
            View Journey
          </button>
        </div>

        <button
          onClick={onClose}
          className={`mt-4 text-sm ${isDarkMode ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-400 hover:text-neutral-600'}`}
        >
          Close
        </button>
      </div>
    </div>
  );
};

// ============================================
// MAIN MASTERY MODE COMPONENT
// ============================================
export const MasteryMode: React.FC<MasteryModeProps> = ({
  topic,
  domain,
  domainEmoji,
  conceptMap,
  importanceMap,
  analogyText,
  isDarkMode,
  onClose,
  cachedState,
  onStateChange
}) => {
  // Session State - restore from cache if available
  const [session, setSession] = useState<MasterySession | null>(cachedState?.session ?? null);
  const [isLoading, setIsLoading] = useState(!cachedState?.session); // Only loading if no cache
  const [error, setError] = useState<string | null>(null);

  // Story State - restore from cache if available
  const [currentStory, setCurrentStory] = useState<MasteryStory | null>(cachedState?.currentStory ?? null);
  const [storyHistory, setStoryHistory] = useState<{ [key: number]: MasteryStory }>(cachedState?.storyHistory ?? {});
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>('idle');
  const [validationAttempts, setValidationAttempts] = useState(0);

  // Derived state for backward compatibility
  const isGeneratingStory = generationPhase !== 'idle';

  // Input State - restore from cache if available
  const [userInput, setUserInput] = useState(cachedState?.userInput ?? '');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [currentEvaluation, setCurrentEvaluation] = useState<EvaluationResult | null>(cachedState?.currentEvaluation ?? null);
  const [detectedKeywords, setDetectedKeywords] = useState<string[]>(cachedState?.detectedKeywords ?? []);
  const [userResponses, setUserResponses] = useState<string[]>(cachedState?.userResponses ?? []);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Completion State
  const [showCelebration, setShowCelebration] = useState(false);
  const [masterySummary, setMasterySummary] = useState<{ keyStrength: string; coreIntuition: string; uniqueApproach: string } | null>(null);
  const [completedHistory, setCompletedHistory] = useState<CompleteMasteryHistory | null>(null);

  // Overview State
  const [showOverview, setShowOverview] = useState(false);
  const [existingMastery, setExistingMastery] = useState<CompleteMasteryHistory | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Notify parent of state changes for persistence
  useEffect(() => {
    if (onStateChange && session) {
      onStateChange({
        session,
        storyHistory,
        userResponses,
        currentStory,
        userInput,
        currentEvaluation,
        detectedKeywords
      });
    }
  }, [session, storyHistory, userResponses, currentStory, userInput, currentEvaluation, detectedKeywords, onStateChange]);

  // Check for existing mastery on mount OR restore from cached state
  useEffect(() => {
    // If we have cached state, skip initialization entirely
    if (cachedState?.session) {
      console.log('[MasteryMode] Restoring from cached state');
      return;
    }

    const checkExistingMastery = () => {
      try {
        const existing = localStorage.getItem(STORAGE_KEY);
        if (existing) {
          const history: CompleteMasteryHistory[] = JSON.parse(existing);
          const match = history.find(h =>
            h.topic.toLowerCase() === topic.toLowerCase() &&
            h.domain.toLowerCase() === domain.toLowerCase()
          );
          if (match) {
            setExistingMastery(match);
            setShowOverview(true);
            setIsLoading(false);
            return true;
          }
        }
      } catch {
        // Continue to normal flow
      }
      return false;
    };

    if (checkExistingMastery()) return;

    // Initialize new session
    const initSession = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Generate initial keywords (these will be updated with contextual definitions)
        let keywords = await generateMasteryKeywords(
          topic,
          domain,
          conceptMap,
          importanceMap,
          analogyText
        );

        // Generate the Stage 1 story first (with validation)
        setGenerationPhase('generating');
        let story = await generateMasteryStory(topic, domain, 1, keywords);

        // Retry once if story content is empty (rare API edge case)
        if (!story?.content || story.content.trim().length === 0) {
          console.warn('[MasteryMode] First story attempt returned empty, retrying...');
          setGenerationPhase('retrying');
          setValidationAttempts(2);
          await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause before retry
          story = await generateMasteryStory(topic, domain, 1, keywords);
        }

        // Validate the initial story
        if (story?.content) {
          setGenerationPhase('validating');
          const validation = await validateDomainLogic(story.content, domain, topic, keywords);
          if (!validation.isValid) {
            console.warn('[MasteryMode] Initial story validation failed:', validation.issues);
            // Retry once for major issues
            if (validation.severity === 'major') {
              setGenerationPhase('retrying');
              setValidationAttempts(2);
              story = await generateMasteryStory(topic, domain, 1, keywords);
            }
          }
        }

        setCurrentStory(story);
        setStoryHistory(prev => ({ ...prev, [1]: story }));
        setGenerationPhase('idle');
        setValidationAttempts(0);

        // NOW regenerate keyword definitions based on the actual mastery story
        // This ensures definitions reference characters/events from THIS story
        // not from the initial analogy (which might be about different players)
        if (story?.content) {
          keywords = await regenerateContextualDefinitions(
            topic,
            domain,
            keywords,
            story.content
          );
        }

        const newSession: MasterySession = {
          id: crypto.randomUUID(),
          sourceData: {
            topic,
            domain,
            domainEmoji,
            analogyText
          },
          keywords,
          currentStage: 1,
          stageHistory: [],
          isComplete: false,
          startedAt: new Date()
        };

        setSession(newSession);
      } catch (err) {
        console.error('Failed to initialize mastery session:', err);
        setError('Failed to start mastery mode. Please try again.');
        setGenerationPhase('idle');
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, [topic, domain, domainEmoji, conceptMap, importanceMap, analogyText]);

  // Maximum retry attempts for validation
  const MAX_VALIDATION_RETRIES = 3;

  // Generate story with validation loop
  const generateValidatedStory = async (
    stage: MasteryStage,
    keywords: MasteryKeyword[],
    previousStoryContent?: string,
    attemptNumber: number = 1
  ): Promise<MasteryStory | null> => {
    // Phase 1: Generate
    setGenerationPhase(attemptNumber === 1 ? 'generating' : 'retrying');
    setValidationAttempts(attemptNumber);

    try {
      const story = await generateMasteryStory(
        topic,
        domain,
        stage,
        keywords,
        previousStoryContent
      );

      // Phase 2: Validate
      setGenerationPhase('validating');

      const validation = await validateDomainLogic(
        story.content,
        domain,
        topic,
        keywords
      );

      if (validation.isValid) {
        // Validation passed - return the story
        console.log(`[MasteryMode] Story validated successfully on attempt ${attemptNumber}`);
        return story;
      }

      // Validation failed
      console.warn(`[MasteryMode] Validation failed (attempt ${attemptNumber}):`, validation.issues);

      if (attemptNumber < MAX_VALIDATION_RETRIES) {
        // Retry with a fresh generation
        console.log(`[MasteryMode] Retrying story generation (attempt ${attemptNumber + 1}/${MAX_VALIDATION_RETRIES})`);
        return generateValidatedStory(stage, keywords, previousStoryContent, attemptNumber + 1);
      }

      // Max retries reached - use the last story anyway but log warning
      console.warn(`[MasteryMode] Max validation retries reached. Using story with issues:`, validation.issues);
      return story;

    } catch (err) {
      console.error('Failed to generate/validate story:', err);
      return null;
    }
  };

  // Generate story for a stage (now with validation)
  const generateStoryForStage = async (stage: MasteryStage, keywords: MasteryKeyword[], previousStoryContent?: string) => {
    try {
      const story = await generateValidatedStory(stage, keywords, previousStoryContent);
      if (story) {
        setCurrentStory(story);
        setStoryHistory(prev => ({ ...prev, [stage]: story }));
      }
    } finally {
      setGenerationPhase('idle');
      setValidationAttempts(0);
    }
  };

  // Handle story regeneration
  const handleRegenerateStory = useCallback(async () => {
    if (!session) return;

    const previousStory = session.currentStage > 1
      ? storyHistory[session.currentStage - 1]?.content
      : undefined;

    await generateStoryForStage(session.currentStage, session.keywords, previousStory);
  }, [session, storyHistory]);

  // Real-time keyword detection as user types
  useEffect(() => {
    if (!session || session.currentStage === 1) {
      setDetectedKeywords([]);
      return;
    }

    const visibleKeywords = session.currentStage === 2
      ? session.keywords.slice(0, 6)
      : session.keywords;

    const detected = detectKeywordsInText(userInput, visibleKeywords);
    setDetectedKeywords(detected);
  }, [userInput, session]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!session || !userInput.trim() || isEvaluating) return;

    setIsEvaluating(true);
    setCurrentEvaluation(null);

    try {
      const visibleKeywords = session.currentStage === 1
        ? []
        : session.currentStage === 2
          ? session.keywords.slice(0, 6)
          : session.keywords;

      const evaluation = await evaluateMasteryResponse(
        topic,
        domain,
        session.currentStage,
        userInput,
        visibleKeywords,
        currentStory?.content || analogyText // Use the Mastery story, fallback to original
      );

      setCurrentEvaluation(evaluation);

      // Create attempt record
      const attempt: StageAttempt = {
        stage: session.currentStage,
        userResponse: userInput,
        availableKeywords: visibleKeywords.map(k => k.term),
        requiredKeywordCount: session.currentStage === 1 ? 0 : session.currentStage === 2 ? 3 : 6,
        keywordsUsed: evaluation.keywordsDetected,
        score: evaluation.score,
        passed: evaluation.passed,
        feedback: evaluation.feedback,
        intuitions: evaluation.intuitions,
        timestamp: new Date()
      };

      // Update session and user responses
      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          stageHistory: [...prev.stageHistory, attempt]
        };
      });

      if (evaluation.passed) {
        setUserResponses(prev => [...prev, userInput]);
      }

    } catch (err) {
      console.error('Evaluation failed:', err);
      setCurrentEvaluation({
        score: 0,
        passed: false,
        feedback: 'Failed to evaluate your response. Please try again.',
        keywordsDetected: [],
        missedConcepts: [],
        strengths: [],
        intuitions: {
          insight: 'Unable to evaluate.',
          keywordsCaptured: [],
          strength: ''
        }
      });
    } finally {
      setIsEvaluating(false);
    }
  }, [session, userInput, topic, domain, analogyText, isEvaluating]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setCurrentEvaluation(null);
    setUserInput('');
    textareaRef.current?.focus();
  }, []);

  // Handle continue to next stage
  const handleContinue = useCallback(async () => {
    if (!session) return;

    const nextStage = (session.currentStage + 1) as MasteryStage;
    const isComplete = nextStage > 3;

    if (isComplete) {
      // Generate mastery summary
      const passedAttempts = session.stageHistory.filter(a => a.passed);
      const responses = {
        stage1: passedAttempts.find(a => a.stage === 1)?.userResponse || '',
        stage2: passedAttempts.find(a => a.stage === 2)?.userResponse || '',
        stage3: userInput // Current stage 3 response
      };
      const intuitions = {
        stage1: passedAttempts.find(a => a.stage === 1)?.intuitions || { insight: '', keywordsCaptured: [], strength: '' },
        stage2: passedAttempts.find(a => a.stage === 2)?.intuitions || { insight: '', keywordsCaptured: [], strength: '' },
        stage3: currentEvaluation?.intuitions || { insight: '', keywordsCaptured: [], strength: '' }
      };

      const summary = await generateMasterySummary(topic, domain, responses, intuitions);
      setMasterySummary(summary);

      // Create complete history entry
      const finalScores = {
        stage1: passedAttempts.find(a => a.stage === 1)?.score ?? 0,
        stage2: passedAttempts.find(a => a.stage === 2)?.score ?? 0,
        stage3: currentEvaluation?.score ?? 0
      };

      const completeHistory: CompleteMasteryHistory = {
        id: session.id,
        topic,
        domain,
        domainEmoji,
        completedAt: new Date(),
        startedAt: session.startedAt,
        stories: {
          stage1: storyHistory[1] || { stage: 1, content: '', highlightedTerms: [], generatedAt: new Date() },
          stage2: storyHistory[2] || { stage: 2, content: '', highlightedTerms: [], generatedAt: new Date() },
          stage3: storyHistory[3] || currentStory || { stage: 3, content: '', highlightedTerms: [], generatedAt: new Date() }
        },
        userResponses: responses,
        intuitions,
        glossary: session.keywords,
        finalScores,
        masterySummary: summary
      };

      setCompletedHistory(completeHistory);
      saveToHistory(completeHistory);
      setShowCelebration(true);

      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          isComplete: true,
          completedAt: new Date()
        };
      });
    } else {
      // Move to next stage
      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          currentStage: nextStage
        };
      });

      // Generate story for next stage
      const previousStoryContent = currentStory?.content;
      await generateStoryForStage(nextStage, session.keywords, previousStoryContent);

      setCurrentEvaluation(null);
      setUserInput('');
      setDetectedKeywords([]);
    }
  }, [session, userInput, currentEvaluation, currentStory, storyHistory, topic, domain, domainEmoji]);

  // Save completed session to history
  const saveToHistory = (completeHistory: CompleteMasteryHistory) => {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      const history: CompleteMasteryHistory[] = existing ? JSON.parse(existing) : [];

      // Remove any existing entry for this topic/domain
      const filtered = history.filter(h =>
        !(h.topic.toLowerCase() === completeHistory.topic.toLowerCase() &&
          h.domain.toLowerCase() === completeHistory.domain.toLowerCase())
      );

      const updatedHistory = [completeHistory, ...filtered].slice(0, 50);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch (err) {
      console.error('Failed to save mastery history:', err);
    }
  };

  // Get stage-specific instructions
  const getStageInstructions = (): string => {
    if (!session) return '';

    switch (session.currentStage) {
      case 1:
        return `Explain "${topic}" in your own words using the ${domain} analogy. No keywords required - just demonstrate your intuitive understanding through storytelling.`;
      case 2:
        return `Now explain "${topic}" again, but incorporate at least 3 of the 6 keywords shown below. Keep it narrative - tell the story using these concepts.`;
      case 3:
        return `Final stage! Explain "${topic}" using at least 6 of all 10 keywords. This should be your most complete narrative explanation.`;
      default:
        return '';
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isChatOpen) {
          setIsChatOpen(false);
        } else if (showOverview) {
          onClose();
        } else {
          onClose();
        }
      }
      if (e.key === 'Enter' && e.metaKey && !isEvaluating && userInput.trim()) {
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleSubmit, isEvaluating, userInput, isChatOpen, showOverview]);

  // Show overview for existing mastery
  if (showOverview && existingMastery) {
    return <OverviewMode historyEntry={existingMastery} isDarkMode={isDarkMode} onClose={onClose} />;
  }

  // Show overview for just completed mastery
  if (showOverview && completedHistory) {
    return <OverviewMode historyEntry={completedHistory} isDarkMode={isDarkMode} onClose={onClose} />;
  }

  // Show celebration
  if (showCelebration && masterySummary && completedHistory) {
    return (
      <CompletionCelebration
        topic={topic}
        domain={domain}
        domainEmoji={domainEmoji}
        finalScores={completedHistory.finalScores}
        masterySummary={masterySummary}
        isDarkMode={isDarkMode}
        onViewOverview={() => {
          setShowCelebration(false);
          setShowOverview(true);
        }}
        onClose={onClose}
      />
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-white font-medium">Preparing Mastery Mode...</p>
          <p className="text-neutral-400 text-sm mt-1">Generating keywords and your first story</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !session) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center">
        <div className="text-center max-w-md">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-white font-medium mb-2">{error || 'Something went wrong'}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-700 text-white rounded-lg hover:bg-neutral-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const isComplete = session.isComplete;
  const requiredKeywords = session.currentStage === 1 ? 0 : session.currentStage === 2 ? 3 : 6;

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col ${isDarkMode ? 'bg-neutral-950' : 'bg-neutral-50'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
            <GraduationCap className="text-white" size={24} />
          </div>
          <div>
            <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
              {topic}
            </h2>
            <p className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Stage {session.currentStage}: {session.currentStage === 1 ? `Pure ${domain} Intuition` : session.currentStage === 2 ? 'Vocabulary' : 'Full Mastery'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-neutral-800 text-neutral-300 hover:bg-red-500 hover:text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-red-500 hover:text-white'}`}
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto">
          {/* Stage Indicator */}
          <StageIndicator
            currentStage={session.currentStage}
            stageHistory={session.stageHistory}
            isDarkMode={isDarkMode}
            domain={domain}
          />

          {/* Story Card - ABOVE INPUT */}
          <StoryCard
            story={currentStory}
            keywords={session.keywords}
            stage={session.currentStage}
            isDarkMode={isDarkMode}
            domain={domain}
            isLoading={isGeneratingStory}
            generationPhase={generationPhase}
            validationAttempts={validationAttempts}
            onRegenerate={handleRegenerateStory}
          />

          {/* Stage Instructions */}
          <div className={`text-center mb-4 p-3 rounded-lg ${isDarkMode ? 'bg-purple-900/20' : 'bg-purple-50'}`}>
            <p className={`text-sm ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
              {getStageInstructions()}
            </p>
          </div>

          {/* Keyword Panel */}
          <KeywordPanel
            keywords={session.keywords}
            stage={session.currentStage}
            isDarkMode={isDarkMode}
            domain={domain}
            detectedKeywords={detectedKeywords}
          />

          {/* Input Area */}
          {!isComplete && (
            <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-neutral-800/50' : 'bg-white shadow-sm'}`}>
              {/* Keyword Counter */}
              {session.currentStage > 1 && (
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    Keywords used: {detectedKeywords.length}/{requiredKeywords} required
                  </span>
                  <div className="flex gap-1">
                    {Array.from({ length: requiredKeywords }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-all ${
                          i < detectedKeywords.length
                            ? 'bg-green-500'
                            : isDarkMode
                              ? 'bg-neutral-700'
                              : 'bg-neutral-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={isEvaluating || currentEvaluation?.passed}
                placeholder={`Tell the story of ${topic} using your ${domain} knowledge...`}
                className={`
                  w-full min-h-[200px] p-4 rounded-lg resize-none outline-none transition-all
                  ${isDarkMode
                    ? 'bg-neutral-900 text-white placeholder:text-neutral-600 border border-neutral-700 focus:border-purple-500'
                    : 'bg-neutral-50 text-neutral-800 placeholder:text-neutral-400 border border-neutral-200 focus:border-purple-500'
                  }
                  ${currentEvaluation?.passed ? 'opacity-50' : ''}
                `}
              />

              <div className="flex items-center justify-between mt-3">
                <span className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  {userInput.length} characters • ⌘+Enter to submit
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={!userInput.trim() || isEvaluating || currentEvaluation?.passed}
                  className={`
                    px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all
                    ${userInput.trim() && !isEvaluating && !currentEvaluation?.passed
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:opacity-90'
                      : isDarkMode
                        ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                        : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                    }
                  `}
                >
                  {isEvaluating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Evaluating...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Submit
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Feedback Panel */}
          <FeedbackPanel
            evaluation={currentEvaluation}
            isDarkMode={isDarkMode}
            onRetry={handleRetry}
            onContinue={handleContinue}
            isComplete={isComplete}
          />
        </div>
      </div>

      {/* Footer */}
      <div className={`px-6 py-3 border-t ${isDarkMode ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <span className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
            Explain in narrative form using {domain} vocabulary • No technical jargon
          </span>
          <span className={`text-xs ${isDarkMode ? 'text-neutral-600' : 'text-neutral-400'}`}>
            Press Esc to exit
          </span>
        </div>
      </div>

      {/* Chat Window */}
      <ChatWindow
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
        topic={topic}
        domain={domain}
        currentStage={session.currentStage}
        currentStory={currentStory?.content || ''}
        userResponses={userResponses}
        keywords={session.keywords}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default MasteryMode;
