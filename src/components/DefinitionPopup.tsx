import React from 'react';
import { CornerDownRight, X, Copy, Check } from 'lucide-react';
import { Position, Size, ConceptMapItem } from '../types';

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
  renderAttentiveText: (
    text: string,
    threshold: number,
    setThreshold: React.Dispatch<React.SetStateAction<number>> | null,
    isColorMode: boolean,
    setColorMode: React.Dispatch<React.SetStateAction<boolean>> | null,
    customMap: ConceptMapItem[] | null,
    textColor: string
  ) => React.ReactNode;
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
  renderAttentiveText
}) => {
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
        maxHeight: '70vh',
        overflow: 'auto',
        resize: 'vertical' as const
      };

  return (
    <div className="def-window fixed z-[200] w-full max-w-md px-4 flex flex-col" style={style}>
      <div
        className={`bg-neutral-950 text-white p-4 shadow-2xl border border-neutral-800 flex flex-col relative select-none ${
          isMobile ? 'rounded-t-2xl h-full' : 'rounded-xl'
        }`}
      >
        {/* Header */}
        <div
          onMouseDown={(e) => onStartDrag(e, 'def')}
          className={`header-drag-area ${isMobile ? '' : 'cursor-move'} flex justify-between items-start mb-2 border-b border-neutral-800 pb-2 flex-shrink-0`}
        >
          <div className="flex items-center gap-2">
            <CornerDownRight size={14} className="text-yellow-400" />
            <span className="font-bold text-sm text-yellow-200 flex items-center gap-2 pr-4">
              {selectedTerm}
            </span>
          </div>
          <div className="flex gap-2 text-neutral-400 items-center">
            <button onClick={onClose} className="hover:text-white">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="text-sm leading-relaxed text-neutral-200 flex-1 overflow-y-auto pr-2 custom-scrollbar">
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
              "text-neutral-200"
            )
          )}
        </div>

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
