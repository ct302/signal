import React from 'react';
import { HelpCircle, Loader2 } from 'lucide-react';
import { DisambiguationData } from '../types';

interface DisambiguationModalProps {
  disambiguation: DisambiguationData;
  isDarkMode: boolean;
  isLoading?: boolean;
  onSelect: (option: string) => void;
  onCancel: () => void;
}

export const DisambiguationModal: React.FC<DisambiguationModalProps> = ({
  disambiguation,
  isDarkMode,
  isLoading = false,
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
        {isLoading ? (
          // Loading state
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 size={48} className="animate-spin text-blue-500" />
            <p className={`text-lg font-medium ${isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}`}>
              Setting up...
            </p>
          </div>
        ) : (
          // Selection state
          <>
            <div className="flex items-center gap-3 text-amber-500">
              <HelpCircle size={32} />
              <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
                Did you mean...?
              </h3>
            </div>

            <p className={isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}>
              Your input "<span className="font-medium">{disambiguation.original}</span>" is ambiguous. Please select an option:
            </p>

            <div className="space-y-2">
              {disambiguation.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => onSelect(opt)}
                  disabled={isLoading}
                  className={`w-full text-left p-3 rounded-lg border transition-colors font-medium ${
                    isDarkMode
                      ? 'border-neutral-600 hover:border-blue-400 hover:bg-blue-900/30 text-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed'
                      : 'border-neutral-200 hover:border-blue-500 hover:bg-blue-50 text-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>

            <button
              onClick={onCancel}
              disabled={isLoading}
              className={`w-full text-center text-sm ${
                isDarkMode ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-500 hover:text-neutral-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
};
