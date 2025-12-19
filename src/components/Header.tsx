import React from 'react';
import { Sparkles, History, Moon, Sun } from 'lucide-react';

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
}

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
  onSubmit
}) => {
  return (
    <header
      className={`sticky top-0 z-50 backdrop-blur-md border-b transition-all duration-500 ${
        isImmersive ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'
      } ${isDarkMode ? 'bg-neutral-900/80 border-neutral-800' : 'bg-white/80 border-neutral-200'}`}
    >
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onDomainClick}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              isDarkMode
                ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
            }`}
          >
            <span className="text-base">{domainEmoji}</span>
            <span className="hidden sm:inline">{analogyDomain}</span>
          </button>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-full transition-colors relative ${
              isDarkMode ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'
            }`}
            title="History"
          >
            <History size={18} />
            {historyCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {historyCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-full transition-colors ${
              isDarkMode ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'
            }`}
            title="Toggle Theme"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="flex-1 relative">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            placeholder="What do you want to learn about?"
            className={`w-full pl-4 pr-12 py-2.5 rounded-xl border-2 transition-all outline-none text-sm ${
              isDarkMode
                ? 'bg-neutral-800 border-neutral-700 focus:border-blue-500 text-white placeholder-neutral-500'
                : 'border-neutral-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
            }`}
          />
          <button
            onClick={onSubmit}
            disabled={isLoading || !topic.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-700 disabled:opacity-50 transition-colors"
          >
            <Sparkles size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
