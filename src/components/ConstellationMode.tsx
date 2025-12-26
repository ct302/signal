import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, ArrowRight, Sparkles, BookOpen, ChevronRight, Layers } from 'lucide-react';

interface ConceptMapItem {
  id: number;
  tech_term: string;
  analogy_term: string;
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

// Relationship labels that describe the isomorphic connection
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

export const ConstellationMode: React.FC<ConstellationModeProps> = ({
  conceptMap,
  importanceMap,
  isDarkMode,
  onClose,
  domainName = 'Your Expertise',
  topicName = 'New Topic'
}) => {
  const [selectedConcept, setSelectedConcept] = useState<number | null>(null);
  const [hoveredConcept, setHoveredConcept] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Update dimensions on mount and resize
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth - 100,
        height: window.innerHeight - 200
      });
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

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

  // Calculate node positions - static layout with expertise on left, learning on right
  const getNodePositions = useCallback(() => {
    const leftX = dimensions.width * 0.22;
    const rightX = dimensions.width * 0.78;
    const startY = 80;
    const spacing = Math.min(100, (dimensions.height - 160) / Math.max(conceptMap.length, 1));

    return conceptMap.map((concept, index) => {
      const y = startY + index * spacing + spacing / 2;
      const importance = getConceptImportance(concept);
      const color = CONCEPT_COLORS[index % CONCEPT_COLORS.length];

      return {
        concept,
        index,
        leftX,
        rightX,
        y,
        importance,
        color,
        relationshipLabel: RELATIONSHIP_LABELS[index % RELATIONSHIP_LABELS.length]
      };
    });
  }, [conceptMap, dimensions, getConceptImportance]);

  const nodePositions = getNodePositions();

  // Handle concept click
  const handleConceptClick = (conceptId: number) => {
    if (selectedConcept === conceptId) {
      setShowExplanation(!showExplanation);
    } else {
      setSelectedConcept(conceptId);
      setShowExplanation(true);
    }
  };

  // Get the selected concept data
  const selectedConceptData = selectedConcept !== null
    ? nodePositions.find(n => n.concept.id === selectedConcept)
    : null;

  // Generate curved path for bridge
  const generateBridgePath = (leftX: number, rightX: number, y: number): string => {
    const controlPointOffset = (rightX - leftX) * 0.3;
    return `M ${leftX + 80} ${y} C ${leftX + 80 + controlPointOffset} ${y}, ${rightX - 80 - controlPointOffset} ${y}, ${rightX - 80} ${y}`;
  };

  return (
    <div className="fixed inset-0 z-[80] bg-gradient-to-br from-neutral-900 via-neutral-950 to-black flex flex-col">
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${
        isDarkMode ? 'border-neutral-700 bg-neutral-900/80' : 'border-neutral-300 bg-white/90'
      } backdrop-blur-sm`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Layers className="text-blue-400" size={24} />
            <h2 className="text-white text-xl font-bold">Knowledge Bridge</h2>
          </div>
          <div className="flex items-center gap-2 text-neutral-400 text-sm">
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-medium">
              {domainName}
            </span>
            <ArrowRight size={16} />
            <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 font-medium">
              {topicName}
            </span>
          </div>
          <span className="text-neutral-500 text-sm ml-4">
            {conceptMap.length} isomorphic mappings
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-red-500 hover:text-white transition-colors"
          title="Close (Esc)"
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Graph Area */}
        <div className={`flex-1 relative ${showExplanation && selectedConceptData ? 'w-2/3' : 'w-full'} transition-all duration-500`}>
          {/* Domain Labels */}
          <div className="absolute top-4 left-0 right-0 flex justify-between px-12 pointer-events-none">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="text-amber-400" size={20} />
                <span className="text-amber-300 font-bold text-lg">Your Expertise</span>
              </div>
              <span className="text-amber-400/70 text-sm">{domainName}</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="text-blue-400" size={20} />
                <span className="text-blue-300 font-bold text-lg">New Knowledge</span>
              </div>
              <span className="text-blue-400/70 text-sm">{topicName}</span>
            </div>
          </div>

          {/* SVG Canvas */}
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="w-full h-full"
          >
            <defs>
              {/* Gradient for bridges */}
              {nodePositions.map((node) => (
                <linearGradient
                  key={`gradient-${node.concept.id}`}
                  id={`bridge-gradient-${node.concept.id}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor={node.color} stopOpacity="0.8" />
                  <stop offset="50%" stopColor={node.color} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={node.color} stopOpacity="0.8" />
                </linearGradient>
              ))}

              {/* Glow filter */}
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Arrow marker */}
              <marker
                id="arrow"
                markerWidth="10"
                markerHeight="10"
                refX="8"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L0,6 L9,3 z" fill="#6b7280" />
              </marker>
            </defs>

            {/* Background subtle grid */}
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Center vertical divider */}
            <line
              x1={dimensions.width / 2}
              y1={60}
              x2={dimensions.width / 2}
              y2={dimensions.height - 40}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="2"
              strokeDasharray="8 4"
            />

            {/* Isomorphic Bridges */}
            <g className="bridges">
              {nodePositions.map((node) => {
                const isSelected = selectedConcept === node.concept.id;
                const isHovered = hoveredConcept === node.concept.id;
                const isActive = isSelected || isHovered;
                const otherSelected = selectedConcept !== null && !isSelected;

                return (
                  <g
                    key={`bridge-${node.concept.id}`}
                    className="transition-all duration-500"
                    style={{ opacity: otherSelected && !isActive ? 0.2 : 1 }}
                  >
                    {/* Bridge path */}
                    <path
                      d={generateBridgePath(node.leftX, node.rightX, node.y)}
                      fill="none"
                      stroke={`url(#bridge-gradient-${node.concept.id})`}
                      strokeWidth={isActive ? 4 : 2}
                      strokeLinecap="round"
                      className="transition-all duration-300"
                      filter={isActive ? 'url(#glow)' : undefined}
                    />

                    {/* Relationship label on bridge */}
                    <text
                      x={dimensions.width / 2}
                      y={node.y - 8}
                      textAnchor="middle"
                      fontSize={isActive ? 13 : 11}
                      fontWeight={isActive ? '600' : '400'}
                      fill={isActive ? node.color : 'rgba(255,255,255,0.5)'}
                      className="transition-all duration-300 pointer-events-none select-none"
                    >
                      {node.relationshipLabel}
                    </text>

                    {/* Animated particles on bridge when active */}
                    {isActive && (
                      <>
                        <circle r={4} fill={node.color}>
                          <animateMotion
                            dur="2s"
                            repeatCount="indefinite"
                            path={generateBridgePath(node.leftX, node.rightX, node.y)}
                          />
                        </circle>
                        <circle r={3} fill={node.color} opacity={0.7}>
                          <animateMotion
                            dur="2s"
                            repeatCount="indefinite"
                            path={generateBridgePath(node.leftX, node.rightX, node.y)}
                            begin="0.5s"
                          />
                        </circle>
                        <circle r={2} fill={node.color} opacity={0.5}>
                          <animateMotion
                            dur="2s"
                            repeatCount="indefinite"
                            path={generateBridgePath(node.leftX, node.rightX, node.y)}
                            begin="1s"
                          />
                        </circle>
                      </>
                    )}
                  </g>
                );
              })}
            </g>

            {/* Left Domain Nodes (Expertise/Analogy) */}
            <g className="left-nodes">
              {nodePositions.map((node) => {
                const isSelected = selectedConcept === node.concept.id;
                const isHovered = hoveredConcept === node.concept.id;
                const isActive = isSelected || isHovered;
                const otherSelected = selectedConcept !== null && !isSelected;
                const radius = 30 + node.importance * 20;
                const label = cleanLabel(node.concept.analogy_term);

                return (
                  <g
                    key={`left-${node.concept.id}`}
                    transform={`translate(${node.leftX}, ${node.y})`}
                    className="cursor-pointer transition-all duration-300"
                    style={{
                      opacity: otherSelected && !isActive ? 0.3 : 1,
                      transform: `translate(${node.leftX}px, ${node.y}px) scale(${isActive ? 1.1 : 1})`
                    }}
                    onMouseEnter={() => setHoveredConcept(node.concept.id)}
                    onMouseLeave={() => setHoveredConcept(null)}
                    onClick={() => handleConceptClick(node.concept.id)}
                  >
                    {/* Glow ring for active state */}
                    {isActive && (
                      <circle
                        r={radius + 12}
                        fill="none"
                        stroke={node.color}
                        strokeWidth={3}
                        opacity={0.5}
                      >
                        <animate
                          attributeName="r"
                          values={`${radius + 12};${radius + 18};${radius + 12}`}
                          dur="1.5s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="0.5;0.2;0.5"
                          dur="1.5s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}

                    {/* Main node circle */}
                    <circle
                      r={radius}
                      fill={isDarkMode ? '#1f1f1f' : '#2a2a2a'}
                      stroke={node.color}
                      strokeWidth={isActive ? 4 : 2}
                    />

                    {/* Inner colored fill */}
                    <circle
                      r={radius - 4}
                      fill={node.color}
                      opacity={isActive ? 0.3 : 0.15}
                    />

                    {/* Domain badge */}
                    <circle
                      cx={0}
                      cy={-radius + 8}
                      r={10}
                      fill="#f59e0b"
                    />
                    <text
                      x={0}
                      y={-radius + 12}
                      textAnchor="middle"
                      fontSize={10}
                      fill="white"
                      fontWeight="bold"
                    >
                      E
                    </text>

                    {/* Label */}
                    <foreignObject
                      x={-radius + 8}
                      y={-12}
                      width={(radius - 8) * 2}
                      height={36}
                      className="pointer-events-none"
                    >
                      <div
                        className="w-full h-full flex items-center justify-center text-center"
                        style={{
                          fontSize: Math.max(11, Math.min(14, radius * 0.3)),
                          fontWeight: isActive ? 700 : 500,
                          color: '#fff',
                          lineHeight: 1.2,
                          textShadow: '0 1px 3px rgba(0,0,0,0.8)'
                        }}
                      >
                        {label.length > 20 ? label.slice(0, 18) + '...' : label}
                      </div>
                    </foreignObject>

                    {/* Importance indicator */}
                    <text
                      y={radius + 16}
                      textAnchor="middle"
                      fontSize={10}
                      fill="rgba(255,255,255,0.6)"
                    >
                      {Math.round(node.importance * 100)}%
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Right Domain Nodes (Learning/Tech) */}
            <g className="right-nodes">
              {nodePositions.map((node) => {
                const isSelected = selectedConcept === node.concept.id;
                const isHovered = hoveredConcept === node.concept.id;
                const isActive = isSelected || isHovered;
                const otherSelected = selectedConcept !== null && !isSelected;
                const radius = 30 + node.importance * 20;
                const label = cleanLabel(node.concept.tech_term);

                return (
                  <g
                    key={`right-${node.concept.id}`}
                    transform={`translate(${node.rightX}, ${node.y})`}
                    className="cursor-pointer transition-all duration-300"
                    style={{
                      opacity: otherSelected && !isActive ? 0.3 : 1,
                      transform: `translate(${node.rightX}px, ${node.y}px) scale(${isActive ? 1.1 : 1})`
                    }}
                    onMouseEnter={() => setHoveredConcept(node.concept.id)}
                    onMouseLeave={() => setHoveredConcept(null)}
                    onClick={() => handleConceptClick(node.concept.id)}
                  >
                    {/* Glow ring for active state */}
                    {isActive && (
                      <circle
                        r={radius + 12}
                        fill="none"
                        stroke={node.color}
                        strokeWidth={3}
                        opacity={0.5}
                      >
                        <animate
                          attributeName="r"
                          values={`${radius + 12};${radius + 18};${radius + 12}`}
                          dur="1.5s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="0.5;0.2;0.5"
                          dur="1.5s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}

                    {/* Main node circle */}
                    <circle
                      r={radius}
                      fill={isDarkMode ? '#1f1f1f' : '#2a2a2a'}
                      stroke={node.color}
                      strokeWidth={isActive ? 4 : 2}
                    />

                    {/* Inner colored fill */}
                    <circle
                      r={radius - 4}
                      fill={node.color}
                      opacity={isActive ? 0.3 : 0.15}
                    />

                    {/* Domain badge */}
                    <circle
                      cx={0}
                      cy={-radius + 8}
                      r={10}
                      fill="#3b82f6"
                    />
                    <text
                      x={0}
                      y={-radius + 12}
                      textAnchor="middle"
                      fontSize={10}
                      fill="white"
                      fontWeight="bold"
                    >
                      L
                    </text>

                    {/* Label */}
                    <foreignObject
                      x={-radius + 8}
                      y={-12}
                      width={(radius - 8) * 2}
                      height={36}
                      className="pointer-events-none"
                    >
                      <div
                        className="w-full h-full flex items-center justify-center text-center"
                        style={{
                          fontSize: Math.max(11, Math.min(14, radius * 0.3)),
                          fontWeight: isActive ? 700 : 500,
                          color: '#fff',
                          lineHeight: 1.2,
                          textShadow: '0 1px 3px rgba(0,0,0,0.8)'
                        }}
                      >
                        {label.length > 20 ? label.slice(0, 18) + '...' : label}
                      </div>
                    </foreignObject>

                    {/* Importance indicator */}
                    <text
                      y={radius + 16}
                      textAnchor="middle"
                      fontSize={10}
                      fill="rgba(255,255,255,0.6)"
                    >
                      {Math.round(node.importance * 100)}%
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Explanation Panel */}
        {showExplanation && selectedConceptData && (
          <div className={`w-1/3 border-l ${
            isDarkMode ? 'border-neutral-700 bg-neutral-900/95' : 'border-neutral-300 bg-neutral-800/95'
          } overflow-y-auto animate-in slide-in-from-right duration-300`}>
            {/* Panel Header */}
            <div className={`sticky top-0 px-6 py-4 border-b ${
              isDarkMode ? 'border-neutral-700 bg-neutral-900' : 'border-neutral-600 bg-neutral-800'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold text-lg">Deep Dive</h3>
                <button
                  onClick={() => setShowExplanation(false)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-700 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: selectedConceptData.color }}
                />
                <span className="text-neutral-300 text-sm">
                  Mapping {selectedConceptData.index + 1} of {conceptMap.length}
                </span>
              </div>
            </div>

            {/* Concept Comparison */}
            <div className="p-6 space-y-6">
              {/* Expertise Term */}
              <div className={`p-4 rounded-xl border ${
                isDarkMode ? 'bg-amber-900/20 border-amber-800/50' : 'bg-amber-900/30 border-amber-700/50'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="text-amber-400" size={16} />
                  <span className="text-amber-300 text-xs font-bold uppercase tracking-wider">
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
              <div className={`p-4 rounded-xl border ${
                isDarkMode ? 'bg-blue-900/20 border-blue-800/50' : 'bg-blue-900/30 border-blue-700/50'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="text-blue-400" size={16} />
                  <span className="text-blue-300 text-xs font-bold uppercase tracking-wider">
                    What You're Learning
                  </span>
                </div>
                <p className="text-white text-xl font-semibold">
                  {cleanLabel(selectedConceptData.concept.tech_term)}
                </p>
              </div>

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
                <p className="text-neutral-500 text-xs mt-2">
                  How central this concept is to understanding the topic
                </p>
              </div>

              {/* Structural Isomorphism Explanation */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-neutral-800/80 to-neutral-900/80 border border-neutral-700">
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Layers size={16} className="text-purple-400" />
                  Why This Works
                </h4>
                <p className="text-neutral-300 text-sm leading-relaxed">
                  Just as <span className="text-amber-300 font-medium">{cleanLabel(selectedConceptData.concept.analogy_term)}</span> functions
                  in {domainName}, <span className="text-blue-300 font-medium">{cleanLabel(selectedConceptData.concept.tech_term)}</span> serves
                  a similar structural role in {topicName}. The underlying patterns and relationships are preserved across both domains.
                </p>
              </div>

              {/* Instructions */}
              <div className="text-center text-neutral-500 text-xs pt-4">
                Click other concepts to explore more mappings
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Instructions */}
      <div className={`px-6 py-3 border-t ${
        isDarkMode ? 'border-neutral-700 bg-neutral-900/80' : 'border-neutral-300 bg-neutral-800/80'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-neutral-400 text-sm">
            Click any concept to explore the isomorphic connection • Hover to highlight bridges
          </span>
          <span className="text-neutral-500 text-xs">
            Press Esc to close
          </span>
        </div>
      </div>
    </div>
  );
};

export default ConstellationMode;
