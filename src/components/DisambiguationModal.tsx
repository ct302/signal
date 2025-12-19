import React from 'react';
import { HelpCircle } from 'lucide-react';
import { DisambiguationData } from '../types';

interface DisambiguationModalProps {
  disambiguation: DisambiguationData;
  isDarkMode: boolean;
  onSelect: (option: string) => void;
  onCancel: () => void;
}

export const DisambiguationModal: React.FC<DisambiguationModalProps> = ({
  disambiguation,
  isDarkMode,
  onSelect,
  onCancel
}) => {
  return (
    <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div
        className={`max-w-md w-full border shadow-2xl rounded-2xl p-8 space-y-6 ${
          isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'
        }`}
      >
        <div className="flex items-center gap-3 text-amber-500">
          <HelpCircle size={32} />
          <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
            Did you mean...?
          </h3>
        </div>

        <p className={isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}>
          Your input "<span className="font-medium">{disambiguation.original}</span>" might be a typo or ambiguous:
        </p>

        <div className="space-y-2">
          {disambiguation.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => onSelect(opt)}
              className={`w-full text-left p-3 rounded-lg border transition-colors font-medium ${
                isDarkMode
                  ? 'border-neutral-600 hover:border-blue-400 hover:bg-blue-900/30 text-neutral-200'
                  : 'border-neutral-200 hover:border-blue-500 hover:bg-blue-50 text-neutral-700'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          className={`w-full text-center text-sm ${
            isDarkMode ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
