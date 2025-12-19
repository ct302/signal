import React from 'react';
import { Trash2 } from 'lucide-react';
import { HistoryItem } from '../types';

interface HistoryPanelProps {
  history: HistoryItem[];
  isDarkMode: boolean;
  onLoadEntry: (entry: HistoryItem) => void;
  onDeleteEntry: (e: React.MouseEvent, id: number) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  isDarkMode,
  onLoadEntry,
  onDeleteEntry
}) => {
  return (
    <div
      className={`fixed top-16 left-4 z-[100] w-80 max-h-96 overflow-y-auto rounded-xl shadow-2xl border ${
        isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'
      }`}
    >
      <div
        className={`sticky top-0 p-3 border-b font-bold text-sm ${
          isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-neutral-200'
        }`}
      >
        History ({history.length})
      </div>

      {history.length === 0 ? (
        <div className={`p-4 text-center text-sm ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
          No history yet
        </div>
      ) : (
        history.map((entry) => (
          <div
            key={entry.id}
            onClick={() => onLoadEntry(entry)}
            className={`p-3 border-b cursor-pointer group flex items-center justify-between ${
              isDarkMode ? 'border-neutral-700 hover:bg-neutral-700' : 'border-neutral-100 hover:bg-neutral-50'
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className={`font-medium text-sm truncate ${isDarkMode ? 'text-white' : ''}`}>
                {entry.topic}
              </div>
              <div className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                {entry.domain} • {new Date(entry.timestamp).toLocaleDateString()}
              </div>
            </div>
            <button
              onClick={(e) => onDeleteEntry(e, entry.id)}
              className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-opacity"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))
      )}
    </div>
  );
};
