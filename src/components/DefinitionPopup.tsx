import React, { useState, useMemo } from 'react';
import { CornerDownRight, X, Copy, Check, ZoomIn, ZoomOut, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { Position, Size, ConceptMapItem } from '../types';

// Symbol glossary map for definitions - includes Unicode symbol and LaTeX commands
const SYMBOL_GLOSSARY: Array<{ symbol: string; name: string; meaning: string; latex: string[] }> = [
  { symbol: 'Σ', name: 'Sigma', meaning: 'Summation or standard deviation', latex: ['\\Sigma', '\\sum'] },
  { symbol: 'σ', name: 'sigma', meaning: 'Standard deviation', latex: ['\\sigma'] },
  { symbol: '∈', name: 'Element of', meaning: '"belongs to" or "is in"', latex: ['\\in'] },
  { symbol: '∉', name: 'Not in', meaning: '"does not belong to"', latex: ['\\notin'] },
  { symbol: '⊂', name: 'Subset', meaning: 'Is contained within', latex: ['\\subset'] },
  { symbol: '∪', name: 'Union', meaning: 'Combined set', latex: ['\\cup'] },
  { symbol: '∩', name: 'Intersection', meaning: 'Common elements', latex: ['\\cap'] },
  { symbol: '∀', name: 'For all', meaning: 'Applies to every element', latex: ['\\forall'] },
  { symbol: '∃', name: 'Exists', meaning: 'At least one exists', latex: ['\\exists'] },
  { symbol: '∞', name: 'Infinity', meaning: 'Without bound', latex: ['\\infty'] },
  { symbol: '∂', name: 'Partial', meaning: 'Partial derivative', latex: ['\\partial'] },
  { symbol: '∇', name: 'Nabla', meaning: 'Gradient operator', latex: ['\\nabla'] },
  { symbol: '∫', name: 'Integral', meaning: 'Area under curve', latex: ['\\int'] },
  { symbol: 'α', name: 'Alpha', meaning: 'First parameter', latex: ['\\alpha'] },
  { symbol: 'β', name: 'Beta', meaning: 'Second parameter', latex: ['\\beta'] },
  { symbol: 'γ', name: 'Gamma', meaning: 'Third parameter', latex: ['\\gamma'] },
  { symbol: 'δ', name: 'Delta (small)', meaning: 'Small change', latex: ['\\delta'] },
  { symbol: 'Δ', name: 'Delta', meaning: 'Change in value', latex: ['\\Delta'] },
  { symbol: 'ε', name: 'Epsilon', meaning: 'Very small quantity', latex: ['\\epsilon', '\\varepsilon'] },
  { symbol: 'θ', name: 'Theta', meaning: 'Angle or parameters', latex: ['\\theta'] },
  { symbol: 'λ', name: 'Lambda', meaning: 'Eigenvalue or rate', latex: ['\\lambda'] },
  { symbol: 'μ', name: 'Mu', meaning: 'Mean (average)', latex: ['\\mu'] },
  { symbol: 'π', name: 'Pi', meaning: '≈ 3.14159', latex: ['\\pi'] },
  { symbol: 'φ', name: 'Phi', meaning: 'Golden ratio', latex: ['\\phi', '\\varphi'] },
  { symbol: 'ψ', name: 'Psi', meaning: 'Wave function', latex: ['\\psi'] },
  { symbol: 'ω', name: 'Omega (small)', meaning: 'Angular frequency', latex: ['\\omega'] },
  { symbol: 'Ω', name: 'Omega', meaning: 'Ohm or sample space', latex: ['\\Omega'] },
  { symbol: 'ρ', name: 'Rho', meaning: 'Correlation or density', latex: ['\\rho'] },
  { symbol: 'τ', name: 'Tau', meaning: 'Time constant', latex: ['\\tau'] },
  { symbol: '≈', name: 'Approximately', meaning: 'Roughly equal', latex: ['\\approx'] },
  { symbol: '≠', name: 'Not equal', meaning: 'Different from', latex: ['\\neq', '\\ne'] },
  { symbol: '≤', name: 'Less or equal', meaning: 'At most', latex: ['\\leq', '\\le'] },
  { symbol: '≥', name: 'Greater or equal', meaning: 'At least', latex: ['\\geq', '\\ge'] },
  { symbol: '→', name: 'Arrow', meaning: 'Maps to or approaches', latex: ['\\to', '\\rightarrow'] },
  { symbol: '⟹', name: 'Implies', meaning: 'Therefore', latex: ['\\implies', '\\Rightarrow'] },
  { symbol: '√', name: 'Square root', meaning: 'Number that squares to input', latex: ['\\sqrt'] },
  { symbol: '×', name: 'Times', meaning: 'Multiplication', latex: ['\\times'] },
  { symbol: '÷', name: 'Division', meaning: 'Division', latex: ['\\div'] },
  { symbol: '±', name: 'Plus-minus', meaning: 'Positive or negative', latex: ['\\pm'] },
  { symbol: '∑', name: 'Sum', meaning: 'Summation', latex: ['\\sum'] },
  { symbol: '∏', name: 'Product', meaning: 'Product of sequence', latex: ['\\prod'] },
];

interface DefinitionPopupProps {
  selectedTerm: string;
  defText: string;
  isLoadingDef: boolean;
  defPosition: Position;
  defPos: Position | null;
  defSize: Size;
  defComplexity: number;
  defThreshold: number;
  setDefThreshold: React.Dispatch<React.SetStateAction<number>>;
  isDefColorMode: boolean;
  setIsDefColorMode: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
  copiedId: string | null;
  onClose: () => void;
  onStartDrag: (e: React.MouseEvent, target: string) => void;
  onStartResize: (e: React.MouseEvent, target: string) => void;
  onEliClick: (level: number) => void;
  onCopy: (text: string, id: string) => void;
  onWordClick?: (word: string, rect: DOMRect) => void;
  renderAttentiveText: (
    text: string,
    threshold: number,
    setThreshold: React.Dispatch<React.SetStateAction<number>> | null,
    isColorMode: boolean,
    setColorMode: React.Dispatch<React.SetStateAction<boolean>> | null,
    customMap: ConceptMapItem[] | null,
    textColor: string,
    textScale?: number,
    onWordClick?: (word: string, rect: DOMRect) => void
  ) => React.ReactNode;
  renderRichText: (text: string, colorClass?: string) => React.ReactNode;
}

export const DefinitionPopup: React.FC<DefinitionPopupProps> = ({
  selectedTerm,
  defText,
  isLoadingDef,
  defPosition,
  defPos,
  defSize,
  defComplexity,
  defThreshold,
  setDefThreshold,
  isDefColorMode,
  setIsDefColorMode,
  isMobile,
  copiedId,
  onClose,
  onStartDrag,
  onStartResize,
  onEliClick,
  onCopy,
  onWordClick,
  renderAttentiveText,
  renderRichText
}) => {
  const [textScale, setTextScale] = useState(1);
  const [showGlossary, setShowGlossary] = useState(false);

  // Detect symbols in the definition text - checks both Unicode and LaTeX commands
  const detectedSymbols = useMemo(() => {
    if (!defText) return [];
    const found: Array<{ symbol: string; name: string; meaning: string }> = [];
    const seen = new Set<string>();

    for (const entry of SYMBOL_GLOSSARY) {
      if (seen.has(entry.symbol)) continue;

      // Check if Unicode symbol is present
      let isFound = defText.includes(entry.symbol);

      // Check if any LaTeX command variant is present
      if (!isFound) {
        for (const latexCmd of entry.latex) {
          if (defText.includes(latexCmd)) {
            isFound = true;
            break;
          }
        }
      }

      if (isFound) {
        seen.add(entry.symbol);
        found.push({ symbol: entry.symbol, name: entry.name, meaning: entry.meaning });
      }
    }
    return found;
  }, [defText]);

  const style: React.CSSProperties = isMobile
    ? {
        top: 'auto',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        height: '60vh',
        transform: 'none'
      }
    : {
        top: defPos ? defPos.top : defPosition.top,
        left: defPos ? defPos.left : defPosition.left,
        width: `${defSize.width}px`,
        height: 'auto',
        minWidth: '280px',
        minHeight: '200px',
        maxHeight: '70vh'
      };

  return (
    <div className="def-window fixed z-[200] flex flex-col" style={style}>
      <div
        className={`bg-neutral-950 text-white p-4 shadow-2xl border border-neutral-800 flex flex-col relative select-none h-full ${
          isMobile ? 'rounded-t-2xl' : 'rounded-xl'
        }`}
      >
        {/* Header */}
        <div
          onMouseDown={(e) => onStartDrag(e, 'def')}
          className={`header-drag-area ${isMobile ? '' : 'cursor-move'} flex justify-between items-start mb-2 border-b border-neutral-800 pb-2 flex-shrink-0`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <CornerDownRight size={14} className="text-yellow-400 flex-shrink-0" />
            <span className="font-bold text-sm text-yellow-200 truncate">
              {renderRichText(selectedTerm, "text-yellow-200")}
            </span>
          </div>
          <div className="flex gap-1 text-neutral-400 items-center flex-shrink-0 ml-2">
            {/* Text Scale Controls */}
            <button
              onClick={(e) => { e.stopPropagation(); setTextScale(s => Math.max(0.8, s - 0.1)); }}
              className="p-1 hover:text-white hover:bg-neutral-800 rounded"
              title="Decrease text size"
            >
              <ZoomOut size={12} />
            </button>
            <span className="text-[10px] text-neutral-500 w-8 text-center">{Math.round(textScale * 100)}%</span>
            <button
              onClick={(e) => { e.stopPropagation(); setTextScale(s => Math.min(1.5, s + 0.1)); }}
              className="p-1 hover:text-white hover:bg-neutral-800 rounded"
              title="Increase text size"
            >
              <ZoomIn size={12} />
            </button>
            <button onClick={onClose} className="hover:text-white ml-1">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className="text-sm leading-relaxed text-neutral-200 flex-1 overflow-y-auto -mr-2 pr-2"
          style={{ fontSize: `${textScale}em` }}
        >
          {isLoadingDef ? (
            <span className="italic text-neutral-400">Defining...</span>
          ) : (
            renderAttentiveText(
              defText,
              defThreshold,
              setDefThreshold,
              isDefColorMode,
              setIsDefColorMode,
              null,
              "text-neutral-200",
              textScale,
              onWordClick
            )
          )}
        </div>
        {onWordClick && !isLoadingDef && (
          <div className="text-[9px] text-neutral-600 mt-1 text-center">
            Click any word for a nested definition
          </div>
        )}

        {/* Symbol Glossary - shows when math symbols detected */}
        {!isLoadingDef && detectedSymbols.length > 0 && (
          <div className="mt-2 pt-2 border-t border-neutral-800">
            <button
              onClick={() => setShowGlossary(!showGlossary)}
              className="flex items-center gap-2 text-[10px] text-blue-400 hover:text-blue-300 transition-colors w-full"
            >
              <BookOpen size={12} />
              <span className="font-semibold uppercase tracking-wider">Symbol Guide</span>
              <span className="text-neutral-600">({detectedSymbols.length})</span>
              {showGlossary ? <ChevronUp size={12} className="ml-auto" /> : <ChevronDown size={12} className="ml-auto" />}
            </button>
            {showGlossary && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {detectedSymbols.map(({ symbol, name, meaning }) => (
                  <div
                    key={symbol}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-[10px]"
                    title={meaning}
                  >
                    <span className="text-blue-300 font-mono text-xs">{symbol}</span>
                    <span className="text-neutral-400">{name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer Controls */}
        <div className="pt-3 border-t border-neutral-800 flex flex-col gap-3">
          {/* ELI Buttons */}
          <div className="flex bg-neutral-900 p-1 rounded-lg w-full">
            {[5, 50, 100].map((level) => (
              <button
                key={level}
                onClick={(e) => {
                  e.stopPropagation();
                  onEliClick(level);
                }}
                disabled={isLoadingDef}
                className={`flex-1 px-2 py-1.5 text-[10px] font-bold rounded-md transition-colors flex justify-center items-center gap-1 ${
                  defComplexity === level
                    ? 'bg-neutral-700 text-white'
                    : 'text-neutral-500 hover:text-neutral-300'
                } ${isLoadingDef ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                ELI{level}
              </button>
            ))}
          </div>

          {/* Copy Button */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-full justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy(defText, 'def');
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className={`p-1.5 rounded-md transition-colors ${
                  copiedId === 'def'
                    ? 'bg-green-900/50 text-green-400'
                    : 'text-neutral-500 hover:text-white'
                }`}
                title="Copy Definition"
              >
                {copiedId === 'def' ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* Resize Handles */}
        {!isMobile && (
          <>
            <div
              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/10 transition-colors"
              onMouseDown={(e) => onStartResize(e, 'def-left')}
            />
            <div
              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/10 transition-colors"
              onMouseDown={(e) => onStartResize(e, 'def-right')}
            />
          </>
        )}
      </div>
    </div>
  );
};
