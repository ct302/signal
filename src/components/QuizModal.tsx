import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, X, GripHorizontal, ChevronRight, Loader2, RotateCcw, Zap } from 'lucide-react';
import { QuizData, QuizDifficulty, Position } from '../types';

interface QuizModalProps {
  quizData: QuizData;
  quizFeedback: string | null;
  quizPos: Position | null;
  isMobile: boolean;
  isQuizLoading?: boolean;
  retryCount?: number;
  maxRetries?: number;
  questionNumber?: number;
  onOptionClick: (index: number) => void;
  onClose: () => void;
  onStartDrag: (e: React.MouseEvent, target: string) => void;
  onNextQuestion: () => void;
  onRetry?: () => void;
  renderRichText: (text: string, colorClass?: string) => React.ReactNode;
}

const DIFFICULTY_CONFIG: Record<QuizDifficulty, { label: string; color: string; bg: string }> = {
  easy: { label: 'Easy', color: 'text-green-300', bg: 'bg-green-900/50' },
  medium: { label: 'Medium', color: 'text-yellow-300', bg: 'bg-yellow-900/50' },
  hard: { label: 'Hard', color: 'text-orange-300', bg: 'bg-orange-900/50' },
  advanced: { label: 'Advanced', color: 'text-red-300', bg: 'bg-red-900/50' }
};

export const QuizModal: React.FC<QuizModalProps> = ({
  quizData,
  quizFeedback,
  quizPos,
  isMobile,
  isQuizLoading = false,
  retryCount = 0,
  maxRetries = 2,
  questionNumber = 1,
  onOptionClick,
  onClose,
  onStartDrag,
  onNextQuestion,
  onRetry,
  renderRichText
}) => {
  const [size, setSize] = useState({ width: 450, height: 'auto' as number | 'auto' });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDir, setResizeDir] = useState<string | null>(null);

  const isCorrect = quizFeedback?.startsWith("Correct");
  const isWrong = quizFeedback && !isCorrect;
  const canRetry = isWrong && retryCount < maxRetries && onRetry;
  const difficulty = quizData.difficulty || 'easy';
  const difficultyConfig = DIFFICULTY_CONFIG[difficulty];

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

  // Get success message based on retry count
  const getSuccessMessage = () => {
    if (retryCount === 0) return "Correct! ✓";
    if (retryCount === 1) return "Correct (retry 1) ✓";
    return "Correct (retry 2) ✓";
  };

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
        maxHeight: '85vh',
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
        {/* Loading Overlay */}
        {isQuizLoading && (
          <div className="absolute inset-0 bg-amber-900/90 z-20 flex flex-col items-center justify-center rounded-xl">
            <Loader2 size={32} className="animate-spin text-amber-300 mb-3" />
            <p className="text-amber-200 text-sm">Loading next question...</p>
          </div>
        )}

        {/* Header */}
        <div
          onMouseDown={(e) => onStartDrag(e, 'quiz')}
          className={`header-drag-area ${isMobile ? '' : 'cursor-move'} flex justify-between items-start mb-4 border-b border-amber-800 pb-2`}
        >
          <div className="flex items-center gap-2">
            <div className="bg-white/10 p-1.5 rounded-full shrink-0">
              <Trophy size={16} />
            </div>
            <div className="flex flex-col">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Question {questionNumber}
              </h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs px-1.5 py-0.5 rounded ${difficultyConfig.bg} ${difficultyConfig.color}`}>
                  <Zap size={10} className="inline mr-0.5" />
                  {difficultyConfig.label}
                </span>
                {retryCount > 0 && (
                  <span className="text-xs text-amber-400">
                    Retry {retryCount}/{maxRetries}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 min-w-touch min-h-touch flex items-center justify-center text-amber-300 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Question */}
        <div className="text-sm font-medium mb-4 text-white break-words overflow-wrap-anywhere">
          {renderRichText(quizData.question, "text-white")}
        </div>

        {/* Options */}
        <div className="space-y-2 mb-4">
          {quizData.options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => !quizFeedback && !isQuizLoading && onOptionClick(idx)}
              disabled={!!quizFeedback || isQuizLoading}
              className={`w-full text-left p-3 rounded-lg border transition-all text-sm break-words overflow-wrap-anywhere ${
                quizFeedback
                  ? idx === quizData.correctIndex
                    ? 'bg-green-900/50 border-green-500 text-green-100'
                    : 'bg-amber-950 border-amber-900 text-amber-400 opacity-50'
                  : 'bg-amber-950 border-amber-800 text-amber-100 hover:bg-amber-900 hover:border-amber-600 disabled:cursor-not-allowed'
              }`}
            >
              {renderRichText(opt, "text-inherit")}
            </button>
          ))}
        </div>

        {/* Feedback */}
        {quizFeedback && (
          <div
            className={`text-sm p-3 rounded-lg ${
              isCorrect
                ? 'bg-green-900/50 text-green-200'
                : 'bg-red-900/50 text-red-200'
            }`}
          >
            {isCorrect ? (
              <div>
                <span className="font-semibold">{getSuccessMessage()}</span>
                {quizData.explanation && (
                  <div className="mt-1 opacity-90">
                    {renderRichText(quizData.explanation, "text-green-200")}
                  </div>
                )}
              </div>
            ) : (
              renderRichText(quizFeedback, "text-red-200")
            )}
          </div>
        )}

        {/* Action Buttons */}
        {quizFeedback && (
          <div className="mt-4 flex gap-2">
            {/* Retry Button - only on wrong answer with retries left */}
            {canRetry && (
              <button
                onClick={onRetry}
                disabled={isQuizLoading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-700 hover:bg-amber-600 disabled:bg-amber-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                <RotateCcw size={16} />
                Retry ({maxRetries - retryCount} left)
              </button>
            )}

            {/* Next Question Button */}
            <button
              onClick={onNextQuestion}
              disabled={isQuizLoading}
              className={`${canRetry ? 'flex-1' : 'w-full'} flex items-center justify-center gap-2 py-2.5 px-4 ${
                isCorrect
                  ? 'bg-green-600 hover:bg-green-500'
                  : 'bg-amber-600 hover:bg-amber-500'
              } disabled:bg-amber-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors`}
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
          </div>
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
