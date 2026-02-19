import React from 'react';
import { ContextData } from '../types';

interface ContextCardProps {
  contextData: ContextData;
  isDarkMode: boolean;
}

// Sticky note color palettes — warm pastels for light, muted tones for dark
const stickyColors = {
  light: [
    { bg: 'bg-yellow-100', border: 'border-yellow-300/60', text: 'text-yellow-900', pin: 'bg-yellow-400', shadow: 'shadow-yellow-200/50' },
    { bg: 'bg-pink-100', border: 'border-pink-300/60', text: 'text-pink-900', pin: 'bg-pink-400', shadow: 'shadow-pink-200/50' },
    { bg: 'bg-blue-100', border: 'border-blue-300/60', text: 'text-blue-900', pin: 'bg-blue-400', shadow: 'shadow-blue-200/50' },
  ],
  dark: [
    { bg: 'bg-yellow-900/30', border: 'border-yellow-700/40', text: 'text-yellow-200', pin: 'bg-yellow-500', shadow: 'shadow-yellow-900/30' },
    { bg: 'bg-pink-900/30', border: 'border-pink-700/40', text: 'text-pink-200', pin: 'bg-pink-500', shadow: 'shadow-pink-900/30' },
    { bg: 'bg-blue-900/30', border: 'border-blue-700/40', text: 'text-blue-200', pin: 'bg-blue-500', shadow: 'shadow-blue-900/30' },
  ]
};

// Slight rotation for each note to feel handmade
const rotations = ['-rotate-[1.5deg]', 'rotate-[1deg]', '-rotate-[0.8deg]'];

export const ContextCard: React.FC<ContextCardProps> = ({
  contextData,
  isDarkMode
}) => {
  // Gather the available tips
  const tips: { emoji: string; label: string; text: string }[] = [];

  if (contextData?.narrative) {
    tips.push({ emoji: '💡', label: 'Intuition', text: contextData.narrative });
  }
  if (contextData?.why) {
    tips.push({ emoji: '🎯', label: 'Why It Matters', text: contextData.why });
  }
  if (contextData?.real_world) {
    tips.push({ emoji: '🌍', label: 'Real World', text: contextData.real_world });
  }

  if (tips.length === 0) return null;

  const palette = isDarkMode ? stickyColors.dark : stickyColors.light;

  return (
    <div className="py-3 px-1 signal-font">
      <div className={`grid gap-3 ${
        tips.length === 1 ? 'grid-cols-1 max-w-sm mx-auto'
        : tips.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto'
        : 'grid-cols-1 sm:grid-cols-3'
      }`}>
        {tips.map((tip, idx) => {
          const colors = palette[idx % palette.length];
          const rotation = rotations[idx % rotations.length];

          return (
            <div
              key={idx}
              className={`
                relative ${rotation} hover:rotate-0
                transition-transform duration-200 ease-out
                ${colors.bg} ${colors.border} ${colors.text}
                border rounded-sm shadow-md ${colors.shadow}
                px-3.5 pt-5 pb-3
                group
              `}
              style={{
                // Subtle tape/fold effect at top
                backgroundImage: isDarkMode
                  ? 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 20%)'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, transparent 20%)',
              }}
            >
              {/* Pin dot */}
              <div className={`absolute top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full ${colors.pin} opacity-60 group-hover:opacity-90 transition-opacity`} />

              {/* Label */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-sm">{tip.emoji}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                  {tip.label}
                </span>
              </div>

              {/* Tip text */}
              <p className="text-xs leading-relaxed italic">
                {tip.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
