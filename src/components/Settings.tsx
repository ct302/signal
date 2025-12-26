import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Settings as SettingsIcon, X, Eye, EyeOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { ProviderConfig, ProviderType, DEFAULT_MODELS, OllamaModel } from '../types';
import { DEFAULT_OLLAMA_ENDPOINT, STORAGE_KEYS, DEFAULT_GEMINI_API_KEY, DEFAULT_OPENROUTER_API_KEY, OPENROUTER_API_KEYS } from '../constants';
import { fetchOllamaModels } from '../services';

interface SettingsProps {
  isDarkMode: boolean;
}

const PROVIDER_LABELS: Record<ProviderType, string> = {
  google: 'Google (Gemini)',
  openai: 'OpenAI (GPT)',
  anthropic: 'Anthropic (Claude)',
  ollama: 'Ollama (Local)',
  openrouter: 'OpenRouter'
};

export const Settings: React.FC<SettingsProps> = ({ isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ProviderConfig>({
    provider: 'openrouter',
    apiKey: DEFAULT_OPENROUTER_API_KEY,
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    ollamaEndpoint: DEFAULT_OLLAMA_ENDPOINT
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // Config version - must match gemini.ts
  const CONFIG_VERSION = 3;

  // Load config from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.PROVIDER_CONFIG);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Check version - if outdated, use defaults
        if (parsed._version !== CONFIG_VERSION) {
          localStorage.removeItem(STORAGE_KEYS.PROVIDER_CONFIG);
          return; // Use default state
        }
        // Use default API key for providers if none stored
        if (parsed.provider === 'google' && !parsed.apiKey) {
          parsed.apiKey = DEFAULT_GEMINI_API_KEY;
        }
        if (parsed.provider === 'openrouter' && !parsed.apiKey) {
          parsed.apiKey = DEFAULT_OPENROUTER_API_KEY;
        }
        setConfig(parsed);
        if (parsed.provider === 'ollama') {
          loadOllamaModels(parsed.ollamaEndpoint);
        }
      } catch {
        // Use default config
      }
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
    const defaultModel = provider === 'ollama'
      ? (ollamaModels[0]?.name || '')
      : DEFAULT_MODELS[provider][0];

    // Reset API key to default when switching providers
    let defaultApiKey = '';
    if (provider === 'google') {
      defaultApiKey = DEFAULT_GEMINI_API_KEY;
    } else if (provider === 'openrouter') {
      // Use model-specific API key for OpenRouter
      defaultApiKey = OPENROUTER_API_KEYS[defaultModel] || DEFAULT_OPENROUTER_API_KEY;
    }

    setConfig(prev => ({ ...prev, provider, model: defaultModel, apiKey: defaultApiKey }));

    if (provider === 'ollama') {
      loadOllamaModels();
    }
  };

  // Handle model change - update API key for OpenRouter models
  const handleModelChange = (model: string) => {
    let apiKey = config.apiKey;
    if (config.provider === 'openrouter') {
      apiKey = OPENROUTER_API_KEYS[model] || config.apiKey;
    }
    setConfig(prev => ({ ...prev, model, apiKey }));
  };

  const handleSave = () => {
    try {
      const configWithVersion = { ...config, _version: CONFIG_VERSION };
      localStorage.setItem(STORAGE_KEYS.PROVIDER_CONFIG, JSON.stringify(configWithVersion));
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
    return DEFAULT_MODELS[config.provider];
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
      onClick={() => setIsOpen(false)}
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
            className={`p-1 rounded-lg transition-colors ${
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
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PROVIDER_LABELS) as ProviderType[]).map(provider => (
                <button
                  key={provider}
                  onClick={() => handleProviderChange(provider)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
            </div>
          )}

          {/* Model Selection */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
              Model
            </label>
            <select
              value={config.model}
              onChange={(e) => handleModelChange(e.target.value)}
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
