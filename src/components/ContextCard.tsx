import React from 'react';
import { ContextData } from '../types';

interface ContextCardProps {
  contextData: ContextData;
  isDarkMode: boolean;
}

export const ContextCard: React.FC<ContextCardProps> = ({
  contextData,
  isDarkMode
}) => {
  if (!contextData?.narrative) return null;

  return (
    <p className={`text-sm italic text-center px-4 py-3 ${
      isDarkMode ? 'text-blue-300/80' : 'text-blue-600/80'
    }`}>
      💡 {contextData.narrative}
    </p>
  );
};
