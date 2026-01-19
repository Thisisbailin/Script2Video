import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  BrainCircuit,
  CheckCircle,
  ChevronDown,
  Globe,
  Loader2,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { useConfig } from "../../hooks/useConfig";
import { TextProvider } from "../../types";
import {
  AVAILABLE_MODELS,
  DEYUNAI_BASE_URL,
  DEYUNAI_MODELS,
  PARTNER_TEXT_BASE_URL,
  QWEN_BASE_URL,
  QWEN_DEFAULT_MODEL,
} from "../../constants";
import * as GeminiService from "../../services/geminiService";
import * as DeyunAIService from "../../services/deyunaiService";
import * as QwenService from "../../services/qwenService";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const AgentSettingsPanel: React.FC<Props> = ({ isOpen, onClose }) => {
  const { config, setConfig } = useConfig("script2video_config_v1");
  const [isLoadingTextModels, setIsLoadingTextModels] = useState(false);
  const [textModelFetchMessage, setTextModelFetchMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [availableTextModels, setAvailableTextModels] = useState<string[]>([]);

  const [isLoadingDeyunModels, setIsLoadingDeyunModels] = useState(false);
  const [deyunModelFetchMessage, setDeyunModelFetchMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [availableDeyunModels, setAvailableDeyunModels] = useState<Array<{ id: string; label: string; meta?: any }>>([]);

  const [isLoadingQwenModels, setIsLoadingQwenModels] = useState(false);
  const [qwenModelFetchMessage, setQwenModelFetchMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [availableQwenModels, setAvailableQwenModels] = useState<string[]>([]);

  useEffect(() => {
    if (config.textConfig.provider === "deyunai" && Array.isArray(config.textConfig.deyunModels)) {
      const mapped = config.textConfig.deyunModels.map((m) => ({
        id: m.id,
        label: m.label || m.id,
        meta: m,
      }));
      setAvailableDeyunModels(mapped);
    } else {
      setAvailableDeyunModels([]);
    }
  }, [config.textConfig.deyunModels, config.textConfig.provider]);

  useEffect(() => {
    if (!config.textConfig.provider) {
      setConfig((prev) => ({
        ...prev,
        textConfig: { ...prev.textConfig, provider: "gemini" as TextProvider },
      }));
    }
  }, [config.textConfig.provider, setConfig]);

  const setProvider = (p: TextProvider) => {
    const nextConfig = { ...config.textConfig };
    if (p === "gemini") {
      nextConfig.baseUrl = "";
      nextConfig.model = "gemini-2.5-flash";
      nextConfig.deyunModels = [];
    } else if (p === "openrouter") {
      nextConfig.baseUrl = nextConfig.baseUrl || OPENROUTER_BASE_URL;
      nextConfig.model = nextConfig.model || "";
      nextConfig.deyunModels = [];
    } else if (p === "deyunai") {
      nextConfig.baseUrl = nextConfig.baseUrl || DEYUNAI_BASE_URL;
      nextConfig.model = nextConfig.model || "gpt-5.1";
      nextConfig.reasoningEffort = nextConfig.reasoningEffort || "medium";
      nextConfig.verbosity = nextConfig.verbosity || "medium";
      nextConfig.stream = false;
      nextConfig.store = nextConfig.store ?? false;
      nextConfig.deyunModels = [];
    } else if (p === "qwen") {
      nextConfig.baseUrl = QWEN_BASE_URL;
      nextConfig.model = nextConfig.model || QWEN_DEFAULT_MODEL;
      nextConfig.deyunModels = [];
    } else {
      nextConfig.baseUrl = PARTNER_TEXT_BASE_URL;
      nextConfig.model = "partner-text-pro";
      nextConfig.apiKey = "";
    }

    setConfig({
      ...config,
      textConfig: {
        ...nextConfig,
        provider: p,
      },
    });
  };

  const handleFetchTextModels = async () => {
    const envKey =
      (typeof import.meta !== "undefined"
        ? (import.meta.env.OPENROUTER_API_KEY || import.meta.env.VITE_OPENROUTER_API_KEY)
        : undefined) ||
      (typeof process !== "undefined"
        ? (process.env?.OPENROUTER_API_KEY || process.env?.VITE_OPENROUTER_API_KEY)
        : undefined);
    const apiKey = config.textConfig.apiKey || envKey;
    const baseUrl = config.textConfig.baseUrl || OPENROUTER_BASE_URL;
    if (!apiKey) {
      setTextModelFetchMessage({ type: "error", text: "未检测到 OpenRouter API Key 环境变量。" });
      return;
    }
    setIsLoadingTextModels(true);
    setTextModelFetchMessage(null);
    try {
      const models = await GeminiService.fetchTextModels(baseUrl, apiKey);
      if (models.length > 0) {
        setAvailableTextModels(models);
        setTextModelFetchMessage({ type: "success", text: `获取成功，${models.length} 个模型` });
      } else {
        setTextModelFetchMessage({ type: "success", text: "连接成功，但未返回模型列表" });
      }
    } catch (e: any) {
      setTextModelFetchMessage({ type: "error", text: e.message || "拉取失败" });
    } finally {
      setIsLoadingTextModels(false);
    }
  };

  const handleFetchDeyunModels = async () => {
    setIsLoadingDeyunModels(true);
    setDeyunModelFetchMessage(null);
    try {
      const models = await DeyunAIService.fetchModels({
        apiKey: config.textConfig.apiKey,
        baseUrl: config.textConfig.baseUrl,
      });
      const mapped = models.map((m) => ({
        id: m.id,
        label: `${m.id}${m.modalities?.length ? ` · ${m.modalities.join("/")}` : ""}${m.capabilities?.tools ? " · tools" : ""}`,
        meta: m,
      }));
      setAvailableDeyunModels(mapped);
      setConfig({
        ...config,
        textConfig: {
          ...config.textConfig,
          deyunModels: mapped.map((m) => ({
            id: m.id,
            label: m.label,
            modalities: m.meta?.modalities,
            capabilities: m.meta?.capabilities,
            description: m.meta?.description,
          })),
        },
      });
      const msg = mapped.length === 0 ? "获取成功，0 个模型" : `获取成功，${mapped.length} 个模型`;
      setDeyunModelFetchMessage({ type: "success", text: msg });
    } catch (e: any) {
      setDeyunModelFetchMessage({ type: "error", text: e.message || "拉取失败" });
    } finally {
      setIsLoadingDeyunModels(false);
    }
  };

  const handleFetchQwenModels = async () => {
    setIsLoadingQwenModels(true);
    setQwenModelFetchMessage(null);
    try {
      const models = await QwenService.fetchModels();
      const ids = models.map((m) => m.id);
      setAvailableQwenModels(ids);
      setQwenModelFetchMessage({
        type: "success",
        text: ids.length ? `获取成功，${ids.length} 个模型` : "获取成功，但返回为空",
      });
      if (ids.length && !ids.includes(config.textConfig.model)) {
        setConfig({
          ...config,
          textConfig: { ...config.textConfig, model: ids[0] },
        });
      }
    } catch (e: any) {
      setQwenModelFetchMessage({ type: "error", text: e.message || "拉取失败" });
    } finally {
      setIsLoadingQwenModels(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed bottom-20 left-4 z-50 w-[380px] max-w-[92vw] max-h-[70vh] rounded-2xl border border-white/10 bg-[#0b0d10]/95 text-white shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur flex flex-col pointer-events-auto">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500/30 via-fuchsia-500/10 to-transparent border border-white/10 flex items-center justify-center">
              <Sparkles size={16} className="text-violet-200" />
            </div>
            <div>
              <div className="text-sm font-semibold">Agent Settings</div>
              <div className="text-[11px] text-white/50">AI 路线与模型</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full border border-white/10 hover:border-white/30 hover:bg-white/5 transition"
            title="Close"
          >
            <ChevronDown size={14} className="mx-auto text-white/70" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-white/50 mb-2">Provider</div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "gemini" as TextProvider, label: "Gemini", Icon: Zap },
                { key: "qwen" as TextProvider, label: "Qwen", Icon: BrainCircuit },
                { key: "openrouter" as TextProvider, label: "OpenRouter", Icon: Globe },
                { key: "deyunai" as TextProvider, label: "DeyunAI", Icon: Sparkles },
                { key: "partner" as TextProvider, label: "Partner", Icon: Shield },
              ].map(({ key, label, Icon }) => {
                const active = config.textConfig.provider === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setProvider(key)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] uppercase tracking-wide border transition ${
                      active
                        ? "bg-white/10 border-white/40 text-white"
                        : "border-white/10 text-white/60 hover:border-white/30 hover:text-white"
                    }`}
                  >
                    <Icon size={12} className={active ? "text-white" : "text-white/60"} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {config.textConfig.provider === "gemini" && (
            <div className="rounded-2xl border border-white/10 bg-white/4 p-4 space-y-3">
              <div>
                <label className="block text-xs text-white/60 mb-2">Gemini Model</label>
                <select
                  value={config.textConfig.model}
                  onChange={(e) => setConfig({ ...config, textConfig: { ...config.textConfig, model: e.target.value } })}
                  className="w-full bg-[#0b0d10]/70 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-400 focus:outline-none"
                >
                  {AVAILABLE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-[11px] text-white/50">
                使用环境变量 GEMINI_API_KEY / VITE_GEMINI_API_KEY。
              </div>
            </div>
          )}

          {config.textConfig.provider === "openrouter" && (
            <div className="rounded-2xl border border-white/10 bg-white/4 p-4 space-y-3">
              <div>
                <div className="text-xs text-white/60 mb-1">API Endpoint</div>
                <div className="text-sm text-white/80">{config.textConfig.baseUrl || OPENROUTER_BASE_URL}</div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-white/60">Target Model</label>
                  <button
                    type="button"
                    onClick={handleFetchTextModels}
                    disabled={isLoadingTextModels}
                    className="text-[11px] flex items-center gap-1 text-sky-300 hover:text-sky-200 disabled:opacity-50"
                  >
                    {isLoadingTextModels ? <Loader2 size={12} className="animate-spin" /> : "拉取模型"}
                  </button>
                </div>
                {textModelFetchMessage && (
                  <div className={`text-[11px] mb-2 flex items-center gap-1 ${textModelFetchMessage.type === "error" ? "text-red-400" : "text-emerald-300"}`}>
                    {textModelFetchMessage.type === "error" ? <AlertCircle size={10} /> : <CheckCircle size={10} />}
                    {textModelFetchMessage.text}
                  </div>
                )}
                {availableTextModels.length > 0 ? (
                  <select
                    value={config.textConfig.model}
                    onChange={(e) => setConfig({ ...config, textConfig: { ...config.textConfig, model: e.target.value } })}
                    className="w-full bg-[#0b0d10]/70 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-400 focus:outline-none"
                  >
                    {availableTextModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="e.g. google/gemini-pro-1.5"
                    value={config.textConfig.model}
                    onChange={(e) => setConfig({ ...config, textConfig: { ...config.textConfig, model: e.target.value } })}
                    className="w-full bg-[#0b0d10]/70 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-400 focus:outline-none"
                  />
                )}
              </div>
              <div className="text-[11px] text-white/50">
                使用环境变量 OPENROUTER_API_KEY / VITE_OPENROUTER_API_KEY。
              </div>
            </div>
          )}

          {config.textConfig.provider === "qwen" && (
            <div className="rounded-2xl border border-white/10 bg-white/4 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-white/60">Aliyun Qwen</div>
                <button
                  type="button"
                  onClick={handleFetchQwenModels}
                  disabled={isLoadingQwenModels}
                  className="text-[11px] flex items-center gap-1 text-amber-300 hover:text-amber-200 disabled:opacity-50"
                >
                  {isLoadingQwenModels ? <Loader2 size={12} className="animate-spin" /> : "拉取模型"}
                </button>
              </div>
              {qwenModelFetchMessage && (
                <div className={`text-[11px] flex items-center gap-1 ${qwenModelFetchMessage.type === "error" ? "text-red-400" : "text-emerald-300"}`}>
                  {qwenModelFetchMessage.type === "error" ? <AlertCircle size={10} /> : <CheckCircle size={10} />}
                  {qwenModelFetchMessage.text}
                </div>
              )}
              <select
                value={config.textConfig.model || QWEN_DEFAULT_MODEL}
                onChange={(e) => setConfig({ ...config, textConfig: { ...config.textConfig, model: e.target.value } })}
                className="w-full bg-[#0b0d10]/70 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-amber-300 focus:outline-none"
              >
                {(availableQwenModels.length ? availableQwenModels : [QWEN_DEFAULT_MODEL]).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-white/50">
                使用环境变量 QWEN_API_KEY / VITE_QWEN_API_KEY。
              </div>
            </div>
          )}

          {config.textConfig.provider === "partner" && (
            <div className="rounded-2xl border border-white/10 bg-white/4 p-4 space-y-2">
              <div className="text-sm font-semibold text-white">合作专线</div>
              <div className="text-[11px] text-white/60">使用平台预置密钥与专属网关，无需配置。</div>
              <div className="text-[11px] text-white/50">Base URL: {PARTNER_TEXT_BASE_URL}</div>
            </div>
          )}

          {config.textConfig.provider === "deyunai" && (
            <div className="rounded-2xl border border-white/10 bg-white/4 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-white/60">模型</label>
                <button
                  type="button"
                  onClick={handleFetchDeyunModels}
                  disabled={isLoadingDeyunModels}
                  className="text-[11px] flex items-center gap-1 text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
                >
                  {isLoadingDeyunModels ? <Loader2 size={12} className="animate-spin" /> : "拉取模型"}
                </button>
              </div>
              {deyunModelFetchMessage && (
                <div className={`text-[11px] flex items-center gap-1 ${deyunModelFetchMessage.type === "error" ? "text-red-400" : "text-emerald-300"}`}>
                  {deyunModelFetchMessage.type === "error" ? <AlertCircle size={10} /> : <CheckCircle size={10} />}
                  {deyunModelFetchMessage.text}
                </div>
              )}
              <select
                value={config.textConfig.model || "gpt-5.1"}
                onChange={(e) => setConfig({ ...config, textConfig: { ...config.textConfig, model: e.target.value } })}
                className="w-full bg-[#0b0d10]/70 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-300 focus:outline-none"
              >
                {(availableDeyunModels.length ? availableDeyunModels : DEYUNAI_MODELS.map((m) => ({ id: m, label: m }))).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-white/60 mb-1">思考强度</label>
                  <select
                    value={config.textConfig.reasoningEffort || "medium"}
                    onChange={(e) => setConfig({ ...config, textConfig: { ...config.textConfig, reasoningEffort: e.target.value as any } })}
                    className="w-full bg-[#0b0d10]/70 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-300 focus:outline-none"
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-white/60 mb-1">输出详尽度</label>
                  <select
                    value={config.textConfig.verbosity || "medium"}
                    onChange={(e) => setConfig({ ...config, textConfig: { ...config.textConfig, verbosity: e.target.value as any } })}
                    className="w-full bg-[#0b0d10]/70 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-300 focus:outline-none"
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-white/60">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!config.textConfig.stream}
                    onChange={(e) => setConfig({ ...config, textConfig: { ...config.textConfig, stream: e.target.checked } })}
                    className="h-4 w-4 text-emerald-400 border-white/20 rounded bg-[#0b0d10]/70"
                  />
                  流式返回
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!config.textConfig.store}
                    onChange={(e) => setConfig({ ...config, textConfig: { ...config.textConfig, store: e.target.checked } })}
                    className="h-4 w-4 text-emerald-400 border-white/20 rounded bg-[#0b0d10]/70"
                  />
                  结果存储
                </label>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/3 p-3 space-y-2 text-[11px] text-white/70">
                <div className="text-[11px] font-semibold text-white">常用工具</div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Array.isArray(config.textConfig.tools) && config.textConfig.tools.some((t: any) => t?.type === "web_search_preview")}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      const existingTools = Array.isArray(config.textConfig.tools)
                        ? config.textConfig.tools.filter((t: any) => t?.type !== "web_search_preview")
                        : [];
                      const nextTools = enabled ? [...existingTools, { type: "web_search_preview" }] : existingTools;
                      setConfig({ ...config, textConfig: { ...config.textConfig, tools: nextTools } });
                    }}
                    className="h-4 w-4 text-emerald-400 border-white/20 rounded bg-[#0b0d10]/70"
                  />
                  启用网络搜索工具（web_search_preview）
                </label>
              </div>
              <div className="text-[11px] text-white/50">
                使用环境变量 DEYUNAI_API_KEY / VITE_DEYUNAI_API_KEY。
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
