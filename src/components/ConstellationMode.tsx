import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, ArrowRight, Sparkles, BookOpen, ChevronRight, Layers, Maximize2, Minimize2, ChevronDown, ChevronUp, Atom, Lightbulb, GitBranch } from 'lucide-react';

// Mobile detection hook
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

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
  renderRichText
}) => {
  const [selectedConcept, setSelectedConcept] = useState<number | null>(null);
  const [hoveredConcept, setHoveredConcept] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showCausalMechanics, setShowCausalMechanics] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mobile responsive
  const isMobile = useIsMobile();

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

  return (
    <div className="fixed inset-0 z-[80] bg-gradient-to-br from-neutral-900 via-neutral-950 to-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-neutral-700 bg-neutral-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 md:gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Layers className="text-blue-400" size={isMobile ? 20 : 24} />
            <h2 className="text-white text-base md:text-xl font-bold">Knowledge Bridge</h2>
          </div>
          {/* Domain badges - hidden on small mobile, shown on larger screens */}
          <div className="hidden xs:flex items-center gap-2 text-neutral-400 text-xs md:text-sm">
            <span className="px-2 md:px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-medium truncate max-w-[200px]">
              {getShortName(domainName)}
            </span>
            <ArrowRight size={14} className="hidden md:block" />
            <span className="px-2 md:px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 font-medium truncate max-w-[200px]">
              {getShortName(topicName)}
            </span>
          </div>
          <span className="hidden md:inline text-neutral-300 text-sm ml-4">
            {conceptMap.length} concept mappings
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 min-w-touch min-h-touch flex items-center justify-center rounded-lg bg-neutral-800 text-neutral-300 hover:bg-red-500 hover:text-white transition-colors"
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
              <Sparkles className="text-amber-400" size={isMobile ? 18 : 24} />
              <div>
                <h3 className="text-amber-300 font-bold text-sm md:text-lg">What You Know</h3>
                <p className="text-amber-400/60 text-xs md:text-sm hidden xs:block">{getShortName(domainName)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <div className="text-right">
                <h3 className="text-blue-300 font-bold text-sm md:text-lg">What You're Learning</h3>
                <p className="text-blue-400/60 text-xs md:text-sm hidden xs:block">{getShortName(topicName)}</p>
              </div>
              <BookOpen className="text-blue-400" size={isMobile ? 18 : 24} />
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
                      isActive ? 'scale-105 md:scale-105' : 'hover:scale-102'
                    }`}
                    style={{
                      backgroundColor: isActive ? data.color + '35' : 'rgba(251, 191, 36, 0.15)',
                      border: `2px solid ${isActive ? data.color : 'rgba(251, 191, 36, 0.5)'}`,
                      boxShadow: isActive ? `0 4px 20px ${data.color}50` : undefined
                    }}
                  >
                    <span className={`font-semibold text-sm md:text-base ${isActive ? 'text-white' : 'text-amber-100'}`}>
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
                          : 'linear-gradient(90deg, rgba(251, 191, 36, 0.4), rgba(96, 165, 250, 0.4))'
                      }}
                    />

                    {/* Animated dot on hover - desktop only */}
                    {isHovered && !isMobile && (
                      <div
                        className="absolute w-2 h-2 rounded-full animate-bridge-flow z-10"
                        style={{ backgroundColor: data.color, boxShadow: `0 0 8px ${data.color}` }}
                      />
                    )}

                    {/* Relationship Label - hidden on mobile, sits on top of line */}
                    <span
                      className={`relative z-10 px-2 md:px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 border hidden xs:inline ${
                        isActive
                          ? 'bg-neutral-900 text-white border-neutral-600'
                          : 'bg-neutral-900 text-neutral-400 border-neutral-700'
                      }`}
                    >
                      {data.relationshipLabel}
                    </span>
                  </div>

                  {/* Right Pill (Tech/Learning) */}
                  <div
                    className={`flex-shrink-0 px-3 md:px-5 py-2 md:py-3 rounded-xl cursor-pointer transition-all duration-300 max-w-[38%] md:max-w-[40%] min-h-touch ${
                      isActive ? 'scale-105 md:scale-105' : 'hover:scale-102'
                    }`}
                    style={{
                      backgroundColor: isActive ? data.color + '35' : 'rgba(96, 165, 250, 0.15)',
                      border: `2px solid ${isActive ? data.color : 'rgba(96, 165, 250, 0.5)'}`,
                      boxShadow: isActive ? `0 4px 20px ${data.color}50` : undefined
                    }}
                  >
                    <span className={`font-semibold text-sm md:text-base ${isActive ? 'text-white' : 'text-blue-100'}`}>
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
              ? 'fixed bottom-0 left-0 right-0 h-[60vh] rounded-t-2xl animate-slide-up z-[90]'
              : (isFullScreen ? 'w-full' : 'w-1/3 border-l')
            }
            border-neutral-700 bg-neutral-900/95 ${isFullScreen && !isMobile ? 'overflow-visible' : 'overflow-hidden'} transition-all duration-300
          `}>
            {/* Mobile Drag Handle */}
            {isMobile && (
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 bg-neutral-600 rounded-full" />
              </div>
            )}

            {/* Panel Header */}
            <div className="sticky top-0 px-4 md:px-6 py-3 md:py-4 border-b border-neutral-700 bg-neutral-900">
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <h3 className="text-white font-bold text-base md:text-lg">Deep Dive</h3>
                <div className="flex items-center gap-2">
                  {/* Maximize/Minimize Button - Desktop only */}
                  {!isMobile && (
                    <button
                      onClick={() => setIsFullScreen(!isFullScreen)}
                      className="p-2 min-w-touch min-h-touch flex items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-700 hover:text-white transition-colors"
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
                    className="p-2 min-w-touch min-h-touch flex items-center justify-center rounded-lg text-neutral-400 hover:bg-red-500/80 hover:text-white transition-colors"
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
                <span className="text-neutral-300 text-xs md:text-sm">
                  Mapping {selectedConceptData.index + 1} of {conceptMap.length}
                </span>
              </div>
            </div>

            {/* Concept Comparison - Scrollable content area */}
            <div className={`p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto pb-safe ${
              isMobile ? 'max-h-[calc(60vh-80px)]' : 'max-h-[calc(100vh-140px)]'
            } ${isFullScreen && !isMobile ? 'max-w-6xl mx-auto px-8' : ''}`}>
              {/* Expertise Term */}
              <div className="p-4 rounded-xl bg-amber-900/30 border border-amber-700/60">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="text-amber-400" size={16} />
                  <span className="text-amber-200 text-xs font-bold uppercase tracking-wider">
                    What You Know
                  </span>
                </div>
                <p className="text-white text-xl font-semibold">
                  {cleanLabel(selectedConceptData.concept.analogy_term)}
                </p>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-800 border border-neutral-700">
                  <ChevronRight className="text-neutral-500" size={16} />
                  <span className="text-neutral-400 text-sm font-medium">
                    {selectedConceptData.relationshipLabel}
                  </span>
                  <ChevronRight className="text-neutral-500" size={16} />
                </div>
              </div>

              {/* Learning Term */}
              <div className="p-4 rounded-xl bg-blue-900/30 border border-blue-700/60">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="text-blue-400" size={16} />
                  <span className="text-blue-200 text-xs font-bold uppercase tracking-wider">
                    What You're Learning
                  </span>
                </div>
                <p className="text-white text-xl font-semibold">
                  {cleanLabel(selectedConceptData.concept.tech_term)}
                </p>
              </div>

              {/* Six-Word Definition */}
              {selectedConceptData.concept.six_word_definition && (
                <div className="text-center py-3 px-4 rounded-lg bg-neutral-800/40 border border-neutral-700/50">
                  <p className="text-neutral-200 text-sm italic">
                    "{selectedConceptData.concept.six_word_definition}"
                  </p>
                </div>
              )}

              {/* Importance Meter */}
              <div className="p-4 rounded-xl bg-neutral-800/50 border border-neutral-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-neutral-400 text-sm">Concept Importance</span>
                  <span className="text-white font-bold">
                    {Math.round(selectedConceptData.importance * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
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
                const bullets = {
                  connection: apiWhy?.connection || fallbackBullets.connection,
                  whyImportant: apiWhy?.importance || fallbackBullets.whyImportant,
                  withoutIt: apiWhy?.critical || fallbackBullets.withoutIt
                };
                return (
                  <div className="p-4 rounded-xl bg-emerald-800/30 border border-emerald-600/50">
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Lightbulb size={16} className="text-emerald-400" />
                      Why It Matters
                    </h4>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-0.5 text-lg leading-none">•</span>
                        <span className="text-neutral-300 text-sm leading-relaxed">
                          {bullets.connection}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-0.5 text-lg leading-none">•</span>
                        <span className="text-neutral-300 text-sm leading-relaxed">
                          {bullets.whyImportant}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-0.5 text-lg leading-none">•</span>
                        <span className="text-neutral-300 text-sm leading-relaxed">
                          {bullets.withoutIt}
                        </span>
                      </li>
                    </ul>
                  </div>
                );
              })()}

              {/* Concept Mapping Visualization */}
              <div className="p-4 rounded-xl bg-neutral-800/50 border border-neutral-700">
                <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <GitBranch size={16} className="text-blue-400" />
                  Mapping Visualization
                </h4>
                <svg viewBox="0 0 400 100" className="w-full h-auto">
                  {/* Analogy Term Box (Amber) */}
                  <rect x="10" y="15" width="150" height="45" rx="8"
                        fill="rgba(251, 191, 36, 0.2)" stroke="rgb(251, 191, 36)" strokeWidth="2"/>
                  <text x="85" y="43" textAnchor="middle" fill="#fbbf24" fontSize="13" fontWeight="600">
                    {cleanLabel(selectedConceptData.concept.analogy_term).length > 18
                      ? cleanLabel(selectedConceptData.concept.analogy_term).substring(0, 16) + '...'
                      : cleanLabel(selectedConceptData.concept.analogy_term)}
                  </text>

                  {/* Arrow with label */}
                  <line x1="160" y1="37" x2="230" y2="37" stroke="#6b7280" strokeWidth="2"/>
                  <polygon points="230,37 220,32 220,42" fill="#6b7280"/>
                  <text x="195" y="28" textAnchor="middle" fill="#9ca3af" fontSize="9">
                    {selectedConceptData.relationshipLabel}
                  </text>

                  {/* Tech Term Box (Blue) */}
                  <rect x="240" y="15" width="150" height="45" rx="8"
                        fill="rgba(59, 130, 246, 0.2)" stroke="rgb(59, 130, 246)" strokeWidth="2"/>
                  <text x="315" y="43" textAnchor="middle" fill="#3b82f6" fontSize="13" fontWeight="600">
                    {cleanLabel(selectedConceptData.concept.tech_term).length > 18
                      ? cleanLabel(selectedConceptData.concept.tech_term).substring(0, 16) + '...'
                      : cleanLabel(selectedConceptData.concept.tech_term)}
                  </text>

                  {/* Domain labels below */}
                  <text x="85" y="78" textAnchor="middle" fill="#78716c" fontSize="10" fontStyle="italic">
                    {getShortName(domainName).length > 20
                      ? getShortName(domainName).substring(0, 18) + '...'
                      : getShortName(domainName)}
                  </text>
                  <text x="315" y="78" textAnchor="middle" fill="#78716c" fontSize="10" fontStyle="italic">
                    {getShortName(topicName).length > 20
                      ? getShortName(topicName).substring(0, 18) + '...'
                      : getShortName(topicName)}
                  </text>
                </svg>
              </div>

              {/* Why This Works - Now uses AI-generated narrative_mapping */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-neutral-800/80 to-neutral-900/80 border border-neutral-700">
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Layers size={16} className="text-purple-400" />
                  Why This Works
                </h4>
                <p className="text-neutral-300 text-sm leading-relaxed">
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
                <div className="rounded-xl border border-neutral-700 overflow-hidden">
                  <button
                    onClick={() => setShowCausalMechanics(!showCausalMechanics)}
                    className="w-full p-4 flex items-center justify-between bg-neutral-800/50 hover:bg-neutral-800/70 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Atom size={16} className="text-cyan-400" />
                      <span className="text-white font-semibold">Causal Mechanics</span>
                    </div>
                    {showCausalMechanics ? (
                      <ChevronUp size={18} className="text-neutral-400" />
                    ) : (
                      <ChevronDown size={18} className="text-neutral-400" />
                    )}
                  </button>
                  {showCausalMechanics && (
                    <div className="p-4 bg-neutral-900/50 border-t border-neutral-700">
                      <div className="text-neutral-300 text-sm leading-relaxed">
                        {renderRichText
                          ? renderRichText(selectedConceptData.concept.causal_explanation || '', 'text-neutral-300')
                          : selectedConceptData.concept.causal_explanation
                        }
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="text-center text-neutral-300 text-xs pt-4">
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
      <div className="px-4 md:px-6 py-3 border-t border-neutral-700 bg-neutral-900/80 pb-safe">
        <div className="flex items-center justify-between">
          <span className="text-amber-200/70 text-xs md:text-sm">
            {isMobile ? 'Tap any mapping to explore' : 'Click any mapping to explore the connection in depth'}
          </span>
          <span className="text-neutral-300 text-xs hidden md:inline">
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
