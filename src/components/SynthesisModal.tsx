import React, { useState } from 'react';
import { BrainCircuit, X, GripHorizontal, ZoomIn, ZoomOut, ChevronDown } from 'lucide-react';
import { Position, ConceptMapItem } from '../types';

interface SynthesisModalProps {
  synthesisOneLiner?: string;
  synthesisSummary: string;
  synthesisDeep?: string;
  synthesisCitation: string;
  synthPos: Position | null;
  isMobile: boolean;
  synthesisThreshold: number;
  setSynthesisThreshold: React.Dispatch<React.SetStateAction<number>>;
  isSynthesisColorMode: boolean;
  setIsSynthesisColorMode: React.Dispatch<React.SetStateAction<boolean>>;
  onClose: () => void;
  onStartDrag: (e: React.MouseEvent, target: string) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
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
  synthesisOneLiner,
  synthesisSummary,
  synthesisDeep,
  synthesisCitation,
  synthPos,
  isMobile,
  synthesisThreshold,
  setSynthesisThreshold,
  isSynthesisColorMode,
  setIsSynthesisColorMode,
  onClose,
  onStartDrag,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  renderAttentiveText
}) => {
  const [textScale, setTextScale] = useState(1);
  const [expandedLevel, setExpandedLevel] = useState<number>(1);

  const hasTreeData = !!(synthesisOneLiner);

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
        className={`bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 shadow-2xl border border-slate-600/40 flex flex-col relative select-none max-h-[70vh] ${
          isMobile ? 'rounded-t-2xl' : 'rounded-xl'
        }`}
      >
        {/* Header */}
        <div
          onMouseDown={(e) => onStartDrag(e, 'synthesis')}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className={`header-drag-area ${isMobile ? '' : 'cursor-move'} flex justify-between items-start mb-4 border-b border-slate-700 pb-2`}
        >
          <div className="flex items-center gap-2">
            <div className="bg-purple-500/20 p-1.5 rounded-full shrink-0">
              <BrainCircuit size={16} />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">Synthesis</h4>
          </div>
          <div className="flex gap-1 text-slate-400 items-center flex-shrink-0 ml-2">
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

        {/* Content Body */}
        <div className="overflow-y-auto flex-1" style={{ zoom: textScale }}>

          {hasTreeData ? (
            /* Progressive Synthesis Tree */
            <>
              {/* Level 1: Gut Feel — always visible */}
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-base">🌱</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Gut Feel</span>
                </div>
                <p className="text-sm font-medium text-slate-100 leading-relaxed pl-7">
                  {synthesisOneLiner}
                </p>
              </div>

              {/* Branch line + Level 2: Core Bridge */}
              {synthesisSummary && (
                <div className="ml-3 pl-4 border-l-2 border-purple-500/30">
                  <button
                    onClick={() => setExpandedLevel(expandedLevel === 2 ? 1 : 2)}
                    className="flex items-center gap-2 mb-1.5 hover:opacity-80 transition-opacity w-full text-left"
                  >
                    <span className="text-base">🔗</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Core Bridge</span>
                    <ChevronDown size={12} className={`text-slate-500 transition-transform duration-200 ${expandedLevel === 2 ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedLevel === 2 && (
                    <div className="pl-7 text-sm leading-relaxed mb-3">
                      {renderAttentiveText(
                        synthesisSummary,
                        synthesisThreshold,
                        setSynthesisThreshold,
                        isSynthesisColorMode,
                        setIsSynthesisColorMode,
                        null,
                        "text-slate-200"
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Branch line + Level 3: Deep Structure */}
              {synthesisDeep && (
                <div className="ml-3 pl-4 border-l-2 border-purple-500/30">
                  <button
                    onClick={() => setExpandedLevel(expandedLevel === 3 ? 1 : 3)}
                    className="flex items-center gap-2 mb-1.5 hover:opacity-80 transition-opacity w-full text-left"
                  >
                    <span className="text-base">🔬</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Deep Structure</span>
                    <ChevronDown size={12} className={`text-slate-500 transition-transform duration-200 ${expandedLevel === 3 ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedLevel === 3 && (
                    <div className="pl-7 text-sm leading-relaxed mb-3">
                      {renderAttentiveText(
                        synthesisDeep,
                        synthesisThreshold,
                        setSynthesisThreshold,
                        isSynthesisColorMode,
                        setIsSynthesisColorMode,
                        null,
                        "text-slate-300"
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Fallback: flat layout for old API responses */
            <div className="text-sm leading-relaxed mb-3">
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
          )}
        </div>

        {/* Citation footer */}
        {synthesisCitation && (
          <div className="italic text-purple-300/90 text-sm border-t border-slate-700 pt-3">
            &ldquo;{synthesisCitation}&rdquo;
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
