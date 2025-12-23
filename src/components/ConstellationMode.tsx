import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Play, Pause, RotateCcw } from 'lucide-react';

// Types for the graph
interface GraphNode {
  id: string;
  label: string;
  techTerm: string;
  analogyTerm: string;
  weight: number;
  conceptIndex: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null; // Fixed x position (for dragging)
  fy?: number | null; // Fixed y position (for dragging)
}

interface GraphEdge {
  source: string;
  target: string;
  strength: number;
}

interface ConstellationModeProps {
  conceptMap: Array<{
    id: number;
    tech_term: string;
    analogy_term: string;
  }>;
  importanceMap: Array<{
    term: string;
    importance: number;
  }>;
  isAnalogyMode: boolean;
  isDarkMode: boolean;
  onClose: () => void;
}

// Color palette for concepts
const CONCEPT_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4'
];

export const ConstellationMode: React.FC<ConstellationModeProps> = ({
  conceptMap,
  importanceMap,
  isAnalogyMode,
  isDarkMode,
  onClose
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<number | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [isSimulating, setIsSimulating] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Initialize graph data from concept map
  useEffect(() => {
    if (!conceptMap.length) return;

    const width = window.innerWidth - 100;
    const height = window.innerHeight - 200;
    setDimensions({ width, height });

    const centerX = width / 2;
    const centerY = height / 2;

    // Create nodes from concept map
    const graphNodes: GraphNode[] = conceptMap.map((concept, index) => {
      // Find importance for this concept
      const importanceEntry = importanceMap.find(
        imp => imp.term.toLowerCase().includes(concept.tech_term.toLowerCase()) ||
               concept.tech_term.toLowerCase().includes(imp.term.toLowerCase())
      );
      const weight = importanceEntry?.importance || 0.5;

      // Random initial position in a circle around center
      const angle = (index / conceptMap.length) * Math.PI * 2;
      const radius = Math.min(width, height) * 0.3;

      return {
        id: `node-${concept.id}`,
        label: isAnalogyMode ? concept.analogy_term : concept.tech_term,
        techTerm: concept.tech_term,
        analogyTerm: concept.analogy_term,
        weight: weight,
        conceptIndex: index,
        x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 50,
        y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 50,
        vx: 0,
        vy: 0
      };
    });

    // Create edges - connect concepts that might be related
    // For now, connect sequential concepts and some cross-connections
    const graphEdges: GraphEdge[] = [];

    for (let i = 0; i < graphNodes.length; i++) {
      // Connect to next node (circular)
      const nextIndex = (i + 1) % graphNodes.length;
      graphEdges.push({
        source: graphNodes[i].id,
        target: graphNodes[nextIndex].id,
        strength: 0.5
      });

      // Connect to node 2 positions away for more web-like structure
      if (graphNodes.length > 3) {
        const skipIndex = (i + 2) % graphNodes.length;
        graphEdges.push({
          source: graphNodes[i].id,
          target: graphNodes[skipIndex].id,
          strength: 0.3
        });
      }

      // Connect high-importance nodes to center concept
      if (graphNodes[i].weight > 0.7 && i > 0) {
        graphEdges.push({
          source: graphNodes[i].id,
          target: graphNodes[0].id,
          strength: 0.4
        });
      }
    }

    setNodes(graphNodes);
    setEdges(graphEdges);
  }, [conceptMap, importanceMap, isAnalogyMode]);

  // Force simulation
  const simulate = useCallback(() => {
    if (!isSimulating || nodes.length === 0) return;

    setNodes(currentNodes => {
      const newNodes = currentNodes.map(node => ({ ...node }));

      const width = dimensions.width;
      const height = dimensions.height;
      const centerX = width / 2;
      const centerY = height / 2;

      // Force parameters
      const repulsionStrength = 5000;
      const attractionStrength = 0.01;
      const centerGravity = 0.02;
      const damping = 0.85;
      const minDistance = 80;

      // Calculate forces for each node
      for (let i = 0; i < newNodes.length; i++) {
        const node = newNodes[i];

        // Skip if node is being dragged
        if (node.fx !== undefined && node.fx !== null) {
          node.x = node.fx;
          node.y = node.fy!;
          node.vx = 0;
          node.vy = 0;
          continue;
        }

        let fx = 0;
        let fy = 0;

        // Repulsion from other nodes (Coulomb's law)
        for (let j = 0; j < newNodes.length; j++) {
          if (i === j) continue;

          const other = newNodes[j];
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;

          if (distance < minDistance * 3) {
            const force = repulsionStrength / (distance * distance);
            fx += (dx / distance) * force;
            fy += (dy / distance) * force;
          }
        }

        // Attraction along edges (spring force)
        for (const edge of edges) {
          let other: GraphNode | undefined;
          if (edge.source === node.id) {
            other = newNodes.find(n => n.id === edge.target);
          } else if (edge.target === node.id) {
            other = newNodes.find(n => n.id === edge.source);
          }

          if (other) {
            const dx = other.x - node.x;
            const dy = other.y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            const idealDistance = 150;
            const force = (distance - idealDistance) * attractionStrength * edge.strength;
            fx += (dx / distance) * force;
            fy += (dy / distance) * force;
          }
        }

        // Gravity toward center
        fx += (centerX - node.x) * centerGravity;
        fy += (centerY - node.y) * centerGravity;

        // Update velocity with damping
        node.vx = (node.vx + fx) * damping;
        node.vy = (node.vy + fy) * damping;

        // Update position
        node.x += node.vx;
        node.y += node.vy;

        // Boundary constraints
        const nodeRadius = 30 + node.weight * 20;
        node.x = Math.max(nodeRadius, Math.min(width - nodeRadius, node.x));
        node.y = Math.max(nodeRadius, Math.min(height - nodeRadius, node.y));
      }

      return newNodes;
    });

    animationRef.current = requestAnimationFrame(simulate);
  }, [isSimulating, nodes.length, edges, dimensions]);

  // Start/stop simulation
  useEffect(() => {
    if (isSimulating && nodes.length > 0) {
      animationRef.current = requestAnimationFrame(simulate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isSimulating, simulate, nodes.length]);

  // Handle mouse events for dragging
  const handleMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setDraggedNode(nodeId);
    setNodes(current => current.map(n =>
      n.id === nodeId ? { ...n, fx: n.x, fy: n.y } : n
    ));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedNode || !svgRef.current) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setNodes(current => current.map(n =>
      n.id === draggedNode ? { ...n, fx: x, fy: y, x, y } : n
    ));
  };

  const handleMouseUp = () => {
    if (draggedNode) {
      setNodes(current => current.map(n =>
        n.id === draggedNode ? { ...n, fx: null, fy: null } : n
      ));
      setDraggedNode(null);
    }
  };

  // Reset simulation
  const resetSimulation = () => {
    const width = dimensions.width;
    const height = dimensions.height;
    const centerX = width / 2;
    const centerY = height / 2;

    setNodes(current => current.map((node, index) => {
      const angle = (index / current.length) * Math.PI * 2;
      const radius = Math.min(width, height) * 0.3;
      return {
        ...node,
        x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 50,
        y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 50,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null
      };
    }));
    setIsSimulating(true);
  };

  // Get node radius based on importance
  const getNodeRadius = (weight: number) => 25 + weight * 25;

  // Get edge opacity based on hover state
  const getEdgeOpacity = (edge: GraphEdge) => {
    if (!hoveredNode) return 0.3;
    if (edge.source === hoveredNode || edge.target === hoveredNode) return 0.8;
    return 0.1;
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-700">
        <div className="flex items-center gap-4">
          <h2 className="text-white text-lg font-bold">Constellation Mode</h2>
          <span className="text-neutral-400 text-sm">
            {isAnalogyMode ? 'Analogy View' : 'Technical View'} • {nodes.length} concepts
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className="p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
            title={isSimulating ? 'Pause simulation' : 'Resume simulation'}
          >
            {isSimulating ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            onClick={resetSimulation}
            className="p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
            title="Reset layout"
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-red-500 hover:text-white transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Graph Canvas */}
      <div className="flex-1 overflow-hidden">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="w-full h-full"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Edges */}
          <g className="edges">
            {edges.map((edge, index) => {
              const sourceNode = nodes.find(n => n.id === edge.source);
              const targetNode = nodes.find(n => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              const isHighlighted = hoveredNode === edge.source || hoveredNode === edge.target;

              return (
                <line
                  key={`edge-${index}`}
                  x1={sourceNode.x}
                  y1={sourceNode.y}
                  x2={targetNode.x}
                  y2={targetNode.y}
                  stroke={isHighlighted ? '#60a5fa' : '#6b7280'}
                  strokeWidth={isHighlighted ? 2 : 1}
                  strokeOpacity={getEdgeOpacity(edge)}
                  className="transition-all duration-200"
                />
              );
            })}
          </g>

          {/* Nodes */}
          <g className="nodes">
            {nodes.map((node) => {
              const radius = getNodeRadius(node.weight);
              const color = CONCEPT_COLORS[node.conceptIndex % CONCEPT_COLORS.length];
              const isHovered = hoveredNode === node.id;
              const isDragging = draggedNode === node.id;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => !isDragging && setHoveredNode(null)}
                  onMouseDown={(e) => handleMouseDown(node.id, e)}
                  className="cursor-pointer"
                >
                  {/* Glow effect */}
                  {isHovered && (
                    <circle
                      r={radius + 10}
                      fill={color}
                      opacity={0.2}
                      className="animate-pulse"
                    />
                  )}

                  {/* Main circle */}
                  <circle
                    r={radius}
                    fill={isDarkMode ? '#1f2937' : '#f3f4f6'}
                    stroke={color}
                    strokeWidth={isHovered ? 4 : 2}
                    className="transition-all duration-200"
                  />

                  {/* Inner colored circle */}
                  <circle
                    r={radius * 0.7}
                    fill={color}
                    opacity={0.2}
                  />

                  {/* Label */}
                  <text
                    textAnchor="middle"
                    dy="0.35em"
                    fontSize={Math.max(10, Math.min(14, radius * 0.4))}
                    fill={isDarkMode ? '#e5e7eb' : '#1f2937'}
                    fontWeight={isHovered ? 'bold' : 'normal'}
                    className="pointer-events-none select-none"
                  >
                    {node.label.length > 15 ? node.label.slice(0, 12) + '...' : node.label}
                  </text>

                  {/* Weight indicator */}
                  <text
                    textAnchor="middle"
                    dy={radius + 15}
                    fontSize={10}
                    fill="#9ca3af"
                    className="pointer-events-none select-none"
                  >
                    {Math.round(node.weight * 100)}%
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Tooltip for hovered node */}
      {hoveredNode && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-neutral-800 border border-neutral-600 rounded-lg px-4 py-3 shadow-xl">
          {(() => {
            const node = nodes.find(n => n.id === hoveredNode);
            if (!node) return null;
            return (
              <div className="text-center">
                <div className="text-white font-medium">{node.label}</div>
                <div className="text-neutral-400 text-sm mt-1">
                  {isAnalogyMode ? (
                    <>Tech: <span className="text-blue-400">{node.techTerm}</span></>
                  ) : (
                    <>Analogy: <span className="text-amber-400">{node.analogyTerm}</span></>
                  )}
                </div>
                <div className="text-neutral-500 text-xs mt-1">
                  Importance: {Math.round(node.weight * 100)}%
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 text-neutral-500 text-xs">
        Drag nodes to rearrange • Hover for details • Press G or Esc to close
      </div>
    </div>
  );
};

export default ConstellationMode;
