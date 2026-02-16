import React, { useState } from 'react';
import { CornerDownRight, X, Copy, Check, ZoomIn, ZoomOut, BookOpen, ChevronDown, ChevronUp, GripHorizontal } from 'lucide-react';
import { Position, Size, ConceptMapItem, SymbolGuideEntry } from '../types';

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
  symbolGuide?: SymbolGuideEntry[];  // API-provided context-aware symbol explanations
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
  symbolGuide = [],  // API-provided context-aware symbols
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
    <div className="def-window fixed z-[200] flex flex-col signal-font" style={style}>
      <div
        className={`bg-neutral-950 text-white p-4 shadow-2xl border border-neutral-800 flex flex-col relative select-none h-full ${
          isMobile ? 'rounded-t-2xl' : 'rounded-xl'
        }`}
      >
        {/* Drag grip indicator */}
        {!isMobile && (
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
              {renderRichText(selectedTerm, "text-yellow-200")}
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
          <div className="text-xs text-neutral-600 mt-1 text-center">
            Click any word for a nested definition
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
                {symbolGuide.map(({ symbol, name, meaning, simple }) => (
                  <div
                    key={symbol}
                    className="px-2 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-blue-300">{renderRichText(symbol, "text-blue-300")}</span>
                      <span className="text-white font-medium">{renderRichText(name, "text-white")}</span>
                    </div>
                    <div className="text-neutral-400 text-xs mt-0.5">{renderRichText(meaning, "text-neutral-400")}</div>
                    {simple && (
                      <div className="text-emerald-400 text-xs mt-0.5">💡 {simple}</div>
                    )}
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
