import React, { useState, useEffect } from 'react';
import { Sparkles, Brain, Lightbulb, Zap, BookOpen } from 'lucide-react';

interface SkeletonLoaderProps {
  isDarkMode: boolean;
  domain?: string;
}

// Rotating encouraging messages
const LOADING_MESSAGES = [
  { icon: Brain, text: "Building your knowledge bridge..." },
  { icon: Sparkles, text: "Crafting the perfect analogy..." },
  { icon: Lightbulb, text: "Connecting concepts..." },
  { icon: Zap, text: "Mapping mental models..." },
  { icon: BookOpen, text: "Translating to your domain..." },
];

// Domain-specific messages
const DOMAIN_MESSAGES: Record<string, string[]> = {
  'NFL': ["Drawing up the play...", "Studying the game film...", "Breaking down the formation..."],
  'NBA': ["Running the play...", "Setting up the pick and roll...", "Reading the defense..."],
  'Chess': ["Planning the opening...", "Calculating variations...", "Setting up the position..."],
  'Cooking': ["Prepping the ingredients...", "Perfecting the recipe...", "Balancing the flavors..."],
  'Music': ["Composing the melody...", "Finding the right key...", "Harmonizing concepts..."],
};

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ isDarkMode, domain }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [showDomainMessage, setShowDomainMessage] = useState(false);

  // Rotate messages every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
      // Occasionally show domain-specific message
      setShowDomainMessage(Math.random() > 0.5);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const currentMessage = LOADING_MESSAGES[messageIndex];
  const Icon = currentMessage.icon;

  // Get domain-specific message if available
  const domainMessages = domain ? DOMAIN_MESSAGES[domain] : null;
  const domainMessage = domainMessages
    ? domainMessages[Math.floor(Math.random() * domainMessages.length)]
    : null;

  const displayMessage = showDomainMessage && domainMessage ? domainMessage : currentMessage.text;

  return (
    <div className={`rounded-2xl p-8 ${isDarkMode ? 'bg-neutral-800' : 'bg-white border border-neutral-200'}`}>
      {/* Animated header */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
          <Icon
            className={`animate-pulse ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`}
            size={28}
          />
        </div>
        <p className={`text-lg font-medium ${isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}`}>
          {displayMessage}
        </p>
      </div>

      {/* Skeleton content */}
      <div className="space-y-6">
        {/* Title skeleton */}
        <div className="flex items-center gap-3">
          <div className={`h-8 w-8 rounded-lg animate-pulse ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-200'}`} />
          <div className={`h-6 w-48 rounded-lg animate-pulse ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-200'}`} />
        </div>

        {/* Paragraph skeletons */}
        <div className="space-y-3">
          <div className={`h-4 w-full rounded animate-pulse ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-200'}`} />
          <div className={`h-4 w-11/12 rounded animate-pulse ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-200'}`} style={{ animationDelay: '100ms' }} />
          <div className={`h-4 w-4/5 rounded animate-pulse ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-200'}`} style={{ animationDelay: '200ms' }} />
        </div>

        {/* Concept mapping skeleton */}
        <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-neutral-750' : 'bg-neutral-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-4 w-4 rounded animate-pulse ${isDarkMode ? 'bg-blue-500/30' : 'bg-blue-200'}`} />
              <div className={`h-4 w-24 rounded animate-pulse ${isDarkMode ? 'bg-neutral-600' : 'bg-neutral-300'}`} />
            </div>
            <div className={`h-4 w-8 rounded animate-pulse ${isDarkMode ? 'bg-neutral-600' : 'bg-neutral-300'}`} />
            <div className="flex items-center gap-2">
              <div className={`h-4 w-24 rounded animate-pulse ${isDarkMode ? 'bg-neutral-600' : 'bg-neutral-300'}`} />
              <div className={`h-4 w-4 rounded animate-pulse ${isDarkMode ? 'bg-emerald-500/30' : 'bg-emerald-200'}`} />
            </div>
          </div>
        </div>

        {/* More paragraph skeletons */}
        <div className="space-y-3">
          <div className={`h-4 w-full rounded animate-pulse ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-200'}`} style={{ animationDelay: '300ms' }} />
          <div className={`h-4 w-3/4 rounded animate-pulse ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-200'}`} style={{ animationDelay: '400ms' }} />
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 mt-8">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i === messageIndex % 3
                ? isDarkMode ? 'bg-blue-400 scale-125' : 'bg-blue-500 scale-125'
                : isDarkMode ? 'bg-neutral-600' : 'bg-neutral-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default SkeletonLoader;
