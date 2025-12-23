import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Columns, ArrowRight } from 'lucide-react';
import { Segment, ConceptMapItem, ImportanceMapItem } from '../types';
import { LATEX_REGEX } from '../constants';
import { wrapBareLatex } from '../utils';

// Declare KaTeX on window
declare global {
  interface Window {
    katex?: {
      renderToString: (tex: string, options?: { throwOnError?: boolean; displayMode?: boolean }) => string;
    };
  }
}

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

// Helper to strip LaTeX for display labels
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

  // Render LaTeX with KaTeX
  const renderLatex = useCallback((latex: string): React.ReactNode => {
    let content = latex.replace(/\\\\/g, "\\");
    if (content.startsWith('$$')) content = content.slice(2, -2);
    else if (content.startsWith('$')) content = content.slice(1, -1);
    else if (content.startsWith('\\(')) content = content.slice(2, -2);
    else if (content.startsWith('\\[')) content = content.slice(2, -2);

    if (window.katex) {
      try {
        const html = window.katex.renderToString(content, { throwOnError: false });
        return <span dangerouslySetInnerHTML={{ __html: html }} className="inline-block not-italic normal-case" />;
      } catch {
        return <span>{content}</span>;
      }
    }
    return <span>{content}</span>;
  }, []);

  // Parse text into segments with LaTeX rendering and concept highlighting
  const parseAndRenderText = useCallback((text: string, isTech: boolean): React.ReactNode[] => {
    if (!text) return [];

    const processedText = wrapBareLatex(text);
    const parts = processedText.split(LATEX_REGEX);
    const result: React.ReactNode[] = [];

    parts.forEach((part, partIndex) => {
      if (!part) return;

      const isLatex = part.startsWith('$') || part.startsWith('\\(') || part.startsWith('\\[') ||
                      (part.startsWith('\\') && part.length > 1 && /^\\[a-zA-Z]/.test(part));

      if (isLatex) {
        // Check if this LaTeX matches a concept
        const cleanedLatex = cleanLabel(part).toLowerCase();
        let matchedConcept: ConceptMapItem | undefined;

        for (const concept of conceptMap) {
          const techClean = cleanLabel(concept.tech_term).toLowerCase();
          const analogyClean = cleanLabel(concept.analogy_term).toLowerCase();
          if (cleanedLatex.includes(techClean) || techClean.includes(cleanedLatex) ||
              cleanedLatex.includes(analogyClean) || analogyClean.includes(cleanedLatex)) {
            matchedConcept = concept;
            break;
          }
        }

        if (matchedConcept) {
          const conceptIndex = conceptMap.findIndex(c => c.id === matchedConcept!.id);
          const color = CONCEPT_COLORS[conceptIndex % CONCEPT_COLORS.length];
          const isHovered = hoveredConcept === matchedConcept.id;

          result.push(
            <span
              key={`latex-${partIndex}`}
              data-concept-id={matchedConcept.id}
              data-type={isTech ? 'tech' : 'analogy'}
              className={`inline-block px-1.5 py-0.5 rounded-md transition-all duration-300 cursor-pointer ${isHovered ? 'scale-105 shadow-lg' : ''}`}
              style={{
                backgroundColor: isHovered ? color + '50' : color + '20',
                border: `2px solid ${isHovered ? color : 'transparent'}`,
              }}
              onMouseEnter={() => setHoveredConcept(matchedConcept!.id)}
              onMouseLeave={() => setHoveredConcept(null)}
            >
              {renderLatex(part)}
            </span>
          );
        } else {
          result.push(<span key={`latex-${partIndex}`}>{renderLatex(part)}</span>);
        }
      } else {
        // Regular text - check for concept terms word by word
        const words = part.split(/(\s+)/);
        words.forEach((word, wordIndex) => {
          if (!word) return;
          if (/^\s+$/.test(word)) {
            result.push(<span key={`space-${partIndex}-${wordIndex}`}>{word}</span>);
            return;
          }

          // Check if this word matches any concept
          let matchedConcept: ConceptMapItem | undefined;
          const wordLower = word.toLowerCase().replace(/[.,!?;:'"()]/g, '');

          for (const concept of conceptMap) {
            const techClean = cleanLabel(concept.tech_term).toLowerCase();
            const analogyClean = cleanLabel(concept.analogy_term).toLowerCase();

            // Check for word match or partial match
            if (wordLower === techClean || wordLower === analogyClean ||
                techClean.split(/\s+/).includes(wordLower) ||
                analogyClean.split(/\s+/).includes(wordLower) ||
                (wordLower.length > 4 && (techClean.includes(wordLower) || analogyClean.includes(wordLower)))) {
              matchedConcept = concept;
              break;
            }
          }

          if (matchedConcept) {
            const conceptIndex = conceptMap.findIndex(c => c.id === matchedConcept!.id);
            const color = CONCEPT_COLORS[conceptIndex % CONCEPT_COLORS.length];
            const isHovered = hoveredConcept === matchedConcept.id;

            result.push(
              <span
                key={`word-${partIndex}-${wordIndex}`}
                data-concept-id={matchedConcept.id}
                data-type={isTech ? 'tech' : 'analogy'}
                className={`inline-block px-1 py-0.5 rounded transition-all duration-300 cursor-pointer ${isHovered ? 'scale-105 shadow-md' : ''}`}
                style={{
                  backgroundColor: isHovered ? color + '50' : color + '20',
                  color: isHovered ? (isDarkMode ? '#fff' : '#000') : color,
                  fontWeight: isHovered ? 700 : 600,
                  border: `2px solid ${isHovered ? color : 'transparent'}`,
                }}
                onMouseEnter={() => setHoveredConcept(matchedConcept!.id)}
                onMouseLeave={() => setHoveredConcept(null)}
              >
                {word}
              </span>
            );
          } else {
            result.push(<span key={`word-${partIndex}-${wordIndex}`}>{word}</span>);
          }
        });
      }
    });

    return result;
  }, [conceptMap, hoveredConcept, isDarkMode, renderLatex]);

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

    // Update positions after delays to ensure DOM is ready
    const timer1 = setTimeout(updatePositions, 100);
    const timer2 = setTimeout(updatePositions, 300);
    const timer3 = setTimeout(updatePositions, 500);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [updatePositions, segments, hoveredConcept]);

  // Animation loop for flowing effect
  useEffect(() => {
    let animationId: number;

    const animate = () => {
      setAnimationPhase(prev => (prev + 0.015) % 1);
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
    const controlOffset = Math.min(Math.abs(endY - startY) * 0.5, 100);

    return `M ${startX} ${startY}
            C ${midX} ${startY},
              ${midX} ${endY},
              ${endX} ${endY}`;
  };

  const containerRect = containerRef.current?.getBoundingClientRect();

  // Get the currently hovered concept details for the info panel
  const hoveredConceptData = hoveredConcept !== null
    ? conceptPositions.find(c => c.id === hoveredConcept)
    : null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-700 bg-neutral-900">
        <div className="flex items-center gap-4">
          <Columns className="text-blue-400" size={22} />
          <h2 className="text-white text-lg font-bold">Isomorphic Dual-Pane View</h2>
          <span className="text-neutral-400 text-sm">
            {conceptMap.length} concept mappings
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
      <div ref={containerRef} className="flex-1 relative overflow-hidden flex">
        {/* SVG Layer for Attention Rivers - Always Visible */}
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* Glow filter */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

            {/* Animated gradients for each concept */}
            {conceptPositions.map((concept) => (
              <linearGradient
                key={`gradient-${concept.id}`}
                id={`flow-gradient-${concept.id}`}
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor={concept.color} stopOpacity="0.2" />
                <stop
                  offset={`${(animationPhase * 100)}%`}
                  stopColor={concept.color}
                  stopOpacity={hoveredConcept === concept.id ? "1" : "0.5"}
                />
                <stop
                  offset={`${((animationPhase * 100) + 30) % 100}%`}
                  stopColor={concept.color}
                  stopOpacity={hoveredConcept === concept.id ? "1" : "0.5"}
                />
                <stop offset="100%" stopColor={concept.color} stopOpacity="0.2" />
              </linearGradient>
            ))}
          </defs>

          {/* All Attention flow paths - Always visible */}
          {containerRect && conceptPositions.map((concept) => {
            if (!concept.techRect || !concept.analogyRect) return null;

            const path = generateFlowPath(concept.techRect, concept.analogyRect, containerRect);
            const isHovered = hoveredConcept === concept.id;
            const baseOpacity = hoveredConcept === null ? 0.4 : (isHovered ? 1 : 0.15);

            return (
              <g key={`flow-${concept.id}`} className="transition-all duration-300">
                {/* Background glow for hovered */}
                {isHovered && (
                  <path
                    d={path}
                    fill="none"
                    stroke={concept.color}
                    strokeWidth={12}
                    strokeOpacity={0.4}
                    filter="url(#glow)"
                  />
                )}
                {/* Main flow line */}
                <path
                  d={path}
                  fill="none"
                  stroke={`url(#flow-gradient-${concept.id})`}
                  strokeWidth={isHovered ? 5 : 2.5}
                  strokeLinecap="round"
                  strokeOpacity={baseOpacity}
                  className="transition-all duration-300"
                />
                {/* Animated particles - always show for all, more prominent when hovered */}
                <circle r={isHovered ? 5 : 3} fill={concept.color} opacity={isHovered ? 1 : 0.6}>
                  <animateMotion
                    dur={isHovered ? "1.5s" : "3s"}
                    repeatCount="indefinite"
                    path={path}
                  />
                </circle>
                {isHovered && (
                  <>
                    <circle r={4} fill={concept.color} opacity={0.8}>
                      <animateMotion
                        dur="1.5s"
                        repeatCount="indefinite"
                        path={path}
                        begin="0.5s"
                      />
                    </circle>
                    <circle r={3} fill={concept.color} opacity={0.6}>
                      <animateMotion
                        dur="1.5s"
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

        {/* Tech Pane (Left) */}
        <div
          ref={techPaneRef}
          className={`w-[42%] p-6 overflow-y-auto ${
            isDarkMode ? 'bg-gradient-to-br from-blue-950/30 to-neutral-900/50' : 'bg-gradient-to-br from-blue-50 to-neutral-100'
          }`}
        >
          <div className="mb-4 flex items-center gap-2">
            <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
              isDarkMode ? 'bg-blue-900/70 text-blue-200' : 'bg-blue-200 text-blue-800'
            }`}>
              ⚡ Technical
            </div>
          </div>
          <div className={`text-base leading-relaxed ${isDarkMode ? 'text-neutral-100' : 'text-neutral-800'}`}>
            {parseAndRenderText(techText, true)}
          </div>
        </div>

        {/* Center Vertical Flow Column */}
        <div className={`w-[16%] flex flex-col border-x ${
          isDarkMode ? 'bg-neutral-900/80 border-neutral-700' : 'bg-neutral-100/80 border-neutral-300'
        }`}>
          {/* Header */}
          <div className={`px-3 py-3 border-b text-center ${isDarkMode ? 'border-neutral-700' : 'border-neutral-300'}`}>
            <div className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Concept Flow
            </div>
          </div>

          {/* Scrollable concept list */}
          <div className="flex-1 overflow-y-auto py-2">
            {conceptMap.map((concept, index) => {
              const color = CONCEPT_COLORS[index % CONCEPT_COLORS.length];
              const isHovered = hoveredConcept === concept.id;

              return (
                <div
                  key={concept.id}
                  className={`px-2 py-2 mx-1 my-1 rounded-lg cursor-pointer transition-all duration-300 ${
                    isHovered
                      ? 'scale-[1.02] shadow-lg'
                      : 'hover:scale-[1.01]'
                  }`}
                  style={{
                    backgroundColor: isHovered ? color + '30' : (isDarkMode ? 'rgba(38,38,38,0.5)' : 'rgba(255,255,255,0.5)'),
                    border: `2px solid ${isHovered ? color : 'transparent'}`,
                  }}
                  onMouseEnter={() => setHoveredConcept(concept.id)}
                  onMouseLeave={() => setHoveredConcept(null)}
                >
                  {/* Tech term */}
                  <div className="flex items-center gap-1.5 mb-1">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className={`text-[11px] font-medium truncate ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                      {cleanLabel(concept.tech_term)}
                    </span>
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center my-1">
                    <ArrowRight
                      size={14}
                      className={`transition-all duration-300 ${isHovered ? 'scale-125' : ''}`}
                      style={{ color: isHovered ? color : (isDarkMode ? '#6b7280' : '#9ca3af') }}
                    />
                  </div>

                  {/* Analogy term */}
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className={`text-[11px] font-medium truncate ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>
                      {cleanLabel(concept.analogy_term)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hovered concept detail */}
          {hoveredConceptData && (
            <div className={`px-3 py-3 border-t ${isDarkMode ? 'border-neutral-700 bg-neutral-800/90' : 'border-neutral-300 bg-white/90'}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Active Connection
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full animate-pulse"
                  style={{ backgroundColor: hoveredConceptData.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className={`text-[10px] truncate ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                    {cleanLabel(hoveredConceptData.techTerm)}
                  </div>
                  <div className={`text-[10px] truncate ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>
                    ↔ {cleanLabel(hoveredConceptData.analogyTerm)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Analogy Pane (Right) */}
        <div
          ref={analogyPaneRef}
          className={`w-[42%] p-6 overflow-y-auto ${
            isDarkMode ? 'bg-gradient-to-bl from-amber-950/30 to-neutral-900/50' : 'bg-gradient-to-bl from-amber-50 to-neutral-100'
          }`}
        >
          <div className="mb-4 flex items-center gap-2">
            <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
              isDarkMode ? 'bg-amber-900/70 text-amber-200' : 'bg-amber-200 text-amber-800'
            }`}>
              🎯 Analogy
            </div>
          </div>
          <div className={`text-base leading-relaxed ${isDarkMode ? 'text-neutral-100' : 'text-neutral-800'}`}>
            {parseAndRenderText(analogyText, false)}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-2 border-t border-neutral-700 bg-neutral-900">
        <div className="flex items-center justify-between">
          <span className="text-neutral-500 text-xs">
            Hover over highlighted concepts to trace connections • Rivers show concept mappings in real-time
          </span>
          <span className="text-neutral-600 text-xs">
            Press P or Esc to close
          </span>
        </div>
      </div>
    </div>
  );
};

export default IsomorphicDualPane;
