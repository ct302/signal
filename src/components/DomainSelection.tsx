import React from 'react';
import { Globe, ArrowRight, Loader2, HelpCircle, X } from 'lucide-react';
import { QUICK_START_DOMAINS } from '../constants';
import { DisambiguationData } from '../types';

interface DomainSelectionProps {
  tempDomainInput: string;
  setTempDomainInput: (value: string) => void;
  isSettingDomain: boolean;
  domainError: string;
  disambiguation: DisambiguationData | null;
  setDisambiguation: (value: DisambiguationData | null) => void;
  handleSetDomain: (override?: string | null) => void;
}

export const DomainSelection: React.FC<DomainSelectionProps> = ({
  tempDomainInput,
  setTempDomainInput,
  isSettingDomain,
  domainError,
  disambiguation,
  setDisambiguation,
  handleSetDomain
}) => {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6 relative">
      {/* Disambiguation Modal */}
      {disambiguation && disambiguation.type === 'domain' && (
        <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-white border border-neutral-200 shadow-2xl rounded-2xl p-8 space-y-6">
            <div className="flex items-center gap-3 text-amber-500">
              <HelpCircle size={32} />
              <h3 className="text-xl font-bold text-neutral-800">Did you mean...?</h3>
            </div>
            <p className="text-neutral-600">
              Your input "<span className="font-medium">{disambiguation.original}</span>" is ambiguous. Please select an option:
            </p>
            <div className="space-y-2">
              {disambiguation.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleSetDomain(opt)}
                  className="w-full text-left p-3 rounded-lg border border-neutral-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-neutral-700 font-medium"
                >
                  {opt}
                </button>
              ))}
            </div>
            <button
              onClick={() => setDisambiguation(null)}
              className="w-full text-center text-neutral-500 hover:text-neutral-700 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-lg w-full space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-5xl font-black tracking-tight text-neutral-900">Signal V2</h1>
          <p className="text-neutral-500 text-lg">Learn anything through powerful analogies</p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl shadow-lg p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-neutral-700 uppercase tracking-wider">
              Choose Your Analogy Domain
            </label>
            <p className="text-sm text-neutral-500">What lens do you want to learn through?</p>
          </div>

          <div className="relative">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
            <input
              type="text"
              value={tempDomainInput}
              onChange={(e) => setTempDomainInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetDomain()}
              placeholder="e.g., NFL, Cooking, Music, Video Games..."
              className="w-full pl-12 pr-4 py-4 text-lg rounded-xl border-2 border-neutral-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
              autoFocus
            />
          </div>

          {domainError && <p className="text-red-500 text-sm">{domainError}</p>}

          <button
            onClick={() => handleSetDomain()}
            disabled={isSettingDomain || !tempDomainInput.trim()}
            className="w-full bg-neutral-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isSettingDomain ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <ArrowRight size={20} /> Start Learning
              </>
            )}
          </button>

          <div className="pt-4 border-t border-neutral-200">
            <p className="text-xs text-neutral-400 mb-3">Quick Start</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_START_DOMAINS.map(({ emoji, name }) => (
                <button
                  key={name}
                  onClick={() => {
                    setTempDomainInput(name);
                    handleSetDomain(name);
                  }}
                  className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-full text-sm text-neutral-600 transition-colors"
                >
                  {emoji} {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
