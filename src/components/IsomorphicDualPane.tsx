import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Columns, Sparkles } from 'lucide-react';
import { Segment, ConceptMapItem, ImportanceMapItem } from '../types';

interface IsomorphicDualPaneProps {
  segments: Segment[];
  conceptMap: ConceptMapItem[];
  importanceMap: ImportanceMapItem[];
  isDarkMode: boolean;
  onClose: () => void;
}

// Color palette matching the main app
const CONCEPT_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4'
];

interface ConceptPosition {
  id: number;
  techTerm: string;
  analogyTerm: string;
  techRect: DOMRect | null;
  analogyRect: DOMRect | null;
  color: string;
}

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
    .replace(/\\[a-zA-Z]+/g, (match) => {
      const commands: { [key: string]: string } = {
        '\\Sigma': 'Σ', '\\sigma': 'σ', '\\alpha': 'α', '\\beta': 'β',
        '\\gamma': 'γ', '\\delta': 'δ', '\\theta': 'θ', '\\lambda': 'λ',
        '\\mu': 'μ', '\\pi': 'π', '\\sum': 'Σ', '\\prod': 'Π',
        '\\int': '∫', '\\infty': '∞', '\\sqrt': '√', '\\cdot': '·',
        '\\times': '×', '\\div': '÷', '\\pm': '±', '\\leq': '≤',
        '\\geq': '≥', '\\neq': '≠', '\\approx': '≈',
      };
      return commands[match] || match.slice(1);
    })
    .trim();
};

export const IsomorphicDualPane: React.FC<IsomorphicDualPaneProps> = ({
  segments,
  conceptMap,
  importanceMap,
  isDarkMode,
  onClose
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const techPaneRef = useRef<HTMLDivElement>(null);
  const analogyPaneRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [conceptPositions, setConceptPositions] = useState<ConceptPosition[]>([]);
  const [hoveredConcept, setHoveredConcept] = useState<number | null>(null);
  const [animationPhase, setAnimationPhase] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Combine all segments into full text
  const techText = segments.map(s => s.tech).join(' ');
  const analogyText = segments.map(s => s.analogy).join(' ');

  // Parse text and wrap concept terms in spans
  const parseTextWithConcepts = useCallback((text: string, isTech: boolean) => {
    if (!text) return [];

    const result: { text: string; conceptId: number | null; isMatch: boolean }[] = [];
    let remaining = text;

    // Sort concepts by term length (longest first) to match longer terms first
    const sortedConcepts = [...conceptMap].sort((a, b) => {
      const termA = isTech ? a.tech_term : a.analogy_term;
      const termB = isTech ? b.tech_term : b.analogy_term;
      return termB.length - termA.length;
    });

    while (remaining.length > 0) {
      let foundMatch = false;

      for (const concept of sortedConcepts) {
        const term = cleanLabel(isTech ? concept.tech_term : concept.analogy_term);
        const lowerRemaining = remaining.toLowerCase();
        const lowerTerm = term.toLowerCase();
        const index = lowerRemaining.indexOf(lowerTerm);

        if (index === 0) {
          // Found a match at the start
          result.push({
            text: remaining.slice(0, term.length),
            conceptId: concept.id,
            isMatch: true
          });
          remaining = remaining.slice(term.length);
          foundMatch = true;
          break;
        } else if (index > 0) {
          // Found a match later - push the text before it first
          result.push({
            text: remaining.slice(0, index),
            conceptId: null,
            isMatch: false
          });
          result.push({
            text: remaining.slice(index, index + term.length),
            conceptId: concept.id,
            isMatch: true
          });
          remaining = remaining.slice(index + term.length);
          foundMatch = true;
          break;
        }
      }

      if (!foundMatch) {
        // No match found - take one character and continue
        result.push({
          text: remaining.charAt(0),
          conceptId: null,
          isMatch: false
        });
        remaining = remaining.slice(1);
      }
    }

    return result;
  }, [conceptMap]);

  // Update concept positions when layout changes
  const updatePositions = useCallback(() => {
    if (!containerRef.current || !techPaneRef.current || !analogyPaneRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const positions: ConceptPosition[] = [];

    conceptMap.forEach((concept, index) => {
      const techSpan = techPaneRef.current?.querySelector(`[data-concept-id="${concept.id}"][data-type="tech"]`);
      const analogySpan = analogyPaneRef.current?.querySelector(`[data-concept-id="${concept.id}"][data-type="analogy"]`);

      positions.push({
        id: concept.id,
        techTerm: concept.tech_term,
        analogyTerm: concept.analogy_term,
        techRect: techSpan ? techSpan.getBoundingClientRect() : null,
        analogyRect: analogySpan ? analogySpan.getBoundingClientRect() : null,
        color: CONCEPT_COLORS[index % CONCEPT_COLORS.length]
      });
    });

    setConceptPositions(positions);
    setDimensions({ width: containerRect.width, height: containerRect.height });
  }, [conceptMap]);

  // Update positions on mount and resize
  useEffect(() => {
    updatePositions();

    const handleResize = () => updatePositions();
    window.addEventListener('resize', handleResize);

    // Update positions after a short delay to ensure DOM is ready
    const timer = setTimeout(updatePositions, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [updatePositions, segments]);

  // Animation loop for flowing effect
  useEffect(() => {
    let animationId: number;

    const animate = () => {
      setAnimationPhase(prev => (prev + 0.02) % 1);
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, []);

  // Generate SVG path for attention flow between two points
  const generateFlowPath = (start: DOMRect, end: DOMRect, containerRect: DOMRect): string => {
    const startX = start.right - containerRect.left;
    const startY = start.top + start.height / 2 - containerRect.top;
    const endX = end.left - containerRect.left;
    const endY = end.top + end.height / 2 - containerRect.top;

    // Create a curved path with control points
    const midX = (startX + endX) / 2;
    const controlOffset = Math.abs(endY - startY) * 0.3;

    return `M ${startX} ${startY}
            C ${midX - controlOffset} ${startY},
              ${midX + controlOffset} ${endY},
              ${endX} ${endY}`;
  };

  // Render concept span with highlighting
  const renderConceptSpan = (
    item: { text: string; conceptId: number | null; isMatch: boolean },
    index: number,
    isTech: boolean
  ) => {
    if (!item.isMatch || item.conceptId === null) {
      return <span key={index}>{item.text}</span>;
    }

    const concept = conceptPositions.find(c => c.id === item.conceptId);
    const isHovered = hoveredConcept === item.conceptId;

    return (
      <span
        key={index}
        data-concept-id={item.conceptId}
        data-type={isTech ? 'tech' : 'analogy'}
        className={`
          inline-block px-1 py-0.5 rounded transition-all duration-300 cursor-pointer
          ${isHovered ? 'scale-110 shadow-lg' : ''}
        `}
        style={{
          backgroundColor: isHovered
            ? (concept?.color || CONCEPT_COLORS[item.conceptId % CONCEPT_COLORS.length]) + '40'
            : (concept?.color || CONCEPT_COLORS[item.conceptId % CONCEPT_COLORS.length]) + '20',
          color: isHovered
            ? (isDarkMode ? '#fff' : '#000')
            : (concept?.color || CONCEPT_COLORS[item.conceptId % CONCEPT_COLORS.length]),
          fontWeight: isHovered ? 700 : 600,
          border: `2px solid ${isHovered
            ? (concept?.color || CONCEPT_COLORS[item.conceptId % CONCEPT_COLORS.length])
            : 'transparent'}`,
        }}
        onMouseEnter={() => setHoveredConcept(item.conceptId)}
        onMouseLeave={() => setHoveredConcept(null)}
      >
        {item.text}
      </span>
    );
  };

  const parsedTech = parseTextWithConcepts(techText, true);
  const parsedAnalogy = parseTextWithConcepts(analogyText, false);
  const containerRect = containerRef.current?.getBoundingClientRect();

  return (
    <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-700">
        <div className="flex items-center gap-4">
          <Columns className="text-blue-400" size={24} />
          <h2 className="text-white text-lg font-bold">Isomorphic Dual-Pane View</h2>
          <span className="text-neutral-400 text-sm">
            {conceptMap.length} concept mappings • Hover to highlight connections
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-red-500 hover:text-white transition-colors"
          title="Close (Esc)"
        >
          <X size={18} />
        </button>
      </div>

      {/* Main Content */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {/* SVG Layer for Attention Rivers */}
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* Animated gradient for flow effect */}
            {conceptPositions.map((concept, index) => (
              <linearGradient
                key={`gradient-${concept.id}`}
                id={`flow-gradient-${concept.id}`}
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor={concept.color} stopOpacity="0.1" />
                <stop
                  offset={`${(animationPhase * 100)}%`}
                  stopColor={concept.color}
                  stopOpacity={hoveredConcept === concept.id ? "0.9" : "0.4"}
                />
                <stop
                  offset={`${(animationPhase * 100 + 20) % 100}%`}
                  stopColor={concept.color}
                  stopOpacity={hoveredConcept === concept.id ? "0.9" : "0.4"}
                />
                <stop offset="100%" stopColor={concept.color} stopOpacity="0.1" />
              </linearGradient>
            ))}

            {/* Glow filter */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Attention flow paths */}
          {containerRect && conceptPositions.map((concept) => {
            if (!concept.techRect || !concept.analogyRect) return null;

            const path = generateFlowPath(concept.techRect, concept.analogyRect, containerRect);
            const isHovered = hoveredConcept === concept.id;

            return (
              <g key={`flow-${concept.id}`}>
                {/* Background glow */}
                {isHovered && (
                  <path
                    d={path}
                    fill="none"
                    stroke={concept.color}
                    strokeWidth={8}
                    strokeOpacity={0.3}
                    filter="url(#glow)"
                  />
                )}
                {/* Main flow line */}
                <path
                  d={path}
                  fill="none"
                  stroke={`url(#flow-gradient-${concept.id})`}
                  strokeWidth={isHovered ? 4 : 2}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
                {/* Animated particles along the path */}
                {isHovered && (
                  <>
                    <circle r={4} fill={concept.color}>
                      <animateMotion
                        dur="2s"
                        repeatCount="indefinite"
                        path={path}
                      />
                    </circle>
                    <circle r={3} fill={concept.color} opacity={0.7}>
                      <animateMotion
                        dur="2s"
                        repeatCount="indefinite"
                        path={path}
                        begin="0.5s"
                      />
                    </circle>
                    <circle r={2} fill={concept.color} opacity={0.5}>
                      <animateMotion
                        dur="2s"
                        repeatCount="indefinite"
                        path={path}
                        begin="1s"
                      />
                    </circle>
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {/* Dual Pane Layout */}
        <div className="flex h-full">
          {/* Tech Pane (Left) */}
          <div
            ref={techPaneRef}
            className={`w-1/2 p-8 overflow-y-auto border-r ${
              isDarkMode ? 'border-neutral-700 bg-neutral-900/50' : 'border-neutral-300 bg-neutral-100/50'
            }`}
          >
            <div className="mb-4 flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
              }`}>
                Technical
              </div>
              <Sparkles size={14} className="text-blue-400" />
            </div>
            <p className={`text-lg leading-relaxed ${isDarkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>
              {parsedTech.map((item, i) => renderConceptSpan(item, i, true))}
            </p>
          </div>

          {/* Center Divider with Legend */}
          <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 px-4 py-3 rounded-xl ${
            isDarkMode ? 'bg-neutral-800/90 border border-neutral-700' : 'bg-white/90 border border-neutral-300'
          } shadow-xl backdrop-blur-sm`}>
            <div className={`text-xs font-bold mb-2 text-center ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Concept Mappings
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {conceptMap.slice(0, 8).map((concept, index) => (
                <div
                  key={concept.id}
                  className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
                    hoveredConcept === concept.id
                      ? (isDarkMode ? 'bg-neutral-700' : 'bg-neutral-200')
                      : ''
                  }`}
                  onMouseEnter={() => setHoveredConcept(concept.id)}
                  onMouseLeave={() => setHoveredConcept(null)}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CONCEPT_COLORS[index % CONCEPT_COLORS.length] }}
                  />
                  <span className={`text-[10px] ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                    {cleanLabel(concept.tech_term).slice(0, 12)}
                  </span>
                  <span className={`text-[10px] ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>→</span>
                  <span className={`text-[10px] ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                    {cleanLabel(concept.analogy_term).slice(0, 12)}
                  </span>
                </div>
              ))}
              {conceptMap.length > 8 && (
                <div className={`text-[10px] text-center ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  +{conceptMap.length - 8} more
                </div>
              )}
            </div>
          </div>

          {/* Analogy Pane (Right) */}
          <div
            ref={analogyPaneRef}
            className={`w-1/2 p-8 overflow-y-auto ${
              isDarkMode ? 'bg-neutral-800/50' : 'bg-white/50'
            }`}
          >
            <div className="mb-4 flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                isDarkMode ? 'bg-amber-900/50 text-amber-300' : 'bg-amber-100 text-amber-700'
              }`}>
                Analogy
              </div>
              <Sparkles size={14} className="text-amber-400" />
            </div>
            <p className={`text-lg leading-relaxed ${isDarkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>
              {parsedAnalogy.map((item, i) => renderConceptSpan(item, i, false))}
            </p>
          </div>
        </div>
      </div>

      {/* Footer Instructions */}
      <div className="px-6 py-3 border-t border-neutral-700 bg-neutral-900/80">
        <div className="flex items-center justify-between">
          <span className="text-neutral-500 text-xs">
            Hover over highlighted terms to see attention flow connections • Press P or Esc to close
          </span>
          <div className="flex items-center gap-2">
            <span className="text-neutral-600 text-xs">Flow animation:</span>
            <div className="w-16 h-1 rounded-full bg-gradient-to-r from-blue-500/20 via-blue-500 to-blue-500/20"
                 style={{ backgroundPosition: `${animationPhase * 100}% 0` }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default IsomorphicDualPane;
