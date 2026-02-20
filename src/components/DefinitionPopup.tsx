import React, { useState } from 'react';
import { CornerDownRight, X, Copy, Check, ZoomIn, ZoomOut, BookOpen, ChevronDown, ChevronUp, GripHorizontal } from 'lucide-react';
import { Position, Size, ConceptMapItem, SymbolGuideEntry } from '../types';

interface BottomSheetDragHandlers {
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: (e: React.TouchEvent) => void;
}

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
  sheetHeight?: number;
  isDraggingSheet?: boolean;
  onSheetDragHandlers?: BottomSheetDragHandlers;
  copiedId: string | null;
  symbolGuide?: SymbolGuideEntry[];  // API-provided context-aware symbol explanations
  domainIntuition?: string | null;   // Domain-mapped intuition for the entire concept
  analogyDomain?: string;            // User's expert domain (e.g., "NFL", "Cooking")
  domainEmoji?: string;              // Emoji for the domain
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
  sheetHeight,
  isDraggingSheet,
  onSheetDragHandlers,
  copiedId,
  symbolGuide = [],  // API-provided context-aware symbols
  domainIntuition,
  analogyDomain,
  domainEmoji,
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

  // Convert Unicode math characters back to LaTeX for proper KaTeX rendering in the header
  const prepareTermForHeader = (term: string): string => {
    if (!term) return term;
    if (term.includes('$')) return term; // Already has LaTeX delimiters

    // Detect math-like characters (Unicode from KaTeX rendering or operator patterns)
    const mathIndicators = /[′→←∂∫∑∏∇∞≈≠≤≥±×÷αβγδεζηθικλμνξπρστυφχψωΓΔΘΛΞΠΣΦΨΩ⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ₀₁₂₃₄₅₆₇₈₉]/;
    const hasOperatorPattern = /[a-zA-Z]\s*\([a-zA-Z]\)|lim|sin|cos|tan|log|ln|exp|det|sup|inf|max|min/i;
    const hasPrimeNotation = /[a-zA-Z][′']/;
    const hasFractionLike = /[a-zA-Z]\s*\/\s*[a-zA-Z]/;

    if (mathIndicators.test(term) || hasPrimeNotation.test(term) || hasOperatorPattern.test(term) || hasFractionLike.test(term)) {
      let latex = term;
      // Unicode → LaTeX command mappings
      latex = latex.replace(/′/g, "'");
      latex = latex.replace(/→/g, ' \\to ');
      latex = latex.replace(/←/g, ' \\leftarrow ');
      latex = latex.replace(/∂/g, '\\partial ');
      latex = latex.replace(/∫/g, '\\int ');
      latex = latex.replace(/∑/g, '\\sum ');
      latex = latex.replace(/∏/g, '\\prod ');
      latex = latex.replace(/∇/g, '\\nabla ');
      latex = latex.replace(/∞/g, '\\infty ');
      latex = latex.replace(/≈/g, ' \\approx ');
      latex = latex.replace(/≠/g, ' \\neq ');
      latex = latex.replace(/≤/g, ' \\leq ');
      latex = latex.replace(/≥/g, ' \\geq ');
      latex = latex.replace(/±/g, ' \\pm ');
      latex = latex.replace(/×/g, ' \\times ');
      latex = latex.replace(/÷/g, ' \\div ');
      // Greek lowercase
      latex = latex.replace(/α/g, '\\alpha ');
      latex = latex.replace(/β/g, '\\beta ');
      latex = latex.replace(/γ/g, '\\gamma ');
      latex = latex.replace(/δ/g, '\\delta ');
      latex = latex.replace(/ε/g, '\\varepsilon ');
      latex = latex.replace(/ζ/g, '\\zeta ');
      latex = latex.replace(/η/g, '\\eta ');
      latex = latex.replace(/θ/g, '\\theta ');
      latex = latex.replace(/λ/g, '\\lambda ');
      latex = latex.replace(/μ/g, '\\mu ');
      latex = latex.replace(/π/g, '\\pi ');
      latex = latex.replace(/σ/g, '\\sigma ');
      latex = latex.replace(/τ/g, '\\tau ');
      latex = latex.replace(/φ/g, '\\varphi ');
      latex = latex.replace(/ω/g, '\\omega ');
      // Greek uppercase
      latex = latex.replace(/Γ/g, '\\Gamma ');
      latex = latex.replace(/Δ/g, '\\Delta ');
      latex = latex.replace(/Θ/g, '\\Theta ');
      latex = latex.replace(/Λ/g, '\\Lambda ');
      latex = latex.replace(/Σ/g, '\\Sigma ');
      latex = latex.replace(/Π/g, '\\Pi ');
      latex = latex.replace(/Φ/g, '\\Phi ');
      latex = latex.replace(/Ψ/g, '\\Psi ');
      latex = latex.replace(/Ω/g, '\\Omega ');
      // Superscript digits
      latex = latex.replace(/⁰/g, '^{0}');
      latex = latex.replace(/¹/g, '^{1}');
      latex = latex.replace(/²/g, '^{2}');
      latex = latex.replace(/³/g, '^{3}');
      latex = latex.replace(/⁴/g, '^{4}');
      latex = latex.replace(/⁵/g, '^{5}');
      latex = latex.replace(/⁶/g, '^{6}');
      latex = latex.replace(/⁷/g, '^{7}');
      latex = latex.replace(/⁸/g, '^{8}');
      latex = latex.replace(/⁹/g, '^{9}');
      latex = latex.replace(/ⁿ/g, '^{n}');
      // Subscript digits
      latex = latex.replace(/₀/g, '_{0}');
      latex = latex.replace(/₁/g, '_{1}');
      latex = latex.replace(/₂/g, '_{2}');
      latex = latex.replace(/₃/g, '_{3}');
      latex = latex.replace(/₄/g, '_{4}');
      latex = latex.replace(/₅/g, '_{5}');
      latex = latex.replace(/₆/g, '_{6}');
      latex = latex.replace(/₇/g, '_{7}');
      latex = latex.replace(/₈/g, '_{8}');
      latex = latex.replace(/₉/g, '_{9}');
      // Wrap known function names in \text or \operatorname for proper rendering
      latex = latex.replace(/\blim\b/gi, '\\lim');
      latex = latex.replace(/\bsin\b/gi, '\\sin');
      latex = latex.replace(/\bcos\b/gi, '\\cos');
      latex = latex.replace(/\btan\b/gi, '\\tan');
      latex = latex.replace(/\blog\b/gi, '\\log');
      latex = latex.replace(/\bln\b/gi, '\\ln');
      latex = latex.replace(/\bexp\b/gi, '\\exp');
      return `$${latex.trim()}$`;
    }
    return term;
  };

  const style: React.CSSProperties = isMobile
    ? {
        top: 'auto',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        height: `${sheetHeight ?? 60}vh`,
        transform: 'none',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        transition: isDraggingSheet ? 'none' : 'height 0.2s ease-out',
      }
    : {
        top: defPos ? defPos.top : defPosition.top,
        left: defPos ? defPos.left : defPosition.left,
        width: `${defSize.width}px`,
        // If user has explicitly resized vertically, use that height; otherwise auto with max
        ...(defSize.height
          ? { height: `${defSize.height}px` }
          : { height: 'auto', maxHeight: '70vh' }
        ),
        minWidth: '280px',
        minHeight: '200px',
      };

  return (
    <div className="def-window fixed z-[200] flex flex-col signal-font" style={style}>
      <div
        className={`bg-neutral-950 text-white p-4 shadow-2xl border border-neutral-800 flex flex-col relative select-none overflow-hidden ${
          isMobile ? 'rounded-t-2xl' : 'rounded-xl'
        }`}
        style={{ height: '100%' }}
      >
        {/* Drag handle — touch-drag on mobile, decorative on desktop */}
        {isMobile ? (
          <div
            className="flex justify-center pt-2 pb-1 touch-none"
            onTouchStart={onSheetDragHandlers?.handleTouchStart}
            onTouchMove={onSheetDragHandlers?.handleTouchMove}
            onTouchEnd={onSheetDragHandlers?.handleTouchEnd}
          >
            <div className="w-10 h-1 rounded-full bg-neutral-600" />
          </div>
        ) : (
          <div className="flex justify-center -mt-1 mb-0 text-neutral-600 pointer-events-none">
            <GripHorizontal size={14} />
          </div>
        )}
        {/* Header */}
        <div
          onMouseDown={(e) => onStartDrag(e, 'def')}
          className={`header-drag-area ${isMobile ? '' : 'cursor-move'} flex justify-between items-start mb-2 border-b border-neutral-800 pb-2 flex-shrink-0`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <CornerDownRight size={14} className="text-yellow-400 flex-shrink-0" />
            <span className="font-bold text-sm text-yellow-200 truncate">
              {renderRichText(prepareTermForHeader(selectedTerm), "text-yellow-200")}
            </span>
          </div>
          <div className="flex gap-1 text-neutral-400 items-center flex-shrink-0 ml-2">
            {/* Text Scale Controls */}
            <button
              onClick={(e) => { e.stopPropagation(); setTextScale(s => Math.max(0.8, s - 0.1)); }}
              className="p-2 min-w-touch min-h-touch flex items-center justify-center hover:text-white hover:bg-neutral-800 rounded"
              title="Decrease text size"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-xs text-neutral-500 w-8 text-center">{Math.round(textScale * 100)}%</span>
            <button
              onClick={(e) => { e.stopPropagation(); setTextScale(s => Math.min(1.5, s + 0.1)); }}
              className="p-2 min-w-touch min-h-touch flex items-center justify-center hover:text-white hover:bg-neutral-800 rounded"
              title="Increase text size"
            >
              <ZoomIn size={14} />
            </button>
            <button onClick={onClose} className="p-2 min-w-touch min-h-touch flex items-center justify-center hover:text-white ml-1">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable content area — contains definition, symbol guide, and footer controls */}
        <div className="flex-1 overflow-y-auto -mr-2 pr-2 min-h-0">
          {/* Definition Text */}
          <div
            className="text-sm leading-relaxed text-neutral-200"
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
            <div className="text-xs text-neutral-600 mt-1 text-center">
              {isMobile ? 'Tap' : 'Click'} any word for a nested definition
            </div>
          )}

          {/* Domain Intuition — maps entire concept to user's expert domain */}
          {domainIntuition && !isLoadingDef && defComplexity !== 5 && (
            <div className="mt-2 px-2.5 py-1.5 rounded-md bg-amber-900/20 border border-amber-800/30">
              <div className="text-amber-300 text-xs">
                {domainEmoji || '🧠'} {renderRichText(domainIntuition, "text-amber-300")}
              </div>
            </div>
          )}

          {/* Symbol Guide - API-provided context-aware symbol explanations */}
          {!isLoadingDef && symbolGuide.length > 0 && (
            <div className="mt-2 pt-2 border-t border-neutral-800">
              <button
                onClick={() => setShowGlossary(!showGlossary)}
                className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors w-full"
              >
                <BookOpen size={12} />
                <span className="font-semibold uppercase tracking-wider">Symbol Guide</span>
                <span className="text-neutral-600">({symbolGuide.length})</span>
                {showGlossary ? <ChevronUp size={12} className="ml-auto" /> : <ChevronDown size={12} className="ml-auto" />}
              </button>
              {showGlossary && (
                <div className="mt-2 space-y-2">
                  {symbolGuide.map(({ symbol, name, meaning, simple, formula, domain_analogy }) => (
                    <div
                      key={symbol}
                      className="px-2 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-blue-300">{renderRichText(symbol, "text-blue-300")}</span>
                        <span className="text-white font-medium">{renderRichText(name, "text-white")}</span>
                      </div>
                      <div className="text-neutral-400 text-xs mt-0.5">{renderRichText(meaning, "text-neutral-400")}</div>
                      {formula && (
                        <div className="text-blue-300 text-xs mt-1 px-1.5 py-0.5 rounded bg-neutral-900/80 overflow-x-auto">
                          {renderRichText(formula, "text-blue-300")}
                        </div>
                      )}
                      {simple && (
                        <div className="text-emerald-400 text-xs mt-0.5">💡 {renderRichText(simple, "text-emerald-400")}</div>
                      )}
                      {domain_analogy && (
                        <div className="text-amber-400 text-xs mt-0.5">
                          {domainEmoji || '🧠'} {renderRichText(domain_analogy, "text-amber-400")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer Controls — inside scrollable area so they're always reachable */}
          <div className="pt-3 mt-2 border-t border-neutral-800 flex flex-col gap-3">
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
                  className={`flex-1 px-2 py-2 min-h-touch text-xs font-bold rounded-md transition-colors flex justify-center items-center gap-1 ${
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
        </div>

        {/* Resize Handles */}
        {!isMobile && (
          <>
            {/* Left edge — horizontal resize */}
            <div
              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/10 transition-colors"
              onMouseDown={(e) => onStartResize(e, 'def-left')}
            />
            {/* Right edge — horizontal resize */}
            <div
              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/10 transition-colors"
              onMouseDown={(e) => onStartResize(e, 'def-right')}
            />
            {/* Bottom edge — vertical resize */}
            <div
              className="absolute bottom-0 left-2 right-2 h-2 cursor-ns-resize hover:bg-white/10 transition-colors"
              onMouseDown={(e) => onStartResize(e, 'def-bottom')}
            />
            {/* Bottom-right corner — diagonal resize */}
            <div
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize hover:bg-white/10 transition-colors rounded-bl"
              onMouseDown={(e) => onStartResize(e, 'def-corner')}
            />
            {/* Bottom-left corner — diagonal resize */}
            <div
              className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize hover:bg-white/10 transition-colors rounded-br"
              onMouseDown={(e) => onStartResize(e, 'def-left-corner')}
            />
          </>
        )}
      </div>
    </div>
  );
};
