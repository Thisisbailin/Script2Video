
import React, { useState } from 'react';
import { AppConfig, TextProvider } from '../types';
import { AVAILABLE_MODELS } from '../constants';
import * as VideoService from '../services/videoService';
import * as GeminiService from '../services/geminiService';
import * as MultimodalService from '../services/multimodalService';
import { X, Video, Cpu, Key, Globe, RefreshCw, CheckCircle, AlertCircle, Loader2, Zap, Image as ImageIcon, Info, Sparkles, BrainCircuit, Film } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onConfigChange: (c: AppConfig) => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, config, onConfigChange }) => {
  const [activeTab, setActiveTab] = useState<'text' | 'multimodal' | 'video' | 'about'>('text');
  
  // Model Fetch States
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelFetchMessage, setModelFetchMessage] = useState<{type: 'error' | 'success', text: string} | null>(null);
  
  const [isLoadingTextModels, setIsLoadingTextModels] = useState(false);
  const [textModelFetchMessage, setTextModelFetchMessage] = useState<{type: 'error' | 'success', text: string} | null>(null);
  
  const [isLoadingMultiModels, setIsLoadingMultiModels] = useState(false);
  const [multiModelFetchMessage, setMultiModelFetchMessage] = useState<{type: 'error' | 'success', text: string} | null>(null);

  const [availableVideoModels, setAvailableVideoModels] = useState<string[]>([]);
  const [availableTextModels, setAvailableTextModels] = useState<string[]>([]);
  const [availableMultiModels, setAvailableMultiModels] = useState<string[]>([]);

  // Video Models Fetcher
  const handleFetchVideoModels = async () => {
    const { baseUrl, apiKey } = config.videoConfig;
    if (!baseUrl || !apiKey) {
        setModelFetchMessage({ type: 'error', text: "Please enter URL and API Key first." });
        return;
    }
    
    // Check if it's a submit URL - if so, skip model fetch and just "ping"
    if (baseUrl.includes('/submit')) {
         setModelFetchMessage({ 
             type: 'success', 
             text: "Submission URL detected. Model fetching skipped (Mode: Direct Submit)." 
         });
         return;
    }

    setIsLoadingModels(true);
    setModelFetchMessage(null);
    try {
        const models = await VideoService.fetchModels(baseUrl, apiKey);
        if (models.length > 0) {
            setAvailableVideoModels(models);
            setModelFetchMessage({ type: 'success', text: `Found ${models.length} models.` });
            if (!config.videoConfig.model) {
                onConfigChange({ ...config, videoConfig: { ...config.videoConfig, model: models[0] } });
            }
        } else {
            setAvailableVideoModels([]);
            // Only show success if no error was thrown
            setModelFetchMessage({ type: 'success', text: "Connection reachable, but no models list returned." });
        }
    } catch (e: any) {
        setModelFetchMessage({ type: 'error', text: e.message || "Failed to connect." });
    } finally {
        setIsLoadingModels(false);
    }
  };

  // Text Models Fetcher (OpenRouter)
  const handleFetchTextModels = async () => {
     const { baseUrl, apiKey } = config.textConfig;
     if (!baseUrl || !apiKey) {
         setTextModelFetchMessage({ type: 'error', text: "Please enter URL and API Key first." });
         return;
     }
     setIsLoadingTextModels(true);
     setTextModelFetchMessage(null);
     try {
         const models = await GeminiService.fetchTextModels(baseUrl, apiKey);
         if (models.length > 0) {
             setAvailableTextModels(models);
             setTextModelFetchMessage({ type: 'success', text: `Found ${models.length} models.` });
         } else {
             setTextModelFetchMessage({ type: 'success', text: "Connection OK. No models listed." });
         }
     } catch (e: any) {
         setTextModelFetchMessage({ type: 'error', text: e.message });
     } finally {
         setIsLoadingTextModels(false);
     }
  };

  // Multimodal Models Fetcher
  const handleFetchMultiModels = async () => {
    const { baseUrl, apiKey } = config.multimodalConfig;
    if (!baseUrl || !apiKey) {
        setMultiModelFetchMessage({ type: 'error', text: "Please enter URL and API Key first." });
        return;
    }
    setIsLoadingMultiModels(true);
    setMultiModelFetchMessage(null);
    try {
        const models = await MultimodalService.fetchMultimodalModels(baseUrl, apiKey);
        if (models.length > 0) {
            setAvailableMultiModels(models);
            setMultiModelFetchMessage({ type: 'success', text: `Found ${models.length} models.` });
        } else {
            setMultiModelFetchMessage({ type: 'success', text: "Connection OK. No models listed." });
        }
    } catch (e: any) {
        setMultiModelFetchMessage({ type: 'error', text: e.message });
    } finally {
        setIsLoadingMultiModels(false);
    }
  };

  const setProvider = (p: TextProvider) => {
      onConfigChange({
          ...config,
          textConfig: { 
              ...config.textConfig, 
              provider: p,
              // Reset defaults if switching
              baseUrl: p === 'openrouter' ? (config.textConfig.baseUrl || 'https://openrouter.ai/api/v1') : '',
              model: p === 'gemini' ? 'gemini-2.5-flash' : ''
          }
      });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg p-0 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col transition-colors">
        
        {/* Header */}
        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex justify-between items-center border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">System Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
            <button 
                onClick={() => setActiveTab('text')}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'text' ? 'bg-blue-50 dark:bg-gray-700/50 text-blue-600 dark:text-white border-b-2 border-blue-500' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'}`}
            >
                <Cpu size={16} /> Text
            </button>
            <button 
                onClick={() => setActiveTab('multimodal')}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'multimodal' ? 'bg-pink-50 dark:bg-gray-700/50 text-pink-600 dark:text-white border-b-2 border-pink-500' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'}`}
            >
                <ImageIcon size={16} /> Visuals
            </button>
            <button 
                onClick={() => setActiveTab('video')}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'video' ? 'bg-indigo-50 dark:bg-gray-700/50 text-indigo-600 dark:text-white border-b-2 border-indigo-500' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'}`}
            >
                <Video size={16} /> Video
            </button>
            <button 
                onClick={() => setActiveTab('about')}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'about' ? 'bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white border-b-2 border-gray-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'}`}
                title="About Project"
            >
                <Info size={16} /> Info
            </button>
        </div>

        <div className="p-6 overflow-y-auto">
            <div className="mb-6 p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 flex items-start gap-3">
                <input
                  id="rememberKeys"
                  type="checkbox"
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  checked={!!config.rememberApiKeys}
                  onChange={(e) => {
                    onConfigChange({
                      ...config,
                      rememberApiKeys: e.target.checked,
                    });
                  }}
                />
                <label htmlFor="rememberKeys" className="text-sm text-gray-700 dark:text-gray-200 leading-tight">
                  记住 API 密钥到本地（默认不落盘，刷新后需重新输入）。勾选后密钥会写入浏览器存储，请仅在可信设备使用。
                </label>
            </div>
            {activeTab === 'text' && (
                <div className="space-y-6">
                   {/* Provider Switcher */}
                   <div>
                       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Provider</label>
                       <div className="flex rounded-lg bg-gray-100 dark:bg-gray-900 p-1 border border-gray-200 dark:border-gray-700">
                           <button 
                               onClick={() => setProvider('gemini')}
                               className={`flex-1 py-2 text-sm rounded-md transition-all flex items-center justify-center gap-2 ${config.textConfig.provider === 'gemini' ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                           >
                               <Zap size={14}/> Google Gemini
                           </button>
                           <button 
                               onClick={() => setProvider('openrouter')}
                               className={`flex-1 py-2 text-sm rounded-md transition-all flex items-center justify-center gap-2 ${config.textConfig.provider === 'openrouter' ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                           >
                               <Globe size={14}/> OpenRouter / OpenAI
                           </button>
                       </div>
                   </div>

                   {/* Configuration Content */}
                   {config.textConfig.provider === 'gemini' ? (
                       <div className="space-y-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700/50">
                           <div>
                               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gemini Model</label>
                               <select
                                 value={config.textConfig.model}
                                 onChange={(e) => onConfigChange({ ...config, textConfig: { ...config.textConfig, model: e.target.value } })}
                                 className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                               >
                                 {AVAILABLE_MODELS.map(m => (
                                   <option key={m.id} value={m.id}>{m.name}</option>
                                 ))}
                               </select>
                           </div>
                           <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                                     <Key size={14}/> API Key
                                </label>
                                <input
                                    type="password"
                                    placeholder="AIza..."
                                    value={config.textConfig.apiKey || ''}
                                    onChange={(e) => onConfigChange({ ...config, textConfig: { ...config.textConfig, apiKey: e.target.value } })}
                                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                                    <CheckCircle size={12} className="text-green-500" />
                                    支持手动填写，留空时会使用环境变量 VITE_GEMINI_API_KEY。
                                </p>
                           </div>
                       </div>
                   ) : (
                       <div className="space-y-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700/50">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                                     <Globe size={14}/> API Endpoint URL
                                </label>
                                <input
                                    type="text"
                                    placeholder="https://openrouter.ai/api/v1"
                                    value={config.textConfig.baseUrl || ''}
                                    onChange={(e) => onConfigChange({ ...config, textConfig: { ...config.textConfig, baseUrl: e.target.value } })}
                                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                                     <Key size={14}/> API Key
                                </label>
                                <input
                                    type="password"
                                    placeholder="sk-or-..."
                                    value={config.textConfig.apiKey || ''}
                                    onChange={(e) => onConfigChange({ ...config, textConfig: { ...config.textConfig, apiKey: e.target.value } })}
                                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                            
                            {/* Fetch & Select Text Model */}
                            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex justify-between items-center mb-1">
                                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Target Model</label>
                                     <button 
                                         onClick={handleFetchTextModels}
                                         disabled={isLoadingTextModels}
                                         className="text-xs flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-500 disabled:opacity-50"
                                     >
                                         {isLoadingTextModels ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                         Fetch Models
                                     </button>
                                </div>
                                {textModelFetchMessage && (
                                    <p className={`text-xs mb-2 flex items-center gap-1 ${textModelFetchMessage.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
                                        {textModelFetchMessage.type === 'error' ? <AlertCircle size={10} /> : <CheckCircle size={10} />}
                                        {textModelFetchMessage.text}
                                    </p>
                                )}
                                {availableTextModels.length > 0 ? (
                                    <select
                                        value={config.textConfig.model}
                                        onChange={(e) => onConfigChange({ ...config, textConfig: { ...config.textConfig, model: e.target.value } })}
                                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    >
                                        <option value="">Select a model...</option>
                                        {availableTextModels.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder="e.g. google/gemini-pro-1.5"
                                        value={config.textConfig.model}
                                        onChange={(e) => onConfigChange({ ...config, textConfig: { ...config.textConfig, model: e.target.value } })}
                                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                )}
                            </div>
                       </div>
                   )}
                </div>
            )}

            {activeTab === 'multimodal' && (
                <div className="space-y-4">
                     <div className="p-3 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-900 rounded text-xs text-pink-800 dark:text-pink-200 mb-4">
                        Phase 4 uses Multimodal Intelligence to generate visual concepts. Use an OpenRouter or OpenAI compatible API that supports image generation or rich markdown responses (e.g., GPT-4o, Claude 3.5 Sonnet, etc).
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                             <Globe size={14}/> API Endpoint URL
                        </label>
                        <input
                            type="text"
                            placeholder="https://openrouter.ai/api/v1"
                            value={config.multimodalConfig?.baseUrl || ''}
                            onChange={(e) => onConfigChange({
                                ...config,
                                multimodalConfig: { ...config.multimodalConfig, baseUrl: e.target.value }
                            })}
                            className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-pink-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                             <Key size={14}/> API Key
                        </label>
                        <input
                            type="password"
                            placeholder="sk-..."
                            value={config.multimodalConfig?.apiKey || ''}
                            onChange={(e) => onConfigChange({
                                ...config,
                                multimodalConfig: { ...config.multimodalConfig, apiKey: e.target.value }
                            })}
                            className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-pink-500 focus:outline-none"
                        />
                    </div>
                     <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                         <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Model</label>
                                <button 
                                    onClick={handleFetchMultiModels}
                                    disabled={isLoadingMultiModels}
                                    className="text-xs flex items-center gap-1 text-pink-600 dark:text-pink-400 hover:text-pink-500 disabled:opacity-50"
                                >
                                    {isLoadingMultiModels ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                    Fetch Models
                                </button>
                        </div>
                        {multiModelFetchMessage && (
                                    <p className={`text-xs mb-2 flex items-center gap-1 ${multiModelFetchMessage.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
                                        {multiModelFetchMessage.type === 'error' ? <AlertCircle size={10} /> : <CheckCircle size={10} />}
                                        {multiModelFetchMessage.text}
                                    </p>
                         )}
                        {availableMultiModels.length > 0 ? (
                            <select
                                value={config.multimodalConfig?.model || ''}
                                onChange={(e) => onConfigChange({
                                    ...config,
                                    multimodalConfig: { ...config.multimodalConfig, model: e.target.value }
                                })}
                                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-pink-500 focus:outline-none"
                            >
                                <option value="">Select a model...</option>
                                {availableMultiModels.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        ) : (
                             <input
                                type="text"
                                placeholder="e.g. gpt-4o"
                                value={config.multimodalConfig?.model || ''}
                                onChange={(e) => onConfigChange({
                                    ...config,
                                    multimodalConfig: { ...config.multimodalConfig, model: e.target.value }
                                })}
                                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-pink-500 focus:outline-none"
                            />
                        )}
                     </div>
                </div>
            )}

            {activeTab === 'video' && (
                <div className="space-y-4">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-900 rounded text-xs text-indigo-800 dark:text-indigo-200 mb-4">
                        Phase 5 requires an external Video Generation API. You can use standard proxies (OneAPI) or direct endpoints.
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                             <Globe size={14}/> API Endpoint URL
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. https://api.wuyinkeji.com/api/sora2/submit"
                            value={config.videoConfig?.baseUrl || ''}
                            onChange={(e) => onConfigChange({
                                ...config,
                                videoConfig: { ...config.videoConfig, baseUrl: e.target.value }
                            })}
                            className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-gray-400 dark:placeholder-gray-600"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                             <Key size={14}/> API Key
                        </label>
                        <input
                            type="password"
                            placeholder="sk-..."
                            value={config.videoConfig?.apiKey || ''}
                            onChange={(e) => onConfigChange({
                                ...config,
                                videoConfig: { ...config.videoConfig, apiKey: e.target.value }
                            })}
                            className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                    </div>

                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-1">
                             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Model ID <span className="text-gray-500 font-normal">(Optional)</span>
                            </label>
                            <button 
                                onClick={handleFetchVideoModels}
                                disabled={isLoadingModels}
                                className="text-xs flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 disabled:opacity-50"
                            >
                                {isLoadingModels ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                Test Connection
                            </button>
                        </div>
                        
                        {modelFetchMessage && (
                            <p className={`text-xs mb-2 flex items-center gap-1 ${modelFetchMessage.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
                                {modelFetchMessage.type === 'error' ? <AlertCircle size={10} /> : <CheckCircle size={10} />}
                                {modelFetchMessage.text}
                            </p>
                        )}

                        {availableVideoModels.length > 0 ? (
                            <div className="relative">
                                <select
                                    value={config.videoConfig?.model || ''}
                                    onChange={(e) => onConfigChange({
                                        ...config,
                                        videoConfig: { ...config.videoConfig, model: e.target.value }
                                    })}
                                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none appearance-none"
                                >
                                    {availableVideoModels.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                             <input
                                type="text"
                                placeholder="Leave empty if URL implies model (e.g. sora2)"
                                value={config.videoConfig?.model || ''}
                                onChange={(e) => onConfigChange({
                                    ...config,
                                    videoConfig: { ...config.videoConfig, model: e.target.value }
                                })}
                                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-gray-400 dark:placeholder-gray-600"
                            />
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'about' && (
                <div className="space-y-8 text-center py-4">
                    {/* Hero Section */}
                    <div>
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4 transform rotate-3 hover:rotate-0 transition-transform duration-500">
                            <Video size={40} className="text-white drop-shadow-md" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-1">
                            Script2Video
                        </h1>
                        <span className="inline-block px-3 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-[10px] text-gray-500 dark:text-gray-400 font-mono border border-gray-200 dark:border-gray-700 tracking-wider">
                            VERSION 0.1
                        </span>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
                        An end-to-end AI filmmaking assistant that transforms screenplays into professional shooting scripts and generates production-ready assets.
                    </p>

                    {/* Features List */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700/50 text-left max-w-sm mx-auto shadow-inner">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Sparkles size={10} /> Core Features
                        </h3>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-3">
                                <BrainCircuit size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                                <div>
                                    <span className="text-sm text-gray-800 dark:text-gray-200 font-medium block">Deep Script Understanding</span>
                                    <span className="text-xs text-gray-500 block">Analyzes plot, characters, and themes.</span>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <Film size={16} className="text-blue-500 shrink-0 mt-0.5" />
                                <div>
                                    <span className="text-sm text-gray-800 dark:text-gray-200 font-medium block">Automated Shot Lists</span>
                                    <span className="text-xs text-gray-500 block">Converts text to professional shooting scripts.</span>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <ImageIcon size={16} className="text-pink-500 shrink-0 mt-0.5" />
                                <div>
                                    <span className="text-sm text-gray-800 dark:text-gray-200 font-medium block">Visual Concept Studio</span>
                                    <span className="text-xs text-gray-500 block">Generates character and location concepts.</span>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <Zap size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                                <div>
                                    <span className="text-sm text-gray-800 dark:text-gray-200 font-medium block">Sora Prompt Engineering</span>
                                    <span className="text-xs text-gray-500 block">Creates production-ready video prompts.</span>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <Video size={16} className="text-purple-500 shrink-0 mt-0.5" />
                                <div>
                                    <span className="text-sm text-gray-800 dark:text-gray-200 font-medium block">Video Generation</span>
                                    <span className="text-xs text-gray-500 block">Direct integration with Video APIs.</span>
                                </div>
                            </li>
                        </ul>
                    </div>

                    {/* Footer / Credits */}
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                        <p className="text-xs text-gray-500">
                            Designed by <span className="text-gray-700 dark:text-gray-400 font-medium">Bai & Gemini</span>
                        </p>
                    </div>
                </div>
            )}
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex justify-end border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
