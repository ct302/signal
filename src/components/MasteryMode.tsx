import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  GraduationCap,
  ChevronRight,
  ChevronDown,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Lightbulb,
  RotateCcw,
  Trophy,
  BookOpen,
  MessageCircle,
  Dices,
  Share2,
  Medal,
  Eye,
  Check
} from 'lucide-react';
import {
  MasterySession,
  MasteryKeyword,
  MasteryStage,
  StageAttempt,
  EvaluationResult,
  ConceptMapItem,
  ImportanceMapItem,
  MasteryStory,
  MasteryChatMessage,
  CompleteMasteryHistory
} from '../types';
import {
  generateMasteryKeywords,
  evaluateMasteryResponse,
  detectKeywordsInText,
  generateMasteryStory,
  generateMasteryChatResponse,
  generateMasterySummary
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
// KEYWORD HOVER MODAL COMPONENT
// ============================================
const KeywordHoverModal: React.FC<{
  keyword: MasteryKeyword;
  stage: MasteryStage;
  isDarkMode: boolean;
  position: { x: number; y: number };
}> = ({ keyword, stage, isDarkMode, position }) => {
  const techDef = stage === 3 ? keyword.techDefinition6 : keyword.techDefinition3;
  const analogyDef = stage === 3 ? keyword.analogyDefinition6 : keyword.analogyDefinition3;

  return (
    <div
      className={`
        fixed z-[200] p-3 rounded-lg shadow-xl border max-w-xs
        animate-in fade-in zoom-in-95 duration-150
        ${isDarkMode
          ? 'bg-neutral-800 border-neutral-700 text-white'
          : 'bg-white border-neutral-200 text-neutral-800'}
      `}
      style={{
        left: Math.min(position.x, window.innerWidth - 280),
        top: position.y + 10,
      }}
    >
      <div className="font-bold text-sm mb-2 flex items-center gap-2">
        <span className="text-purple-500">{keyword.term}</span>
        <span className={isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}>↔</span>
        <span className="text-blue-500">{keyword.analogyTerm}</span>
      </div>

      <div className="space-y-2">
        <div>
          <div className={`text-[10px] uppercase font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
            Technical ({stage === 3 ? '6-word' : '3-word'})
          </div>
          <div className={`text-xs ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
            {techDef}
          </div>
        </div>

        <div>
          <div className={`text-[10px] uppercase font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
            Analogy ({stage === 3 ? '6-word' : '3-word'})
          </div>
          <div className={`text-xs ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
            {analogyDef}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// STORY CARD COMPONENT
// ============================================
const StoryCard: React.FC<{
  story: MasteryStory | null;
  keywords: MasteryKeyword[];
  stage: MasteryStage;
  isDarkMode: boolean;
  domain: string;
  isLoading: boolean;
  onRegenerate: () => void;
}> = ({ story, keywords, stage, isDarkMode, domain, isLoading, onRegenerate }) => {
  const [hoveredKeyword, setHoveredKeyword] = useState<MasteryKeyword | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });

  // Highlight keywords in the story text
  const renderStoryWithHighlights = () => {
    if (!story) return null;

    let content = story.content;
    const relevantKeywords = stage === 1 ? [] : stage === 2 ? keywords.slice(0, 6) : keywords;

    if (relevantKeywords.length === 0) {
      return <span>{content}</span>;
    }

    // Create a regex pattern for all keywords (both tech and analogy terms)
    const terms: { term: string; keyword: MasteryKeyword }[] = [];
    relevantKeywords.forEach(k => {
      terms.push({ term: k.term, keyword: k });
      terms.push({ term: k.analogyTerm, keyword: k });
    });

    // Sort by length (longest first) to match longer terms first
    terms.sort((a, b) => b.term.length - a.term.length);

    // Build regex
    const pattern = terms.map(t => t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');

    const parts = content.split(regex);

    return parts.map((part, index) => {
      const matchedTerm = terms.find(t => t.term.toLowerCase() === part.toLowerCase());

      if (matchedTerm) {
        return (
          <span
            key={index}
            className={`
              cursor-pointer px-1 py-0.5 rounded transition-all duration-200
              ${isDarkMode
                ? 'bg-purple-500/30 text-purple-300 hover:bg-purple-500/50'
                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}
              font-medium
            `}
            onMouseEnter={(e) => {
              setHoveredKeyword(matchedTerm.keyword);
              setHoverPosition({ x: e.clientX, y: e.clientY });
            }}
            onMouseLeave={() => setHoveredKeyword(null)}
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  if (isLoading) {
    return (
      <div className={`rounded-xl p-6 mb-4 ${isDarkMode ? 'bg-neutral-800/50' : 'bg-white shadow-sm'}`}>
        <div className="flex items-center justify-center gap-3 py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
          <span className={isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}>
            Generating your {domain} story...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl p-6 mb-4 relative ${isDarkMode ? 'bg-neutral-800/50' : 'bg-white shadow-sm'}`}>
      {/* Story Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} />
          <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
            {stage === 1 ? 'Your Story' : `Your Story (${stage === 2 ? '6' : '10'} terms highlighted)`}
          </span>
        </div>

        {/* Regenerate Button */}
        <button
          onClick={onRegenerate}
          className={`
            p-2 rounded-lg transition-all duration-200 group
            ${isDarkMode
              ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
              : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'}
          `}
          title="Regenerate story"
        >
          <Dices size={18} className="group-hover:rotate-180 transition-transform duration-500" />
        </button>
      </div>

      {/* Story Content */}
      <div className={`text-base leading-relaxed ${isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}`}>
        {renderStoryWithHighlights()}
      </div>

      {/* Stage indicator badge */}
      <div className={`
        absolute bottom-4 right-4 px-2 py-1 rounded text-xs font-medium
        ${stage === 1
          ? 'bg-blue-500/20 text-blue-400'
          : stage === 2
            ? 'bg-purple-500/20 text-purple-400'
            : 'bg-green-500/20 text-green-400'}
      `}>
        Stage {stage}
      </div>

      {/* Keyword Hover Modal */}
      {hoveredKeyword && (
        <KeywordHoverModal
          keyword={hoveredKeyword}
          stage={stage}
          isDarkMode={isDarkMode}
          position={hoverPosition}
        />
      )}
    </div>
  );
};

// ============================================
// CHAT WINDOW COMPONENT
// ============================================
const ChatWindow: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
  topic: string;
  domain: string;
  currentStage: MasteryStage;
  currentStory: string;
  userResponses: string[];
  keywords: MasteryKeyword[];
  isDarkMode: boolean;
}> = ({ isOpen, onToggle, topic, domain, currentStage, currentStory, userResponses, keywords, isDarkMode }) => {
  const [messages, setMessages] = useState<MasteryChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: MasteryChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await generateMasteryChatResponse(
        topic,
        domain,
        currentStage,
        currentStory,
        userResponses,
        keywords,
        messages,
        input.trim()
      );

      const assistantMessage: MasteryChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className={`
          fixed bottom-24 right-6 z-[150] p-4 rounded-full shadow-lg
          transition-all duration-300 hover:scale-110
          bg-gradient-to-br from-purple-500 to-blue-500 text-white
        `}
        title="Chat with tutor"
      >
        <MessageCircle size={24} />
      </button>
    );
  }

  return (
    <div className={`
      fixed bottom-24 right-6 z-[150] w-96 h-[500px] rounded-xl shadow-2xl
      flex flex-col overflow-hidden border
      ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-200'}
    `}>
      {/* Header */}
      <div className={`
        flex items-center justify-between p-4 border-b
        ${isDarkMode ? 'border-neutral-700 bg-neutral-800' : 'border-neutral-200 bg-neutral-50'}
      `}>
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className="text-purple-500" />
          <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
            Chat with Claude
          </span>
        </div>
        <button
          onClick={onToggle}
          className={`p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700`}
        >
          <X size={18} className={isDarkMode ? 'text-neutral-400' : 'text-neutral-600'} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className={`text-center py-8 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
            <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Ask me anything about the story or concept!</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`
              p-3 rounded-lg max-w-[85%]
              ${msg.role === 'user'
                ? `ml-auto ${isDarkMode ? 'bg-purple-600 text-white' : 'bg-purple-500 text-white'}`
                : `${isDarkMode ? 'bg-neutral-800 text-neutral-200' : 'bg-neutral-100 text-neutral-800'}`
              }
            `}
          >
            <p className="text-sm">{msg.content}</p>
          </div>
        ))}

        {isLoading && (
          <div className={`p-3 rounded-lg max-w-[85%] ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
            <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`p-4 border-t ${isDarkMode ? 'border-neutral-700' : 'border-neutral-200'}`}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask me anything..."
            className={`
              flex-1 px-3 py-2 rounded-lg outline-none text-sm
              ${isDarkMode
                ? 'bg-neutral-800 text-white placeholder:text-neutral-500 border border-neutral-700 focus:border-purple-500'
                : 'bg-neutral-100 text-neutral-800 placeholder:text-neutral-400 border border-neutral-200 focus:border-purple-500'}
            `}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`
              p-2 rounded-lg transition-all
              ${input.trim() && !isLoading
                ? 'bg-purple-500 text-white hover:bg-purple-600'
                : isDarkMode
                  ? 'bg-neutral-700 text-neutral-500'
                  : 'bg-neutral-200 text-neutral-400'
              }
            `}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// STAGE INDICATOR COMPONENT
// ============================================
const StageIndicator: React.FC<{
  currentStage: MasteryStage;
  stageHistory: StageAttempt[];
  isDarkMode: boolean;
  domain: string;
}> = ({ currentStage, stageHistory, isDarkMode, domain }) => {
  const stages: MasteryStage[] = [1, 2, 3];
  const stageNames = [`Pure ${domain} Intuition`, 'Vocabulary', 'Full Mastery'];

  const getStageStatus = (stage: MasteryStage): 'completed' | 'current' | 'locked' => {
    const stageAttempts = stageHistory.filter(a => a.stage === stage && a.passed);
    if (stageAttempts.length > 0) return 'completed';
    if (stage === currentStage) return 'current';
    return 'locked';
  };

  return (
    <div className={`rounded-xl p-4 mb-4 ${isDarkMode ? 'bg-neutral-800/30' : 'bg-white/50'}`}>
      <div className="flex items-center justify-center gap-2">
        {stages.map((stage, idx) => {
          const status = getStageStatus(stage);
          return (
            <React.Fragment key={stage}>
              <div className="flex flex-col items-center">
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
                <span className={`text-xs mt-1 ${status === 'current' ? 'text-purple-400 font-medium' : isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  {stageNames[idx]}
                </span>
              </div>
              {idx < stages.length - 1 && (
                <div
                  className={`w-12 h-1 rounded-full transition-all duration-500 mb-5 ${
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
  const [isExpanded, setIsExpanded] = useState(true);

  if (stage === 1) return null;

  const visibleKeywords = stage === 2 ? keywords.slice(0, 6) : keywords;

  return (
    <div className={`rounded-xl overflow-hidden mb-4 ${isDarkMode ? 'bg-neutral-800/50' : 'bg-neutral-100'}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full p-3 flex items-center justify-between ${isDarkMode ? 'hover:bg-neutral-700/50' : 'hover:bg-neutral-200/50'} transition-colors`}
      >
        <div className="flex items-center gap-2">
          <BookOpen size={16} className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} />
          <span className={`text-sm font-bold ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
            {stage === 2 ? '6 Keywords' : 'All 10 Keywords'}
            <span className="font-normal text-neutral-500 ml-2">
              (Use {stage === 2 ? '3' : '6'} in your explanation)
            </span>
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}
        />
      </button>

      {isExpanded && (
        <div className="p-3 pt-0">
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
      )}
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
// GLOSSARY VIEW COMPONENT
// ============================================
const GlossaryView: React.FC<{
  keywords: MasteryKeyword[];
  isDarkMode: boolean;
}> = ({ keywords, isDarkMode }) => {
  return (
    <div className="space-y-3">
      <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
        Complete Glossary
      </h3>

      <div className="grid gap-3">
        {keywords.map((keyword) => (
          <div
            key={keyword.id}
            className={`p-4 rounded-xl ${isDarkMode ? 'bg-neutral-800/50' : 'bg-white shadow-sm'}`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className={`font-bold text-lg ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                {keyword.term}
              </span>
              <span className={isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}>↔</span>
              <span className={`font-bold text-lg ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                {keyword.analogyTerm}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* 3-word definitions */}
              <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-neutral-900/50' : 'bg-neutral-50'}`}>
                <div className={`text-[10px] uppercase font-bold mb-1 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                  Technical (3-word)
                </div>
                <div className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                  {keyword.techDefinition3}
                </div>
              </div>

              <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-neutral-900/50' : 'bg-neutral-50'}`}>
                <div className={`text-[10px] uppercase font-bold mb-1 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  Analogy (3-word)
                </div>
                <div className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                  {keyword.analogyDefinition3}
                </div>
              </div>

              {/* 6-word definitions */}
              <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-neutral-900/50' : 'bg-neutral-50'}`}>
                <div className={`text-[10px] uppercase font-bold mb-1 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                  Technical (6-word)
                </div>
                <div className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                  {keyword.techDefinition6}
                </div>
              </div>

              <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-neutral-900/50' : 'bg-neutral-50'}`}>
                <div className={`text-[10px] uppercase font-bold mb-1 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  Analogy (6-word)
                </div>
                <div className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                  {keyword.analogyDefinition6}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// OVERVIEW MODE COMPONENT
// ============================================
const OverviewMode: React.FC<{
  historyEntry: CompleteMasteryHistory;
  isDarkMode: boolean;
  onClose: () => void;
}> = ({ historyEntry, isDarkMode, onClose }) => {
  const [activeTab, setActiveTab] = useState<'journey' | 'glossary'>('journey');
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareText = `🎓 I mastered ${historyEntry.topic} using ${historyEntry.domain} analogies!\n\n` +
      `📊 Scores: Stage 1: ${historyEntry.finalScores.stage1}% | Stage 2: ${historyEntry.finalScores.stage2}% | Stage 3: ${historyEntry.finalScores.stage3}%\n\n` +
      `💡 Key Insight: ${historyEntry.masterySummary.coreIntuition}\n\n` +
      `#Signal #Learning`;

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('Failed to copy to clipboard');
    }
  };

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col ${isDarkMode ? 'bg-neutral-950' : 'bg-neutral-50'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Medal className="w-10 h-10 text-yellow-500" />
            <span className="absolute -bottom-1 -right-1 text-lg">{historyEntry.domainEmoji}</span>
          </div>
          <div>
            <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
              {historyEntry.topic}
            </h2>
            <p className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Mastered on {new Date(historyEntry.completedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all
              ${isDarkMode ? 'bg-neutral-800 text-white hover:bg-neutral-700' : 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'}
            `}
          >
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            {copied ? 'Copied!' : 'Share'}
          </button>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-neutral-800 text-neutral-300 hover:bg-red-500 hover:text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-red-500 hover:text-white'}`}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={`px-6 py-2 border-b ${isDarkMode ? 'border-neutral-800' : 'border-neutral-200'}`}>
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('journey')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'journey'
                ? 'bg-purple-500 text-white'
                : isDarkMode ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            Your Journey
          </button>
          <button
            onClick={() => setActiveTab('glossary')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'glossary'
                ? 'bg-purple-500 text-white'
                : isDarkMode ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            Glossary
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto">
          {activeTab === 'journey' ? (
            <div className="space-y-6">
              {/* Mastery Summary */}
              <div className={`p-6 rounded-xl ${isDarkMode ? 'bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border border-yellow-500/30' : 'bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="text-yellow-500" size={24} />
                  <h3 className={`text-lg font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                    Your Mastery Summary
                  </h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className={`text-xs uppercase font-bold ${isDarkMode ? 'text-yellow-400/70' : 'text-yellow-600'}`}>
                      Key Strength
                    </div>
                    <p className={`${isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}`}>
                      {historyEntry.masterySummary.keyStrength}
                    </p>
                  </div>

                  <div>
                    <div className={`text-xs uppercase font-bold ${isDarkMode ? 'text-yellow-400/70' : 'text-yellow-600'}`}>
                      Core Intuition
                    </div>
                    <p className={`${isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}`}>
                      {historyEntry.masterySummary.coreIntuition}
                    </p>
                  </div>

                  <div>
                    <div className={`text-xs uppercase font-bold ${isDarkMode ? 'text-yellow-400/70' : 'text-yellow-600'}`}>
                      What Made You Unique
                    </div>
                    <p className={`${isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}`}>
                      {historyEntry.masterySummary.uniqueApproach}
                    </p>
                  </div>
                </div>
              </div>

              {/* Scores */}
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((stage) => (
                  <div
                    key={stage}
                    className={`p-4 rounded-xl text-center ${isDarkMode ? 'bg-neutral-800/50' : 'bg-white shadow-sm'}`}
                  >
                    <div className={`text-3xl font-bold ${
                      stage === 1 ? 'text-blue-500' : stage === 2 ? 'text-purple-500' : 'text-green-500'
                    }`}>
                      {historyEntry.finalScores[`stage${stage}` as keyof typeof historyEntry.finalScores]}%
                    </div>
                    <div className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                      Stage {stage}
                    </div>
                  </div>
                ))}
              </div>

              {/* Stage Details */}
              {[1, 2, 3].map((stage) => (
                <div
                  key={stage}
                  className={`p-6 rounded-xl ${isDarkMode ? 'bg-neutral-800/50' : 'bg-white shadow-sm'}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center font-bold
                      ${stage === 1 ? 'bg-blue-500' : stage === 2 ? 'bg-purple-500' : 'bg-green-500'} text-white
                    `}>
                      {stage}
                    </div>
                    <h4 className={`font-bold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
                      Stage {stage}: {stage === 1 ? 'Pure Intuition' : stage === 2 ? 'Vocabulary' : 'Full Mastery'}
                    </h4>
                  </div>

                  {/* Story */}
                  <div className={`p-4 rounded-lg mb-4 ${isDarkMode ? 'bg-neutral-900/50' : 'bg-neutral-50'}`}>
                    <div className={`text-xs uppercase font-bold mb-2 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      The Story
                    </div>
                    <p className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                      {historyEntry.stories[`stage${stage}` as keyof typeof historyEntry.stories]?.content || 'Story not available'}
                    </p>
                  </div>

                  {/* User Response */}
                  <div className={`p-4 rounded-lg mb-4 ${isDarkMode ? 'bg-purple-900/20 border border-purple-500/30' : 'bg-purple-50 border border-purple-200'}`}>
                    <div className={`text-xs uppercase font-bold mb-2 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                      Your Response
                    </div>
                    <p className={`text-sm italic ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                      "{historyEntry.userResponses[`stage${stage}` as keyof typeof historyEntry.userResponses] || 'Response not available'}"
                    </p>
                  </div>

                  {/* Intuition */}
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-yellow-900/20 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb size={14} className="text-yellow-500" />
                      <span className={`text-xs uppercase font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                        Key Intuition
                      </span>
                    </div>
                    <p className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                      {historyEntry.intuitions[`stage${stage}` as keyof typeof historyEntry.intuitions]?.insight || 'Intuition not available'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <GlossaryView keywords={historyEntry.glossary} isDarkMode={isDarkMode} />
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// COMPLETION CELEBRATION COMPONENT
// ============================================
const CompletionCelebration: React.FC<{
  topic: string;
  domain: string;
  domainEmoji: string;
  finalScores: { stage1: number; stage2: number; stage3: number };
  masterySummary: { keyStrength: string; coreIntuition: string; uniqueApproach: string };
  isDarkMode: boolean;
  onViewOverview: () => void;
  onClose: () => void;
}> = ({ topic, domain, domainEmoji, finalScores, masterySummary, isDarkMode, onViewOverview, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareText = `🎓 I mastered ${topic} using ${domain} analogies!\n\n` +
      `📊 Scores: Stage 1: ${finalScores.stage1}% | Stage 2: ${finalScores.stage2}% | Stage 3: ${finalScores.stage3}%\n\n` +
      `💡 Key Insight: ${masterySummary.coreIntuition}\n\n` +
      `#Signal #Learning`;

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('Failed to copy to clipboard');
    }
  };

  return (
    <div className={`fixed inset-0 z-[110] flex items-center justify-center ${isDarkMode ? 'bg-black/90' : 'bg-white/90'}`}>
      <div className={`max-w-md w-full mx-4 p-8 rounded-2xl text-center ${isDarkMode ? 'bg-neutral-900' : 'bg-white shadow-2xl'}`}>
        {/* Trophy Animation */}
        <div className="relative mb-6">
          <Trophy className="w-24 h-24 mx-auto text-yellow-500 animate-bounce" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-yellow-500/20 animate-ping" />
          </div>
          <span className="absolute bottom-0 right-1/3 text-3xl">{domainEmoji}</span>
        </div>

        <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
          Mastery Complete!
        </h2>

        <p className={`mb-6 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
          You've demonstrated full understanding of <strong>{topic}</strong> through the lens of <strong>{domain}</strong>.
        </p>

        {/* Scores */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3].map((stage) => (
            <div
              key={stage}
              className={`p-3 rounded-lg ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'}`}
            >
              <div className={`text-2xl font-bold ${
                stage === 1 ? 'text-blue-500' : stage === 2 ? 'text-purple-500' : 'text-green-500'
              }`}>
                {finalScores[`stage${stage}` as keyof typeof finalScores]}%
              </div>
              <div className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                Stage {stage}
              </div>
            </div>
          ))}
        </div>

        {/* Key Insight */}
        <div className={`p-4 rounded-lg mb-6 ${isDarkMode ? 'bg-yellow-900/20' : 'bg-yellow-50'}`}>
          <Lightbulb className="w-5 h-5 text-yellow-500 mx-auto mb-2" />
          <p className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
            {masterySummary.coreIntuition}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleShare}
            className={`
              flex-1 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all
              ${isDarkMode ? 'bg-neutral-800 text-white hover:bg-neutral-700' : 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'}
            `}
          >
            {copied ? <Check size={18} /> : <Share2 size={18} />}
            {copied ? 'Copied!' : 'Share'}
          </button>

          <button
            onClick={onViewOverview}
            className="flex-1 py-3 px-4 rounded-lg font-medium bg-gradient-to-r from-purple-500 to-blue-500 text-white flex items-center justify-center gap-2 hover:opacity-90 transition-all"
          >
            <Eye size={18} />
            View Journey
          </button>
        </div>

        <button
          onClick={onClose}
          className={`mt-4 text-sm ${isDarkMode ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-400 hover:text-neutral-600'}`}
        >
          Close
        </button>
      </div>
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

  // Story State
  const [currentStory, setCurrentStory] = useState<MasteryStory | null>(null);
  const [storyHistory, setStoryHistory] = useState<{ [key: number]: MasteryStory }>({});
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);

  // Input State
  const [userInput, setUserInput] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [currentEvaluation, setCurrentEvaluation] = useState<EvaluationResult | null>(null);
  const [detectedKeywords, setDetectedKeywords] = useState<string[]>([]);
  const [userResponses, setUserResponses] = useState<string[]>([]);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Completion State
  const [showCelebration, setShowCelebration] = useState(false);
  const [masterySummary, setMasterySummary] = useState<{ keyStrength: string; coreIntuition: string; uniqueApproach: string } | null>(null);
  const [completedHistory, setCompletedHistory] = useState<CompleteMasteryHistory | null>(null);

  // Overview State
  const [showOverview, setShowOverview] = useState(false);
  const [existingMastery, setExistingMastery] = useState<CompleteMasteryHistory | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check for existing mastery on mount
  useEffect(() => {
    const checkExistingMastery = () => {
      try {
        const existing = localStorage.getItem(STORAGE_KEY);
        if (existing) {
          const history: CompleteMasteryHistory[] = JSON.parse(existing);
          const match = history.find(h =>
            h.topic.toLowerCase() === topic.toLowerCase() &&
            h.domain.toLowerCase() === domain.toLowerCase()
          );
          if (match) {
            setExistingMastery(match);
            setShowOverview(true);
            setIsLoading(false);
            return true;
          }
        }
      } catch {
        // Continue to normal flow
      }
      return false;
    };

    if (checkExistingMastery()) return;

    // Initialize new session
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

        // Generate initial story
        await generateStoryForStage(1, keywords);
      } catch (err) {
        console.error('Failed to initialize mastery session:', err);
        setError('Failed to start mastery mode. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, [topic, domain, domainEmoji, conceptMap, importanceMap, analogyText]);

  // Generate story for a stage
  const generateStoryForStage = async (stage: MasteryStage, keywords: MasteryKeyword[], previousStoryContent?: string) => {
    setIsGeneratingStory(true);
    try {
      const story = await generateMasteryStory(
        topic,
        domain,
        stage,
        keywords,
        previousStoryContent
      );
      setCurrentStory(story);
      setStoryHistory(prev => ({ ...prev, [stage]: story }));
    } catch (err) {
      console.error('Failed to generate story:', err);
    } finally {
      setIsGeneratingStory(false);
    }
  };

  // Handle story regeneration
  const handleRegenerateStory = useCallback(async () => {
    if (!session) return;

    const previousStory = session.currentStage > 1
      ? storyHistory[session.currentStage - 1]?.content
      : undefined;

    await generateStoryForStage(session.currentStage, session.keywords, previousStory);
  }, [session, storyHistory]);

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

      // Update session and user responses
      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          stageHistory: [...prev.stageHistory, attempt]
        };
      });

      if (evaluation.passed) {
        setUserResponses(prev => [...prev, userInput]);
      }

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
  const handleContinue = useCallback(async () => {
    if (!session) return;

    const nextStage = (session.currentStage + 1) as MasteryStage;
    const isComplete = nextStage > 3;

    if (isComplete) {
      // Generate mastery summary
      const passedAttempts = session.stageHistory.filter(a => a.passed);
      const responses = {
        stage1: passedAttempts.find(a => a.stage === 1)?.userResponse || '',
        stage2: passedAttempts.find(a => a.stage === 2)?.userResponse || '',
        stage3: userInput // Current stage 3 response
      };
      const intuitions = {
        stage1: passedAttempts.find(a => a.stage === 1)?.intuitions || { insight: '', keywordsCaptured: [], strength: '' },
        stage2: passedAttempts.find(a => a.stage === 2)?.intuitions || { insight: '', keywordsCaptured: [], strength: '' },
        stage3: currentEvaluation?.intuitions || { insight: '', keywordsCaptured: [], strength: '' }
      };

      const summary = await generateMasterySummary(topic, domain, responses, intuitions);
      setMasterySummary(summary);

      // Create complete history entry
      const finalScores = {
        stage1: passedAttempts.find(a => a.stage === 1)?.score ?? 0,
        stage2: passedAttempts.find(a => a.stage === 2)?.score ?? 0,
        stage3: currentEvaluation?.score ?? 0
      };

      const completeHistory: CompleteMasteryHistory = {
        id: session.id,
        topic,
        domain,
        domainEmoji,
        completedAt: new Date(),
        startedAt: session.startedAt,
        stories: {
          stage1: storyHistory[1] || { stage: 1, content: '', highlightedTerms: [], generatedAt: new Date() },
          stage2: storyHistory[2] || { stage: 2, content: '', highlightedTerms: [], generatedAt: new Date() },
          stage3: storyHistory[3] || currentStory || { stage: 3, content: '', highlightedTerms: [], generatedAt: new Date() }
        },
        userResponses: responses,
        intuitions,
        glossary: session.keywords,
        finalScores,
        masterySummary: summary
      };

      setCompletedHistory(completeHistory);
      saveToHistory(completeHistory);
      setShowCelebration(true);

      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          isComplete: true,
          completedAt: new Date()
        };
      });
    } else {
      // Move to next stage
      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          currentStage: nextStage
        };
      });

      // Generate story for next stage
      const previousStoryContent = currentStory?.content;
      await generateStoryForStage(nextStage, session.keywords, previousStoryContent);

      setCurrentEvaluation(null);
      setUserInput('');
      setDetectedKeywords([]);
    }
  }, [session, userInput, currentEvaluation, currentStory, storyHistory, topic, domain, domainEmoji]);

  // Save completed session to history
  const saveToHistory = (completeHistory: CompleteMasteryHistory) => {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      const history: CompleteMasteryHistory[] = existing ? JSON.parse(existing) : [];

      // Remove any existing entry for this topic/domain
      const filtered = history.filter(h =>
        !(h.topic.toLowerCase() === completeHistory.topic.toLowerCase() &&
          h.domain.toLowerCase() === completeHistory.domain.toLowerCase())
      );

      const updatedHistory = [completeHistory, ...filtered].slice(0, 50);
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
        return `Now explain "${topic}" again, but incorporate at least 3 of the 6 keywords shown below. Keep it narrative - tell the story using these concepts.`;
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
        if (isChatOpen) {
          setIsChatOpen(false);
        } else if (showOverview) {
          onClose();
        } else {
          onClose();
        }
      }
      if (e.key === 'Enter' && e.metaKey && !isEvaluating && userInput.trim()) {
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleSubmit, isEvaluating, userInput, isChatOpen, showOverview]);

  // Show overview for existing mastery
  if (showOverview && existingMastery) {
    return <OverviewMode historyEntry={existingMastery} isDarkMode={isDarkMode} onClose={onClose} />;
  }

  // Show overview for just completed mastery
  if (showOverview && completedHistory) {
    return <OverviewMode historyEntry={completedHistory} isDarkMode={isDarkMode} onClose={onClose} />;
  }

  // Show celebration
  if (showCelebration && masterySummary && completedHistory) {
    return (
      <CompletionCelebration
        topic={topic}
        domain={domain}
        domainEmoji={domainEmoji}
        finalScores={completedHistory.finalScores}
        masterySummary={masterySummary}
        isDarkMode={isDarkMode}
        onViewOverview={() => {
          setShowCelebration(false);
          setShowOverview(true);
        }}
        onClose={onClose}
      />
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-white font-medium">Preparing Mastery Mode...</p>
          <p className="text-neutral-400 text-sm mt-1">Generating keywords and your first story</p>
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

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto">
          {/* Stage Indicator */}
          <StageIndicator
            currentStage={session.currentStage}
            stageHistory={session.stageHistory}
            isDarkMode={isDarkMode}
            domain={domain}
          />

          {/* Story Card - ABOVE INPUT */}
          <StoryCard
            story={currentStory}
            keywords={session.keywords}
            stage={session.currentStage}
            isDarkMode={isDarkMode}
            domain={domain}
            isLoading={isGeneratingStory}
            onRegenerate={handleRegenerateStory}
          />

          {/* Stage Instructions */}
          <div className={`text-center mb-4 p-3 rounded-lg ${isDarkMode ? 'bg-purple-900/20' : 'bg-purple-50'}`}>
            <p className={`text-sm ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
              {getStageInstructions()}
            </p>
          </div>

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

      {/* Chat Window */}
      <ChatWindow
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
        topic={topic}
        domain={domain}
        currentStage={session.currentStage}
        currentStory={currentStory?.content || ''}
        userResponses={userResponses}
        keywords={session.keywords}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default MasteryMode;
