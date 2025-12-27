import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Columns, Zap } from 'lucide-react';
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

// Stop words to filter out during semantic distillation
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
  'she', 'we', 'they', 'what', 'which', 'who', 'whom', 'where', 'when',
  'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
  'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there',
  'then', 'once', 'into', 'over', 'after', 'before', 'between', 'under',
  'again', 'further', 'while', 'about', 'against', 'during', 'through',
  'above', 'below', 'up', 'down', 'out', 'off', 'any', 'if'
]);

// Check if a word is a stop word
const isStopWord = (word: string): boolean => {
  return STOP_WORDS.has(word.toLowerCase().replace(/[.,!?;:'"()]/g, ''));
};

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

// Relationship labels for connections
const RELATIONSHIP_LABELS = [
  'maps to',
  'is like',
  'corresponds to',
  'functions as',
  'represents',
  'parallels',
  'mirrors',
  'aligns with'
];

interface ConceptPosition {
  id: number;
  techTerm: string;
  analogyTerm: string;
  techRect: DOMRect | null;
  analogyRect: DOMRect | null;
  color: string;
  importance: number;
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
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [wordBoxOffsets, setWordBoxOffsets] = useState<Map<string, { x: number; y: number }>>(new Map());

  // Combine all segments into full text
  const techText = segments.map(s => s.tech).join(' ');
  const analogyText = segments.map(s => s.analogy).join(' ');

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
    return 0.5; // Default medium importance
  }, [importanceMap]);

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
  // FIRST OCCURRENCE ONLY - reduces visual chaos
  const parseAndRenderText = useCallback((text: string, isTech: boolean): React.ReactNode[] => {
    if (!text) return [];

    const processedText = wrapBareLatex(text);
    const parts = processedText.split(LATEX_REGEX);
    const result: React.ReactNode[] = [];
    const paneType = isTech ? 'tech' : 'analogy';

    // Track which concepts have been highlighted - ONLY highlight first occurrence
    const highlightedConceptIds = new Set<number>();

    // Helper to check if a word is a meaningful match (not just a stop word)
    const isSemanticMatch = (word: string, concept: ConceptMapItem): boolean => {
      const wordLower = word.toLowerCase().replace(/[.,!?;:'"()]/g, '');

      // Skip stop words unless they're the entire concept term
      if (isStopWord(wordLower)) {
        const techClean = cleanLabel(concept.tech_term).toLowerCase();
        const analogyClean = cleanLabel(concept.analogy_term).toLowerCase();
        // Only allow if the stop word IS the entire concept (rare edge case)
        if (wordLower !== techClean && wordLower !== analogyClean) {
          return false;
        }
      }

      return true;
    };

    // Helper to find matching concept for a word
    const findMatchingConcept = (word: string): ConceptMapItem | undefined => {
      const wordLower = word.toLowerCase().replace(/[.,!?;:'"()]/g, '');

      // Skip very short words and stop words early
      if (wordLower.length < 2 || isStopWord(wordLower)) {
        return undefined;
      }

      for (const concept of conceptMap) {
        const techClean = cleanLabel(concept.tech_term).toLowerCase();
        const analogyClean = cleanLabel(concept.analogy_term).toLowerCase();

        // Check each word in multi-word terms
        const techWords = techClean.split(/\s+/);
        const analogyWords = analogyClean.split(/\s+/);

        // Exact match to full term
        if (wordLower === techClean || wordLower === analogyClean) {
          if (isSemanticMatch(word, concept)) return concept;
        }

        // Match any significant word in the term (not just includes check)
        for (const tw of techWords) {
          if (tw.length >= 3 && !isStopWord(tw) && (wordLower === tw || (wordLower.length > 4 && tw.includes(wordLower)))) {
            if (isSemanticMatch(word, concept)) return concept;
          }
        }

        for (const aw of analogyWords) {
          if (aw.length >= 3 && !isStopWord(aw) && (wordLower === aw || (wordLower.length > 4 && aw.includes(wordLower)))) {
            if (isSemanticMatch(word, concept)) return concept;
          }
        }

        // Partial match for longer words
        if (wordLower.length > 4 && (techClean.includes(wordLower) || analogyClean.includes(wordLower))) {
          if (isSemanticMatch(word, concept)) return concept;
        }
      }
      return undefined;
    };

    parts.forEach((part, partIndex) => {
      if (!part) return;

      const isLatex = part.startsWith('$') || part.startsWith('\\(') || part.startsWith('\\[') ||
                      (part.startsWith('\\') && part.length > 1 && /^\\[a-zA-Z]/.test(part));

      if (isLatex) {
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
          // FIRST OCCURRENCE ONLY - skip if already highlighted
          if (highlightedConceptIds.has(matchedConcept.id)) {
            // Render as plain LaTeX without highlighting, but still apply spotlight dimming
            const spotlightActive = hoveredConcept !== null;
            const isThisConceptHovered = hoveredConcept === matchedConcept.id;
            result.push(
              <span
                key={`latex-${partIndex}`}
                className="transition-all duration-300"
                style={{
                  opacity: spotlightActive && !isThisConceptHovered ? 0.3 : 1,
                }}
              >
                {renderLatex(part)}
              </span>
            );
          } else {
            // Mark this concept as highlighted
            highlightedConceptIds.add(matchedConcept.id);

            const conceptIndex = conceptMap.findIndex(c => c.id === matchedConcept!.id);
            const color = CONCEPT_COLORS[conceptIndex % CONCEPT_COLORS.length];
            const isHovered = hoveredConcept === matchedConcept.id;
            const spotlightActive = hoveredConcept !== null;
            const isSpotlit = isHovered;

            // NO SCALE TRANSFORMS - just color and border for clean highlighting
            result.push(
              <span
                key={`latex-${partIndex}`}
                data-concept-id={matchedConcept.id}
                data-type={paneType}
                className="inline-block px-1.5 py-0.5 rounded-md cursor-pointer transition-all duration-300"
                style={{
                  backgroundColor: isSpotlit ? color + '50' : color + '15',
                  border: `2px solid ${isSpotlit ? color : color + '40'}`,
                  boxShadow: isSpotlit ? `0 2px 8px ${color}30` : undefined,
                  opacity: spotlightActive && !isSpotlit ? 0.3 : 1,
                }}
                onMouseEnter={() => setHoveredConcept(matchedConcept!.id)}
                onMouseLeave={() => setHoveredConcept(null)}
              >
                {renderLatex(part)}
              </span>
            );
          }
        } else {
          const spotlightActive = hoveredConcept !== null;
          result.push(
            <span
              key={`latex-${partIndex}`}
              className="transition-all duration-500"
              style={{
                opacity: spotlightActive ? 0.25 : 1,
                filter: spotlightActive ? 'blur(1px)' : undefined,
              }}
            >
              {renderLatex(part)}
            </span>
          );
        }
      } else {
        // Regular text - use phrase coalescence
        const words = part.split(/(\s+)/);
        let i = 0;

        while (i < words.length) {
          const word = words[i];

          if (!word) {
            i++;
            continue;
          }

          if (/^\s+$/.test(word)) {
            result.push(<span key={`space-${partIndex}-${i}`}>{word}</span>);
            i++;
            continue;
          }

          const matchedConcept = findMatchingConcept(word);

          if (matchedConcept) {
            // Phrase coalescence: collect consecutive words matching the same concept
            const phraseWords: string[] = [word];
            let j = i + 1;

            // Look ahead for consecutive matches to the same concept or related words
            while (j < words.length) {
              const nextWord = words[j];

              // Include spaces and connecting words in phrases
              if (/^\s+$/.test(nextWord)) {
                // Check if there's another matching word after the space
                if (j + 1 < words.length) {
                  const wordAfterSpace = words[j + 1];
                  const nextMatch = findMatchingConcept(wordAfterSpace);

                  if (nextMatch && nextMatch.id === matchedConcept.id) {
                    phraseWords.push(nextWord); // Include the space
                    phraseWords.push(wordAfterSpace); // Include the matching word
                    j += 2;
                    continue;
                  }
                }
                break; // Stop if next word doesn't match
              }

              const nextMatch = findMatchingConcept(nextWord);
              if (nextMatch && nextMatch.id === matchedConcept.id) {
                phraseWords.push(nextWord);
                j++;
              } else {
                break;
              }
            }

            // Render the entire phrase as one unit
            const phraseText = phraseWords.join('');

            // FIRST OCCURRENCE ONLY - skip highlighting if already done
            if (highlightedConceptIds.has(matchedConcept.id)) {
              // Render as plain text, but still apply spotlight dimming
              const spotlightActive = hoveredConcept !== null;
              const isThisConceptHovered = hoveredConcept === matchedConcept.id;
              result.push(
                <span
                  key={`phrase-${partIndex}-${i}`}
                  className="transition-all duration-300"
                  style={{
                    opacity: spotlightActive && !isThisConceptHovered ? 0.3 : 1,
                  }}
                >
                  {phraseText}
                </span>
              );
            } else {
              // Mark this concept as highlighted
              highlightedConceptIds.add(matchedConcept.id);

              const conceptIndex = conceptMap.findIndex(c => c.id === matchedConcept.id);
              const color = CONCEPT_COLORS[conceptIndex % CONCEPT_COLORS.length];
              const isHovered = hoveredConcept === matchedConcept.id;
              const spotlightActive = hoveredConcept !== null;
              const isSpotlit = isHovered;

              // NO SCALE TRANSFORMS - clean, simple highlighting
              result.push(
                <span
                  key={`phrase-${partIndex}-${i}`}
                  data-concept-id={matchedConcept.id}
                  data-type={paneType}
                  className="inline-block px-1.5 py-0.5 rounded cursor-pointer transition-all duration-300"
                  style={{
                    backgroundColor: isSpotlit ? color + '50' : color + '15',
                    color: isSpotlit ? (isDarkMode ? '#fff' : '#000') : color,
                    fontWeight: isSpotlit ? 700 : 600,
                    border: `2px solid ${isSpotlit ? color : color + '40'}`,
                    boxShadow: isSpotlit ? `0 2px 8px ${color}30` : undefined,
                    opacity: spotlightActive && !isSpotlit ? 0.3 : 1,
                  }}
                  onMouseEnter={() => setHoveredConcept(matchedConcept.id)}
                  onMouseLeave={() => setHoveredConcept(null)}
                >
                  {phraseText}
                </span>
              );
            }

            i = j; // Skip to after the phrase
          } else {
            // Non-concept word - apply spotlight fade
            const spotlightActive = hoveredConcept !== null;
            result.push(
              <span
                key={`word-${partIndex}-${i}`}
                className="transition-all duration-500"
                style={{
                  opacity: spotlightActive ? 0.2 : 1,
                  filter: spotlightActive ? 'blur(1.5px)' : undefined,
                }}
              >
                {word}
              </span>
            );
            i++;
          }
        }
      }
    });

    return result;
  }, [conceptMap, hoveredConcept, isDarkMode, renderLatex, wordBoxOffsets]);

  // Update concept positions when layout changes
  const updatePositions = useCallback(() => {
    if (!containerRef.current || !techPaneRef.current || !analogyPaneRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const positions: ConceptPosition[] = [];

    conceptMap.forEach((concept, index) => {
      const techSpan = techPaneRef.current?.querySelector(`[data-concept-id="${concept.id}"][data-type="tech"]`);
      const analogySpan = analogyPaneRef.current?.querySelector(`[data-concept-id="${concept.id}"][data-type="analogy"]`);
      const importance = getConceptImportance(concept);

      positions.push({
        id: concept.id,
        techTerm: concept.tech_term,
        analogyTerm: concept.analogy_term,
        techRect: techSpan ? techSpan.getBoundingClientRect() : null,
        analogyRect: analogySpan ? analogySpan.getBoundingClientRect() : null,
        color: CONCEPT_COLORS[index % CONCEPT_COLORS.length],
        importance
      });
    });

    setConceptPositions(positions);
    setDimensions({ width: containerRect.width, height: containerRect.height });
  }, [conceptMap, getConceptImportance]);

  // Update positions on mount and resize
  useEffect(() => {
    updatePositions();

    const handleResize = () => updatePositions();
    window.addEventListener('resize', handleResize);

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

  // Magnetic repulsion zones - prevent highlighted boxes from overlapping
  useEffect(() => {
    if (hoveredConcept === null) {
      // Clear offsets when not hovering
      setWordBoxOffsets(new Map());
      return;
    }

    // Find all highlighted word boxes for the hovered concept
    const calculateRepulsion = () => {
      const techPane = techPaneRef.current;
      const analogyPane = analogyPaneRef.current;
      if (!techPane && !analogyPane) return;

      // Get pane boundaries for constraining offsets
      const techPaneRect = techPane?.getBoundingClientRect();
      const analogyPaneRect = analogyPane?.getBoundingClientRect();

      const allBoxes: Array<{ id: string; rect: DOMRect; pane: 'tech' | 'analogy'; paneRect: DOMRect | null }> = [];

      // Collect all highlighted boxes from both panes
      [techPane, analogyPane].forEach((pane, paneIndex) => {
        if (!pane) return;
        const paneName = paneIndex === 0 ? 'tech' : 'analogy';
        const paneRect = paneIndex === 0 ? techPaneRect : analogyPaneRect;
        const highlightedElements = pane.querySelectorAll(`[data-concept-id="${hoveredConcept}"]`);
        highlightedElements.forEach((el, idx) => {
          const rect = el.getBoundingClientRect();
          allBoxes.push({
            id: `${paneName}-${idx}`,
            rect,
            pane: paneName as 'tech' | 'analogy',
            paneRect: paneRect || null
          });
        });
      });

      // Calculate repulsion offsets
      const newOffsets = new Map<string, { x: number; y: number }>();
      // Buffer zone for better separation (smaller now that we use smaller scales)
      const bufferZone = 20;
      const maxIterations = 25;

      // Simple iterative repulsion with stronger force
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        let hadOverlap = false;

        for (let i = 0; i < allBoxes.length; i++) {
          for (let j = i + 1; j < allBoxes.length; j++) {
            // Only check boxes in the same pane
            if (allBoxes[i].pane !== allBoxes[j].pane) continue;

            const box1 = allBoxes[i];
            const box2 = allBoxes[j];

            const offset1 = newOffsets.get(box1.id) || { x: 0, y: 0 };
            const offset2 = newOffsets.get(box2.id) || { x: 0, y: 0 };

            // Scale factor to account for CSS transform scale(1.05-1.08) plus shadows
            const scaleFactor = 1.15;

            // Adjusted positions with scale compensation
            const rect1 = {
              left: box1.rect.left + offset1.x - (box1.rect.width * (scaleFactor - 1) / 2),
              right: box1.rect.right + offset1.x + (box1.rect.width * (scaleFactor - 1) / 2),
              top: box1.rect.top + offset1.y - (box1.rect.height * (scaleFactor - 1) / 2),
              bottom: box1.rect.bottom + offset1.y + (box1.rect.height * (scaleFactor - 1) / 2),
              width: box1.rect.width * scaleFactor,
              height: box1.rect.height * scaleFactor
            };

            const rect2 = {
              left: box2.rect.left + offset2.x - (box2.rect.width * (scaleFactor - 1) / 2),
              right: box2.rect.right + offset2.x + (box2.rect.width * (scaleFactor - 1) / 2),
              top: box2.rect.top + offset2.y - (box2.rect.height * (scaleFactor - 1) / 2),
              bottom: box2.rect.bottom + offset2.y + (box2.rect.height * (scaleFactor - 1) / 2),
              width: box2.rect.width * scaleFactor,
              height: box2.rect.height * scaleFactor
            };

            // Check for overlap (with buffer zone)
            const overlapX = Math.max(0, Math.min(rect1.right + bufferZone, rect2.right + bufferZone) -
                                         Math.max(rect1.left - bufferZone, rect2.left - bufferZone));
            const overlapY = Math.max(0, Math.min(rect1.bottom + bufferZone, rect2.bottom + bufferZone) -
                                         Math.max(rect1.top - bufferZone, rect2.top - bufferZone));

            if (overlapX > 0 && overlapY > 0) {
              hadOverlap = true;

              // Calculate center points
              const center1X = rect1.left + rect1.width / 2;
              const center1Y = rect1.top + rect1.height / 2;
              const center2X = rect2.left + rect2.width / 2;
              const center2Y = rect2.top + rect2.height / 2;

              // Push boxes apart - primarily in Y direction for text flow
              const pushStrength = 1.5;
              const deltaY = center1Y - center2Y || 1;
              const deltaX = center1X - center2X || 0.1;

              // Favor Y-axis movement to preserve reading flow
              const pushY = (overlapY * pushStrength * Math.sign(deltaY)) / 2;
              const pushX = (overlapX * pushStrength * 0.4 * Math.sign(deltaX)) / 2;

              newOffsets.set(box1.id, {
                x: offset1.x + pushX,
                y: offset1.y + pushY
              });

              newOffsets.set(box2.id, {
                x: offset2.x - pushX,
                y: offset2.y - pushY
              });
            }
          }
        }

        if (!hadOverlap) break;
      }

      // Apply boundary constraints - keep boxes within their panes
      const boundaryPadding = 12;
      for (const box of allBoxes) {
        const offset = newOffsets.get(box.id);
        if (!offset || !box.paneRect) continue;

        const scaledWidth = box.rect.width * 1.15;
        const scaledHeight = box.rect.height * 1.15;

        // Calculate boundaries relative to the pane
        const minX = box.paneRect.left + boundaryPadding - box.rect.left + (scaledWidth - box.rect.width) / 2;
        const maxX = box.paneRect.right - boundaryPadding - box.rect.right - (scaledWidth - box.rect.width) / 2;
        const minY = box.paneRect.top + boundaryPadding - box.rect.top + (scaledHeight - box.rect.height) / 2;
        const maxY = box.paneRect.bottom - boundaryPadding - box.rect.bottom - (scaledHeight - box.rect.height) / 2;

        // Clamp offsets to boundaries
        newOffsets.set(box.id, {
          x: Math.max(minX, Math.min(maxX, offset.x)),
          y: Math.max(minY, Math.min(maxY, offset.y))
        });
      }

      setWordBoxOffsets(newOffsets);
    };

    // Run repulsion calculation with slight delay for layout to settle
    const timer = setTimeout(calculateRepulsion, 50);
    return () => clearTimeout(timer);
  }, [hoveredConcept]);

  const containerRect = containerRef.current?.getBoundingClientRect();

  // Get the currently hovered concept details
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
          {hoveredConceptData && (
            <span className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium animate-pulse"
              style={{ backgroundColor: hoveredConceptData.color + '30', color: hoveredConceptData.color }}>
              <Zap size={12} />
              {Math.round(hoveredConceptData.importance * 100)}% importance
            </span>
          )}
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
        {/* SVG Layer - Minimal edge indicators only, no cross-pane curves */}
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Edge indicators - small dots at the edge of highlighted terms pointing to center */}
          {containerRect && conceptPositions.map((concept) => {
            if (!concept.techRect || !concept.analogyRect) return null;

            const isHovered = hoveredConcept === concept.id;
            const opacity = hoveredConcept === null ? 0.4 : (isHovered ? 1 : 0.1);

            // Tech side indicator (right edge of tech term)
            const techX = concept.techRect.right - containerRect.left + 4;
            const techY = concept.techRect.top + concept.techRect.height / 2 - containerRect.top;

            // Analogy side indicator (left edge of analogy term)
            const analogyX = concept.analogyRect.left - containerRect.left - 4;
            const analogyY = concept.analogyRect.top + concept.analogyRect.height / 2 - containerRect.top;

            return (
              <g key={`indicator-${concept.id}`} className="transition-all duration-300">
                {/* Tech side - small arrow pointing right */}
                <g opacity={opacity} filter={isHovered ? "url(#soft-glow)" : undefined}>
                  <circle
                    cx={techX}
                    cy={techY}
                    r={isHovered ? 5 : 3}
                    fill={concept.color}
                  />
                  {isHovered && (
                    <path
                      d={`M ${techX + 6} ${techY} L ${techX + 14} ${techY}`}
                      stroke={concept.color}
                      strokeWidth={2}
                      strokeLinecap="round"
                      opacity={0.6}
                    />
                  )}
                </g>

                {/* Analogy side - small arrow pointing left */}
                <g opacity={opacity} filter={isHovered ? "url(#soft-glow)" : undefined}>
                  <circle
                    cx={analogyX}
                    cy={analogyY}
                    r={isHovered ? 5 : 3}
                    fill={concept.color}
                  />
                  {isHovered && (
                    <path
                      d={`M ${analogyX - 6} ${analogyY} L ${analogyX - 14} ${analogyY}`}
                      stroke={concept.color}
                      strokeWidth={2}
                      strokeLinecap="round"
                      opacity={0.6}
                    />
                  )}
                </g>
              </g>
            );
          })}
        </svg>

        {/* Tech Pane (Left) */}
        <div
          ref={techPaneRef}
          className={`w-[42%] p-6 overflow-y-auto transition-all duration-500 ${
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
          <div className={`text-base leading-loose ${isDarkMode ? 'text-neutral-100' : 'text-neutral-800'}`}>
            {parseAndRenderText(techText, true)}
          </div>
        </div>

        {/* Center Vertical Flow Column */}
        <div className={`w-[16%] flex flex-col border-x transition-all duration-300 ${
          isDarkMode ? 'bg-neutral-900/80 border-neutral-700' : 'bg-neutral-100/80 border-neutral-300'
        } ${hoveredConcept !== null ? 'bg-opacity-95' : ''}`}>
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
              const relationshipLabel = RELATIONSHIP_LABELS[index % RELATIONSHIP_LABELS.length];

              return (
                <div
                  key={concept.id}
                  className={`px-2 py-2 mx-1 my-1 rounded-lg cursor-pointer transition-all duration-300 ${
                    hoveredConcept !== null && !isHovered ? 'opacity-30' : ''
                  }`}
                  style={{
                    backgroundColor: isHovered ? color + '25' : (isDarkMode ? 'rgba(38,38,38,0.5)' : 'rgba(255,255,255,0.5)'),
                    border: `2px solid ${isHovered ? color : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)')}`,
                    boxShadow: isHovered ? `0 4px 16px ${color}30` : undefined,
                  }}
                  onMouseEnter={() => setHoveredConcept(concept.id)}
                  onMouseLeave={() => setHoveredConcept(null)}
                >
                  {/* Tech term */}
                  <div className="mb-1">
                    <span className={`text-[10px] leading-tight block transition-all duration-300 ${
                      isDarkMode ? 'text-blue-300' : 'text-blue-700'
                    } ${isHovered ? 'font-semibold' : 'font-medium'}`}>
                      {cleanLabel(concept.tech_term)}
                    </span>
                  </div>

                  {/* Relationship label */}
                  <div className="flex items-center justify-center gap-1 my-1.5">
                    <div className={`h-px flex-1 ${isDarkMode ? 'bg-neutral-600' : 'bg-neutral-300'}`} style={{ backgroundColor: isHovered ? color + '50' : undefined }} />
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full transition-all duration-300 ${
                        isHovered
                          ? 'font-medium'
                          : isDarkMode ? 'text-neutral-500' : 'text-neutral-400'
                      }`}
                      style={{
                        color: isHovered ? color : undefined,
                        backgroundColor: isHovered ? color + '15' : 'transparent'
                      }}
                    >
                      {relationshipLabel}
                    </span>
                    <div className={`h-px flex-1 ${isDarkMode ? 'bg-neutral-600' : 'bg-neutral-300'}`} style={{ backgroundColor: isHovered ? color + '50' : undefined }} />
                  </div>

                  {/* Analogy term */}
                  <div>
                    <span className={`text-[10px] leading-tight block transition-all duration-300 ${
                      isDarkMode ? 'text-amber-300' : 'text-amber-700'
                    } ${isHovered ? 'font-semibold' : 'font-medium'}`}>
                      {cleanLabel(concept.analogy_term)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hovered concept detail panel - fixed height to prevent jumpy layout */}
          <div
            className={`px-3 py-3 border-t transition-all duration-300 min-h-[100px] ${
              isDarkMode ? 'border-neutral-700 bg-neutral-800/95' : 'border-neutral-300 bg-white/95'
            }`}
            style={{
              opacity: hoveredConceptData ? 1 : 0.5,
              pointerEvents: hoveredConceptData ? 'auto' : 'none'
            }}
          >
            <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
              {hoveredConceptData ? 'Active Connection' : 'Hover to Preview'}
            </div>
            {hoveredConceptData ? (
              <>
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full animate-pulse"
                    style={{ backgroundColor: hoveredConceptData.color, boxShadow: `0 0 12px ${hoveredConceptData.color}` }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] font-semibold truncate ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                      {cleanLabel(hoveredConceptData.techTerm)}
                    </div>
                    <div className={`text-[11px] font-semibold truncate ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>
                      ↔ {cleanLabel(hoveredConceptData.analogyTerm)}
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-neutral-600 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${hoveredConceptData.importance * 100}%`,
                          backgroundColor: hoveredConceptData.color
                        }}
                      />
                    </div>
                    <span className="text-[9px] font-bold" style={{ color: hoveredConceptData.color }}>
                      {Math.round(hoveredConceptData.importance * 100)}%
                    </span>
                  </div>
                  <div className={`text-[8px] mt-1 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}
                    title="How essential this concept is to understanding the main topic">
                    Importance = centrality to core topic
                  </div>
                </div>
              </>
            ) : (
              <div className={`text-[11px] ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                Hover over any concept card above to see details
              </div>
            )}
          </div>
        </div>

        {/* Analogy Pane (Right) */}
        <div
          ref={analogyPaneRef}
          className={`w-[42%] p-6 overflow-y-auto transition-all duration-500 ${
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
          <div className={`text-base leading-loose ${isDarkMode ? 'text-neutral-100' : 'text-neutral-800'}`}>
            {parseAndRenderText(analogyText, false)}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-2 border-t border-neutral-700 bg-neutral-900">
        <div className="flex items-center justify-between">
          <span className="text-neutral-500 text-xs">
            Hover concepts to spotlight connections • Importance shows how central a concept is to understanding the topic
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
