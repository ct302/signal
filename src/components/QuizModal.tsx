import React, { useState, useEffect, useCallback } from 'react';
import { X, GripHorizontal, ChevronRight, ChevronDown, Loader2, RotateCcw, Lightbulb } from 'lucide-react';
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
  domain?: string;
  domainEmoji?: string;
  onOptionClick: (index: number) => void;
  onClose: () => void;
  onStartDrag: (e: React.MouseEvent, target: string) => void;
  onNextQuestion: () => void;
  onRetry?: () => void;
  renderRichText: (text: string, colorClass?: string) => React.ReactNode;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

const DIFFICULTY_CONFIG: Record<QuizDifficulty, { label: string; color: string; bg: string; paperText: string; paperBorder: string }> = {
  easy: { label: 'Easy', color: 'text-green-300', bg: 'bg-green-900/50', paperText: 'text-green-700', paperBorder: 'border-green-300' },
  medium: { label: 'Medium', color: 'text-yellow-300', bg: 'bg-yellow-900/50', paperText: 'text-amber-700', paperBorder: 'border-amber-300' },
  hard: { label: 'Hard', color: 'text-orange-300', bg: 'bg-orange-900/50', paperText: 'text-orange-700', paperBorder: 'border-orange-300' },
  advanced: { label: 'Advanced', color: 'text-red-300', bg: 'bg-red-900/50', paperText: 'text-red-700', paperBorder: 'border-red-300' }
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
  domain,
  domainEmoji,
  onOptionClick,
  onClose,
  onStartDrag,
  onNextQuestion,
  onRetry,
  renderRichText
}) => {
  const [size, setSize] = useState({ width: 480, height: 'auto' as number | 'auto' });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDir, setResizeDir] = useState<string | null>(null);
  const [showBridge, setShowBridge] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const isCorrect = quizFeedback?.startsWith("Correct");
  const isWrong = quizFeedback && !isCorrect;
  const canRetry = isWrong && retryCount < maxRetries && onRetry;
  const difficulty = quizData.difficulty || 'easy';
  const difficultyConfig = DIFFICULTY_CONFIG[difficulty];

  // Reset bridge when new question arrives
  useEffect(() => {
    setShowBridge(false);
    setSelectedIndex(null);
  }, [quizData]);

  // Track which option was clicked
  const handleOptionClick = (idx: number) => {
    if (!quizFeedback && !isQuizLoading) {
      setSelectedIndex(idx);
      onOptionClick(idx);
    }
  };

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
        let newWidth = typeof prev.width === 'number' ? prev.width : 480;
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
  const resizeHandleHover = "hover:bg-[#d4c5a9]/30";

  // Get success message based on retry count
  const getSuccessMessage = () => {
    if (retryCount === 0) return "✓ Correct!";
    if (retryCount === 1) return "✓ Correct (attempt 2)";
    return "✓ Correct (attempt 3)";
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
        minHeight: '200px',
        fontFamily: 'Georgia, "Times New Roman", serif'
      }}
    >
      {/* Resize Handles */}
      {!isMobile && (
        <>
          <div className={`${resizeHandleBase} ${resizeHandleHover} top-0 left-2 right-2 h-1 cursor-n-resize`} onMouseDown={e => handleResizeStart(e, 'n')} />
          <div className={`${resizeHandleBase} ${resizeHandleHover} bottom-0 left-2 right-2 h-1 cursor-s-resize`} onMouseDown={e => handleResizeStart(e, 's')} />
          <div className={`${resizeHandleBase} ${resizeHandleHover} left-0 top-2 bottom-2 w-1 cursor-w-resize`} onMouseDown={e => handleResizeStart(e, 'w')} />
          <div className={`${resizeHandleBase} ${resizeHandleHover} right-0 top-2 bottom-2 w-1 cursor-e-resize`} onMouseDown={e => handleResizeStart(e, 'e')} />
          <div className={`${resizeHandleBase} ${resizeHandleHover} top-0 left-0 w-2 h-2 cursor-nw-resize`} onMouseDown={e => handleResizeStart(e, 'nw')} />
          <div className={`${resizeHandleBase} ${resizeHandleHover} top-0 right-0 w-2 h-2 cursor-ne-resize`} onMouseDown={e => handleResizeStart(e, 'ne')} />
          <div className={`${resizeHandleBase} ${resizeHandleHover} bottom-0 left-0 w-2 h-2 cursor-sw-resize`} onMouseDown={e => handleResizeStart(e, 'sw')} />
          <div className={`${resizeHandleBase} ${resizeHandleHover} bottom-0 right-0 w-2 h-2 cursor-se-resize`} onMouseDown={e => handleResizeStart(e, 'se')} />
        </>
      )}

      {/* Paper container */}
      <div
        className={`bg-[#faf8f2] text-[#2c2416] p-5 shadow-[0_2px_20px_rgba(0,0,0,0.12)] border border-[#d4c5a9] flex flex-col relative select-none h-full overflow-auto ${
          isMobile ? 'rounded-t-2xl' : 'rounded-xl'
        }`}
        style={{
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.018) 1px, transparent 1px)',
          backgroundSize: '100% 28px'
        }}
      >
        {/* Loading Overlay */}
        {isQuizLoading && (
          <div className="absolute inset-0 bg-[#faf8f2]/95 z-20 flex flex-col items-center justify-center rounded-xl">
            <Loader2 size={28} className="animate-spin text-[#8a7a5e] mb-3" />
            <p className="text-[#8a7a5e] text-sm italic">Preparing next question...</p>
          </div>
        )}

        {/* Header — Exam paper style */}
        <div
          onMouseDown={(e) => onStartDrag(e, 'quiz')}
          className={`header-drag-area ${isMobile ? '' : 'cursor-move'} flex justify-between items-start mb-4 border-b-2 border-[#2c2416] pb-3`}
        >
          <div>
            <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#8a7a5e]">
              Examination
            </h4>
            <div className="text-lg font-bold text-[#2c2416] mt-0.5" style={{ fontFamily: 'Georgia, serif' }}>
              Question {questionNumber}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-mono px-2 py-0.5 rounded border ${difficultyConfig.paperBorder} ${difficultyConfig.paperText}`}>
                {difficultyConfig.label}
              </span>
              {retryCount > 0 && (
                <span className="text-xs font-mono text-[#8a7a5e]">
                  Attempt {retryCount + 1}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 min-w-touch min-h-touch flex items-center justify-center text-[#8a7a5e] hover:text-[#2c2416] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Question */}
        <div className="text-sm font-medium mb-4 text-[#2c2416] break-words overflow-wrap-anywhere leading-relaxed">
          {renderRichText(quizData.question, "text-[#2c2416]")}
        </div>

        {/* Analogy Bridge — collapsible hint */}
        {quizData.analogyBridge && !quizFeedback && domain && (
          <div className="mb-3">
            <button
              onClick={() => setShowBridge(!showBridge)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs hover:bg-blue-100 transition-colors"
            >
              <Lightbulb size={14} />
              <span className="font-medium">Think through {domainEmoji} {domain}</span>
              <ChevronDown size={12} className={`ml-auto transition-transform duration-200 ${showBridge ? 'rotate-180' : ''}`} />
            </button>

            {showBridge && (
              <div className="mt-2 px-3 py-2.5 rounded-lg bg-blue-50/70 border border-blue-100 text-sm text-blue-800 leading-relaxed">
                {quizData.analogyBridge.hint}
              </div>
            )}
          </div>
        )}

        {/* Options — A, B, C, D */}
        <div className="space-y-2.5 mb-4">
          {quizData.options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => handleOptionClick(idx)}
              disabled={!!quizFeedback || isQuizLoading}
              className={`w-full text-left p-3 rounded-lg border transition-all text-sm break-words overflow-wrap-anywhere ${
                quizFeedback
                  ? idx === quizData.correctIndex
                    ? 'bg-green-50 border-green-400 text-green-900'
                    : selectedIndex === idx
                      ? 'bg-red-50 border-red-300 text-red-400'
                      : 'bg-[#faf8f2] border-[#e0d5c0] text-[#a09080] opacity-50'
                  : 'bg-white border-[#d4c5a9] text-[#2c2416] hover:bg-[#f5f0e6] hover:border-[#b8a88e] disabled:cursor-not-allowed'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Letter circle */}
                <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold font-mono flex-shrink-0 mt-0.5 transition-colors ${
                  quizFeedback
                    ? idx === quizData.correctIndex
                      ? 'bg-green-500 border-green-500 text-white'
                      : selectedIndex === idx
                        ? 'bg-red-400 border-red-400 text-white'
                        : 'border-[#d4c5a9] text-[#c0b09a]'
                    : 'border-[#8a7a5e] text-[#8a7a5e]'
                }`}>
                  {OPTION_LETTERS[idx]}
                </span>
                <div className="flex-1">
                  {renderRichText(opt, "text-inherit")}
                  {/* Domain hint when bridge is expanded */}
                  {showBridge && quizData.analogyBridge?.optionHints?.[idx] && !quizFeedback && (
                    <div className="text-xs text-blue-500 mt-1.5 italic flex items-center gap-1">
                      <span>{domainEmoji}</span>
                      <span>{quizData.analogyBridge.optionHints[idx]}</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Feedback — red pen / green check */}
        {quizFeedback && (
          <div
            className={`text-sm p-3 rounded-lg border-l-4 ${
              isCorrect
                ? 'bg-green-50 border-green-500 text-green-800'
                : 'bg-red-50 border-red-400 text-red-800'
            }`}
          >
            {isCorrect ? (
              <div>
                <span className="font-bold text-green-600">{getSuccessMessage()}</span>
                {quizData.explanation && (
                  <div className="mt-1.5 text-green-700 opacity-90 leading-relaxed">
                    {renderRichText(quizData.explanation, "text-green-700")}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <span className="font-bold text-red-500 italic">✗ Not quite</span>
                <div className="mt-1.5 text-red-700 opacity-90 leading-relaxed">
                  {renderRichText(quizFeedback.replace(/^Incorrect[.!]?\s*/i, ''), "text-red-700")}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {quizFeedback && (
          <div className="mt-4 flex gap-2">
            {canRetry && (
              <button
                onClick={onRetry}
                disabled={isQuizLoading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 border-2 border-[#2c2416] text-[#2c2416] hover:bg-[#f0ebe0] disabled:opacity-40 disabled:cursor-not-allowed font-medium rounded-lg transition-colors"
              >
                <RotateCcw size={16} />
                Retry ({maxRetries - retryCount} left)
              </button>
            )}

            <button
              onClick={onNextQuestion}
              disabled={isQuizLoading}
              className={`${canRetry ? 'flex-1' : 'w-full'} flex items-center justify-center gap-2 py-2.5 px-4 ${
                isCorrect
                  ? 'bg-green-700 hover:bg-green-600 text-white'
                  : 'bg-[#2c2416] hover:bg-[#3d3322] text-[#faf8f2]'
              } disabled:opacity-40 disabled:cursor-not-allowed font-medium rounded-lg transition-colors`}
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

        {/* Drag indicator */}
        {!isMobile && (
          <div className="absolute top-1 left-1/2 transform -translate-x-1/2 text-[#d4c5a9] pointer-events-none">
            <GripHorizontal size={12} />
          </div>
        )}
      </div>
    </div>
  );
};
