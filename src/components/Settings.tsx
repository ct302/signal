import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Settings as SettingsIcon, X, Eye, EyeOff, RefreshCw, Check, AlertCircle, Edit3, Clock } from 'lucide-react';
import { ProviderConfig, ProviderType, OllamaModel } from '../types';
import { DEFAULT_OLLAMA_ENDPOINT, STORAGE_KEYS } from '../constants';
import { fetchOllamaModels } from '../services';

// Storage key for model history
const MODEL_HISTORY_KEY = 'signal_model_history';

// Get recent models for a provider from localStorage (max 3)
const getRecentModels = (provider: ProviderType): string[] => {
  try {
    const stored = localStorage.getItem(MODEL_HISTORY_KEY);
    if (stored) {
      const history = JSON.parse(stored);
      return history[provider] || [];
    }
  } catch {
    // Ignore errors
  }
  return [];
};

// Save a model to recent history for a provider
const saveModelToHistory = (provider: ProviderType, model: string) => {
  try {
    const stored = localStorage.getItem(MODEL_HISTORY_KEY);
    const history = stored ? JSON.parse(stored) : {};
    const providerHistory = history[provider] || [];

    // Remove if already exists (will re-add at front)
    const filtered = providerHistory.filter((m: string) => m !== model);

    // Add to front, keep only 3
    history[provider] = [model, ...filtered].slice(0, 3);

    localStorage.setItem(MODEL_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Ignore errors
  }
};

interface SettingsProps {
  isDarkMode: boolean;
}

const PROVIDER_LABELS: Record<ProviderType, string> = {
  google: 'Google (Gemini)',
  openai: 'OpenAI (GPT)',
  anthropic: 'Anthropic (Claude)',
  groq: 'Groq',
  ollama: 'Ollama (Local)',
  openrouter: 'OpenRouter'
};

export const Settings: React.FC<SettingsProps> = ({ isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ProviderConfig>({
    provider: 'openrouter',
    apiKey: '',
    model: '',
    ollamaEndpoint: DEFAULT_OLLAMA_ENDPOINT
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [customModelInput, setCustomModelInput] = useState('');
  const [recentModels, setRecentModels] = useState<string[]>([]);

  // Load config from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.PROVIDER_CONFIG);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setConfig(parsed);
        setCustomModelInput(parsed.model || '');
        if (parsed.provider === 'ollama') {
          loadOllamaModels(parsed.ollamaEndpoint);
        } else {
          // Load recent models for this provider
          setRecentModels(getRecentModels(parsed.provider));
        }
      } catch {
        // Use default config - load recent for default provider
        setRecentModels(getRecentModels('openrouter'));
      }
    } else {
      // No stored config - load recent for default provider
      setRecentModels(getRecentModels('openrouter'));
    }
  }, []);

  const loadOllamaModels = async (endpoint?: string) => {
    setIsLoadingModels(true);
    const models = await fetchOllamaModels(endpoint || config.ollamaEndpoint);
    setOllamaModels(models);
    setIsLoadingModels(false);
    
    // Auto-select first model if none selected
    if (models.length > 0 && !config.model) {
      setConfig(prev => ({ ...prev, model: models[0].name }));
    }
  };

  const handleProviderChange = (provider: ProviderType) => {
    // Load recent models for this provider
    const recent = getRecentModels(provider);
    setRecentModels(recent);

    // If switching to Ollama, use first Ollama model; otherwise use first recent or empty
    const defaultModel = provider === 'ollama'
      ? (ollamaModels[0]?.name || '')
      : (recent[0] || '');

    setConfig(prev => ({ ...prev, provider, model: defaultModel }));
    setCustomModelInput(defaultModel);

    if (provider === 'ollama') {
      loadOllamaModels();
    }
  };

  // Handle model selection from recent dropdown
  const handleModelSelect = (value: string) => {
    setConfig(prev => ({ ...prev, model: value }));
    setCustomModelInput(value);
  };

  // Handle custom model input change
  const handleCustomModelChange = (value: string) => {
    setCustomModelInput(value);
    setConfig(prev => ({ ...prev, model: value }));
  };

  // Check if we're in "custom" mode (model not in recent list)
  const isCustomMode = config.provider !== 'ollama' && !recentModels.includes(config.model);

  // Provider model hints (where to find model names)
  const getModelHint = (): string => {
    switch (config.provider) {
      case 'openrouter':
        return 'Find models at openrouter.ai/models';
      case 'google':
        return 'e.g., gemini-2.0-flash-exp, gemini-1.5-pro';
      case 'openai':
        return 'e.g., gpt-4o, gpt-4-turbo-preview';
      case 'anthropic':
        return 'e.g., claude-3-5-sonnet-20241022';
      case 'groq':
        return 'e.g., llama-3.3-70b-versatile, mixtral-8x7b-32768';
      default:
        return '';
    }
  };

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROVIDER_CONFIG, JSON.stringify(config));

      // Save model to history (only for non-Ollama providers with a valid model)
      if (config.provider !== 'ollama' && config.model) {
        saveModelToHistory(config.provider, config.model);
        // Update local state to reflect new history
        setRecentModels(getRecentModels(config.provider));
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const getAvailableModels = (): string[] => {
    if (config.provider === 'ollama') {
      return ollamaModels.map(m => m.name);
    }
    return recentModels;
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`p-2 rounded-lg transition-colors ${
          isDarkMode 
            ? 'text-neutral-400 hover:bg-neutral-700 hover:text-white' 
            : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
        }`}
        title="Settings"
      >
        <SettingsIcon size={20} />
      </button>
    );
  }

  // Use portal to render modal at document body level
  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
    >
      {/* Modal */}
      <div
        className={`w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl ${
          isDarkMode ? 'bg-neutral-800' : 'bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDarkMode ? 'border-neutral-700' : 'border-neutral-200'
        }`}>
          <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>
            AI Provider Settings
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className={`p-2 min-w-touch min-h-touch flex items-center justify-center rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'
            }`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Provider Selection */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
              Provider
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {(Object.keys(PROVIDER_LABELS) as ProviderType[]).map(provider => (
                <button
                  key={provider}
                  onClick={() => handleProviderChange(provider)}
                  className={`px-3 py-3 min-h-touch rounded-lg text-sm font-medium transition-colors ${
                    config.provider === provider
                      ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
                      : (isDarkMode ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200')
                  }`}
                >
                  {PROVIDER_LABELS[provider]}
                </button>
              ))}
            </div>
          </div>

          {/* Ollama Endpoint (only for Ollama) */}
          {config.provider === 'ollama' && (
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                Ollama Endpoint
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={config.ollamaEndpoint || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, ollamaEndpoint: e.target.value }))}
                  placeholder="http://localhost:11434"
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                    isDarkMode 
                      ? 'bg-neutral-700 border-neutral-600 text-white placeholder-neutral-500' 
                      : 'bg-white border-neutral-200 text-neutral-800 placeholder-neutral-400'
                  }`}
                />
                <button
                  onClick={() => loadOllamaModels()}
                  disabled={isLoadingModels}
                  className={`px-3 py-2 rounded-lg transition-colors ${
                    isDarkMode ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                  title="Detect Models"
                >
                  <RefreshCw size={16} className={isLoadingModels ? 'animate-spin' : ''} />
                </button>
              </div>
              {ollamaModels.length === 0 && !isLoadingModels && (
                <p className={`mt-1 text-xs ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                  No models found. Is Ollama running?
                </p>
              )}
            </div>
          )}

          {/* API Key (not for Ollama) */}
          {config.provider !== 'ollama' && (
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={config.apiKey}
                  onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder={`Enter your ${PROVIDER_LABELS[config.provider]} API key`}
                  className={`w-full px-3 py-2 pr-10 rounded-lg border text-sm ${
                    isDarkMode 
                      ? 'bg-neutral-700 border-neutral-600 text-white placeholder-neutral-500' 
                      : 'bg-white border-neutral-200 text-neutral-800 placeholder-neutral-400'
                  }`}
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded ${
                    isDarkMode ? 'text-neutral-400 hover:text-white' : 'text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className={`mt-1 text-xs ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                Stored locally in your browser. Never sent to our servers.
              </p>
              {!config.apiKey && (
                <p className={`mt-2 text-xs font-medium ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                  ⚠️ API key required to use Signal
                </p>
              )}
            </div>
          )}

          {/* Model Selection */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
              Model
            </label>

            {/* Mode Toggle: Recent vs Custom (only show if there are recent models) */}
            {config.provider !== 'ollama' && recentModels.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => {
                    const firstRecent = recentModels[0] || '';
                    setConfig(prev => ({ ...prev, model: firstRecent }));
                    setCustomModelInput(firstRecent);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    !isCustomMode
                      ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
                      : (isDarkMode ? 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200')
                  }`}
                >
                  <Clock size={14} />
                  Recent
                </button>
                <button
                  onClick={() => { setCustomModelInput(config.model || ''); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isCustomMode
                      ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
                      : (isDarkMode ? 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200')
                  }`}
                >
                  <Edit3 size={14} />
                  Custom
                </button>
              </div>
            )}

            {/* Ollama: Always show dropdown */}
            {config.provider === 'ollama' && (
              <select
                value={config.model}
                onChange={(e) => handleModelSelect(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  isDarkMode
                    ? 'bg-neutral-700 border-neutral-600 text-white'
                    : 'bg-white border-neutral-200 text-neutral-800'
                }`}
              >
                {getAvailableModels().map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            )}

            {/* Non-Ollama with recent models: Show dropdown or custom input */}
            {config.provider !== 'ollama' && recentModels.length > 0 && !isCustomMode && (
              <select
                value={config.model}
                onChange={(e) => handleModelSelect(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  isDarkMode
                    ? 'bg-neutral-700 border-neutral-600 text-white'
                    : 'bg-white border-neutral-200 text-neutral-800'
                }`}
              >
                {recentModels.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            )}

            {/* Non-Ollama with no recent models OR in custom mode: Show custom input */}
            {config.provider !== 'ollama' && (recentModels.length === 0 || isCustomMode) && (
              <div>
                <input
                  type="text"
                  value={customModelInput}
                  onChange={(e) => handleCustomModelChange(e.target.value)}
                  placeholder="Enter model name (e.g., google/gemini-2.0-flash-exp:free)"
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${
                    isDarkMode
                      ? 'bg-neutral-700 border-neutral-600 text-white placeholder-neutral-500'
                      : 'bg-white border-neutral-200 text-neutral-800 placeholder-neutral-400'
                  }`}
                />
                <p className={`mt-1.5 text-xs ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  {getModelHint()}
                </p>
              </div>
            )}

            {/* Help text */}
            {config.provider !== 'ollama' && recentModels.length > 0 && !isCustomMode && (
              <p className={`mt-1.5 text-xs ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                Use <strong>Custom</strong> to enter a new model name.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-4 border-t ${
          isDarkMode ? 'border-neutral-700' : 'border-neutral-200'
        }`}>
          <div className="flex items-center gap-2">
            {saveStatus === 'saved' && (
              <>
                <Check size={16} className="text-green-500" />
                <span className={`text-sm ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>Saved!</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <AlertCircle size={16} className="text-red-500" />
                <span className={`text-sm ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>Error saving</span>
              </>
            )}
          </div>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Settings;
