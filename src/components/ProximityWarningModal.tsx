import React from 'react';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';
import { ProximityResult } from '../types';

interface ProximityWarningModalProps {
  topic: string;
  domain: string;
  proximityResult: ProximityResult;
  isDarkMode: boolean;
  onClose: () => void;
  onSwitchDomain: (newDomain: string) => void;
  onProceedAnyway: () => void;
}

export const ProximityWarningModal: React.FC<ProximityWarningModalProps> = ({
  topic,
  domain,
  proximityResult,
  isDarkMode,
  onClose,
  onSwitchDomain,
  onProceedAnyway
}) => {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-md mx-4 rounded-2xl shadow-2xl border overflow-hidden ${
          isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center gap-3 ${
          isDarkMode ? 'bg-amber-900/30 border-neutral-700' : 'bg-amber-50 border-amber-100'
        }`}>
          <div className={`p-2 rounded-full ${isDarkMode ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
            <AlertTriangle className="text-amber-500" size={24} />
          </div>
          <div className="flex-1">
            <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
              Topic Too Similar
            </h2>
            <p className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
              The magic works best with different domains
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors ${
              isDarkMode ? 'text-neutral-400 hover:bg-neutral-700 hover:text-white' : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
            }`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Explanation */}
          <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-neutral-700/50' : 'bg-neutral-50'}`}>
            <div className="flex items-center gap-3 mb-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
              }`}>
                {domain}
              </span>
              <ArrowRight size={16} className={isDarkMode ? 'text-neutral-500' : 'text-neutral-400'} />
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                isDarkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'
              }`}>
                {topic}
              </span>
            </div>
            <p className={`text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
              {proximityResult.reason}
            </p>
          </div>

          {/* Suggestion text */}
          <p className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
            The analogy engine explains <strong>unfamiliar topics</strong> using <strong>familiar domains</strong>.
            Try a topic outside of {domain}, or switch to a different domain:
          </p>

          {/* Suggested domains */}
          {proximityResult.suggestedDomains && proximityResult.suggestedDomains.length > 0 && (
            <div className="space-y-2">
              <p className={`text-xs font-medium uppercase tracking-wider ${
                isDarkMode ? 'text-neutral-500' : 'text-neutral-400'
              }`}>
                Suggested Domains
              </p>
              <div className="flex flex-wrap gap-2">
                {proximityResult.suggestedDomains.map((suggested) => (
                  <button
                    key={suggested.name}
                    onClick={() => onSwitchDomain(suggested.name)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 ${
                      isDarkMode
                        ? 'bg-neutral-700 text-neutral-200 hover:bg-neutral-600 border border-neutral-600'
                        : 'bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-200 shadow-sm'
                    }`}
                  >
                    <span className="text-lg">{suggested.emoji}</span>
                    <span>{suggested.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex items-center justify-between ${
          isDarkMode ? 'bg-neutral-900/50 border-neutral-700' : 'bg-neutral-50 border-neutral-100'
        }`}>
          <button
            onClick={onProceedAnyway}
            className={`text-sm font-medium transition-colors ${
              isDarkMode ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-400 hover:text-neutral-600'
            }`}
          >
            Proceed anyway
          </button>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDarkMode
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            Choose Different Topic
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProximityWarningModal;
