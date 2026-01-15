import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Settings as SettingsIcon, X, Eye, EyeOff, RefreshCw, Check, AlertCircle, ChevronDown, ChevronUp, Cloud, HardDrive } from 'lucide-react';
import { ProviderConfig, ProviderType, OllamaModel } from '../types';
import { DEFAULT_OLLAMA_ENDPOINT, STORAGE_KEYS } from '../constants';
import { fetchOllamaModels } from '../services';

// Default base URL for cloud providers (OpenRouter)
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

// Storage key for model history
const MODEL_HISTORY_KEY = 'signal_model_history';

// Get recent models from localStorage (max 3)
const getRecentModels = (): string[] => {
  try {
    const stored = localStorage.getItem(MODEL_HISTORY_KEY);
    if (stored) {
      const history = JSON.parse(stored);
      return history.cloud || [];
    }
  } catch {
    // Ignore errors
  }
  return [];
};

// Save a model to recent history
const saveModelToHistory = (model: string) => {
  try {
    const stored = localStorage.getItem(MODEL_HISTORY_KEY);
    const history = stored ? JSON.parse(stored) : {};
    const cloudHistory = history.cloud || [];

    // Remove if already exists (will re-add at front)
    const filtered = cloudHistory.filter((m: string) => m !== model);

    // Add to front, keep only 3
    history.cloud = [model, ...filtered].slice(0, 3);

    localStorage.setItem(MODEL_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Ignore errors
  }
};

interface SettingsProps {
  isDarkMode: boolean;
}

export const Settings: React.FC<SettingsProps> = ({ isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ProviderConfig>({
    provider: 'cloud',
    apiKey: '',
    model: '',
    baseUrl: DEFAULT_BASE_URL,
    ollamaEndpoint: DEFAULT_OLLAMA_ENDPOINT
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [recentModels, setRecentModels] = useState<string[]>([]);

  // Load config from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.PROVIDER_CONFIG);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);

        // Migrate old config format (6 providers -> 2)
        if (['google', 'openai', 'anthropic', 'groq', 'openrouter'].includes(parsed.provider)) {
          parsed.provider = 'cloud';
          parsed.baseUrl = DEFAULT_BASE_URL;
        }

        setConfig({
          ...parsed,
          baseUrl: parsed.baseUrl || DEFAULT_BASE_URL,
          ollamaEndpoint: parsed.ollamaEndpoint || DEFAULT_OLLAMA_ENDPOINT
        });

        if (parsed.provider === 'ollama') {
          loadOllamaModels(parsed.ollamaEndpoint);
        } else {
          setRecentModels(getRecentModels());
        }
      } catch {
        setRecentModels(getRecentModels());
      }
    } else {
      setRecentModels(getRecentModels());
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
    if (provider === 'ollama') {
      setConfig(prev => ({
        ...prev,
        provider,
        model: ollamaModels[0]?.name || ''
      }));
      loadOllamaModels();
    } else {
      const recent = getRecentModels();
      setRecentModels(recent);
      setConfig(prev => ({
        ...prev,
        provider,
        model: recent[0] || ''
      }));
    }
  };

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROVIDER_CONFIG, JSON.stringify(config));

      // Save model to history (only for cloud with a valid model)
      if (config.provider === 'cloud' && config.model) {
        saveModelToHistory(config.model);
        setRecentModels(getRecentModels());
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
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
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
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
            className={`p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'
            }`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Provider Selection - Two Big Buttons */}
          <div>
            <label className={`block text-sm font-medium mb-3 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
              Provider
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => handleProviderChange('cloud')}
                className={`flex-1 py-4 rounded-xl flex flex-col items-center gap-2 transition-all ${
                  config.provider === 'cloud'
                    ? (isDarkMode ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-blue-500 text-white ring-2 ring-blue-300')
                    : (isDarkMode ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200')
                }`}
              >
                <Cloud size={28} />
                <span className="font-medium">Cloud</span>
              </button>
              <button
                onClick={() => handleProviderChange('ollama')}
                className={`flex-1 py-4 rounded-xl flex flex-col items-center gap-2 transition-all ${
                  config.provider === 'ollama'
                    ? (isDarkMode ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-blue-500 text-white ring-2 ring-blue-300')
                    : (isDarkMode ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200')
                }`}
              >
                <HardDrive size={28} />
                <span className="font-medium">Local</span>
              </button>
            </div>
          </div>

          {/* Cloud Mode */}
          {config.provider === 'cloud' && (
            <>
              {/* API Key */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={config.apiKey}
                    onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="Enter your API key"
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
              </div>

              {/* Model */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                  Model
                </label>
                <input
                  type="text"
                  value={config.model}
                  onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                  placeholder="e.g., google/gemini-2.0-flash-exp:free"
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${
                    isDarkMode
                      ? 'bg-neutral-700 border-neutral-600 text-white placeholder-neutral-500'
                      : 'bg-white border-neutral-200 text-neutral-800 placeholder-neutral-400'
                  }`}
                />
                {recentModels.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {recentModels.map(model => (
                      <button
                        key={model}
                        onClick={() => setConfig(prev => ({ ...prev, model }))}
                        className={`px-2 py-1 text-xs rounded-md transition-colors ${
                          config.model === model
                            ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
                            : (isDarkMode ? 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200')
                        }`}
                      >
                        {model.length > 30 ? model.slice(0, 30) + '...' : model}
                      </button>
                    ))}
                  </div>
                )}
                <p className={`mt-1.5 text-xs ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  Find models at <span className="font-medium">openrouter.ai/models</span>
                </p>
              </div>

              {/* Advanced Section */}
              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={`flex items-center gap-2 text-sm font-medium ${isDarkMode ? 'text-neutral-400 hover:text-neutral-300' : 'text-neutral-500 hover:text-neutral-600'}`}
                >
                  {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  Advanced
                </button>

                {showAdvanced && (
                  <div className={`mt-3 p-3 rounded-lg ${isDarkMode ? 'bg-neutral-700/50' : 'bg-neutral-50'}`}>
                    <label className={`block text-xs font-medium mb-1.5 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                      Base URL
                    </label>
                    <input
                      type="text"
                      value={config.baseUrl || DEFAULT_BASE_URL}
                      onChange={(e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                      placeholder={DEFAULT_BASE_URL}
                      className={`w-full px-3 py-2 rounded-lg border text-xs font-mono ${
                        isDarkMode
                          ? 'bg-neutral-800 border-neutral-600 text-white placeholder-neutral-500'
                          : 'bg-white border-neutral-200 text-neutral-800 placeholder-neutral-400'
                      }`}
                    />
                    <p className={`mt-1.5 text-xs ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      Default: OpenRouter. Change for direct OpenAI, Groq, etc.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Ollama Mode */}
          {config.provider === 'ollama' && (
            <>
              {/* Endpoint */}
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

              {/* Model Selection */}
              {ollamaModels.length > 0 && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                    Model
                  </label>
                  <select
                    value={config.model}
                    onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${
                      isDarkMode
                        ? 'bg-neutral-700 border-neutral-600 text-white'
                        : 'bg-white border-neutral-200 text-neutral-800'
                    }`}
                  >
                    {ollamaModels.map(model => (
                      <option key={model.name} value={model.name}>{model.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
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
