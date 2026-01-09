import React, { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, Wind, CloudLightning, CloudFog, Sparkles, X, ChevronDown } from 'lucide-react';

export type WeatherType = 'none' | 'sunny' | 'rain' | 'rainforest' | 'snow' | 'thunderstorm' | 'wind' | 'fog' | 'aurora';

interface WeatherModeProps {
  weather: WeatherType;
}

export const WEATHER_OPTIONS: { type: WeatherType; icon: React.ReactNode; label: string; emoji: string }[] = [
  { type: 'none', icon: <X size={16} />, label: 'Off', emoji: '✕' },
  { type: 'sunny', icon: <Sun size={16} />, label: 'Beach', emoji: '🏖️' },
  { type: 'rain', icon: <CloudRain size={16} />, label: 'Rain', emoji: '🌧️' },
  { type: 'rainforest', icon: <Cloud size={16} />, label: 'Rainforest', emoji: '🌴' },
  { type: 'snow', icon: <CloudSnow size={16} />, label: 'Snow', emoji: '❄️' },
  { type: 'thunderstorm', icon: <CloudLightning size={16} />, label: 'Storm', emoji: '⛈️' },
  { type: 'wind', icon: <Wind size={16} />, label: 'Windy', emoji: '💨' },
  { type: 'fog', icon: <CloudFog size={16} />, label: 'Fog', emoji: '🌫️' },
  { type: 'aurora', icon: <Sparkles size={16} />, label: 'Aurora', emoji: '🌌' },
];

// Lightning flash component for thunderstorm
const LightningFlash: React.FC = () => {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const triggerFlash = () => {
      setFlash(true);
      setTimeout(() => setFlash(false), 150);
    };

    // Random lightning intervals (3-10 seconds)
    const scheduleNext = () => {
      const delay = 3000 + Math.random() * 7000;
      return setTimeout(() => {
        triggerFlash();
        scheduleNext();
      }, delay);
    };

    const timeout = scheduleNext();
    return () => clearTimeout(timeout);
  }, []);

  if (!flash) return null;

  return (
    <div className="absolute inset-0 bg-white/30 animate-lightning-flash" />
  );
};

// Weather selector dropdown
const WeatherSelector: React.FC<{
  weather: WeatherType;
  onWeatherChange: (weather: WeatherType) => void;
  isDarkMode: boolean;
}> = ({ weather, onWeatherChange, isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentWeather = WEATHER_OPTIONS.find(w => w.type === weather) || WEATHER_OPTIONS[0];

  return (
    <div className="fixed bottom-6 left-6 z-[10001]">
      <div className="relative">
        {/* Main button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm
            transition-all shadow-lg backdrop-blur-md
            ${weather !== 'none'
              ? 'bg-gradient-to-r from-violet-600/90 to-purple-600/90 text-white border border-violet-400/30'
              : isDarkMode
                ? 'bg-neutral-800/90 text-neutral-300 border border-neutral-700 hover:bg-neutral-700/90'
                : 'bg-white/90 text-neutral-700 border border-neutral-200 hover:bg-neutral-50/90'
            }
          `}
        >
          <span className="text-lg">{currentWeather.emoji}</span>
          <span>{weather === 'none' ? 'Weather' : currentWeather.label}</span>
          <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[-1]"
              onClick={() => setIsOpen(false)}
            />
            {/* Menu */}
            <div className={`
              absolute bottom-full left-0 mb-2 w-48 rounded-xl overflow-hidden shadow-2xl
              ${isDarkMode ? 'bg-neutral-800/95 border border-neutral-700' : 'bg-white/95 border border-neutral-200'}
              backdrop-blur-md
            `}>
              <div className="p-2 space-y-1">
                {WEATHER_OPTIONS.map((option) => (
                  <button
                    key={option.type}
                    onClick={() => {
                      onWeatherChange(option.type);
                      setIsOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                      transition-all
                      ${weather === option.type
                        ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white'
                        : isDarkMode
                          ? 'text-neutral-300 hover:bg-neutral-700'
                          : 'text-neutral-700 hover:bg-neutral-100'
                      }
                    `}
                  >
                    <span className="text-lg">{option.emoji}</span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Main weather effects overlay
const WeatherEffects: React.FC<{ weather: WeatherType }> = ({ weather }) => {
  if (weather === 'none') return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[5] overflow-hidden">
      {/* Background scenes */}
      {weather === 'sunny' && <SunnyScene />}
      {weather === 'rain' && <RainScene />}
      {weather === 'rainforest' && <RainforestScene />}
      {weather === 'snow' && <SnowScene />}
      {weather === 'thunderstorm' && <ThunderstormScene />}
      {weather === 'wind' && <WindScene />}
      {weather === 'fog' && <FogScene />}
      {weather === 'aurora' && <AuroraScene />}
    </div>
  );
};

// ============================================
// SCENE COMPONENTS
// ============================================

const SunnyScene: React.FC = () => (
  <>
    {/* Warm gradient overlay */}
    <div
      className="absolute inset-0"
      style={{
        background: 'linear-gradient(180deg, rgba(251, 191, 36, 0.15) 0%, rgba(252, 211, 77, 0.1) 30%, rgba(147, 197, 253, 0.2) 70%, rgba(59, 130, 246, 0.15) 100%)'
      }}
    />
    {/* Sun glow in corner */}
    <div
      className="absolute -top-20 -right-20 w-64 h-64 rounded-full animate-sun-pulse"
      style={{
        background: 'radial-gradient(circle, rgba(251, 191, 36, 0.6) 0%, rgba(251, 191, 36, 0.3) 30%, rgba(251, 191, 36, 0.1) 50%, transparent 70%)',
      }}
    />
    {/* Beach/ocean at bottom */}
    <div className="absolute bottom-0 left-0 right-0 h-32">
      {/* Sand */}
      <div
        className="absolute bottom-0 left-0 right-0 h-16"
        style={{
          background: 'linear-gradient(180deg, rgba(217, 180, 131, 0.4) 0%, rgba(194, 154, 108, 0.5) 100%)'
        }}
      />
      {/* Ocean waves */}
      <div
        className="absolute bottom-12 left-0 right-0 h-20"
        style={{
          background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.3) 0%, rgba(37, 99, 235, 0.4) 50%, rgba(217, 180, 131, 0.4) 100%)'
        }}
      />
      {/* Animated wave line */}
      <div className="absolute bottom-12 left-0 right-0 h-1 bg-white/30 animate-wave" />
    </div>
    {/* Floating particles (sand/sparkles) */}
    <div className="absolute inset-0">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-float-gentle"
          style={{
            left: `${(i * 5) % 100}%`,
            top: `${30 + (i * 3) % 40}%`,
            width: '3px',
            height: '3px',
            backgroundColor: 'rgba(251, 191, 36, 0.5)',
            animationDelay: `${i * 0.3}s`,
            animationDuration: `${4 + (i % 3)}s`,
          }}
        />
      ))}
    </div>
  </>
);

const RainScene: React.FC = () => (
  <>
    {/* Gray-blue overlay */}
    <div
      className="absolute inset-0"
      style={{
        background: 'linear-gradient(180deg, rgba(71, 85, 105, 0.2) 0%, rgba(100, 116, 139, 0.15) 50%, rgba(71, 85, 105, 0.25) 100%)'
      }}
    />
    {/* Rain drops */}
    <div className="absolute inset-0">
      {Array.from({ length: 80 }).map((_, i) => (
        <div
          key={i}
          className="absolute animate-rainfall"
          style={{
            left: `${(i * 1.25) % 100}%`,
            width: '2px',
            height: `${10 + (i % 8)}px`,
            background: 'linear-gradient(180deg, transparent 0%, rgba(147, 197, 253, 0.6) 50%, rgba(147, 197, 253, 0.3) 100%)',
            borderRadius: '2px',
            animationDelay: `${(i * 0.05) % 2}s`,
            animationDuration: `${0.5 + (i % 3) * 0.2}s`,
          }}
        />
      ))}
    </div>
    {/* Puddle ripples at bottom */}
    <div className="absolute bottom-0 left-0 right-0 h-8 overflow-hidden">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="absolute bottom-2 w-4 h-2 rounded-full border border-blue-300/30 animate-ripple"
          style={{
            left: `${(i * 10) + 5}%`,
            animationDelay: `${i * 0.5}s`,
          }}
        />
      ))}
    </div>
  </>
);

const RainforestScene: React.FC = () => (
  <>
    {/* Dense green jungle gradient */}
    <div
      className="absolute inset-0"
      style={{
        background: 'linear-gradient(180deg, rgba(6, 78, 59, 0.2) 0%, rgba(21, 128, 61, 0.15) 30%, rgba(22, 101, 52, 0.25) 70%, rgba(20, 83, 45, 0.35) 100%)'
      }}
    />
    {/* Tree silhouettes on sides */}
    <div className="absolute left-0 top-0 bottom-0 w-24">
      <svg className="h-full w-full" viewBox="0 0 100 400" preserveAspectRatio="none">
        <path
          d="M0,0 L0,400 L30,400 Q50,350 40,300 Q60,280 45,250 Q70,230 50,200 Q75,180 55,150 Q80,120 50,80 Q70,50 40,20 Q50,0 0,0 Z"
          fill="rgba(6, 78, 59, 0.4)"
        />
      </svg>
    </div>
    <div className="absolute right-0 top-0 bottom-0 w-24">
      <svg className="h-full w-full" viewBox="0 0 100 400" preserveAspectRatio="none">
        <path
          d="M100,0 L100,400 L70,400 Q50,350 60,300 Q40,280 55,250 Q30,230 50,200 Q25,180 45,150 Q20,120 50,80 Q30,50 60,20 Q50,0 100,0 Z"
          fill="rgba(6, 78, 59, 0.4)"
        />
      </svg>
    </div>
    {/* Hanging vines */}
    {Array.from({ length: 8 }).map((_, i) => (
      <div
        key={i}
        className="absolute top-0 w-0.5 bg-gradient-to-b from-green-800/40 to-green-600/20 animate-vine-sway"
        style={{
          left: `${10 + i * 12}%`,
          height: `${60 + (i % 4) * 15}px`,
          animationDelay: `${i * 0.3}s`,
        }}
      />
    ))}
    {/* Rain - heavier tropical rain */}
    <div className="absolute inset-0">
      {Array.from({ length: 100 }).map((_, i) => (
        <div
          key={i}
          className="absolute animate-rainfall"
          style={{
            left: `${(i * 1) % 100}%`,
            width: '2px',
            height: `${15 + (i % 10)}px`,
            background: 'linear-gradient(180deg, transparent 0%, rgba(134, 239, 172, 0.4) 50%, rgba(74, 222, 128, 0.2) 100%)',
            borderRadius: '2px',
            animationDelay: `${(i * 0.04) % 2}s`,
            animationDuration: `${0.4 + (i % 3) * 0.15}s`,
          }}
        />
      ))}
    </div>
    {/* Misty layer at bottom */}
    <div
      className="absolute bottom-0 left-0 right-0 h-24"
      style={{
        background: 'linear-gradient(0deg, rgba(134, 239, 172, 0.15) 0%, transparent 100%)'
      }}
    />
  </>
);

const SnowScene: React.FC = () => (
  <>
    {/* Cool blue-white gradient */}
    <div
      className="absolute inset-0"
      style={{
        background: 'linear-gradient(180deg, rgba(186, 230, 253, 0.1) 0%, rgba(224, 242, 254, 0.15) 50%, rgba(241, 245, 249, 0.2) 100%)'
      }}
    />
    {/* Snow particles */}
    <div className="absolute inset-0">
      {Array.from({ length: 60 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-snowfall"
          style={{
            left: `${(i * 1.7) % 100}%`,
            width: `${3 + (i % 4)}px`,
            height: `${3 + (i % 4)}px`,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            boxShadow: '0 0 4px rgba(255, 255, 255, 0.5)',
            animationDelay: `${(i * 0.15) % 10}s`,
            animationDuration: `${4 + (i % 6)}s`,
          }}
        />
      ))}
    </div>
    {/* Snow accumulation at bottom */}
    <div className="absolute bottom-0 left-0 right-0 h-12">
      <svg className="w-full h-full" viewBox="0 0 1000 50" preserveAspectRatio="none">
        <path
          d="M0,50 L0,30 Q50,20 100,30 Q150,15 200,25 Q250,35 300,20 Q350,30 400,25 Q450,15 500,30 Q550,20 600,25 Q650,35 700,20 Q750,25 800,30 Q850,15 900,25 Q950,30 1000,20 L1000,50 Z"
          fill="rgba(255, 255, 255, 0.4)"
        />
      </svg>
    </div>
    {/* Frost vignette */}
    <div
      className="absolute inset-0"
      style={{
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(186, 230, 253, 0.15) 100%)'
      }}
    />
  </>
);

const ThunderstormScene: React.FC = () => (
  <>
    {/* Dark stormy gradient */}
    <div
      className="absolute inset-0"
      style={{
        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(51, 65, 85, 0.3) 50%, rgba(30, 41, 59, 0.45) 100%)'
      }}
    />
    {/* Storm clouds */}
    <div className="absolute top-0 left-0 right-0 h-40">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-cloud-drift"
          style={{
            left: `${i * 20}%`,
            top: `${(i % 3) * 10}px`,
            width: `${150 + (i % 3) * 50}px`,
            height: `${60 + (i % 2) * 20}px`,
            background: 'radial-gradient(ellipse, rgba(51, 65, 85, 0.6) 0%, rgba(30, 41, 59, 0.3) 70%, transparent 100%)',
            animationDelay: `${i * 2}s`,
            animationDuration: `${20 + i * 5}s`,
          }}
        />
      ))}
    </div>
    {/* Heavy rain */}
    <div className="absolute inset-0">
      {Array.from({ length: 120 }).map((_, i) => (
        <div
          key={i}
          className="absolute animate-heavy-rainfall"
          style={{
            left: `${(i * 0.85) % 100}%`,
            width: '2px',
            height: `${20 + (i % 12)}px`,
            background: 'linear-gradient(180deg, transparent 0%, rgba(148, 163, 184, 0.5) 50%, rgba(148, 163, 184, 0.2) 100%)',
            borderRadius: '2px',
            animationDelay: `${(i * 0.03) % 1.5}s`,
            animationDuration: `${0.3 + (i % 3) * 0.1}s`,
          }}
        />
      ))}
    </div>
    {/* Lightning */}
    <LightningFlash />
    {/* Dark vignette */}
    <div
      className="absolute inset-0"
      style={{
        background: 'radial-gradient(ellipse at center, transparent 20%, rgba(15, 23, 42, 0.4) 100%)'
      }}
    />
  </>
);

const WindScene: React.FC = () => (
  <>
    {/* Light gray gradient */}
    <div
      className="absolute inset-0"
      style={{
        background: 'linear-gradient(135deg, rgba(148, 163, 184, 0.1) 0%, rgba(203, 213, 225, 0.15) 50%, rgba(148, 163, 184, 0.1) 100%)'
      }}
    />
    {/* Wind streaks */}
    <div className="absolute inset-0">
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          className="absolute animate-wind-streak"
          style={{
            top: `${(i * 2.5) % 100}%`,
            left: '-100px',
            width: `${80 + (i % 5) * 40}px`,
            height: '2px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(148, 163, 184, 0.4) 20%, rgba(148, 163, 184, 0.4) 80%, transparent 100%)',
            borderRadius: '2px',
            animationDelay: `${(i * 0.15) % 5}s`,
            animationDuration: `${1 + (i % 3) * 0.5}s`,
          }}
        />
      ))}
    </div>
    {/* Floating debris/leaves */}
    <div className="absolute inset-0">
      {Array.from({ length: 15 }).map((_, i) => (
        <div
          key={i}
          className="absolute animate-wind-particle"
          style={{
            top: `${20 + (i * 5) % 60}%`,
            left: '-20px',
            width: `${4 + (i % 3) * 2}px`,
            height: `${4 + (i % 3) * 2}px`,
            backgroundColor: i % 3 === 0 ? 'rgba(134, 239, 172, 0.5)' : i % 3 === 1 ? 'rgba(251, 191, 36, 0.5)' : 'rgba(203, 213, 225, 0.5)',
            borderRadius: i % 2 === 0 ? '50%' : '2px',
            animationDelay: `${i * 0.4}s`,
            animationDuration: `${2 + (i % 3)}s`,
          }}
        />
      ))}
    </div>
  </>
);

const FogScene: React.FC = () => (
  <>
    {/* Base mist overlay */}
    <div
      className="absolute inset-0"
      style={{
        background: 'linear-gradient(180deg, rgba(226, 232, 240, 0.2) 0%, rgba(203, 213, 225, 0.3) 50%, rgba(226, 232, 240, 0.35) 100%)'
      }}
    />
    {/* Floating fog layers */}
    {Array.from({ length: 6 }).map((_, i) => (
      <div
        key={i}
        className="absolute animate-fog-drift"
        style={{
          top: `${15 + i * 15}%`,
          left: '-50%',
          width: '200%',
          height: `${80 + (i % 3) * 30}px`,
          background: `radial-gradient(ellipse 50% 100%, rgba(226, 232, 240, ${0.15 + (i % 3) * 0.1}) 0%, transparent 70%)`,
          animationDelay: `${i * 3}s`,
          animationDuration: `${25 + i * 5}s`,
        }}
      />
    ))}
    {/* Soft vignette */}
    <div
      className="absolute inset-0"
      style={{
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(203, 213, 225, 0.2) 100%)'
      }}
    />
  </>
);

const AuroraScene: React.FC = () => {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setOffset(prev => (prev + 1) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Dark night sky base */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.3) 0%, rgba(30, 41, 59, 0.2) 50%, rgba(15, 23, 42, 0.25) 100%)'
        }}
      />
      {/* Aurora waves */}
      <div className="absolute top-0 left-0 right-0 h-2/3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-full animate-aurora-wave"
            style={{
              top: `${i * 10}%`,
              height: '40%',
              background: `linear-gradient(${90 + offset + i * 30}deg,
                transparent 0%,
                rgba(74, 222, 128, ${0.15 - i * 0.02}) 20%,
                rgba(34, 197, 94, ${0.2 - i * 0.02}) 35%,
                rgba(56, 189, 248, ${0.2 - i * 0.02}) 50%,
                rgba(167, 139, 250, ${0.15 - i * 0.02}) 65%,
                rgba(192, 132, 252, ${0.1 - i * 0.01}) 80%,
                transparent 100%
              )`,
              filter: 'blur(20px)',
              animationDelay: `${i * 0.5}s`,
            }}
          />
        ))}
      </div>
      {/* Stars */}
      <div className="absolute inset-0">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-twinkle"
            style={{
              left: `${(i * 2.1) % 100}%`,
              top: `${(i * 1.7) % 70}%`,
              width: `${1 + (i % 3)}px`,
              height: `${1 + (i % 3)}px`,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
    </>
  );
};

// ============================================
// MAIN EXPORT
// ============================================

export const WeatherMode: React.FC<WeatherModeProps> = ({ weather }) => {
  // Only render effects - selector is now in App.tsx floating actions
  return <WeatherEffects weather={weather} />;
};

export default WeatherMode;
