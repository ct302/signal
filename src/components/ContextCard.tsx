import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { ContextData } from '../types';

interface ContextCardProps {
  contextData: ContextData;
  showContext: boolean;
  setShowContext: (value: boolean) => void;
  isDarkMode: boolean;
}

export const ContextCard: React.FC<ContextCardProps> = ({
  contextData,
  showContext,
  setShowContext,
  isDarkMode
}) => {
  if (!contextData) return null;

  if (!showContext) {
    return (
      <button
        onClick={() => setShowContext(true)}
        className={`w-full text-left p-3 rounded-xl border flex items-center gap-2 text-sm transition-colors ${
          isDarkMode
            ? 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:bg-neutral-700'
            : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50'
        }`}
      >
        <ChevronDown size={14} />
        <span className="text-lg">{contextData.emoji}</span>
        {contextData.header}
      </button>
    );
  }

  return (
    <div
      className={`rounded-xl p-4 border ${
        isDarkMode
          ? 'bg-neutral-800 border-neutral-700'
          : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{contextData.emoji}</span>
        <div className="flex-1 space-y-2">
          <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
            {contextData.header}
          </h3>
          {contextData.why && (
            <p className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
              <span className="font-medium">Why it matters:</span> {contextData.why}
            </p>
          )}
          {contextData.real_world && (
            <p className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
              <span className="font-medium">Real world:</span> {contextData.real_world}
            </p>
          )}
          {contextData.narrative && (
            <p className={`text-sm italic ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>
              💡 {contextData.narrative}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowContext(false)}
          className={isDarkMode ? 'text-neutral-500 hover:text-white' : 'text-neutral-400 hover:text-neutral-600'}
        >
          <ChevronUp size={16} />
        </button>
      </div>
    </div>
  );
};
