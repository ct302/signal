import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Columns, Zap, ChevronRight } from 'lucide-react';
import { ConceptMapItem, ImportanceMapItem } from '../types';

interface IsomorphicDualPaneProps {
  conceptMap: ConceptMapItem[];
  importanceMap: ImportanceMapItem[];
  isDarkMode: boolean;
  analogyDomain: string;
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
  onClose
}) => {
  const [selectedConcept, setSelectedConcept] = useState<number | null>(null);
  const [hoveredConcept, setHoveredConcept] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const rightColumnRef = useRef<HTMLDivElement>(null);
  const [linePositions, setLinePositions] = useState<Map<number, { left: DOMRect; right: DOMRect }>>(new Map());
  const [scrollHighlight, setScrollHighlight] = useState<number | null>(null);

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

  // Update line positions when layout changes
  const updateLinePositions = useCallback(() => {
    if (!containerRef.current) return;

    const positions = new Map<number, { left: DOMRect; right: DOMRect }>();

    conceptMap.forEach((concept) => {
      const leftEl = containerRef.current?.querySelector(`[data-tech-id="${concept.id}"]`);
      const rightEl = containerRef.current?.querySelector(`[data-analogy-id="${concept.id}"]`);

      if (leftEl && rightEl) {
        positions.set(concept.id, {
          left: leftEl.getBoundingClientRect(),
          right: rightEl.getBoundingClientRect()
        });
      }
    });

    setLinePositions(positions);
  }, [conceptMap]);

  useEffect(() => {
    updateLinePositions();
    window.addEventListener('resize', updateLinePositions);

    // Multiple updates to catch layout shifts
    const t1 = setTimeout(updateLinePositions, 100);
    const t2 = setTimeout(updateLinePositions, 300);

    return () => {
      window.removeEventListener('resize', updateLinePositions);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [updateLinePositions]);

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

    // Update line positions after scroll
    setTimeout(updateLinePositions, 350);

    return () => clearTimeout(timeout);
  }, [activeConcept, updateLinePositions]);
  const containerRect = containerRef.current?.getBoundingClientRect();

  return (
    <div className="fixed inset-0 z-[80] bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-700 bg-neutral-900">
        <div className="flex items-center gap-4">
          <Columns className="text-blue-400" size={24} />
          <div>
            <h2 className="text-white text-lg font-bold">Concept Isomorphism</h2>
            <p className="text-neutral-400 text-sm">{conceptMap.length} mappings • Technical ↔ {analogyDomain}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-red-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Content */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {/* SVG Connection Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          <defs>
            {/* Animated gradient for active connection */}
            <linearGradient id="neural-pulse" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0">
                <animate attributeName="offset" values="-0.5;1" dur="1.5s" repeatCount="indefinite" />
              </stop>
              <stop offset="50%" stopColor="#8b5cf6" stopOpacity="1">
                <animate attributeName="offset" values="0;1.5" dur="1.5s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0">
                <animate attributeName="offset" values="0.5;2" dur="1.5s" repeatCount="indefinite" />
              </stop>
            </linearGradient>

            {/* Glow filter */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Draw connection lines */}
          {containerRect && conceptMap.map((concept, index) => {
            const positions = linePositions.get(concept.id);
            if (!positions) return null;

            const color = CONCEPT_COLORS[index % CONCEPT_COLORS.length];
            const isActive = activeConcept === concept.id;
            const isInactive = activeConcept !== null && activeConcept !== concept.id;

            // Calculate line coordinates relative to container
            const startX = positions.left.right - containerRect.left;
            const startY = positions.left.top + positions.left.height / 2 - containerRect.top;
            const endX = positions.right.left - containerRect.left;
            const endY = positions.right.top + positions.right.height / 2 - containerRect.top;

            // Control points for smooth curve
            const midX = (startX + endX) / 2;

            return (
              <g key={concept.id} className="transition-all duration-500">
                {/* Background line */}
                <path
                  d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                  fill="none"
                  stroke={isActive ? color : (isDarkMode ? '#374151' : '#d1d5db')}
                  strokeWidth={isActive ? 3 : 1.5}
                  strokeOpacity={isInactive ? 0.15 : (isActive ? 1 : 0.4)}
                  className="transition-all duration-300"
                />

                {/* Animated pulse overlay for active */}
                {isActive && (
                  <path
                    d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                    fill="none"
                    stroke="url(#neural-pulse)"
                    strokeWidth={4}
                    filter="url(#glow)"
                    className="transition-all duration-300"
                  />
                )}

                {/* Endpoint circles */}
                <circle
                  cx={startX}
                  cy={startY}
                  r={isActive ? 6 : 4}
                  fill={isActive ? color : (isDarkMode ? '#4b5563' : '#9ca3af')}
                  opacity={isInactive ? 0.2 : 1}
                  className="transition-all duration-300"
                />
                <circle
                  cx={endX}
                  cy={endY}
                  r={isActive ? 6 : 4}
                  fill={isActive ? color : (isDarkMode ? '#4b5563' : '#9ca3af')}
                  opacity={isInactive ? 0.2 : 1}
                  className="transition-all duration-300"
                />
              </g>
            );
          })}
        </svg>

        {/* Three Column Layout */}
        <div className="h-full flex">
          {/* Left Column - Technical Terms */}
          <div className={`w-[35%] p-6 overflow-y-auto border-r ${isDarkMode ? 'border-neutral-700 bg-neutral-900/50' : 'border-neutral-200 bg-blue-50/30'}`}>
            <div className="flex items-center gap-2 mb-6">
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
                        ? 'scale-105 shadow-lg'
                        : 'hover:scale-102'
                      }
                      ${isInactive ? 'opacity-30' : 'opacity-100'}
                      ${isScrollingTo ? 'scroll-highlight' : ''}
                    `}
                    style={{
                      backgroundColor: isActive ? color + '25' : (isDarkMode ? '#1f2937' : '#ffffff'),
                      border: `2px solid ${isActive ? color : 'transparent'}`,
                      boxShadow: isActive ? `0 4px 20px ${color}30` : undefined,
                    }}
                  >
                    <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
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

          {/* Center Column - Connection Indicator */}
          <div className={`w-[30%] flex flex-col items-center justify-center ${isDarkMode ? 'bg-neutral-900/30' : 'bg-neutral-50'}`}>
            {activeConcept !== null ? (
              <div className="text-center px-4">
                {(() => {
                  const concept = conceptMap.find(c => c.id === activeConcept);
                  if (!concept) return null;
                  const index = conceptMap.findIndex(c => c.id === activeConcept);
                  const color = CONCEPT_COLORS[index % CONCEPT_COLORS.length];
                  const importance = getConceptImportance(concept);

                  return (
                    <div className="animate-fadeIn">
                      {/* Pulsing connection indicator */}
                      <div
                        className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center animate-pulse"
                        style={{ backgroundColor: color + '30', boxShadow: `0 0 30px ${color}50` }}
                      >
                        <Zap size={28} style={{ color }} />
                      </div>

                      <p className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                        maps to
                      </p>

                      {/* Importance bar */}
                      <div className="mt-4 px-4">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className={isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}>Importance</span>
                          <span style={{ color }} className="font-bold">{Math.round(importance * 100)}%</span>
                        </div>
                        <div className={`h-2 rounded-full ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-200'}`}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${importance * 100}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="text-center px-4">
                <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-200'}`}>
                  <Columns size={20} className={isDarkMode ? 'text-neutral-500' : 'text-neutral-400'} />
                </div>
                <p className={`text-sm ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  Hover or click a concept<br/>to see the connection
                </p>
              </div>
            )}
          </div>

          {/* Right Column - Analogy Terms */}
          <div className={`w-[35%] p-6 overflow-y-auto border-l ${isDarkMode ? 'border-neutral-700 bg-neutral-900/50' : 'border-neutral-200 bg-amber-50/30'}`}>
            <div className="flex items-center gap-2 mb-6">
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
                        ? 'scale-105 shadow-lg'
                        : 'hover:scale-102'
                      }
                      ${isInactive ? 'opacity-30' : 'opacity-100'}
                      ${isScrollingTo ? 'scroll-highlight' : ''}
                    `}
                    style={{
                      backgroundColor: isActive ? color + '25' : (isDarkMode ? '#1f2937' : '#ffffff'),
                      border: `2px solid ${isActive ? color : 'transparent'}`,
                      boxShadow: isActive ? `0 4px 20px ${color}30` : undefined,
                    }}
                  >
                    <ChevronRight
                      size={18}
                      className="transition-transform duration-300 rotate-180"
                      style={{
                        color: isActive ? color : (isDarkMode ? '#6b7280' : '#9ca3af'),
                        transform: isActive ? 'translateX(-4px) rotate(180deg)' : 'rotate(180deg)'
                      }}
                    />
                    <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
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
      <div className="px-6 py-3 border-t border-neutral-700 bg-neutral-900">
        <div className="flex items-center justify-between">
          <span className="text-neutral-500 text-xs">
            Click concepts to select • Hover to preview connections
          </span>
          <span className="text-neutral-600 text-xs">
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
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .scroll-highlight {
          animation: scrollPulse 0.8s ease-out;
        }
        .hover\\:scale-102:hover {
          transform: scale(1.02);
        }
      `}</style>
    </div>
  );
};

export default IsomorphicDualPane;
