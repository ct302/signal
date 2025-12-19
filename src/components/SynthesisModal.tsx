import React from 'react';
import { BrainCircuit, X, GripHorizontal } from 'lucide-react';
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
  return (
    <div
      className="synthesis-window fixed z-[200] w-full max-w-lg px-4 flex flex-col cursor-move"
      style={{
        top: synthPos ? synthPos.top : '50%',
        left: synthPos ? synthPos.left : '50%',
        transform: synthPos ? 'none' : 'translate(-50%, -50%)',
        width: isMobile ? '100%' : 'auto'
      }}
    >
      <div
        className={`bg-gradient-to-br from-purple-900 to-indigo-900 text-white p-4 shadow-2xl border border-purple-500/30 flex flex-col relative select-none ${
          isMobile ? 'rounded-t-2xl' : 'rounded-xl'
        }`}
      >
        <div
          onMouseDown={(e) => onStartDrag(e, 'synthesis')}
          className={`header-drag-area ${isMobile ? '' : 'cursor-move'} flex justify-between items-start mb-4 border-b border-purple-800 pb-2`}
        >
          <div className="flex items-center gap-2">
            <div className="bg-white/10 p-1.5 rounded-full shrink-0">
              <BrainCircuit size={16} />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300">Synthesis</h4>
          </div>
          <button onClick={onClose} className="text-purple-300 hover:text-white">
            <X size={14} />
          </button>
        </div>

        <div className="text-sm leading-relaxed mb-3">
          {renderAttentiveText(
            synthesisSummary,
            synthesisThreshold,
            setSynthesisThreshold,
            isSynthesisColorMode,
            setIsSynthesisColorMode,
            null,
            "text-purple-100"
          )}
        </div>

        {synthesisCitation && (
          <div className="italic text-purple-300 text-xs border-t border-purple-800 pt-3">
            "{synthesisCitation}"
          </div>
        )}

        {!isMobile && (
          <div className="absolute top-1 left-1/2 transform -translate-x-1/2 text-purple-400/50 pointer-events-none">
            <GripHorizontal size={12} />
          </div>
        )}
      </div>
    </div>
  );
};
