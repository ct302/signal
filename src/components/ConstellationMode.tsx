import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Play, Pause, RotateCcw, Pin, Unlock, Target, Orbit } from 'lucide-react';

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
  pinned: boolean; // Whether node is pinned in place
  orbitAngle?: number; // For focus mode orbit animation
  orbitRadius?: number; // Distance from focused node
  anchorX?: number; // Original position for tether constraint
  anchorY?: number;
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
    // Handle commands with arguments like \boldsymbol{C} -> C
    .replace(/\\(boldsymbol|mathbf|mathbb|mathcal|mathrm|textbf|text)\{([^}]*)\}/g, '$2')
    .replace(/\\[a-zA-Z]+/g, (match) => {
      // Convert common LaTeX commands to readable text
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
    .replace(/\{([^}]*)\}/g, '$1') // Remove remaining braces
    .trim();
};

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
  const [focusedNode, setFocusedNode] = useState<string | null>(null); // For focus/explosion mode
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [anchorNode, setAnchorNode] = useState<string | null>(null); // Highest importance node
  const [tetherTension, setTetherTension] = useState<Map<string, number>>(new Map()); // Track tether strain
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

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

      // Initial position in a wider, more uniform spread
      const angle = (index / conceptMap.length) * Math.PI * 2;
      // Vary radius based on weight - important nodes closer to center
      const baseRadius = Math.min(width, height) * 0.35;
      const radiusVariation = (1 - weight) * 0.2 * baseRadius; // Less important = further out
      const radius = baseRadius + radiusVariation;

      const rawLabel = isAnalogyMode ? concept.analogy_term : concept.tech_term;

      return {
        id: `node-${concept.id}`,
        label: cleanLabel(rawLabel),
        techTerm: concept.tech_term,
        analogyTerm: concept.analogy_term,
        weight: weight,
        conceptIndex: index,
        x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 30,
        y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 30,
        vx: 0,
        vy: 0,
        pinned: false
      };
    });

    // Create edges - connect concepts that might be related
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

    // Set anchor node to highest importance concept
    const highestImportance = graphNodes.reduce((max, node) =>
      node.weight > max.weight ? node : max, graphNodes[0]);
    setAnchorNode(highestImportance?.id || null);
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

      // Force parameters - tuned for smooth, non-overlapping layout
      const repulsionStrength = 12000; // Increased to prevent overlap
      const attractionStrength = 0.008; // Reduced for gentler springs
      const centerGravity = 0.015; // Slightly reduced
      const damping = 0.92; // Increased for smoother motion
      const minDistance = 120; // Increased minimum separation

      // Calculate forces for each node
      for (let i = 0; i < newNodes.length; i++) {
        const node = newNodes[i];

        // Skip pinned nodes - they stay in place
        if (node.pinned) {
          node.vx = 0;
          node.vy = 0;
          continue;
        }

        let fx = 0;
        let fy = 0;

        // Repulsion from other nodes (Coulomb's law) - always active to prevent overlap
        for (let j = 0; j < newNodes.length; j++) {
          if (i === j) continue;

          const other = newNodes[j];
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;

          // Calculate combined radii for proper spacing
          const nodeRadius = 25 + node.weight * 25;
          const otherRadius = 25 + other.weight * 25;
          const combinedRadius = nodeRadius + otherRadius + 40; // Add buffer

          // Apply repulsion if within range
          if (distance < Math.max(minDistance * 4, combinedRadius * 2)) {
            // Stronger repulsion when very close
            const distanceFactor = distance < combinedRadius ? 2 : 1;
            const force = (repulsionStrength * distanceFactor) / (distance * distance);
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
            const idealDistance = 180; // Increased for better spacing
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

        // Cap maximum velocity for smoother motion
        const maxVelocity = 8;
        const velocity = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (velocity > maxVelocity) {
          node.vx = (node.vx / velocity) * maxVelocity;
          node.vy = (node.vy / velocity) * maxVelocity;
        }

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

  // Get connected nodes with their connection strengths
  const getConnectedNodes = useCallback((nodeId: string): Array<{ id: string; strength: number }> => {
    const connected: Array<{ id: string; strength: number }> = [];
    for (const edge of edges) {
      if (edge.source === nodeId) {
        connected.push({ id: edge.target, strength: edge.strength });
      } else if (edge.target === nodeId) {
        connected.push({ id: edge.source, strength: edge.strength });
      }
    }
    return connected;
  }, [edges]);

  // Handle mouse events for dragging with magnetic chains
  const handleMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setDraggedNode(nodeId);
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      dragStartPos.current = { x: node.x, y: node.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedNode || !svgRef.current) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    let newX = e.clientX - rect.left;
    let newY = e.clientY - rect.top;

    // Get the drag delta
    const draggedNodeData = nodes.find(n => n.id === draggedNode);
    if (!draggedNodeData) return;

    // TETHERED CONSTRAINT: Limit how far non-anchor nodes can go from anchor
    const anchorNodeData = nodes.find(n => n.id === anchorNode);
    const isAnchor = draggedNode === anchorNode;

    if (!isAnchor && anchorNodeData) {
      // Calculate connection strength to anchor
      const connectionToAnchor = edges.find(e =>
        (e.source === draggedNode && e.target === anchorNode) ||
        (e.target === draggedNode && e.source === anchorNode)
      );
      const connectionStrength = connectionToAnchor?.strength || 0.3;

      // Max distance based on connection strength (stronger = shorter leash)
      // Strength 1.0 = max 150px, Strength 0.3 = max 400px
      const maxDistance = 150 + (1 - connectionStrength) * 350;

      // Calculate distance from anchor
      const dxToAnchor = newX - anchorNodeData.x;
      const dyToAnchor = newY - anchorNodeData.y;
      const distanceToAnchor = Math.sqrt(dxToAnchor * dxToAnchor + dyToAnchor * dyToAnchor);

      // Calculate tension (0 = relaxed, 1 = max strain)
      const tension = Math.min(1, distanceToAnchor / maxDistance);

      // Update tether tension for visual feedback
      setTetherTension(prev => {
        const newMap = new Map(prev);
        newMap.set(draggedNode, tension);
        return newMap;
      });

      // Constrain to max distance if exceeded
      if (distanceToAnchor > maxDistance) {
        const angle = Math.atan2(dyToAnchor, dxToAnchor);
        newX = anchorNodeData.x + Math.cos(angle) * maxDistance;
        newY = anchorNodeData.y + Math.sin(angle) * maxDistance;
      }
    }

    const deltaX = newX - draggedNodeData.x;
    const deltaY = newY - draggedNodeData.y;

    // Apply magnetic pull to connected nodes based on connection strength
    const connectedNodes = getConnectedNodes(draggedNode);

    setNodes(current => current.map(n => {
      if (n.id === draggedNode) {
        // Main dragged node moves (with tether constraint applied above)
        return { ...n, x: newX, y: newY };
      }

      // Check if this node is connected to the dragged node
      const connection = connectedNodes.find(cn => cn.id === n.id);
      if (connection && !n.pinned) {
        // Apply elastic pull based on connection strength
        // Higher strength = more pull (follows more closely)
        const pullFactor = connection.strength * 0.6; // 0 to 0.6 pull
        let elasticX = n.x + deltaX * pullFactor;
        let elasticY = n.y + deltaY * pullFactor;

        // Also apply tether constraint to connected nodes
        if (anchorNodeData && n.id !== anchorNode) {
          const connToAnchor = edges.find(e =>
            (e.source === n.id && e.target === anchorNode) ||
            (e.target === n.id && e.source === anchorNode)
          );
          const connStrength = connToAnchor?.strength || 0.3;
          const maxDist = 150 + (1 - connStrength) * 350;

          const dx = elasticX - anchorNodeData.x;
          const dy = elasticY - anchorNodeData.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > maxDist) {
            const angle = Math.atan2(dy, dx);
            elasticX = anchorNodeData.x + Math.cos(angle) * maxDist;
            elasticY = anchorNodeData.y + Math.sin(angle) * maxDist;
          }
        }

        // Boundary constraints
        const nodeRadius = 30 + n.weight * 20;
        const constrainedX = Math.max(nodeRadius, Math.min(dimensions.width - nodeRadius, elasticX));
        const constrainedY = Math.max(nodeRadius, Math.min(dimensions.height - nodeRadius, elasticY));

        return { ...n, x: constrainedX, y: constrainedY };
      }

      return n;
    }));
  };

  const handleMouseUp = () => {
    if (draggedNode) {
      // Pin the node where it was dropped
      setNodes(current => current.map(n =>
        n.id === draggedNode ? { ...n, pinned: true } : n
      ));
      setDraggedNode(null);
      dragStartPos.current = null;
      // Clear tether tension
      setTetherTension(new Map());
    }
  };

  // Double-click to toggle focus mode on a node
  const handleDoubleClick = (nodeId: string) => {
    if (focusedNode === nodeId) {
      // Unpin and exit focus mode
      setFocusedNode(null);
      setNodes(current => current.map(n => ({ ...n, pinned: false })));
      setIsSimulating(true);
    } else {
      // Enter focus mode - this node becomes the center
      setFocusedNode(nodeId);
      setIsSimulating(false);

      // Calculate orbit positions for non-focused nodes
      const focusNode = nodes.find(n => n.id === nodeId);
      if (!focusNode) return;

      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      const connectedNodes = getConnectedNodes(nodeId);

      setNodes(current => {
        const nonFocused = current.filter(n => n.id !== nodeId);
        const totalNonFocused = nonFocused.length;

        return current.map((n, idx) => {
          if (n.id === nodeId) {
            // Focused node goes to center and gets pinned
            return { ...n, x: centerX, y: centerY, pinned: true };
          }

          // Calculate orbit position based on connection strength
          const connection = connectedNodes.find(cn => cn.id === n.id);
          const connectionStrength = connection?.strength || 0.2;

          // Closer connection = smaller orbit
          const baseRadius = 180;
          const orbitRadius = baseRadius + (1 - connectionStrength) * 150;

          // Distribute around the circle
          const nonFocusedIndex = nonFocused.findIndex(nf => nf.id === n.id);
          const angle = (nonFocusedIndex / totalNonFocused) * Math.PI * 2;

          return {
            ...n,
            x: centerX + Math.cos(angle) * orbitRadius,
            y: centerY + Math.sin(angle) * orbitRadius,
            orbitAngle: angle,
            orbitRadius: orbitRadius,
            pinned: false
          };
        });
      });
    }
  };

  // Unpin all nodes and exit focus mode
  const unpinAll = () => {
    setFocusedNode(null);
    setNodes(current => current.map(n => ({ ...n, pinned: false })));
    setIsSimulating(true);
  };

  // Exit focus mode
  const exitFocusMode = () => {
    setFocusedNode(null);
    setNodes(current => current.map(n => ({ ...n, pinned: false })));
    setIsSimulating(true);
  };

  // Orbit animation for focus mode
  useEffect(() => {
    if (!focusedNode) return;

    const orbitSpeed = 0.005; // radians per frame
    let animId: number;

    const animateOrbit = () => {
      setNodes(current => {
        const focusNode = current.find(n => n.id === focusedNode);
        if (!focusNode) return current;

        return current.map(n => {
          if (n.id === focusedNode || n.pinned) return n;

          // Slowly orbit around the focused node
          const newAngle = (n.orbitAngle || 0) + orbitSpeed;
          const orbitRadius = n.orbitRadius || 200;

          return {
            ...n,
            x: focusNode.x + Math.cos(newAngle) * orbitRadius,
            y: focusNode.y + Math.sin(newAngle) * orbitRadius,
            orbitAngle: newAngle
          };
        });
      });

      animId = requestAnimationFrame(animateOrbit);
    };

    animId = requestAnimationFrame(animateOrbit);
    return () => cancelAnimationFrame(animId);
  }, [focusedNode]);

  // Reset simulation
  const resetSimulation = () => {
    const width = dimensions.width;
    const height = dimensions.height;
    const centerX = width / 2;
    const centerY = height / 2;

    setFocusedNode(null); // Exit focus mode on reset

    setNodes(current => current.map((node, index) => {
      const angle = (index / current.length) * Math.PI * 2;
      const radius = Math.min(width, height) * 0.3;
      return {
        ...node,
        x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 50,
        y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 50,
        vx: 0,
        vy: 0,
        pinned: false,
        orbitAngle: undefined,
        orbitRadius: undefined
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

  // Get tether color based on tension (0 = green/relaxed, 1 = red/strained)
  const getTetherColor = (tension: number): string => {
    if (tension < 0.5) {
      // Green to Yellow (0-0.5)
      const t = tension * 2;
      const r = Math.round(34 + t * (234 - 34));
      const g = Math.round(197 + t * (179 - 197));
      const b = Math.round(94 + t * (8 - 94));
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Yellow to Red (0.5-1)
      const t = (tension - 0.5) * 2;
      const r = Math.round(234 + t * (239 - 234));
      const g = Math.round(179 - t * 111);
      const b = Math.round(8 + t * (68 - 8));
      return `rgb(${r}, ${g}, ${b})`;
    }
  };

  // Count pinned nodes
  const pinnedCount = nodes.filter(n => n.pinned).length;

  // Get focused node label for display
  const focusedNodeData = focusedNode ? nodes.find(n => n.id === focusedNode) : null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-700">
        <div className="flex items-center gap-4">
          <h2 className="text-white text-lg font-bold">Constellation Mode</h2>
          <span className="text-neutral-400 text-sm">
            {isAnalogyMode ? 'Analogy View' : 'Technical View'} • {nodes.length} concepts
            {pinnedCount > 0 && <span className="text-amber-400 ml-2">• {pinnedCount} pinned</span>}
          </span>
          {focusedNode && (
            <span className="flex items-center gap-2 text-cyan-400 text-sm bg-cyan-400/10 px-3 py-1 rounded-full">
              <Target size={14} />
              Focus: {focusedNodeData?.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {focusedNode ? (
            <button
              onClick={exitFocusMode}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
              title="Exit focus mode"
            >
              <Orbit size={18} />
              Exit Focus
            </button>
          ) : (
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className="p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
              title={isSimulating ? 'Pause simulation' : 'Resume simulation'}
            >
              {isSimulating ? <Pause size={18} /> : <Play size={18} />}
            </button>
          )}
          {pinnedCount > 0 && !focusedNode && (
            <button
              onClick={unpinAll}
              className="p-2 rounded-lg bg-neutral-800 text-amber-400 hover:bg-neutral-700 transition-colors"
              title="Unpin all nodes"
            >
              <Unlock size={18} />
            </button>
          )}
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
          {/* Background grid and filters */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
            </pattern>
            {/* Glow filter for focused node */}
            <filter id="focusGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            {/* Radial gradient for orbit rings */}
            <radialGradient id="orbitGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0"/>
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Orbit rings for focus mode */}
          {focusedNode && focusedNodeData && (
            <g className="orbit-rings">
              {/* Inner orbit ring */}
              <circle
                cx={focusedNodeData.x}
                cy={focusedNodeData.y}
                r={180}
                fill="none"
                stroke="#22d3ee"
                strokeWidth={1}
                strokeOpacity={0.3}
                strokeDasharray="8 4"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`0 ${focusedNodeData.x} ${focusedNodeData.y}`}
                  to={`360 ${focusedNodeData.x} ${focusedNodeData.y}`}
                  dur="30s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Outer orbit ring */}
              <circle
                cx={focusedNodeData.x}
                cy={focusedNodeData.y}
                r={330}
                fill="none"
                stroke="#22d3ee"
                strokeWidth={1}
                strokeOpacity={0.2}
                strokeDasharray="12 6"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`360 ${focusedNodeData.x} ${focusedNodeData.y}`}
                  to={`0 ${focusedNodeData.x} ${focusedNodeData.y}`}
                  dur="45s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Center glow */}
              <circle
                cx={focusedNodeData.x}
                cy={focusedNodeData.y}
                r={100}
                fill="url(#orbitGradient)"
              />
            </g>
          )}

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

          {/* Visual Elastic Tethers - shown when dragging */}
          {draggedNode && anchorNode && draggedNode !== anchorNode && (() => {
            const draggedNodeData = nodes.find(n => n.id === draggedNode);
            const anchorNodeData = nodes.find(n => n.id === anchorNode);
            if (!draggedNodeData || !anchorNodeData) return null;

            const tension = tetherTension.get(draggedNode) || 0;
            const tetherColor = getTetherColor(tension);

            // Calculate control point for curved elastic tether
            const midX = (draggedNodeData.x + anchorNodeData.x) / 2;
            const midY = (draggedNodeData.y + anchorNodeData.y) / 2;
            // Add sag based on tension (less sag when stretched)
            const dx = draggedNodeData.x - anchorNodeData.x;
            const dy = draggedNodeData.y - anchorNodeData.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const perpX = -dy / distance;
            const perpY = dx / distance;
            const sagAmount = 30 * (1 - tension); // Sag decreases as tension increases
            const controlX = midX + perpX * sagAmount;
            const controlY = midY + perpY * sagAmount;

            return (
              <g className="tether-visualization">
                {/* Main tether line with curve */}
                <path
                  d={`M ${anchorNodeData.x} ${anchorNodeData.y} Q ${controlX} ${controlY} ${draggedNodeData.x} ${draggedNodeData.y}`}
                  fill="none"
                  stroke={tetherColor}
                  strokeWidth={3 + tension * 2}
                  strokeLinecap="round"
                  strokeDasharray={tension > 0.8 ? "8 4" : "none"}
                  opacity={0.8}
                />
                {/* Anchor indicator glow */}
                <circle
                  cx={anchorNodeData.x}
                  cy={anchorNodeData.y}
                  r={getNodeRadius(anchorNodeData.weight) + 8}
                  fill="none"
                  stroke={tetherColor}
                  strokeWidth={2}
                  opacity={0.6}
                >
                  <animate
                    attributeName="r"
                    values={`${getNodeRadius(anchorNodeData.weight) + 8};${getNodeRadius(anchorNodeData.weight) + 14};${getNodeRadius(anchorNodeData.weight) + 8}`}
                    dur="1s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.6;0.3;0.6"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                </circle>
                {/* Tension indicator near dragged node */}
                {tension > 0.5 && (
                  <text
                    x={draggedNodeData.x}
                    y={draggedNodeData.y - getNodeRadius(draggedNodeData.weight) - 20}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight="bold"
                    fill={tetherColor}
                  >
                    {tension > 0.9 ? 'MAX!' : tension > 0.7 ? 'STRAIN' : 'pulling...'}
                  </text>
                )}
              </g>
            );
          })()}

          {/* Nodes */}
          <g className="nodes">
            {nodes.map((node) => {
              const radius = getNodeRadius(node.weight);
              const color = CONCEPT_COLORS[node.conceptIndex % CONCEPT_COLORS.length];
              const isHovered = hoveredNode === node.id;
              const isDragging = draggedNode === node.id;
              const isFocused = focusedNode === node.id;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => !isDragging && setHoveredNode(null)}
                  onMouseDown={(e) => handleMouseDown(node.id, e)}
                  onDoubleClick={() => handleDoubleClick(node.id)}
                  className="cursor-pointer"
                  style={{ filter: isFocused ? 'url(#focusGlow)' : undefined }}
                >
                  {/* Focus mode outer ring */}
                  {isFocused && (
                    <circle
                      r={radius + 15}
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth={3}
                      opacity={0.8}
                    >
                      <animate
                        attributeName="r"
                        values={`${radius + 15};${radius + 25};${radius + 15}`}
                        dur="2s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.8;0.3;0.8"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* Glow effect */}
                  {(isHovered || isFocused) && (
                    <circle
                      r={radius + 10}
                      fill={isFocused ? '#22d3ee' : color}
                      opacity={0.3}
                      className={isFocused ? '' : 'animate-pulse'}
                    />
                  )}

                  {/* Pin indicator ring (not shown in focus mode) */}
                  {node.pinned && !isFocused && (
                    <circle
                      r={radius + 4}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                      opacity={0.8}
                    />
                  )}

                  {/* Main circle */}
                  <circle
                    r={radius}
                    fill={isDarkMode ? '#1f2937' : '#f3f4f6'}
                    stroke={isFocused ? '#22d3ee' : color}
                    strokeWidth={isHovered || isFocused ? 4 : 2}
                    className="transition-all duration-200"
                  />

                  {/* Inner colored circle */}
                  <circle
                    r={radius * 0.7}
                    fill={isFocused ? '#22d3ee' : color}
                    opacity={isFocused ? 0.4 : 0.2}
                  />

                  {/* Label using foreignObject for proper text rendering */}
                  <foreignObject
                    x={-radius + 5}
                    y={-radius / 2}
                    width={(radius - 5) * 2}
                    height={radius}
                    className="pointer-events-none"
                  >
                    <div
                      className="w-full h-full flex items-center justify-center text-center select-none"
                      style={{
                        fontSize: `${Math.max(10, Math.min(14, radius * 0.35))}px`,
                        fontWeight: isHovered ? 'bold' : 'normal',
                        color: isDarkMode ? '#e5e7eb' : '#1f2937',
                        lineHeight: 1.2,
                        overflow: 'hidden',
                        wordBreak: 'break-word'
                      }}
                    >
                      {(() => {
                        // Smart truncation based on node size
                        const maxChars = Math.floor(radius * 0.6);
                        const label = node.label;
                        if (label.length <= maxChars) return label;
                        // Prefer breaking at word boundaries
                        const truncated = label.slice(0, maxChars - 2);
                        const lastSpace = truncated.lastIndexOf(' ');
                        if (lastSpace > maxChars * 0.5) {
                          return truncated.slice(0, lastSpace) + '…';
                        }
                        return truncated + '…';
                      })()}
                    </div>
                  </foreignObject>

                  {/* Expanded label shown on hover for truncated text */}
                  {isHovered && node.label.length > Math.floor(radius * 0.6) && (
                    <g className="expanded-label">
                      <rect
                        x={-node.label.length * 4}
                        y={-radius - 35}
                        width={node.label.length * 8}
                        height={24}
                        rx={4}
                        fill={isDarkMode ? '#1f2937' : '#f3f4f6'}
                        stroke={color}
                        strokeWidth={1}
                        opacity={0.95}
                      />
                      <text
                        textAnchor="middle"
                        y={-radius - 18}
                        fontSize={12}
                        fontWeight="bold"
                        fill={isDarkMode ? '#e5e7eb' : '#1f2937'}
                        className="pointer-events-none select-none"
                      >
                        {node.label}
                      </text>
                    </g>
                  )}

                  {/* Pin icon */}
                  {node.pinned && (
                    <g transform={`translate(${radius - 8}, ${-radius + 8})`}>
                      <circle r={8} fill="#f59e0b" />
                      <Pin size={10} color="white" style={{ transform: 'translate(-5px, -5px)' }} />
                    </g>
                  )}

                  {/* Weight indicator */}
                  <text
                    textAnchor="middle"
                    dy={radius + 18}
                    fontSize={11}
                    fontWeight="600"
                    fill="#ffffff"
                    className="pointer-events-none select-none"
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
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
                    <>Tech: <span className="text-blue-400">{cleanLabel(node.techTerm)}</span></>
                  ) : (
                    <>Analogy: <span className="text-amber-400">{cleanLabel(node.analogyTerm)}</span></>
                  )}
                </div>
                <div className="text-neutral-500 text-xs mt-1">
                  Importance: {Math.round(node.weight * 100)}%
                  {node.pinned && <span className="text-amber-400 ml-2">• Pinned (double-click to unpin)</span>}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 text-white/80 text-sm font-medium" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
        {focusedNode ? (
          <>Double-click focused node to exit • Connected nodes orbit closer • Drag to arrange</>
        ) : (
          <>Drag nodes • Connected nodes follow • Double-click for Focus Mode • Hover for details</>
        )}
      </div>
    </div>
  );
};

export default ConstellationMode;
