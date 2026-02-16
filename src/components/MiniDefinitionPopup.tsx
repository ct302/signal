import React, { useState } from 'react';
import { CornerDownRight, X, Copy, Check, ZoomIn, ZoomOut, GripHorizontal } from 'lucide-react';
import { Position, Size, ConceptMapItem } from '../types';

interface MiniDefinitionPopupProps {
  miniSelectedTerm: string;
  miniDefText: string;
  isLoadingMiniDef: boolean;
  miniDefPosition: Position;
  miniDefSize: Size;
  miniDefComplexity: number;
  miniDefThreshold: number;
  setMiniDefThreshold: React.Dispatch<React.SetStateAction<number>>;
  isMiniDefColorMode: boolean;
  setIsMiniDefColorMode: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
  copiedId: string | null;
  onClose: () => void;
  onHeaderMouseDown: (e: React.MouseEvent) => void;
  onStartResize: (e: React.MouseEvent, target: string) => void;
  onEliClick: (level: number) => void;
  onCopy: (text: string, id: string) => void;
  renderAttentiveText: (
    text: string,
    threshold: number,
    setThreshold: React.Dispatch<React.SetStateAction<number>> | null,
    isColorMode: boolean,
    setColorMode: React.Dispatch<React.SetStateAction<boolean>> | null,
    customMap: ConceptMapItem[] | null,
    textColor: string,
    textScale?: number
  ) => React.ReactNode;
  renderRichText: (text: string, colorClass?: string) => React.ReactNode;
}

export const MiniDefinitionPopup: React.FC<MiniDefinitionPopupProps> = ({
  miniSelectedTerm,
  miniDefText,
  isLoadingMiniDef,
  miniDefPosition,
  miniDefSize,
  miniDefComplexity,
  miniDefThreshold,
  setMiniDefThreshold,
  isMiniDefColorMode,
  setIsMiniDefColorMode,
  isMobile,
  copiedId,
  onClose,
  onHeaderMouseDown,
  onStartResize,
  onEliClick,
  onCopy,
  renderAttentiveText,
  renderRichText
}) => {
  const [textScale, setTextScale] = useState(1);
  const style: React.CSSProperties = isMobile
    ? {
        top: 'auto',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        height: '50vh',
        transform: 'none'
      }
    : {
        top: miniDefPosition.top,
        left: miniDefPosition.left,
        width: `${miniDefSize.width}px`,
        height: 'auto',
        minWidth: '240px',
        minHeight: '200px',
        maxHeight: '60vh',
        overflow: 'auto',
        resize: 'vertical' as const
      };

  return (
    <div
      className={`mini-def-window absolute z-[210] bg-neutral-900 border border-neutral-700 text-white p-4 rounded-xl shadow-2xl transition-all duration-300 animate-in fade-in zoom-in flex flex-col signal-font ${
        isMobile ? 'rounded-t-2xl' : 'md:rounded-xl'
      }`}
      style={style}
    >
      {/* Header */}
      <div
        onMouseDown={onHeaderMouseDown}
        className={`header-drag-area ${isMobile ? '' : 'cursor-move'} flex justify-between items-start mb-2 border-b border-neutral-700 pb-2 flex-shrink-0 select-none`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <CornerDownRight size={14} className="text-blue-400 flex-shrink-0" />
          <span className="font-bold text-sm text-blue-200 truncate">
            {renderRichText(miniSelectedTerm, "text-blue-200")}
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
        className="text-sm leading-relaxed text-neutral-300 flex-1 overflow-y-auto -mr-2 pr-2"
        style={{ fontSize: `${textScale}em` }}
      >
        {isLoadingMiniDef ? (
          <span className="italic text-neutral-500">Deep diving...</span>
        ) : (
          renderAttentiveText(
            miniDefText,
            miniDefThreshold,
            setMiniDefThreshold,
            isMiniDefColorMode,
            setIsMiniDefColorMode,
            null,
            "text-neutral-300",
            textScale
          )
        )}
      </div>

      {/* Footer Controls */}
      <div className="pt-3 border-t border-neutral-800 flex flex-col gap-3">
        {/* ELI Buttons */}
        <div className="flex bg-neutral-950 p-1 rounded-lg w-full">
          {[5, 50, 100].map((level) => (
            <button
              key={level}
              onClick={(e) => {
                e.stopPropagation();
                onEliClick(level);
              }}
              disabled={isLoadingMiniDef}
              className={`flex-1 px-2 py-2 min-h-touch text-xs font-bold rounded-md transition-colors flex justify-center items-center gap-1 ${
                miniDefComplexity === level
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-600 hover:text-neutral-400'
              } ${isLoadingMiniDef ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              ELI{level}
            </button>
          ))}
        </div>

        {/* Copy Button */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopy(miniDefText, 'miniDef');
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className={`p-1.5 rounded-md transition-colors ${
              copiedId === 'miniDef'
                ? 'bg-green-900/50 text-green-400'
                : 'text-neutral-500 hover:text-white'
            }`}
            title="Copy Definition"
          >
            {copiedId === 'miniDef' ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      </div>

      {/* Resize Handles */}
      {!isMobile && (
        <>
          <div
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/10 transition-colors"
            onMouseDown={(e) => onStartResize(e, 'mini-left')}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/10 transition-colors"
            onMouseDown={(e) => onStartResize(e, 'mini-right')}
          />
        </>
      )}

      {/* Draggable Footer Bar - allows dragging from bottom */}
      {!isMobile && (
        <div
          onMouseDown={onHeaderMouseDown}
          className="absolute bottom-0 left-0 right-0 h-6 cursor-move flex items-center justify-center bg-gradient-to-t from-neutral-800 to-transparent rounded-b-xl hover:from-neutral-700 transition-colors"
          title="Drag to move"
        >
          <GripHorizontal size={14} className="text-neutral-500" />
        </div>
      )}
    </div>
  );
};
