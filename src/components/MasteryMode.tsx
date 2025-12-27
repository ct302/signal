import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  GraduationCap,
  ChevronRight,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Lightbulb,
  History,
  RotateCcw,
  Trophy,
  BookOpen
} from 'lucide-react';
import {
  MasterySession,
  MasteryKeyword,
  MasteryStage,
  StageAttempt,
  EvaluationResult,
  ConceptMapItem,
  ImportanceMapItem,
  MasteryHistoryEntry
} from '../types';
import {
  generateMasteryKeywords,
  evaluateMasteryResponse,
  detectKeywordsInText
} from '../services';

interface MasteryModeProps {
  topic: string;
  domain: string;
  domainEmoji: string;
  conceptMap: ConceptMapItem[];
  importanceMap: ImportanceMapItem[];
  analogyText: string;
  isDarkMode: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'signal_mastery_history';

// ============================================
// STAGE INDICATOR COMPONENT
// ============================================
const StageIndicator: React.FC<{
  currentStage: MasteryStage;
  stageHistory: StageAttempt[];
  isDarkMode: boolean;
}> = ({ currentStage, stageHistory, isDarkMode }) => {
  const stages: MasteryStage[] = [1, 2, 3];

  const getStageStatus = (stage: MasteryStage): 'completed' | 'current' | 'locked' => {
    const stageAttempts = stageHistory.filter(a => a.stage === stage && a.passed);
    if (stageAttempts.length > 0) return 'completed';
    if (stage === currentStage) return 'current';
    return 'locked';
  };

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {stages.map((stage, idx) => {
        const status = getStageStatus(stage);
        return (
          <React.Fragment key={stage}>
            <div
              className={`
                w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
                transition-all duration-500 relative
                ${status === 'completed'
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                  : status === 'current'
                    ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-lg shadow-purple-500/30 animate-pulse'
                    : isDarkMode
                      ? 'bg-neutral-800 text-neutral-500'
                      : 'bg-neutral-200 text-neutral-400'
                }
              `}
            >
              {status === 'completed' ? <CheckCircle2 size={20} /> : stage}
              {status === 'current' && (
                <div className="absolute inset-0 rounded-full border-2 border-purple-400 animate-ping opacity-50" />
              )}
            </div>
            {idx < stages.length - 1 && (
              <div
                className={`w-12 h-1 rounded-full transition-all duration-500 ${
                  getStageStatus(stages[idx + 1]) !== 'locked' || status === 'completed'
                    ? 'bg-gradient-to-r from-green-500 to-blue-500'
                    : isDarkMode
                      ? 'bg-neutral-800'
                      : 'bg-neutral-200'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ============================================
// KEYWORD PANEL COMPONENT
// ============================================
const KeywordPanel: React.FC<{
  keywords: MasteryKeyword[];
  stage: MasteryStage;
  isDarkMode: boolean;
  domain: string;
  detectedKeywords: string[];
}> = ({ keywords, stage, isDarkMode, domain, detectedKeywords }) => {
  if (stage === 1) return null;

  // Stage 2: Show top 6 keywords with 3-word definitions
  // Stage 3: Show all 10 keywords with 6-word definitions
  const visibleKeywords = stage === 2 ? keywords.slice(0, 6) : keywords;

  return (
    <div className={`rounded-xl p-4 mb-4 ${isDarkMode ? 'bg-neutral-800/50' : 'bg-neutral-100'}`}>
      <div className="flex items-center gap-2 mb-3">
        <BookOpen size={16} className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} />
        <span className={`text-sm font-bold ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
          {stage === 2 ? '6 Keywords' : 'All 10 Keywords'}
          <span className="font-normal text-neutral-500 ml-2">
            (Use {stage === 2 ? '3' : '6'} in your explanation)
          </span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {visibleKeywords.map((keyword) => {
          const isDetected = detectedKeywords.includes(keyword.term);
          const definition = stage === 2 ? keyword.analogyDefinition3 : keyword.analogyDefinition6;

          return (
            <div
              key={keyword.id}
              className={`
                p-3 rounded-lg border-2 transition-all duration-300
                ${isDetected
                  ? 'border-green-500 bg-green-500/10'
                  : isDarkMode
                    ? 'border-neutral-700 bg-neutral-900/50 hover:border-neutral-600'
                    : 'border-neutral-200 bg-white hover:border-neutral-300'
                }
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
                    {keyword.analogyTerm}
                  </div>
                  <div className={`text-xs mt-1 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    {definition}
                  </div>
                  <div className={`text-[10px] mt-1 opacity-60 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    Technical: {keyword.term}
                  </div>
                </div>
                {isDetected && (
                  <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// FEEDBACK PANEL COMPONENT
// ============================================
const FeedbackPanel: React.FC<{
  evaluation: EvaluationResult | null;
  isDarkMode: boolean;
  onRetry: () => void;
  onContinue: () => void;
  isComplete: boolean;
}> = ({ evaluation, isDarkMode, onRetry, onContinue, isComplete }) => {
  if (!evaluation) return null;

  const passed = evaluation.passed;

  return (
    <div
      className={`
        rounded-xl p-4 mt-4 border-2 animate-in slide-in-from-bottom-4 duration-300
        ${passed
          ? 'border-green-500 bg-green-500/10'
          : 'border-amber-500 bg-amber-500/10'
        }
      `}
    >
      {/* Score Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {passed ? (
            <CheckCircle2 className="text-green-500" size={24} />
          ) : (
            <XCircle className="text-amber-500" size={24} />
          )}
          <span className={`font-bold text-lg ${passed ? 'text-green-500' : 'text-amber-500'}`}>
            {evaluation.score}%
          </span>
          <span className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
            {passed ? 'Passed!' : 'Not quite - try again'}
          </span>
        </div>
      </div>

      {/* Feedback */}
      <p className={`text-sm mb-3 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
        {evaluation.feedback}
      </p>

      {/* Strengths */}
      {evaluation.strengths.length > 0 && (
        <div className="mb-3">
          <div className={`text-xs font-bold uppercase mb-1 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
            Strengths
          </div>
          <ul className={`text-xs space-y-1 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
            {evaluation.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-green-500">✓</span> {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Intuitions */}
      {evaluation.intuitions && (
        <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-neutral-800' : 'bg-white'} mb-3`}>
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb size={14} className="text-yellow-500" />
            <span className={`text-xs font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
              Key Intuition
            </span>
          </div>
          <p className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
            {evaluation.intuitions.insight}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!passed && (
          <button
            onClick={onRetry}
            className={`
              flex-1 py-2 px-4 rounded-lg font-medium text-sm
              flex items-center justify-center gap-2 transition-all
              ${isDarkMode
                ? 'bg-neutral-700 text-white hover:bg-neutral-600'
                : 'bg-neutral-200 text-neutral-800 hover:bg-neutral-300'
              }
            `}
          >
            <RotateCcw size={16} />
            Try Again
          </button>
        )}
        {passed && !isComplete && (
          <button
            onClick={onContinue}
            className="flex-1 py-2 px-4 rounded-lg font-medium text-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white flex items-center justify-center gap-2 hover:opacity-90 transition-all"
          >
            Next Stage
            <ChevronRight size={16} />
          </button>
        )}
        {passed && isComplete && (
          <div className="flex-1 py-2 px-4 rounded-lg font-medium text-sm bg-gradient-to-r from-green-500 to-emerald-500 text-white flex items-center justify-center gap-2">
            <Trophy size={16} />
            Mastery Complete!
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// ANSWER HISTORY COMPONENT
// ============================================
const AnswerHistoryPanel: React.FC<{
  stageHistory: StageAttempt[];
  isDarkMode: boolean;
  domain: string;
}> = ({ stageHistory, isDarkMode, domain }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (stageHistory.length === 0) return null;

  const passedAttempts = stageHistory.filter(a => a.passed);

  return (
    <div className={`rounded-xl overflow-hidden mb-4 ${isDarkMode ? 'bg-neutral-800/50' : 'bg-neutral-100'}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full p-3 flex items-center justify-between ${isDarkMode ? 'hover:bg-neutral-700/50' : 'hover:bg-neutral-200/50'} transition-colors`}
      >
        <div className="flex items-center gap-2">
          <History size={16} className={isDarkMode ? 'text-neutral-400' : 'text-neutral-500'} />
          <span className={`text-sm font-medium ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
            Your Journey ({passedAttempts.length}/3 stages passed)
          </span>
        </div>
        <ChevronRight
          size={16}
          className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}
        />
      </button>

      {isExpanded && (
        <div className="p-3 pt-0 space-y-3">
          {passedAttempts.map((attempt, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg ${isDarkMode ? 'bg-neutral-900/50' : 'bg-white'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  Stage {attempt.stage} • {attempt.score}%
                </span>
                <span className="text-green-500">
                  <CheckCircle2 size={14} />
                </span>
              </div>

              {/* User's Answer */}
              <div className="mb-2">
                <div className={`text-xs font-medium mb-1 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  Your Explanation:
                </div>
                <p className={`text-sm italic ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                  "{attempt.userResponse.slice(0, 200)}{attempt.userResponse.length > 200 ? '...' : ''}"
                </p>
              </div>

              {/* Intuition */}
              <div className={`p-2 rounded ${isDarkMode ? 'bg-yellow-900/20' : 'bg-yellow-50'}`}>
                <div className="flex items-center gap-1 mb-1">
                  <Lightbulb size={12} className="text-yellow-500" />
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                    Why this worked:
                  </span>
                </div>
                <p className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                  {attempt.intuitions?.insight || 'Understanding demonstrated.'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN MASTERY MODE COMPONENT
// ============================================
export const MasteryMode: React.FC<MasteryModeProps> = ({
  topic,
  domain,
  domainEmoji,
  conceptMap,
  importanceMap,
  analogyText,
  isDarkMode,
  onClose
}) => {
  // Session State
  const [session, setSession] = useState<MasterySession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Input State
  const [userInput, setUserInput] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [currentEvaluation, setCurrentEvaluation] = useState<EvaluationResult | null>(null);
  const [detectedKeywords, setDetectedKeywords] = useState<string[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Generate keywords with dual definitions
        const keywords = await generateMasteryKeywords(
          topic,
          domain,
          conceptMap,
          importanceMap,
          analogyText
        );

        const newSession: MasterySession = {
          id: crypto.randomUUID(),
          sourceData: {
            topic,
            domain,
            domainEmoji,
            analogyText
          },
          keywords,
          currentStage: 1,
          stageHistory: [],
          isComplete: false,
          startedAt: new Date()
        };

        setSession(newSession);
      } catch (err) {
        console.error('Failed to initialize mastery session:', err);
        setError('Failed to start mastery mode. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, [topic, domain, domainEmoji, conceptMap, importanceMap, analogyText]);

  // Real-time keyword detection as user types
  useEffect(() => {
    if (!session || session.currentStage === 1) {
      setDetectedKeywords([]);
      return;
    }

    const visibleKeywords = session.currentStage === 2
      ? session.keywords.slice(0, 6)
      : session.keywords;

    const detected = detectKeywordsInText(userInput, visibleKeywords);
    setDetectedKeywords(detected);
  }, [userInput, session]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!session || !userInput.trim() || isEvaluating) return;

    setIsEvaluating(true);
    setCurrentEvaluation(null);

    try {
      const visibleKeywords = session.currentStage === 1
        ? []
        : session.currentStage === 2
          ? session.keywords.slice(0, 6)
          : session.keywords;

      const evaluation = await evaluateMasteryResponse(
        topic,
        domain,
        session.currentStage,
        userInput,
        visibleKeywords,
        analogyText
      );

      setCurrentEvaluation(evaluation);

      // Create attempt record
      const attempt: StageAttempt = {
        stage: session.currentStage,
        userResponse: userInput,
        availableKeywords: visibleKeywords.map(k => k.term),
        requiredKeywordCount: session.currentStage === 1 ? 0 : session.currentStage === 2 ? 3 : 6,
        keywordsUsed: evaluation.keywordsDetected,
        score: evaluation.score,
        passed: evaluation.passed,
        feedback: evaluation.feedback,
        intuitions: evaluation.intuitions,
        timestamp: new Date()
      };

      // Update session
      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          stageHistory: [...prev.stageHistory, attempt]
        };
      });

    } catch (err) {
      console.error('Evaluation failed:', err);
      setCurrentEvaluation({
        score: 0,
        passed: false,
        feedback: 'Failed to evaluate your response. Please try again.',
        keywordsDetected: [],
        missedConcepts: [],
        strengths: [],
        intuitions: {
          insight: 'Unable to evaluate.',
          keywordsCaptured: [],
          strength: ''
        }
      });
    } finally {
      setIsEvaluating(false);
    }
  }, [session, userInput, topic, domain, analogyText, isEvaluating]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setCurrentEvaluation(null);
    setUserInput('');
    textareaRef.current?.focus();
  }, []);

  // Handle continue to next stage
  const handleContinue = useCallback(() => {
    if (!session) return;

    const nextStage = (session.currentStage + 1) as MasteryStage;
    const isComplete = nextStage > 3;

    setSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        currentStage: isComplete ? 3 : nextStage,
        isComplete,
        completedAt: isComplete ? new Date() : undefined
      };
    });

    setCurrentEvaluation(null);
    setUserInput('');
    setDetectedKeywords([]);

    // Save to history if complete
    if (isComplete && session) {
      saveToHistory(session);
    }
  }, [session]);

  // Save completed session to history
  const saveToHistory = (completedSession: MasterySession) => {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      const history: MasteryHistoryEntry[] = existing ? JSON.parse(existing) : [];

      const passedAttempts = completedSession.stageHistory.filter(a => a.passed);
      const entry: MasteryHistoryEntry = {
        id: completedSession.id,
        topic: completedSession.sourceData.topic,
        domain: completedSession.sourceData.domain,
        domainEmoji: completedSession.sourceData.domainEmoji,
        completedAt: new Date(),
        finalScores: {
          stage1: passedAttempts.find(a => a.stage === 1)?.score ?? 0,
          stage2: passedAttempts.find(a => a.stage === 2)?.score ?? 0,
          stage3: passedAttempts.find(a => a.stage === 3)?.score ?? 0
        },
        stageAttempts: completedSession.stageHistory
      };

      const updatedHistory = [entry, ...history].slice(0, 50);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch (err) {
      console.error('Failed to save mastery history:', err);
    }
  };

  // Get stage-specific instructions
  const getStageInstructions = (): string => {
    if (!session) return '';

    switch (session.currentStage) {
      case 1:
        return `Explain "${topic}" in your own words using the ${domain} analogy. No keywords required - just demonstrate your intuitive understanding through storytelling.`;
      case 2:
        return `Now explain "${topic}" again, but incorporate at least 3 of the 6 keywords shown above. Keep it narrative - tell the story using these concepts.`;
      case 3:
        return `Final stage! Explain "${topic}" using at least 6 of all 10 keywords. This should be your most complete narrative explanation.`;
      default:
        return '';
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'Enter' && e.metaKey && !isEvaluating && userInput.trim()) {
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleSubmit, isEvaluating, userInput]);

  // Loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-white font-medium">Preparing Mastery Mode...</p>
          <p className="text-neutral-400 text-sm mt-1">Generating keywords and definitions</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !session) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center">
        <div className="text-center max-w-md">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-white font-medium mb-2">{error || 'Something went wrong'}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-700 text-white rounded-lg hover:bg-neutral-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const isComplete = session.isComplete;
  const requiredKeywords = session.currentStage === 1 ? 0 : session.currentStage === 2 ? 3 : 6;

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col ${isDarkMode ? 'bg-neutral-950' : 'bg-neutral-50'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
            <GraduationCap className="text-white" size={24} />
          </div>
          <div>
            <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
              {topic}
            </h2>
            <p className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Stage {session.currentStage}: {session.currentStage === 1 ? `Pure ${domain} Intuition` : session.currentStage === 2 ? 'Vocabulary' : 'Full Mastery'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-neutral-800 text-neutral-300 hover:bg-red-500 hover:text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-red-500 hover:text-white'}`}
        >
          <X size={20} />
        </button>
      </div>

      {/* Stage Indicator */}
      <StageIndicator
        currentStage={session.currentStage}
        stageHistory={session.stageHistory}
        isDarkMode={isDarkMode}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-2xl mx-auto">
          {/* Stage Header */}
          <div className={`text-center mb-6 p-4 rounded-xl ${isDarkMode ? 'bg-neutral-800/50' : 'bg-white shadow-sm'}`}>
            <div className="text-4xl mb-2">{domainEmoji}</div>
            <h3 className={`text-xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
              Stage {session.currentStage}: {session.currentStage === 1 ? `Pure ${domain} Intuition` : session.currentStage === 2 ? 'Vocabulary' : 'Full Mastery'}
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
              {getStageInstructions()}
            </p>
          </div>

          {/* Answer History */}
          <AnswerHistoryPanel
            stageHistory={session.stageHistory}
            isDarkMode={isDarkMode}
            domain={domain}
          />

          {/* Keyword Panel */}
          <KeywordPanel
            keywords={session.keywords}
            stage={session.currentStage}
            isDarkMode={isDarkMode}
            domain={domain}
            detectedKeywords={detectedKeywords}
          />

          {/* Input Area */}
          {!isComplete && (
            <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-neutral-800/50' : 'bg-white shadow-sm'}`}>
              {/* Keyword Counter */}
              {session.currentStage > 1 && (
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    Keywords used: {detectedKeywords.length}/{requiredKeywords} required
                  </span>
                  <div className="flex gap-1">
                    {Array.from({ length: requiredKeywords }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-all ${
                          i < detectedKeywords.length
                            ? 'bg-green-500'
                            : isDarkMode
                              ? 'bg-neutral-700'
                              : 'bg-neutral-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={isEvaluating || currentEvaluation?.passed}
                placeholder={`Tell the story of ${topic} using your ${domain} knowledge...`}
                className={`
                  w-full min-h-[200px] p-4 rounded-lg resize-none outline-none transition-all
                  ${isDarkMode
                    ? 'bg-neutral-900 text-white placeholder:text-neutral-600 border border-neutral-700 focus:border-purple-500'
                    : 'bg-neutral-50 text-neutral-800 placeholder:text-neutral-400 border border-neutral-200 focus:border-purple-500'
                  }
                  ${currentEvaluation?.passed ? 'opacity-50' : ''}
                `}
              />

              <div className="flex items-center justify-between mt-3">
                <span className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  {userInput.length} characters • ⌘+Enter to submit
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={!userInput.trim() || isEvaluating || currentEvaluation?.passed}
                  className={`
                    px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all
                    ${userInput.trim() && !isEvaluating && !currentEvaluation?.passed
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:opacity-90'
                      : isDarkMode
                        ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                        : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                    }
                  `}
                >
                  {isEvaluating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Evaluating...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Submit
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Completion State */}
          {isComplete && (
            <div className={`text-center p-8 rounded-xl ${isDarkMode ? 'bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30' : 'bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200'}`}>
              <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <h3 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
                Mastery Complete!
              </h3>
              <p className={`mb-4 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                You've demonstrated full understanding of {topic} through the lens of {domain}.
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={onClose}
                  className="px-6 py-2 rounded-lg font-medium bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:opacity-90 transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Feedback Panel */}
          <FeedbackPanel
            evaluation={currentEvaluation}
            isDarkMode={isDarkMode}
            onRetry={handleRetry}
            onContinue={handleContinue}
            isComplete={isComplete}
          />
        </div>
      </div>

      {/* Footer */}
      <div className={`px-6 py-3 border-t ${isDarkMode ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <span className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
            Explain in narrative form using {domain} vocabulary • No technical jargon
          </span>
          <span className={`text-xs ${isDarkMode ? 'text-neutral-600' : 'text-neutral-400'}`}>
            Press Esc to exit
          </span>
        </div>
      </div>
    </div>
  );
};

export default MasteryMode;
