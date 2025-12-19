import { useState, useEffect, useCallback } from 'react';
import { HistoryItem } from '../types';
import { STORAGE_KEYS, MAX_HISTORY_ITEMS } from '../constants';

export const useHistory = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  const saveToHistory = useCallback((data: any, topicName: string, domain: string) => {
    const newEntry: HistoryItem = {
      id: Date.now(),
      topic: topicName,
      domain,
      data,
      timestamp: new Date().toISOString()
    };
    const updated = [newEntry, ...history].slice(0, MAX_HISTORY_ITEMS);
    setHistory(updated);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
  }, [history]);

  const deleteHistoryItem = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
  }, [history]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
  }, []);

  return {
    history,
    showHistory,
    setShowHistory,
    saveToHistory,
    deleteHistoryItem,
    clearHistory
  };
};
