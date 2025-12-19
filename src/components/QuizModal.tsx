import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, X, GripHorizontal, ChevronRight, Loader2 } from 'lucide-react';
import { QuizData, Position } from '../types';

interface QuizModalProps {
  quizData: QuizData;
  quizFeedback: string | null;
  quizPos: Position | null;
  isMobile: boolean;
  isQuizLoading?: boolean;
  onOptionClick: (index: number) => void;
  onClose: () => void;
  onStartDrag: (e: React.MouseEvent, target: string) => void;
  onNextQuestion: () => void;
  renderRichText: (text: string, colorClass?: string) => React.ReactNode;
}

export const QuizModal: React.FC<QuizModalProps> = ({
  quizData,
  quizFeedback,
  quizPos,
  isMobile,
  isQuizLoading = false,
  onOptionClick,
  onClose,
  onStartDrag,
  onNextQuestion,
  renderRichText
}) => {
  const [size, setSize] = useState({ width: 450, height: 'auto' as number | 'auto' });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDir, setResizeDir] = useState<string | null>(null);

  const isCorrect = quizFeedback?.startsWith("Correct");

  const handleResizeStart = useCallback((e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDir(direction);
  }, []);

  useEffect(() => {
    if (!isResizing || !resizeDir) return;

    const handleMouseMove = (e: MouseEvent) => {
      setSize(prev => {
        let newWidth = typeof prev.width === 'number' ? prev.width : 450;
        let newHeight = typeof prev.height === 'number' ? prev.height : 400;

        if (resizeDir.includes('e')) newWidth = Math.max(320, newWidth + e.movementX);
        if (resizeDir.includes('w')) newWidth = Math.max(320, newWidth - e.movementX);
        if (resizeDir.includes('s')) newHeight = Math.max(200, newHeight + e.movementY);
        if (resizeDir.includes('n')) newHeight = Math.max(200, newHeight - e.movementY);

        return { width: newWidth, height: newHeight };
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeDir(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeDir]);

  const resizeHandleBase = "absolute bg-transparent z-10";
  const resizeHandleHover = "hover:bg-amber-400/20";

  return (
    <div
      className="quiz-window fixed z-[200] flex flex-col"
      style={{
        top: quizPos ? quizPos.top : '50%',
        left: quizPos ? quizPos.left : '50%',
        transform: quizPos ? 'none' : 'translate(-50%, -50%)',
        width: isMobile ? '100%' : size.width,
        height: size.height === 'auto' ? 'auto' : size.height,
        minWidth: '320px',
        maxWidth: '90vw',
        minHeight: '200px'
      }}
    >
      {/* Resize Handles - All 4 sides */}
      {!isMobile && (
        <>
          {/* Edges */}
          <div className={`${resizeHandleBase} ${resizeHandleHover} top-0 left-2 right-2 h-1 cursor-n-resize`} onMouseDown={e => handleResizeStart(e, 'n')} />
          <div className={`${resizeHandleBase} ${resizeHandleHover} bottom-0 left-2 right-2 h-1 cursor-s-resize`} onMouseDown={e => handleResizeStart(e, 's')} />
          <div className={`${resizeHandleBase} ${resizeHandleHover} left-0 top-2 bottom-2 w-1 cursor-w-resize`} onMouseDown={e => handleResizeStart(e, 'w')} />
          <div className={`${resizeHandleBase} ${resizeHandleHover} right-0 top-2 bottom-2 w-1 cursor-e-resize`} onMouseDown={e => handleResizeStart(e, 'e')} />
          {/* Corners */}
          <div className={`${resizeHandleBase} ${resizeHandleHover} top-0 left-0 w-2 h-2 cursor-nw-resize`} onMouseDown={e => handleResizeStart(e, 'nw')} />
          <div className={`${resizeHandleBase} ${resizeHandleHover} top-0 right-0 w-2 h-2 cursor-ne-resize`} onMouseDown={e => handleResizeStart(e, 'ne')} />
          <div className={`${resizeHandleBase} ${resizeHandleHover} bottom-0 left-0 w-2 h-2 cursor-sw-resize`} onMouseDown={e => handleResizeStart(e, 'sw')} />
          <div className={`${resizeHandleBase} ${resizeHandleHover} bottom-0 right-0 w-2 h-2 cursor-se-resize`} onMouseDown={e => handleResizeStart(e, 'se')} />
        </>
      )}

      <div
        className={`bg-amber-900 text-white p-4 shadow-2xl border border-amber-500/30 flex flex-col relative select-none h-full overflow-auto ${
          isMobile ? 'rounded-t-2xl' : 'rounded-xl'
        }`}
      >
        <div
          onMouseDown={(e) => onStartDrag(e, 'quiz')}
          className={`header-drag-area ${isMobile ? '' : 'cursor-move'} flex justify-between items-start mb-4 border-b border-amber-800 pb-2`}
        >
          <div className="flex items-center gap-2">
            <div className="bg-white/10 p-1.5 rounded-full shrink-0">
              <Trophy size={16} />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">Quick Quiz</h4>
          </div>
          <button onClick={onClose} className="text-amber-300 hover:text-white">
            <X size={14} />
          </button>
        </div>

        <div className="text-sm font-medium mb-4 text-white">
          {renderRichText(quizData.question, "text-white")}
        </div>

        <div className="space-y-2 mb-4">
          {quizData.options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => onOptionClick(idx)}
              className={`w-full text-left p-3 rounded-lg border transition-all text-sm ${
                quizFeedback
                  ? idx === quizData.correctIndex
                    ? 'bg-green-900/50 border-green-500 text-green-100'
                    : 'bg-amber-950 border-amber-900 text-amber-400 opacity-50'
                  : 'bg-amber-950 border-amber-800 text-amber-100 hover:bg-amber-900 hover:border-amber-600'
              }`}
            >
              {renderRichText(opt, "text-inherit")}
            </button>
          ))}
        </div>

        {quizFeedback && (
          <div
            className={`text-sm p-3 rounded-lg ${
              isCorrect
                ? 'bg-green-900/50 text-green-200'
                : 'bg-red-900/50 text-red-200'
            }`}
          >
            {renderRichText(quizFeedback, isCorrect ? "text-green-200" : "text-red-200")}
          </div>
        )}

        {/* Next Question Button - only shown on correct answer */}
        {quizFeedback && isCorrect && (
          <button
            onClick={onNextQuestion}
            disabled={isQuizLoading}
            className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isQuizLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Loading...
              </>
            ) : (
              <>
                Next Question
                <ChevronRight size={16} />
              </>
            )}
          </button>
        )}

        {!isMobile && (
          <div className="absolute top-1 left-1/2 transform -translate-x-1/2 text-amber-400/50 pointer-events-none">
            <GripHorizontal size={12} />
          </div>
        )}
      </div>
    </div>
  );
};
