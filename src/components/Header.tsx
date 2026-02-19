import React, { useState } from 'react';
import { Sparkles, History, Moon, Sun, Loader2, Home, Lock, Mic, MicOff } from 'lucide-react';
import { Settings } from './Settings';
import { useMobile } from '../hooks/useMobile';

interface HeaderProps {
  analogyDomain: string;
  domainEmoji: string;
  topic: string;
  setTopic: (value: string) => void;
  isLoading: boolean;
  isImmersive: boolean;
  isDarkMode: boolean;
  setIsDarkMode: (value: boolean) => void;
  showHistory: boolean;
  setShowHistory: (value: boolean) => void;
  historyCount: number;
  onDomainClick: () => void;
  onSubmit: () => void;
  isViewingFromHistory?: boolean;
  onReturnHome?: () => void;
  // Voice input props
  isListening?: boolean;
  onMicClick?: () => void;
  isMicSupported?: boolean;
}

/**
 * Extract the short domain name (before parentheses disambiguation)
 * e.g., "2002 NFL season (American football season...)" -> "2002 NFL season"
 */
const getShortDomainName = (domain: string): string => {
  const parenIndex = domain.indexOf('(');
  if (parenIndex > 0) {
    return domain.substring(0, parenIndex).trim();
  }
  return domain;
};

export const Header: React.FC<HeaderProps> = ({
  analogyDomain,
  domainEmoji,
  topic,
  setTopic,
  isLoading,
  isImmersive,
  isDarkMode,
  setIsDarkMode,
  showHistory,
  setShowHistory,
  historyCount,
  onDomainClick,
  onSubmit,
  isViewingFromHistory = false,
  onReturnHome,
  isListening = false,
  onMicClick,
  isMicSupported = false
}) => {
  const [isHoveringDomain, setIsHoveringDomain] = useState(false);
  const isMobile = useMobile();
  const shortDomain = getShortDomainName(analogyDomain);

  // Determine if search is disabled (either loading or viewing history)
  const isSearchDisabled = isLoading || isViewingFromHistory;

  return (
    <header
      className={`sticky top-0 z-50 backdrop-blur-md border-b transition-all duration-500 ${
        isImmersive ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'
      } ${isDarkMode ? 'bg-neutral-900/80 border-neutral-800' : 'bg-white/80 border-neutral-200'}`}
    >
      <div className="max-w-4xl mx-auto px-3 md:px-4 py-3 flex items-center gap-2 md:gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onDomainClick}
            onMouseEnter={() => !isMobile && setIsHoveringDomain(true)}
            onMouseLeave={() => !isMobile && setIsHoveringDomain(false)}
            className={`flex items-center gap-2 py-2 min-h-touch rounded-full text-sm font-medium transition-all duration-200 ${
              isHoveringDomain ? 'px-3' : 'px-2'
            } ${
              isDarkMode
                ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
            }`}
            title={shortDomain}
          >
            <span className="text-base">{domainEmoji}</span>
            <span
              className={`overflow-hidden transition-all duration-200 whitespace-nowrap ${
                isHoveringDomain ? 'max-w-[200px] opacity-100' : 'max-w-0 opacity-0'
              }`}
            >
              {shortDomain}
            </span>
          </button>

          <button
            onClick={() => setShowHistory(!showHistory)}
            data-history-toggle
            className={`p-2 min-w-touch min-h-touch flex items-center justify-center rounded-full transition-colors relative ${
              isDarkMode ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'
            }`}
            title="History"
          >
            <History size={18} />
            {historyCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                {historyCount}
              </span>
            )}
          </button>

          {!isMobile && (
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 min-w-touch min-h-touch flex items-center justify-center rounded-full transition-colors ${
                isDarkMode ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'
              }`}
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}

          {!isMobile && <Settings isDarkMode={isDarkMode} />}
        </div>

        <div className="flex-1 relative">
          {isViewingFromHistory ? (
            /* History View Mode - Show locked state with return home button */
            <div className={`w-full pl-4 pr-4 py-2.5 rounded-xl border-2 flex items-center gap-3 ${
              isDarkMode
                ? 'bg-neutral-800/50 border-amber-600/50 text-amber-300'
                : 'bg-amber-50 border-amber-300 text-amber-700'
            }`}>
              <Lock size={14} className="shrink-0 opacity-70" />
              <span className="text-sm flex-1 truncate font-medium">{topic}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                isDarkMode ? 'bg-amber-900/50 text-amber-400' : 'bg-amber-200 text-amber-700'
              }`}>
                Viewing Saved
              </span>
              {onReturnHome && (
                <button
                  onClick={onReturnHome}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    isDarkMode
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                  title="Return to home to search for new topics"
                >
                  <Home size={12} />
                  New Search
                </button>
              )}
            </div>
          ) : (
            /* Normal Search Mode */
            <>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && onSubmit()}
                disabled={isLoading}
                placeholder="What do you want to learn about?"
                className={`w-full pl-4 ${isMicSupported ? 'pr-24' : 'pr-12'} py-2.5 rounded-xl border-2 transition-all outline-none text-sm disabled:opacity-60 disabled:cursor-not-allowed ${
                  isDarkMode
                    ? 'bg-neutral-800 border-neutral-700 focus:border-blue-500 text-white placeholder-neutral-500'
                    : 'border-neutral-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
                }`}
              />
              {/* Microphone button */}
              {isMicSupported && onMicClick && (
                <button
                  onClick={onMicClick}
                  disabled={isLoading}
                  className={`absolute right-14 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : isDarkMode
                        ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700'
                        : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100'
                  } disabled:opacity-50`}
                  title={isListening ? 'Stop listening' : 'Voice input'}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}
              <button
                onClick={onSubmit}
                disabled={isLoading || !topic.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
