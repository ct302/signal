import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { FontPreset } from '../types';
import { FONT_PRESETS } from '../constants';

interface FontPickerProps {
  isDarkMode: boolean;
  currentPreset: FontPreset;
  onSelectPreset: (preset: FontPreset) => void;
  onClose: () => void;
}

// Dynamically load a Google Font if not already loaded
const loadedFonts = new Set<string>();
const loadFont = (preset: FontPreset) => {
  if (!preset.googleFontUrl || loadedFonts.has(preset.id)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = preset.googleFontUrl;
  link.id = `font-preview-${preset.id}`;
  document.head.appendChild(link);
  loadedFonts.add(preset.id);
};

export const FontPicker: React.FC<FontPickerProps> = ({
  isDarkMode,
  currentPreset,
  onSelectPreset,
  onClose,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Preload all fonts for preview on mount
  useEffect(() => {
    FONT_PRESETS.forEach(loadFont);
  }, []);

  // Scroll active preset into view
  useEffect(() => {
    const activeEl = scrollRef.current?.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentPreset.id]);

  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-300 ${
      isDarkMode
        ? 'bg-neutral-800/95 border-neutral-700 backdrop-blur-sm'
        : 'bg-white/95 border-neutral-200 backdrop-blur-sm'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
        isDarkMode ? 'border-neutral-700' : 'border-neutral-200'
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-base">Aa</span>
          <span className={`text-sm font-medium ${isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}`}>
            Reading Font
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            isDarkMode ? 'bg-neutral-700 text-neutral-400' : 'bg-neutral-100 text-neutral-500'
          }`}>
            {currentPreset.name}
          </span>
        </div>
        <button
          onClick={onClose}
          className={`p-1 rounded-lg transition-colors ${
            isDarkMode
              ? 'text-neutral-400 hover:text-white hover:bg-neutral-700'
              : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100'
          }`}
        >
          <X size={16} />
        </button>
      </div>

      {/* Font Grid */}
      <div
        ref={scrollRef}
        className="px-3 py-3 grid grid-cols-5 gap-2 max-h-[200px] overflow-y-auto"
      >
        {FONT_PRESETS.map((preset) => {
          const isActive = preset.id === currentPreset.id;
          return (
            <button
              key={preset.id}
              data-active={isActive}
              onClick={() => onSelectPreset(preset)}
              className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all duration-200 ${
                isActive
                  ? (isDarkMode
                      ? 'border-blue-500 bg-blue-500/15 ring-1 ring-blue-500/30'
                      : 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/20')
                  : (isDarkMode
                      ? 'border-neutral-700 bg-neutral-800 hover:border-neutral-600 hover:bg-neutral-750'
                      : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50')
              }`}
              title={preset.name}
            >
              <span className="text-lg leading-none">{preset.emoji}</span>
              <span
                className={`text-[11px] font-medium leading-tight text-center ${
                  isActive
                    ? (isDarkMode ? 'text-blue-300' : 'text-blue-600')
                    : (isDarkMode ? 'text-neutral-400' : 'text-neutral-600')
                }`}
              >
                {preset.name}
              </span>
              {/* Font preview */}
              <span
                className={`text-xs leading-tight truncate w-full text-center ${
                  isDarkMode ? 'text-neutral-500' : 'text-neutral-400'
                }`}
                style={{
                  fontFamily: preset.fontFamily,
                  fontWeight: preset.fontWeight,
                  letterSpacing: preset.letterSpacing,
                }}
              >
                Aa Bb Cc
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
