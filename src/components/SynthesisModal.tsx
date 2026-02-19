import React, { useState } from 'react';
import { BrainCircuit, X, GripHorizontal, ZoomIn, ZoomOut } from 'lucide-react';
import { Position, ConceptMapItem } from '../types';

interface SynthesisModalProps {
  synthesisSummary: string;
  synthesisCitation: string;
  synthPos: Position | null;
  isMobile: boolean;
  synthesisThreshold: number;
  setSynthesisThreshold: React.Dispatch<React.SetStateAction<number>>;
  isSynthesisColorMode: boolean;
  setIsSynthesisColorMode: React.Dispatch<React.SetStateAction<boolean>>;
  onClose: () => void;
  onStartDrag: (e: React.MouseEvent, target: string) => void;
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

export const SynthesisModal: React.FC<SynthesisModalProps> = ({
  synthesisSummary,
  synthesisCitation,
  synthPos,
  isMobile,
  synthesisThreshold,
  setSynthesisThreshold,
  isSynthesisColorMode,
  setIsSynthesisColorMode,
  onClose,
  onStartDrag,
  renderAttentiveText
}) => {
  const [textScale, setTextScale] = useState(1);

  return (
    <div
      className="synthesis-window fixed z-[200] w-full max-w-lg px-4 flex flex-col cursor-move signal-font"
      style={{
        top: isMobile ? 'auto' : (synthPos ? synthPos.top : '50%'),
        bottom: isMobile ? 0 : 'auto',
        left: isMobile ? 0 : (synthPos ? synthPos.left : '50%'),
        transform: isMobile ? 'none' : (synthPos ? 'none' : 'translate(-50%, -50%)'),
        width: isMobile ? '100%' : 'auto',
        maxHeight: isMobile ? '80vh' : undefined,
        paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : undefined
      }}
    >
      <div
        className={`bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 shadow-2xl border border-slate-600/40 flex flex-col relative select-none ${
          isMobile ? 'rounded-t-2xl' : 'rounded-xl'
        }`}
      >
        <div
          onMouseDown={(e) => onStartDrag(e, 'synthesis')}
          className={`header-drag-area ${isMobile ? '' : 'cursor-move'} flex justify-between items-start mb-4 border-b border-slate-700 pb-2`}
        >
          <div className="flex items-center gap-2">
            <div className="bg-purple-500/20 p-1.5 rounded-full shrink-0">
              <BrainCircuit size={16} />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">Synthesis</h4>
          </div>
          <div className="flex gap-1 text-slate-400 items-center flex-shrink-0 ml-2">
            {/* Text Scale Controls */}
            <button
              onClick={(e) => { e.stopPropagation(); setTextScale(s => Math.max(0.8, s - 0.1)); }}
              className="p-1.5 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Decrease text size"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-xs text-slate-500 w-8 text-center">{Math.round(textScale * 100)}%</span>
            <button
              onClick={(e) => { e.stopPropagation(); setTextScale(s => Math.min(1.5, s + 0.1)); }}
              className="p-1.5 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Increase text size"
            >
              <ZoomIn size={14} />
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white ml-1">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="text-sm leading-relaxed mb-3 overflow-y-auto flex-1" style={{ zoom: textScale }}>
          {renderAttentiveText(
            synthesisSummary,
            synthesisThreshold,
            setSynthesisThreshold,
            isSynthesisColorMode,
            setIsSynthesisColorMode,
            null,
            "text-slate-100"
          )}
        </div>

        {synthesisCitation && (
          <div className="italic text-slate-400 text-xs border-t border-slate-700 pt-3">
            "{synthesisCitation}"
          </div>
        )}

        {!isMobile && (
          <div className="absolute top-1 left-1/2 transform -translate-x-1/2 text-slate-500/50 pointer-events-none">
            <GripHorizontal size={12} />
          </div>
        )}
      </div>
    </div>
  );
};
