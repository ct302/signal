import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, ArrowRight, Sparkles, BookOpen, ChevronRight, Layers, Maximize2, Minimize2, ChevronDown, ChevronUp, Atom, Lightbulb } from 'lucide-react';
import { useMobile } from '../hooks/useMobile';

interface ConceptMapItem {
  id: number;
  tech_term: string;
  analogy_term: string;
  six_word_definition?: string;
  narrative_mapping?: string;
  causal_explanation?: string;
  why_it_matters?: {
    connection: string;
    importance: string;
    critical: string;
  };
}

interface ImportanceMapItem {
  term: string;
  importance: number;
}

interface ConstellationModeProps {
  conceptMap: ConceptMapItem[];
  importanceMap: ImportanceMapItem[];
  isAnalogyMode: boolean;
  isDarkMode: boolean;
  onClose: () => void;
  domainName?: string;
  topicName?: string;
  renderRichText?: (text: string, colorClass?: string) => React.ReactNode;
  onFetchFoundationalMapping?: (
    techTerm: string,
    analogyTerm: string,
    domainName: string,
    topicName: string,
    importance: number
  ) => Promise<{ foundationalMapping: string }>;
}

// Color palette for concepts
const CONCEPT_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4'
];

// Helper to strip LaTeX delimiters for display
const cleanLabel = (text: string): string => {
  return text
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    .replace(/\\\(/g, '')
    .replace(/\\\)/g, '')
    .replace(/\\\[/g, '')
    .replace(/\\\]/g, '')
    .replace(/\^{([^}]+)}/g, '^$1')
    .replace(/_{([^}]+)}/g, '_$1')
    .replace(/\\(boldsymbol|mathbf|mathbb|mathcal|mathrm|textbf|text)\{([^}]*)\}/g, '$2')
    // Handle backslash followed by actual Unicode Greek letters (e.g., \Σ -> Σ)
    .replace(/\\([Σσαβγδεθλμπφψωρτηκχ∞∈∀∃∇∂∫≈≠≤≥])/g, '$1')
    .replace(/\\[a-zA-Z]+/g, (match) => {
      const commands: { [key: string]: string } = {
        '\\Sigma': 'Σ', '\\sigma': 'σ', '\\alpha': 'α', '\\beta': 'β',
        '\\gamma': 'γ', '\\delta': 'δ', '\\theta': 'θ', '\\lambda': 'λ',
        '\\mu': 'μ', '\\pi': 'π', '\\sum': 'Σ', '\\prod': 'Π',
        '\\int': '∫', '\\infty': '∞', '\\sqrt': '√', '\\cdot': '·',
        '\\times': '×', '\\div': '÷', '\\pm': '±', '\\leq': '≤',
        '\\geq': '≥', '\\neq': '≠', '\\approx': '≈',
        '\\circ': '∘', '\\bullet': '•', '\\star': '★',
        '\\forall': '∀', '\\exists': '∃', '\\in': '∈', '\\notin': '∉',
        '\\subset': '⊂', '\\supset': '⊃', '\\cup': '∪', '\\cap': '∩',
        '\\land': '∧', '\\lor': '∨', '\\neg': '¬',
        '\\implies': '⟹', '\\iff': '⟺',
        '\\oplus': '⊕', '\\otimes': '⊗', '\\odot': '⊙',
      };
      return commands[match] || '';
    })
    .replace(/\{([^}]*)\}/g, '$1')
    .trim();
};

// Shorten domain/topic names by removing parenthetical content for cleaner display
const getShortName = (name: string): string => {
  const parenIndex = name.indexOf('(');
  if (parenIndex > 0) {
    return name.substring(0, parenIndex).trim();
  }
  return name;
};

// Add appropriate article (a/an) before a term for proper grammar
const withArticle = (term: string): string => {
  if (!term || term.length === 0) return term;
  const vowels = ['a', 'e', 'i', 'o', 'u'];
  const firstChar = term[0].toLowerCase();
  const article = vowels.includes(firstChar) ? 'an' : 'a';
  return `${article} ${term}`;
};

// Relationship labels
const RELATIONSHIP_LABELS = [
  'maps to',
  'corresponds to',
  'is like',
  'functions as',
  'represents',
  'parallels',
  'mirrors',
  'aligns with'
];

// Dynamic explanation templates - now with narrative mini-stories
const generateDynamicExplanation = (
  analogyTerm: string,
  techTerm: string,
  domainName: string,
  topicName: string,
  index: number
): string => {
  const explanationTemplates = [
    `Imagine you're watching ${domainName} unfold. The ${analogyTerm} is the moment everything clicks—players read each other, timing aligns perfectly, and what looked chaotic becomes coordinated brilliance. That "click" is exactly what ${techTerm} does in ${topicName}: it takes scattered pieces and reveals the hidden order beneath.`,
    `Picture a crucial moment in ${domainName} where ${analogyTerm} becomes the deciding factor. A coach scribbles it on a whiteboard, players nod in understanding, and suddenly the impossible becomes achievable. In ${topicName}, ${techTerm} is that same "aha moment"—the tool that transforms confusion into clarity.`,
    `Every ${domainName} story has a turning point where ${analogyTerm} separates the good from the great. It's the difference between reacting and anticipating. When you master ${techTerm} in ${topicName}, you gain that same edge—you stop chasing and start predicting.`,
    `In the heat of ${domainName}, ${analogyTerm} is what lets experts see patterns invisible to beginners. They don't see chaos; they see structure. That's precisely what ${techTerm} unlocks in ${topicName}—the ability to perceive order where others see only complexity.`,
    `Think of ${analogyTerm} as the language fluent ${domainName} practitioners speak without thinking. It's instinct built from understanding. ${techTerm} is the grammar of that same fluency in ${topicName}—once internalized, it becomes second nature.`,
    `In ${domainName}, ${analogyTerm} is the bridge between "knowing what to do" and "doing it automatically." Beginners calculate; experts feel. ${techTerm} serves the same role in ${topicName}: first you learn the mechanics, then they become intuition.`,
    `The beauty of ${analogyTerm} in ${domainName} is how it compresses hours of explanation into a single, elegant move. ${techTerm} achieves the same compression in ${topicName}—what takes pages to explain in words becomes a single, powerful operation.`,
    `Every master of ${domainName} knows that ${analogyTerm} isn't just a technique—it's a way of seeing. Once you understand it, you can't unsee it. ${techTerm} offers the same transformation in ${topicName}: a new lens that reveals hidden connections everywhere.`
  ];
  return explanationTemplates[index % explanationTemplates.length];
};

// Generate "Why It Matters" bullets - low complexity, analogical first-principles
const generateWhyItMatters = (
  analogyTerm: string,
  techTerm: string,
  domainName: string,
  importance: number
): { connection: string; whyImportant: string; withoutIt: string } => {
  // Connection bullet - WHY these connect
  const connectionTemplates = [
    `In ${domainName}, ${analogyTerm} and ${techTerm} solve the same core problem—just in different contexts.`,
    `Both ${analogyTerm} and ${techTerm} answer the same fundamental question: how do parts relate to the whole?`,
    `${analogyTerm} in ${domainName} behaves exactly like ${techTerm}—same structure, same purpose, different setting.`,
    `The pattern you recognize in ${analogyTerm} is the same pattern that makes ${techTerm} work.`
  ];

  // Importance bullet - WHY it matters for learning
  const importanceTemplates = importance >= 0.7
    ? [
        `This is a cornerstone concept—master it and many other ideas will click into place.`,
        `Understanding this deeply will unlock related concepts faster than studying them separately.`,
        `This mapping is foundational—it's one of the key bridges between what you know and what you're learning.`
      ]
    : importance >= 0.4
    ? [
        `This connection reinforces the core pattern—seeing it strengthens your overall understanding.`,
        `While not the main idea, this link helps cement how the whole system fits together.`,
        `This builds on what you already understand, making the new concept feel familiar.`
      ]
    : [
        `This is a supporting detail that rounds out your mental model.`,
        `A smaller piece of the puzzle, but it helps complete the picture.`,
        `This fills in the edges—not essential, but useful for full comprehension.`
      ];

  // Critical bullet - WHY the system fails without it
  const criticalTemplates = [
    `Without ${withArticle(techTerm)}, you'd lose the ability to see how individual pieces influence each other—like ${domainName} without ${withArticle(analogyTerm)}.`,
    `Remove ${withArticle(techTerm)} and the system becomes a collection of isolated facts instead of a connected understanding.`,
    `${techTerm} is the glue—without it, you can describe parts but not explain how they work together.`,
    `Skip this and you'll memorize facts but miss the "why"—like knowing ${domainName} stats without understanding strategy.`
  ];

  const seed = (analogyTerm.length + techTerm.length) % 4;
  const impSeed = Math.floor(importance * 3) % 3;

  return {
    connection: connectionTemplates[seed],
    whyImportant: importanceTemplates[impSeed],
    withoutIt: criticalTemplates[(seed + 1) % 4]
  };
};

export const ConstellationMode: React.FC<ConstellationModeProps> = ({
  conceptMap,
  importanceMap,
  isDarkMode,
  onClose,
  domainName = 'Your Expertise',
  topicName = 'New Topic',
  renderRichText,
  onFetchFoundationalMapping
}) => {
  const [selectedConcept, setSelectedConcept] = useState<number | null>(null);
  const [hoveredConcept, setHoveredConcept] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showCausalMechanics, setShowCausalMechanics] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Foundational mapping cache (pre-generated on mount)
  const [foundationalMappingCache, setFoundationalMappingCache] = useState<Map<number, string>>(new Map());

  // Mobile responsive
  const isMobile = useMobile();

  // Get importance for a concept
  const getConceptImportance = useCallback((concept: ConceptMapItem): number => {
    const techTerm = cleanLabel(concept.tech_term).toLowerCase();
    const analogyTerm = cleanLabel(concept.analogy_term).toLowerCase();
    for (const imp of importanceMap) {
      const term = imp.term.toLowerCase();
      if (term.includes(techTerm) || techTerm.includes(term) ||
          term.includes(analogyTerm) || analogyTerm.includes(term)) {
        return imp.importance;
      }
    }
    return 0.5;
  }, [importanceMap]);

  // Build concept data with colors and importance
  const conceptData = conceptMap.map((concept, index) => ({
    concept,
    index,
    importance: getConceptImportance(concept),
    color: CONCEPT_COLORS[index % CONCEPT_COLORS.length],
    relationshipLabel: RELATIONSHIP_LABELS[index % RELATIONSHIP_LABELS.length]
  }));

  // Handle concept click
  const handleConceptClick = (conceptId: number) => {
    if (selectedConcept === conceptId) {
      setShowExplanation(!showExplanation);
    } else {
      setSelectedConcept(conceptId);
      setShowExplanation(true);
    }
  };

  // Get selected concept data
  const selectedConceptData = selectedConcept !== null
    ? conceptData.find(c => c.concept.id === selectedConcept)
    : null;

  // Handle Escape key - minimize fullscreen first, then close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullScreen) {
          setIsFullScreen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, isFullScreen]);

  // Pre-generate foundational mappings for ALL concepts on mount
  useEffect(() => {
    if (!onFetchFoundationalMapping || conceptData.length === 0) return;

    let isCancelled = false;

    // Fetch all mappings in parallel
    conceptData.forEach((item) => {
      const conceptId = item.concept.id;

      // Skip if already cached
      if (foundationalMappingCache.has(conceptId)) return;

      onFetchFoundationalMapping(
        cleanLabel(item.concept.tech_term),
        cleanLabel(item.concept.analogy_term),
        domainName,
        topicName,
        item.importance
      ).then((result) => {
        if (isCancelled) return;
        if (result.foundationalMapping) {
          setFoundationalMappingCache(prev => new Map(prev).set(conceptId, result.foundationalMapping));
        }
      }).catch(() => {
        // Silently fail - will use fallback
      });
    });

    return () => {
      isCancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFetchFoundationalMapping, domainName, topicName]);

  return (
    <div className={`fixed inset-0 z-[80] flex flex-col signal-font ${
      isDarkMode
        ? 'bg-gradient-to-br from-neutral-800 via-neutral-850 to-neutral-900'
        : 'bg-gradient-to-br from-slate-50 via-neutral-100 to-blue-50'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b backdrop-blur-sm ${
        isDarkMode
          ? 'border-neutral-600 bg-neutral-800/90'
          : 'border-neutral-200 bg-white/80'
      }`}>
        <div className="flex items-center gap-2 md:gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Layers className="text-blue-500" size={isMobile ? 20 : 24} />
            <h2 className={`text-base md:text-xl font-bold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>Knowledge Bridge</h2>
          </div>
          {/* Domain badges - hidden on small mobile, shown on larger screens */}
          <div className="hidden xs:flex items-center gap-2 text-xs md:text-sm">
            <span className={`px-2 md:px-3 py-1 rounded-full font-medium truncate max-w-[200px] ${
              isDarkMode ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'
            }`}>
              {getShortName(domainName)}
            </span>
            <ArrowRight size={14} className={`hidden md:block ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`} />
            <span className={`px-2 md:px-3 py-1 rounded-full font-medium truncate max-w-[200px] ${
              isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
            }`}>
              {getShortName(topicName)}
            </span>
          </div>
          <span className={`text-xs md:text-sm ml-2 md:ml-4 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
            {conceptMap.length} concept mappings
          </span>
        </div>
        <button
          onClick={onClose}
          className={`p-2 min-w-touch min-h-touch flex items-center justify-center rounded-lg transition-colors ${
            isDarkMode
              ? 'bg-neutral-700 text-neutral-300 hover:bg-red-500 hover:text-white'
              : 'bg-neutral-200 text-neutral-600 hover:bg-red-500 hover:text-white'
          }`}
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Bridge Visualization - Hidden when fullscreen on desktop */}
        {(!isFullScreen || isMobile) && (
        <div
          ref={containerRef}
          className={`flex-1 p-4 md:p-8 overflow-y-auto ${
            !isMobile && showExplanation && selectedConceptData ? 'md:w-2/3' : 'w-full'
          } transition-all duration-500 ${
            isMobile && showExplanation ? 'pb-[65vh]' : ''
          }`}
        >
          {/* Column Headers */}
          <div className="flex justify-between mb-4 md:mb-8 px-2 md:px-4">
            <div className="flex items-center gap-2 md:gap-3">
              <Sparkles className={isDarkMode ? 'text-amber-400' : 'text-amber-500'} size={isMobile ? 18 : 24} />
              <div>
                <h3 className={`font-bold text-sm md:text-lg ${isDarkMode ? 'text-amber-300' : 'text-amber-600'}`}>What You Know</h3>
                <p className={`text-xs md:text-sm hidden xs:block ${isDarkMode ? 'text-amber-400/60' : 'text-amber-500/70'}`}>{getShortName(domainName)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <div className="text-right">
                <h3 className={`font-bold text-sm md:text-lg ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>What You're Learning</h3>
                <p className={`text-xs md:text-sm hidden xs:block ${isDarkMode ? 'text-blue-400/60' : 'text-blue-500/70'}`}>{getShortName(topicName)}</p>
              </div>
              <BookOpen className={isDarkMode ? 'text-blue-400' : 'text-blue-500'} size={isMobile ? 18 : 24} />
            </div>
          </div>

          {/* Concept Bridges */}
          <div className="space-y-3 md:space-y-4">
            {conceptData.map((data) => {
              const isSelected = selectedConcept === data.concept.id;
              const isHovered = hoveredConcept === data.concept.id;
              const isActive = isSelected || isHovered;
              const otherSelected = selectedConcept !== null && !isSelected;

              return (
                <div
                  key={data.concept.id}
                  className={`relative flex items-center transition-all duration-300 ${
                    otherSelected && !isActive ? 'opacity-30' : 'opacity-100'
                  }`}
                  onMouseEnter={() => !isMobile && setHoveredConcept(data.concept.id)}
                  onMouseLeave={() => !isMobile && setHoveredConcept(null)}
                  onClick={() => handleConceptClick(data.concept.id)}
                >
                  {/* Left Pill (Analogy/Expertise) */}
                  <div
                    className={`flex-shrink-0 px-3 md:px-5 py-2 md:py-3 rounded-xl cursor-pointer transition-all duration-300 max-w-[38%] md:max-w-[40%] min-h-touch ${
                      isActive ? 'scale-105 md:scale-105' : 'hover:scale-102 active:scale-95'
                    }`}
                    style={{
                      backgroundColor: isActive ? data.color + '35' : (isDarkMode ? 'rgba(251, 191, 36, 0.15)' : 'rgba(251, 191, 36, 0.2)'),
                      border: `2px solid ${isActive ? data.color : (isDarkMode ? 'rgba(251, 191, 36, 0.5)' : 'rgba(217, 119, 6, 0.5)')}`,
                      boxShadow: isActive ? `0 4px 20px ${data.color}50` : undefined
                    }}
                  >
                    <span className={`font-semibold text-sm md:text-base truncate block ${
                      isActive
                        ? (isDarkMode ? 'text-white' : 'text-neutral-900')
                        : (isDarkMode ? 'text-amber-100' : 'text-amber-800')
                    }`}>
                      {cleanLabel(data.concept.analogy_term)}
                    </span>
                  </div>

                  {/* Bridge Line with Label - Single continuous line */}
                  <div className="flex-1 flex items-center justify-center relative min-w-[60px] md:min-w-[120px]">
                    {/* Single connecting line - properly contained */}
                    <div
                      className="absolute left-0 right-0 h-px top-1/2 -translate-y-1/2"
                      style={{
                        background: isActive
                          ? data.color
                          : (isDarkMode
                              ? 'linear-gradient(90deg, rgba(251, 191, 36, 0.4), rgba(96, 165, 250, 0.4))'
                              : 'linear-gradient(90deg, rgba(217, 119, 6, 0.5), rgba(37, 99, 235, 0.5))')
                      }}
                    />

                    {/* Animated dot on hover (desktop) or selected (mobile) */}
                    {((isHovered && !isMobile) || (isSelected && isMobile)) && (
                      <div
                        className="absolute w-2 h-2 rounded-full animate-bridge-flow z-10"
                        style={{ backgroundColor: data.color, boxShadow: `0 0 8px ${data.color}` }}
                      />
                    )}

                    {/* Relationship Label - hidden on mobile, sits on top of line */}
                    <span
                      className={`relative z-10 px-2 md:px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 border hidden xs:inline ${
                        isActive
                          ? (isDarkMode ? 'bg-neutral-800 text-white border-neutral-600' : 'bg-white text-neutral-800 border-neutral-300')
                          : (isDarkMode ? 'bg-neutral-800 text-neutral-400 border-neutral-700' : 'bg-white text-neutral-500 border-neutral-300')
                      }`}
                    >
                      {data.relationshipLabel}
                    </span>
                  </div>

                  {/* Right Pill (Tech/Learning) */}
                  <div
                    className={`flex-shrink-0 px-3 md:px-5 py-2 md:py-3 rounded-xl cursor-pointer transition-all duration-300 max-w-[38%] md:max-w-[40%] min-h-touch ${
                      isActive ? 'scale-105 md:scale-105' : 'hover:scale-102 active:scale-95'
                    }`}
                    style={{
                      backgroundColor: isActive ? data.color + '35' : (isDarkMode ? 'rgba(96, 165, 250, 0.15)' : 'rgba(59, 130, 246, 0.15)'),
                      border: `2px solid ${isActive ? data.color : (isDarkMode ? 'rgba(96, 165, 250, 0.5)' : 'rgba(37, 99, 235, 0.5)')}`,
                      boxShadow: isActive ? `0 4px 20px ${data.color}50` : undefined
                    }}
                  >
                    <span className={`font-semibold text-sm md:text-base truncate block ${
                      isActive
                        ? (isDarkMode ? 'text-white' : 'text-neutral-900')
                        : (isDarkMode ? 'text-blue-100' : 'text-blue-800')
                    }`}>
                      {cleanLabel(data.concept.tech_term)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* Explanation Panel - Desktop: Side Panel | Mobile: Bottom Sheet */}
        {showExplanation && selectedConceptData && (
          <div className={`
            ${isMobile
              ? 'fixed bottom-0 left-0 right-0 max-h-[75vh] rounded-t-2xl animate-slide-up z-[90] pb-safe-bottom'
              : (isFullScreen ? 'w-full' : 'w-1/3 border-l')
            }
            ${isDarkMode ? 'border-neutral-600 bg-neutral-800/98' : 'border-neutral-200 bg-white/98'}
            ${isFullScreen && !isMobile ? 'overflow-visible' : 'overflow-hidden'} transition-all duration-300
          `}>
            {/* Mobile Drag Handle */}
            {isMobile && (
              <div className="flex justify-center pt-2 pb-1">
                <div className={`w-10 h-1 rounded-full ${isDarkMode ? 'bg-neutral-600' : 'bg-neutral-300'}`} />
              </div>
            )}

            {/* Panel Header */}
            <div className={`sticky top-0 px-4 md:px-6 py-3 md:py-4 border-b ${
              isDarkMode ? 'border-neutral-600 bg-neutral-800' : 'border-neutral-200 bg-white'
            }`}>
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <h3 className={`font-bold text-base md:text-lg ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>Deep Dive</h3>
                <div className="flex items-center gap-2">
                  {/* Maximize/Minimize Button - Desktop only */}
                  {!isMobile && (
                    <button
                      onClick={() => setIsFullScreen(!isFullScreen)}
                      className={`p-2 min-w-touch min-h-touch flex items-center justify-center rounded-lg transition-colors ${
                        isDarkMode
                          ? 'text-neutral-400 hover:bg-neutral-700 hover:text-white'
                          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800'
                      }`}
                      title={isFullScreen ? 'Minimize' : 'Maximize'}
                    >
                      {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                  )}
                  {/* Close Button */}
                  <button
                    onClick={() => {
                      if (isFullScreen && !isMobile) {
                        setIsFullScreen(false);
                      } else {
                        setShowExplanation(false);
                      }
                    }}
                    className={`p-2 min-w-touch min-h-touch flex items-center justify-center rounded-lg transition-colors ${
                      isDarkMode
                        ? 'text-neutral-400 hover:bg-red-500/80 hover:text-white'
                        : 'text-neutral-500 hover:bg-red-500 hover:text-white'
                    }`}
                    title={isFullScreen ? 'Back to split view' : 'Close panel'}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 md:w-4 md:h-4 rounded-full"
                  style={{ backgroundColor: selectedConceptData.color }}
                />
                <span className={`text-xs md:text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  Mapping {selectedConceptData.index + 1} of {conceptMap.length}
                </span>
              </div>
            </div>

            {/* Concept Comparison - Scrollable content area */}
            <div className={`p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto pb-safe ${
              isMobile ? 'max-h-[calc(75vh-80px)]' : 'max-h-[calc(100vh-140px)]'
            } ${isFullScreen && !isMobile ? 'max-w-6xl mx-auto px-8' : ''}`}>
              {/* Expertise Term */}
              <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-amber-900/30 border border-amber-700/60' : 'bg-amber-50 border border-amber-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className={isDarkMode ? 'text-amber-400' : 'text-amber-500'} size={16} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-amber-200' : 'text-amber-600'}`}>
                    What You Know
                  </span>
                </div>
                <p className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
                  {cleanLabel(selectedConceptData.concept.analogy_term)}
                </p>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
                  isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'
                }`}>
                  <ChevronRight className={isDarkMode ? 'text-neutral-500' : 'text-neutral-400'} size={16} />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    {selectedConceptData.relationshipLabel}
                  </span>
                  <ChevronRight className={isDarkMode ? 'text-neutral-500' : 'text-neutral-400'} size={16} />
                </div>
              </div>

              {/* Learning Term */}
              <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-blue-900/30 border border-blue-700/60' : 'bg-blue-50 border border-blue-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className={isDarkMode ? 'text-blue-400' : 'text-blue-500'} size={16} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-blue-200' : 'text-blue-600'}`}>
                    What You're Learning
                  </span>
                </div>
                <p className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
                  {cleanLabel(selectedConceptData.concept.tech_term)}
                </p>
              </div>

              {/* Six-Word Definition */}
              {selectedConceptData.concept.six_word_definition && (
                <div className={`text-center py-3 px-4 rounded-lg border ${
                  isDarkMode ? 'bg-neutral-700/40 border-neutral-600/50' : 'bg-neutral-100 border-neutral-200'
                }`}>
                  <p className={`text-sm italic ${isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}`}>
                    "{selectedConceptData.concept.six_word_definition}"
                  </p>
                </div>
              )}

              {/* Importance Meter */}
              <div className={`p-4 rounded-xl border ${
                isDarkMode ? 'bg-neutral-700/50 border-neutral-600' : 'bg-neutral-50 border-neutral-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Concept Importance</span>
                  <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
                    {Math.round(selectedConceptData.importance * 100)}%
                  </span>
                </div>
                <div className={`h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-neutral-600' : 'bg-neutral-200'}`}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${selectedConceptData.importance * 100}%`,
                      backgroundColor: selectedConceptData.color
                    }}
                  />
                </div>
              </div>

              {/* Why It Matters - First Principles Bullets */}
              {(() => {
                // Use API-generated bullets if available, fallback to template
                const apiWhy = selectedConceptData.concept.why_it_matters;
                const fallbackBullets = generateWhyItMatters(
                  cleanLabel(selectedConceptData.concept.analogy_term),
                  cleanLabel(selectedConceptData.concept.tech_term),
                  domainName,
                  selectedConceptData.importance
                );
                // Get cached foundational mapping (pre-generated on mount)
                const cachedFoundational = foundationalMappingCache.get(selectedConceptData.concept.id);
                const bullets = {
                  connection: apiWhy?.connection || fallbackBullets.connection,
                  // Use cached API-generated foundational mapping, then inline API, then fallback
                  whyImportant: cachedFoundational || apiWhy?.importance || fallbackBullets.whyImportant,
                  withoutIt: apiWhy?.critical || fallbackBullets.withoutIt
                };
                return (
                  <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-emerald-800/30 border border-emerald-600/50' : 'bg-emerald-50 border border-emerald-200'}`}>
                    <h4 className={`font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
                      <Lightbulb size={16} className={isDarkMode ? 'text-emerald-400' : 'text-emerald-500'} />
                      Why It Matters
                    </h4>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2">
                        <span className={`mt-0.5 text-lg leading-none ${isDarkMode ? 'text-emerald-400' : 'text-emerald-500'}`}>•</span>
                        <span className={`text-sm leading-relaxed ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                          {bullets.connection}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={`mt-0.5 text-lg leading-none ${isDarkMode ? 'text-emerald-400' : 'text-emerald-500'}`}>•</span>
                        <span className={`text-sm leading-relaxed ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                          {bullets.whyImportant}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={`mt-0.5 text-lg leading-none ${isDarkMode ? 'text-emerald-400' : 'text-emerald-500'}`}>•</span>
                        <span className={`text-sm leading-relaxed ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                          {bullets.withoutIt}
                        </span>
                      </li>
                    </ul>
                  </div>
                );
              })()}

              {/* Why This Works - Now uses AI-generated narrative_mapping */}
              <div className={`p-4 rounded-xl border ${
                isDarkMode
                  ? 'bg-gradient-to-br from-neutral-700/80 to-neutral-800/80 border-neutral-600'
                  : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-100'
              }`}>
                <h4 className={`font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
                  <Layers size={16} className={isDarkMode ? 'text-purple-400' : 'text-purple-500'} />
                  Why This Works
                </h4>
                <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                  {selectedConceptData.concept.narrative_mapping || generateDynamicExplanation(
                    cleanLabel(selectedConceptData.concept.analogy_term),
                    cleanLabel(selectedConceptData.concept.tech_term),
                    domainName,
                    topicName,
                    selectedConceptData.index
                  )}
                </p>
              </div>

              {/* Causal Mechanics Accordion */}
              {selectedConceptData.concept.causal_explanation && (
                <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'border-neutral-600' : 'border-neutral-200'}`}>
                  <button
                    onClick={() => setShowCausalMechanics(!showCausalMechanics)}
                    className={`w-full p-4 flex items-center justify-between transition-colors ${
                      isDarkMode ? 'bg-neutral-700/50 hover:bg-neutral-700/70' : 'bg-neutral-50 hover:bg-neutral-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Atom size={16} className={isDarkMode ? 'text-cyan-400' : 'text-cyan-500'} />
                      <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>Causal Mechanics</span>
                    </div>
                    {showCausalMechanics ? (
                      <ChevronUp size={18} className={isDarkMode ? 'text-neutral-400' : 'text-neutral-500'} />
                    ) : (
                      <ChevronDown size={18} className={isDarkMode ? 'text-neutral-400' : 'text-neutral-500'} />
                    )}
                  </button>
                  {showCausalMechanics && (
                    <div className={`p-4 border-t ${isDarkMode ? 'bg-neutral-800/50 border-neutral-600' : 'bg-white border-neutral-200'}`}>
                      <div className={`text-sm leading-relaxed ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                        {renderRichText
                          ? renderRichText(selectedConceptData.concept.causal_explanation || '', isDarkMode ? 'text-neutral-300' : 'text-neutral-700')
                          : selectedConceptData.concept.causal_explanation
                        }
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className={`text-center text-xs pt-4 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                {isFullScreen
                  ? 'Press minimize or ESC to return to split view'
                  : 'Click other concepts to explore more mappings'
                }
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`px-4 md:px-6 py-3 border-t pb-safe ${
        isDarkMode ? 'border-neutral-600 bg-neutral-800/90' : 'border-neutral-200 bg-white/90'
      }`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs md:text-sm ${isDarkMode ? 'text-amber-200/70' : 'text-amber-600/80'}`}>
            {isMobile ? 'Tap any mapping to explore' : 'Click any mapping to explore the connection in depth'}
          </span>
          <span className={`text-xs hidden md:inline ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Press Esc to close
          </span>
        </div>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes bridge-flow {
          0% { left: 10%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: 90%; opacity: 0; }
        }
        .animate-bridge-flow {
          animation: bridge-flow 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default ConstellationMode;
