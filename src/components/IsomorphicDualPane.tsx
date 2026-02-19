import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Columns, Zap, ChevronRight, Lightbulb, BookOpen, Sparkles } from 'lucide-react';
import { ConceptMapItem, ImportanceMapItem } from '../types';
import { useMobile } from '../hooks/useMobile';

type MobilePane = 'tech' | 'connection' | 'analogy';

// Generate dynamic "Why This Works" bullet points based on actual concept characteristics
const generateWhyBullets = (
  techTerm: string,
  analogyTerm: string,
  domain: string,
  importance: number,
  index: number
): string[] => {
  // Different insight patterns based on importance level and concept index
  const highImportanceInsights = [
    `"${analogyTerm}" is a cornerstone concept in ${domain}—${techTerm} plays the exact same structural role in technical systems`,
    `Experts in ${domain} rely on ${analogyTerm} instinctively; this same instinct directly applies to understanding ${techTerm}`,
    `The way ${analogyTerm} constrains decisions in ${domain} mirrors how ${techTerm} constrains technical design`,
  ];

  const mediumImportanceInsights = [
    `${analogyTerm} and ${techTerm} solve the same fundamental problem in their respective domains`,
    `Your mental model for "${analogyTerm}" already contains the logic needed to reason about ${techTerm}`,
    `Both concepts answer "how do we handle complexity?" in remarkably similar ways`,
  ];

  const lowImportanceInsights = [
    `${analogyTerm} provides intuitive vocabulary for what ${techTerm} describes formally`,
    `The patterns you recognize in ${analogyTerm} are the same patterns ${techTerm} captures mathematically`,
    `Understanding ${analogyTerm} gives you a head start—${techTerm} just adds precision`,
  ];

  // Select insights based on importance
  const baseInsights = importance > 0.7
    ? highImportanceInsights
    : importance > 0.4
      ? mediumImportanceInsights
      : lowImportanceInsights;

  // Add a transfer insight
  const transferInsights = [
    `When you visualize ${analogyTerm}, you're already visualizing ${techTerm}—just with different labels`,
    `The "aha moment" for ${techTerm} is the same one you had when ${analogyTerm} first clicked`,
    `If you can explain ${analogyTerm} to a friend, you can explain ${techTerm} to a colleague`,
    `The intuition behind ${analogyTerm} IS the intuition behind ${techTerm}`,
  ];

  return [
    baseInsights[index % baseInsights.length],
    transferInsights[(index + 1) % transferInsights.length],
    `This isn't analogy as decoration—it's structural equivalence. ${techTerm} and ${analogyTerm} are isomorphic.`,
  ];
};

// Generate bridge narrative
const generateBridgeNarrative = (
  techTerm: string,
  analogyTerm: string,
  domain: string,
  index: number
): string => {
  const narratives = [
    `Just as ${analogyTerm} shapes how experts think in ${domain}, ${techTerm} serves the same foundational role in technical work. The insight you've built from experience transfers directly—you're not learning something new, you're translating something you already know.`,
    `In ${domain}, ${analogyTerm} is the invisible framework behind every great decision. ${techTerm} works the same way mathematically. Your intuition about ${analogyTerm} is the same intuition that powers ${techTerm}.`,
    `Think of how ${analogyTerm} connects everything in ${domain}. That connective tissue? It's ${techTerm} in disguise. Master one, and you've mastered the other.`,
    `Every time you've used ${analogyTerm} instinctively in ${domain}, you've been applying ${techTerm} without knowing it. The formal concept just gives a name to what you already understand.`,
  ];
  return narratives[index % narratives.length];
};

// Generate dynamic isomorphic insight with structural reason + transfer tip
const generateIsomorphicInsight = (
  techTerm: string,
  analogyTerm: string,
  domain: string,
  importance: number,
  index: number
): { structural: string; transferTip: string } => {
  // Structural insights - WHY the mapping works (varies by importance)
  const highImportanceStructural = [
    `Both filter noise to find signal—${analogyTerm} filters distractions in ${domain}, ${techTerm} filters data mathematically`,
    `Same decision architecture: ${analogyTerm} weighs tradeoffs in ${domain} exactly like ${techTerm} weighs parameters`,
    `Both are about pattern recognition under pressure—reading the field vs reading the data`,
    `${analogyTerm} and ${techTerm} both answer: "What's the optimal move given incomplete information?"`,
  ];

  const mediumImportanceStructural = [
    `Both organize complexity into manageable chunks—${analogyTerm} in ${domain}, ${techTerm} in code`,
    `Same underlying logic: if X happens, respond with Y—whether on the field or in the algorithm`,
    `Both concepts create structure from chaos by identifying what matters and what doesn't`,
    `${analogyTerm} and ${techTerm} are both frameworks for systematic decision-making`,
  ];

  const lowImportanceStructural = [
    `Both name the same intuition—${analogyTerm} is just the ${domain} word for ${techTerm}`,
    `Same pattern, different context: what you call ${analogyTerm} in ${domain}, engineers call ${techTerm}`,
    `The mental model is identical—only the vocabulary changes between domains`,
    `${analogyTerm} gives you the intuition; ${techTerm} gives you the precision`,
  ];

  // Transfer tips - actionable memory hooks
  const transferTips = [
    `Next time ${techTerm} feels abstract, ask: "How would I explain this as ${analogyTerm}?"`,
    `When you encounter ${techTerm} in the wild, picture it as ${analogyTerm}—same playbook`,
    `Stuck on ${techTerm}? Reframe: "What would the ${domain} equivalent look like?"`,
    `To remember ${techTerm}: it's just ${analogyTerm} wearing a lab coat`,
    `Debug ${techTerm} problems by thinking: "If this were ${analogyTerm}, what would I check first?"`,
    `Explain ${techTerm} to others using ${analogyTerm}—if they get that, they get this`,
  ];

  const structural = importance > 0.7
    ? highImportanceStructural[index % highImportanceStructural.length]
    : importance > 0.4
      ? mediumImportanceStructural[index % mediumImportanceStructural.length]
      : lowImportanceStructural[index % lowImportanceStructural.length];

  const transferTip = transferTips[(index + Math.floor(importance * 10)) % transferTips.length];

  return { structural, transferTip };
};

// Extract a short structural label from causal_explanation for bridge display
const extractBridgeLabel = (
  causalExplanation: string,
  techTerm: string,
  analogyTerm: string,
  importance: number,
  index: number
): string => {
  if (causalExplanation) {
    // Try to get first clause (before " — ", " - ", ", ", or first sentence)
    const cleaned = causalExplanation
      .replace(/^(both|they|this|it|the)\s+/i, '') // Strip weak openers
      .replace(/["""]/g, '');
    const clause = cleaned.split(/\s*[—–\-]\s*|\.\s+|,\s+/)[0]?.trim();
    if (clause && clause.length > 5 && clause.length < 60) {
      // Capitalize first letter
      return clause.charAt(0).toUpperCase() + clause.slice(1);
    }
  }
  // Fallback based on importance tier
  const labels = importance > 0.7
    ? ['Same core mechanic', 'Structural equivalent', 'Identical architecture', 'Parallel systems']
    : importance > 0.4
      ? ['Same organizing principle', 'Shared pattern', 'Parallel logic', 'Common framework']
      : ['Same vocabulary', 'Matching intuition', 'Shared concept', 'Parallel idea'];
  return labels[index % labels.length];
};

interface IsomorphicDualPaneProps {
  conceptMap: ConceptMapItem[];
  importanceMap: ImportanceMapItem[];
  isDarkMode: boolean;
  analogyDomain: string;
  domainEmoji?: string;
  onClose: () => void;
}

// Color palette for concepts
const CONCEPT_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4'
];

// Helper to strip LaTeX for display
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
        '\\geq': '≥', '\\neq': '≠', '\\approx': '≈', '\\partial': '∂',
      };
      return commands[match] || '';
    })
    .replace(/\{([^}]*)\}/g, '$1')
    .trim();
};

export const IsomorphicDualPane: React.FC<IsomorphicDualPaneProps> = ({
  conceptMap,
  importanceMap,
  isDarkMode,
  analogyDomain,
  domainEmoji = '',
  onClose
}) => {
  const [selectedConcept, setSelectedConcept] = useState<number | null>(null);
  const [hoveredConcept, setHoveredConcept] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollHighlight, setScrollHighlight] = useState<number | null>(null);

  // Mobile responsive state
  const isMobile = useMobile();
  const [mobileActivePane, setMobileActivePane] = useState<MobilePane>('tech');

  // Auto-switch to connection tab when concept is selected on mobile
  useEffect(() => {
    if (isMobile && selectedConcept !== null) {
      setMobileActivePane('connection');
    }
  }, [isMobile, selectedConcept]);

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

  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const activeConcept = selectedConcept ?? hoveredConcept;

  // Auto-scroll paired concept into view when hovering/selecting
  useEffect(() => {
    if (activeConcept === null) {
      setScrollHighlight(null);
      return;
    }

    // Find the paired elements and scroll them into view
    const techElement = containerRef.current?.querySelector(`[data-tech-id="${activeConcept}"]`);
    const analogyElement = containerRef.current?.querySelector(`[data-analogy-id="${activeConcept}"]`);

    // Scroll both elements into view with smooth animation
    if (techElement) {
      techElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (analogyElement) {
      analogyElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Trigger highlight animation
    setScrollHighlight(activeConcept);
    const timeout = setTimeout(() => setScrollHighlight(null), 1000);

    return () => clearTimeout(timeout);
  }, [activeConcept]);

  return (
    <div className="fixed inset-0 z-[80] bg-black/95 flex flex-col signal-font">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-neutral-700 bg-neutral-900">
        <div className="flex items-center gap-3 md:gap-4">
          <Columns className="text-blue-400 hidden md:block" size={24} />
          <div>
            <h2 className="text-white text-base md:text-lg font-bold">Concept Isomorphism</h2>
            <p className="text-neutral-400 text-xs md:text-sm">{conceptMap.length} mappings • Technical ↔ {analogyDomain}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 min-w-touch min-h-touch flex items-center justify-center rounded-lg bg-neutral-800 text-neutral-300 hover:bg-red-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Mobile Tab Navigation */}
      {isMobile && (
        <div className="flex border-b border-neutral-700 bg-neutral-900">
          <button
            onClick={() => setMobileActivePane('tech')}
            className={`flex-1 py-3 text-sm font-medium min-h-touch transition-colors ${
              mobileActivePane === 'tech'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-900/20'
                : 'text-neutral-400 hover:text-neutral-300'
            }`}
          >
            ⚡ Technical
          </button>
          <button
            onClick={() => setMobileActivePane('connection')}
            className={`flex-1 py-3 text-sm font-medium min-h-touch transition-colors ${
              mobileActivePane === 'connection'
                ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-900/20'
                : 'text-neutral-400 hover:text-neutral-300'
            }`}
          >
            <Zap size={14} className="inline mr-1" />
            Connection
          </button>
          <button
            onClick={() => setMobileActivePane('analogy')}
            className={`flex-1 py-3 text-sm font-medium min-h-touch transition-colors ${
              mobileActivePane === 'analogy'
                ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-900/20'
                : 'text-neutral-400 hover:text-neutral-300'
            }`}
          >
            🎯 {analogyDomain}
          </button>
        </div>
      )}

      {/* Main Content */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {/* Desktop: Three Column Layout | Mobile: Single Pane */}
        <div className="h-full flex">
          {/* Left Column - Technical Terms */}
          <div className={`
            ${isMobile
              ? (mobileActivePane === 'tech' ? 'w-full' : 'hidden')
              : (selectedConcept !== null ? 'w-[30%]' : 'w-[35%]')
            }
            p-4 md:p-6 overflow-y-auto md:border-r transition-all duration-500
            ${isDarkMode ? 'border-neutral-700 bg-neutral-900/50' : 'border-neutral-200 bg-blue-50/30'}
          `}>
            {/* Hide header on mobile since we have tabs */}
            <div className="hidden md:flex items-center gap-2 mb-6">
              <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${isDarkMode ? 'bg-blue-900/70 text-blue-200' : 'bg-blue-200 text-blue-800'}`}>
                ⚡ Technical
              </div>
            </div>

            <div className="space-y-3">
              {conceptMap.map((concept, index) => {
                const color = CONCEPT_COLORS[index % CONCEPT_COLORS.length];
                const isActive = activeConcept === concept.id;
                const isInactive = activeConcept !== null && activeConcept !== concept.id;
                const isScrollingTo = scrollHighlight === concept.id;

                return (
                  <div
                    key={concept.id}
                    data-tech-id={concept.id}
                    onClick={() => setSelectedConcept(selectedConcept === concept.id ? null : concept.id)}
                    onMouseEnter={() => setHoveredConcept(concept.id)}
                    onMouseLeave={() => setHoveredConcept(null)}
                    className={`
                      px-4 py-3 rounded-xl cursor-pointer transition-all duration-300
                      flex items-center justify-between gap-2
                      ${isActive
                        ? 'scale-105 concept-glow-active'
                        : 'hover:scale-102'
                      }
                      ${isInactive ? 'opacity-30' : 'opacity-100'}
                      ${isScrollingTo ? 'scroll-highlight' : ''}
                    `}
                    style={{
                      backgroundColor: isActive ? color + '25' : (isDarkMode ? '#1f2937' : '#ffffff'),
                      border: `2px solid ${isActive ? color : 'transparent'}`,
                      '--glow-color': color,
                    } as React.CSSProperties}
                  >
                    <span className={`font-semibold ${isDarkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>
                      {cleanLabel(concept.tech_term)}
                    </span>
                    <ChevronRight
                      size={18}
                      className="transition-transform duration-300"
                      style={{
                        color: isActive ? color : (isDarkMode ? '#6b7280' : '#9ca3af'),
                        transform: isActive ? 'translateX(4px)' : 'translateX(0)'
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Center Column - Connection Indicator (expands when concept selected) */}
          <div className={`
            ${isMobile
              ? (mobileActivePane === 'connection' ? 'w-full' : 'hidden')
              : (selectedConcept !== null ? 'w-[40%]' : 'w-[30%]')
            }
            flex flex-col items-center transition-all duration-500 overflow-y-auto
            ${isDarkMode ? 'bg-neutral-900/30' : 'bg-neutral-50'}
          `}>
            {activeConcept !== null ? (
              <div className={`${selectedConcept !== null ? 'p-6 w-full' : 'text-center px-4 py-8'}`}>
                {(() => {
                  const concept = conceptMap.find(c => c.id === activeConcept);
                  if (!concept) return null;
                  const index = conceptMap.findIndex(c => c.id === activeConcept);
                  const color = CONCEPT_COLORS[index % CONCEPT_COLORS.length];
                  const importance = getConceptImportance(concept);
                  const techTerm = cleanLabel(concept.tech_term);
                  const analogyTerm = cleanLabel(concept.analogy_term);
                  const isExpanded = selectedConcept === concept.id;

                  // Get the six_word_definition and narrative_mapping from the concept
                  const sixWordDef = concept.six_word_definition || '';
                  const narrativeMapping = concept.narrative_mapping || '';

                  return (
                    <div className="animate-fadeIn">
                      {/* 6-Word Definition - Always visible when concept is active */}
                      {sixWordDef && (
                        <div className="text-center mb-6">
                          <p className={`text-xs uppercase tracking-wider mb-1 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                            {techTerm}
                          </p>
                          <p className={`text-base font-medium italic ${isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}`} style={{ color }}>
                            "{sixWordDef}"
                          </p>
                        </div>
                      )}

                      {/* Structure Bridge Diagram */}
                      {(() => {
                        const bridgeLabel = extractBridgeLabel(concept.causal_explanation || '', techTerm, analogyTerm, importance, index);
                        const importancePct = Math.round(importance * 100);
                        return (
                          <div className="bridge-stagger">
                            {/* Two-node bridge layout */}
                            <div className="flex items-stretch gap-0 my-2">
                              {/* Tech Node */}
                              <div
                                className={`flex-1 rounded-xl p-3 border-l-4 bridge-node-left ${isDarkMode ? 'bg-neutral-800/70' : 'bg-white'}`}
                                style={{ borderLeftColor: color, boxShadow: `0 0 12px ${color}15` }}
                              >
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className={`text-xs uppercase tracking-wider font-mono ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>Technical</span>
                                </div>
                                <p className="text-sm font-semibold" style={{ color }}>{techTerm}</p>
                                {sixWordDef && (
                                  <p className={`text-[11px] italic mt-1 leading-snug ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                    "{sixWordDef}"
                                  </p>
                                )}
                                {/* Mini importance ring */}
                                <div className="flex items-center gap-1.5 mt-2">
                                  <div
                                    className="w-5 h-5 rounded-full flex-shrink-0"
                                    style={{
                                      background: `conic-gradient(${color} ${importance * 360}deg, ${isDarkMode ? '#404040' : '#e5e5e5'} ${importance * 360}deg)`
                                    }}
                                  >
                                    <div className={`w-3 h-3 rounded-full m-1 ${isDarkMode ? 'bg-neutral-800' : 'bg-white'}`} />
                                  </div>
                                  <span className={`text-xs font-mono ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>{importancePct}%</span>
                                </div>
                              </div>

                              {/* Bridge connector */}
                              <div className="flex flex-col items-center justify-center w-10 flex-shrink-0 bridge-node-center">
                                <div className="flex-1 w-px" style={{ borderLeft: `2px dashed ${color}40` }} />
                                <div
                                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse"
                                  style={{ backgroundColor: color + '25', boxShadow: `0 0 12px ${color}30` }}
                                >
                                  <Zap size={13} style={{ color }} />
                                </div>
                                <div className="flex-1 w-px" style={{ borderLeft: `2px dashed ${color}40` }} />
                              </div>

                              {/* Analogy Node */}
                              <div
                                className={`flex-1 rounded-xl p-3 border-r-4 bridge-node-right ${isDarkMode ? 'bg-neutral-800/70' : 'bg-white'}`}
                                style={{ borderRightColor: color, boxShadow: `0 0 12px ${color}15` }}
                              >
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className={`text-xs uppercase tracking-wider font-mono ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>{analogyDomain}</span>
                                </div>
                                <p className="text-sm font-semibold" style={{ color }}>
                                  {domainEmoji && <span className="mr-1">{domainEmoji}</span>}
                                  {analogyTerm}
                                </p>
                                <p className={`text-[11px] mt-1 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                                  maps to {techTerm}
                                </p>
                              </div>
                            </div>

                            {/* Bridge label pill */}
                            <div className="text-center -mt-1 mb-1">
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bridge-node-label ${isDarkMode ? 'bg-neutral-800 border border-neutral-700' : 'bg-neutral-100 border border-neutral-200'}`}
                              >
                                <Sparkles size={10} style={{ color }} />
                                <span className={isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}>{bridgeLabel}</span>
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Expanded Content - Only when concept is clicked/selected */}
                      {isExpanded && (
                        <div className="mt-6 space-y-4 animate-fadeIn">
                          {/* The Connection Story - Uses actual narrative_mapping if available */}
                          <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-gradient-to-br from-neutral-800/80 to-neutral-900/80 border border-neutral-700' : 'bg-gradient-to-br from-amber-50 to-blue-50 border border-neutral-200'}`}>
                            <div className="flex items-center gap-2 mb-3">
                              <BookOpen size={16} style={{ color }} />
                              <h4 className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
                                The Connection
                              </h4>
                            </div>
                            <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                              {narrativeMapping || generateBridgeNarrative(techTerm, analogyTerm, analogyDomain, index)}
                            </p>
                          </div>

                          {/* Why It Works - Dynamic structural insight + transfer tip */}
                          {(() => {
                            const { structural, transferTip } = generateIsomorphicInsight(techTerm, analogyTerm, analogyDomain, importance, index);
                            return (
                              <div className={`p-4 rounded-xl space-y-3 ${isDarkMode ? 'bg-neutral-800/50 border border-neutral-700' : 'bg-white border border-neutral-200'}`}>
                                {/* Structural insight - WHY it works */}
                                <div className="flex items-start gap-2">
                                  <Lightbulb size={14} style={{ color }} className="mt-0.5 flex-shrink-0" />
                                  <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                                    {structural}
                                  </p>
                                </div>
                                {/* Transfer tip - actionable memory hook */}
                                <div className={`flex items-start gap-2 pt-2 border-t ${isDarkMode ? 'border-neutral-700' : 'border-neutral-100'}`}>
                                  <Zap size={12} style={{ color }} className="mt-0.5 flex-shrink-0 opacity-70" />
                                  <p className={`text-xs italic leading-relaxed ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                    {transferTip}
                                  </p>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Equivalence Badge */}
                          <div className="text-center">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: color + '20' }}>
                              <Sparkles size={12} style={{ color }} />
                              <span className={`text-xs font-medium ${isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}`}>
                                {analogyTerm} = {techTerm}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Click hint when hovering but not selected */}
                      {!isExpanded && (
                        <p className={`text-xs mt-4 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                          Click to explore the connection
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="text-center px-4 py-8">
                <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-200'}`}>
                  <Columns size={20} className={isDarkMode ? 'text-neutral-400' : 'text-neutral-500'} />
                </div>
                <p className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  Hover or click a concept<br/>to see the connection
                </p>
              </div>
            )}
          </div>

          {/* Right Column - Analogy Terms */}
          <div className={`
            ${isMobile
              ? (mobileActivePane === 'analogy' ? 'w-full' : 'hidden')
              : (selectedConcept !== null ? 'w-[30%]' : 'w-[35%]')
            }
            p-4 md:p-6 overflow-y-auto md:border-l transition-all duration-500
            ${isDarkMode ? 'border-neutral-700 bg-neutral-900/50' : 'border-neutral-200 bg-amber-50/30'}
          `}>
            {/* Hide header on mobile since we have tabs */}
            <div className="hidden md:flex items-center gap-2 mb-6">
              <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${isDarkMode ? 'bg-amber-900/70 text-amber-200' : 'bg-amber-200 text-amber-800'}`}>
                🎯 {analogyDomain}
              </div>
            </div>

            <div className="space-y-3">
              {conceptMap.map((concept, index) => {
                const color = CONCEPT_COLORS[index % CONCEPT_COLORS.length];
                const isActive = activeConcept === concept.id;
                const isInactive = activeConcept !== null && activeConcept !== concept.id;
                const isScrollingTo = scrollHighlight === concept.id;

                return (
                  <div
                    key={concept.id}
                    data-analogy-id={concept.id}
                    onClick={() => setSelectedConcept(selectedConcept === concept.id ? null : concept.id)}
                    onMouseEnter={() => setHoveredConcept(concept.id)}
                    onMouseLeave={() => setHoveredConcept(null)}
                    className={`
                      px-4 py-3 rounded-xl cursor-pointer transition-all duration-300
                      flex items-center gap-2
                      ${isActive
                        ? 'scale-105 concept-glow-active'
                        : 'hover:scale-102'
                      }
                      ${isInactive ? 'opacity-30' : 'opacity-100'}
                      ${isScrollingTo ? 'scroll-highlight' : ''}
                    `}
                    style={{
                      backgroundColor: isActive ? color + '25' : (isDarkMode ? '#1f2937' : '#ffffff'),
                      border: `2px solid ${isActive ? color : 'transparent'}`,
                      '--glow-color': color,
                    } as React.CSSProperties}
                  >
                    <ChevronRight
                      size={18}
                      className="transition-transform duration-300 rotate-180"
                      style={{
                        color: isActive ? color : (isDarkMode ? '#6b7280' : '#9ca3af'),
                        transform: isActive ? 'translateX(-4px) rotate(180deg)' : 'rotate(180deg)'
                      }}
                    />
                    <span className={`font-semibold ${isDarkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>
                      {cleanLabel(concept.analogy_term)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 md:px-6 py-3 border-t border-neutral-700 bg-neutral-900 pb-safe">
        <div className="flex items-center justify-between">
          <span className="text-blue-200/70 text-xs">
            {isMobile
              ? 'Tap concepts • Switch tabs to explore'
              : 'Click concepts to select • Hover to preview connections'
            }
          </span>
          <span className="text-neutral-300 text-xs hidden md:inline">
            Press P or Esc to close
          </span>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scrollPulse {
          0% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.7); }
          50% { box-shadow: 0 0 0 8px rgba(139, 92, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
        }
        @keyframes conceptGlow {
          0% {
            box-shadow: 0 0 15px var(--glow-color), 0 4px 20px color-mix(in srgb, var(--glow-color) 30%, transparent);
          }
          50% {
            box-shadow: 0 0 25px var(--glow-color), 0 4px 30px color-mix(in srgb, var(--glow-color) 50%, transparent);
          }
          100% {
            box-shadow: 0 0 15px var(--glow-color), 0 4px 20px color-mix(in srgb, var(--glow-color) 30%, transparent);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .scroll-highlight {
          animation: scrollPulse 0.8s ease-out;
        }
        .concept-glow-active {
          animation: conceptGlow 2s ease-in-out infinite;
        }
        .hover\\:scale-102:hover {
          transform: scale(1.02);
        }
        .bridge-stagger .bridge-node-left {
          animation: fadeIn 0.3s ease-out both;
        }
        .bridge-stagger .bridge-node-center {
          animation: fadeIn 0.3s ease-out 0.1s both;
        }
        .bridge-stagger .bridge-node-right {
          animation: fadeIn 0.3s ease-out 0.2s both;
        }
        .bridge-stagger .bridge-node-label {
          animation: fadeIn 0.3s ease-out 0.25s both;
        }
      `}</style>
    </div>
  );
};

export default IsomorphicDualPane;
