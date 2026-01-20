import React, { useEffect, useMemo, useState } from "react";
import {
  AudioLines,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Code2,
  Eye,
  Globe,
  Layers,
  Loader2,
  Shield,
  Sparkles,
  Video,
  X,
  Zap,
} from "lucide-react";
import { useConfig } from "../../hooks/useConfig";
import { TextProvider } from "../../types";
import {
  AVAILABLE_MODELS,
  DEYUNAI_BASE_URL,
  DEYUNAI_MODELS,
  PARTNER_TEXT_BASE_URL,
  QWEN_CHAT_COMPLETIONS_ENDPOINT,
  QWEN_DEFAULT_MODEL,
  QWEN_WAN_IMAGE_MODEL,
  QWEN_WAN_VIDEO_MODEL,
} from "../../constants";
import * as GeminiService from "../../services/geminiService";
import * as DeyunAIService from "../../services/deyunaiService";
import * as QwenService from "../../services/qwenService";
import type { QwenModel } from "../../services/qwenService";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const QwenIcon: React.FC<{ size?: number; className?: string }> = ({ size = 12, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="7.5" />
    <path d="M16.5 16.5l4 4" />
  </svg>
);

const normalizeModalities = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).toLowerCase());
  if (typeof value === "string") return value.split(/[,/ ]+/).map((v) => v.trim().toLowerCase()).filter(Boolean);
  return [];
};

const getModalities = (model: QwenModel) => {
  const input =
    normalizeModalities(model.modalities) ||
    normalizeModalities(model.capabilities?.modalities) ||
    normalizeModalities((model as any).input_modalities) ||
    normalizeModalities((model as any).architecture?.input_modalities);
  const output =
    normalizeModalities((model as any).output_modalities) ||
    normalizeModalities((model as any).architecture?.output_modalities);
  return { input, output };
};

const getQwenCategory = (model: QwenModel) => {
  const id = model.id.toLowerCase();
  if (id.includes("video") || id.includes("t2v") || id.includes("i2v") || id.includes("v2v")) {
    return { key: "video", label: "Video", Icon: Video, tone: "text-cyan-300 bg-cyan-500/10 border-cyan-400/30" };
  }
  if (id.includes("image") || id.includes("z-image")) {
    return { key: "image", label: "Image", Icon: Eye, tone: "text-sky-300 bg-sky-500/10 border-sky-400/30" };
  }
  if (id.includes("vl")) {
    return { key: "vision", label: "Vision", Icon: Eye, tone: "text-sky-300 bg-sky-500/10 border-sky-400/30" };
  }
  if (id.includes("tts") || id.includes("audio") || id.includes("speech")) {
    return { key: "audio", label: "Audio", Icon: AudioLines, tone: "text-pink-300 bg-pink-500/10 border-pink-400/30" };
  }
  if (id.includes("coder") || id.includes("code")) {
    return { key: "code", label: "Code", Icon: Code2, tone: "text-amber-300 bg-amber-500/10 border-amber-400/30" };
  }
  if (id.includes("embed")) {
    return { key: "embedding", label: "Embedding", Icon: Layers, tone: "text-emerald-300 bg-emerald-500/10 border-emerald-400/30" };
  }
  if (id.includes("rerank")) {
    return { key: "rerank", label: "Rerank", Icon: Layers, tone: "text-indigo-300 bg-indigo-500/10 border-indigo-400/30" };
  }
  return { key: "chat", label: "Chat", Icon: Sparkles, tone: "text-violet-300 bg-violet-500/10 border-violet-400/30" };
};

const getQwenTags = (model: QwenModel) => {
  const tags: string[] = [];
  const { input, output } = getModalities(model);
  if (input.length) tags.push(`in:${input.join("/")}`);
  if (output.length) tags.push(`out:${output.join("/")}`);
  const contextLength = model.context_length || model.contextLength || model.max_context_length || model.maxTokens;
  if (typeof contextLength === "number") {
    tags.push(`ctx:${contextLength}`);
  }
  const tools = model.capabilities?.tools || (model as any).supports_tools || (model as any).tool_calls;
  if (tools) tags.push("tools");
  const reasoning = model.capabilities?.reasoning || (model as any).supports_reasoning || (model as any).reasoning;
  if (reasoning) tags.push("reasoning");
  return tags.slice(0, 4);
};

const formatEpochDate = (value?: number) => {
  if (!value) return null;
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
};

export const AgentSettingsPanel: React.FC<Props> = ({ isOpen, onClose }) => {
  const { config, setConfig } = useConfig("script2video_config_v1");
  const [activeType, setActiveType] = useState<"chat" | "multi" | "video">("chat");
  const [isLoadingTextModels, setIsLoadingTextModels] = useState(false);
  const [textModelFetchMessage, setTextModelFetchMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [availableTextModels, setAvailableTextModels] = useState<string[]>([]);

  const [isLoadingDeyunModels, setIsLoadingDeyunModels] = useState(false);
  const [deyunModelFetchMessage, setDeyunModelFetchMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [availableDeyunModels, setAvailableDeyunModels] = useState<Array<{ id: string; label: string; meta?: any }>>([]);

  const [isLoadingQwenChatModels, setIsLoadingQwenChatModels] = useState(false);
  const [qwenChatFetchMessage, setQwenChatFetchMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [qwenChatModels, setQwenChatModels] = useState<QwenModel[]>([]);
  const [qwenModelsRaw, setQwenModelsRaw] = useState<string>("");
  const [showQwenRaw, setShowQwenRaw] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const qwenGroups = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; Icon: React.ComponentType<{ size?: number }>; tone: string; items: QwenModel[] }>();
    qwenChatModels.forEach((model) => {
      const category = getQwenCategory(model);
      if (!groups.has(category.key)) {
        groups.set(category.key, { ...category, items: [] });
      }
      groups.get(category.key)!.items.push(model);
    });
    const order = ["chat", "code", "image", "video", "vision", "audio", "embedding", "rerank"];
    return Array.from(groups.values()).sort((a, b) => {
      const ai = order.indexOf(a.key);
      const bi = order.indexOf(b.key);
      if (ai === -1 && bi === -1) return a.label.localeCompare(b.label);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [qwenChatModels]);

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
      nextConfig.baseUrl = "";
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
    setIsLoadingQwenChatModels(true);
    setQwenChatFetchMessage(null);
    try {
      const { models, raw } = await QwenService.fetchModels(QWEN_CHAT_COMPLETIONS_ENDPOINT, "GET");
      setQwenChatModels(models);
      setQwenModelsRaw(JSON.stringify(raw, null, 2));
      setQwenChatFetchMessage({
        type: "success",
        text: models.length ? `获取成功，${models.length} 个模型` : "获取成功，但返回为空",
      });
      if (models.length && !models.find((m) => m.id === config.textConfig.model)) {
        setConfig((prev) => ({
          ...prev,
          textConfig: { ...prev.textConfig, model: models[0].id },
        }));
      }
    } catch (e: any) {
      setQwenChatFetchMessage({ type: "error", text: e.message || "拉取失败" });
      setQwenModelsRaw("");
    } finally {
      setIsLoadingQwenChatModels(false);
    }
  };

  const renderQwenModelCard = (model: QwenModel, isActive: boolean, onSelect: () => void) => {
    const category = getQwenCategory(model);
    const tags = getQwenTags(model);
    const description = model.description || (model as any).summary || (model as any).display_name || "";
    const owner = model.owned_by || (model as any).provider || (model as any).vendor;
    const createdAt = formatEpochDate((model as any).created);
    return (
      <button
        key={model.id}
        type="button"
        onClick={onSelect}
        className={`text-left rounded-2xl border bg-[var(--app-panel-muted)] p-3 space-y-2 transition ${
          isActive ? "border-amber-300/60 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]" : "border-[var(--app-border)] hover:border-[var(--app-border-strong)]"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-[var(--app-text-primary)]">{model.id}</div>
          <span className={`text-[10px] px-2 py-1 rounded-full border ${category.tone} flex items-center gap-1`}>
            <category.Icon size={10} />
            {category.label}
          </span>
        </div>
        {description && (
          <div className="text-[11px] text-[var(--app-text-secondary)] line-clamp-2">{description}</div>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={`${model.id}-${tag}`}
                className="px-2 py-0.5 rounded-full border border-[var(--app-border)] text-[10px] text-[var(--app-text-secondary)]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {(owner || createdAt) && (
          <div className="text-[10px] text-[var(--app-text-muted)] flex flex-wrap gap-2">
            {owner && <span>owner: {owner}</span>}
            {createdAt && <span>created: {createdAt}</span>}
          </div>
        )}
      </button>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-[960px] max-w-[96vw] max-h-[85vh] rounded-2xl app-panel flex flex-col pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--app-border)]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-violet-500/30 via-fuchsia-500/10 to-transparent border border-[var(--app-border)] flex items-center justify-center">
              <Sparkles size={16} className="text-violet-200" />
            </div>
            <div>
              <div className="text-sm font-semibold">Agent Settings</div>
              <div className="text-[11px] app-text-muted">AI 路线与模型</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full border border-[var(--app-border)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-muted)] transition"
            title="Close"
          >
            <X size={14} className="mx-auto text-[var(--app-text-secondary)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4 space-y-3">
                <div className="text-[11px] uppercase tracking-widest app-text-muted">Type</div>
                <div className="flex flex-col gap-2">
                  {[
                    { key: "chat", label: "Chat", Icon: Sparkles },
                    { key: "multi", label: "Multi", Icon: Eye },
                    { key: "video", label: "Video", Icon: Video },
                  ].map(({ key, label, Icon }) => {
                    const active = activeType === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveType(key)}
                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[12px] border transition ${
                          active
                            ? "bg-[var(--app-panel-soft)] border-[var(--app-border-strong)] text-[var(--app-text-primary)]"
                            : "border-[var(--app-border)] text-[var(--app-text-secondary)] hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-primary)]"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Icon size={14} className={active ? "text-[var(--app-text-primary)]" : "text-[var(--app-text-secondary)]"} />
                          {label}
                        </span>
                        {active && <span className="text-[10px] text-emerald-400">Active</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4 space-y-3">
                <div className="text-[11px] uppercase tracking-widest app-text-muted">Agents</div>
                <div className="flex flex-wrap gap-2">
                  {["主Agent · 制片人", "导演", "分镜导演", "美术设计", "指令师"].map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full border border-[var(--app-border)] text-[11px] text-[var(--app-text-secondary)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="text-[11px] app-text-muted">规划中，敬请期待。</div>
              </div>

              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4 space-y-3">
                <div className="text-[11px] uppercase tracking-widest app-text-muted">Tools</div>
                <div className="flex flex-wrap gap-2">
                  {["tool1", "tool2", "tool3"].map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full border border-[var(--app-border)] text-[11px] text-[var(--app-text-secondary)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="text-[11px] app-text-muted">规划中。</div>
              </div>
            </div>

            <div className="space-y-4">
              {activeType === "chat" && (
                <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4 space-y-3">
                  <div className="text-[11px] uppercase tracking-widest app-text-muted">Chat Providers</div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "gemini" as TextProvider, label: "Gemini", Icon: Zap },
                      { key: "qwen" as TextProvider, label: "Qwen", Icon: QwenIcon },
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
                          className={`flex items-center gap-2 px-3 py-2 rounded-full text-[11px] border transition ${
                            active
                              ? "bg-[var(--app-panel-soft)] border-[var(--app-border-strong)] text-[var(--app-text-primary)]"
                              : "border-[var(--app-border)] text-[var(--app-text-secondary)] hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-primary)]"
                          }`}
                        >
                          <Icon size={12} className={active ? "text-[var(--app-text-primary)]" : "text-[var(--app-text-secondary)]"} />
                          {label}
                          {active && <span className="ml-1 text-[10px] text-emerald-400">Active</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

          {activeType === "chat" && config.textConfig.provider === "gemini" && (
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4 space-y-3">
              <div>
                <label className="block text-xs text-[var(--app-text-secondary)] mb-2">Gemini Model</label>
                <select
                  value={config.textConfig.model}
                  onChange={(e) => setConfig({ ...config, textConfig: { ...config.textConfig, model: e.target.value } })}
                  className="w-full bg-[var(--app-panel-muted)] border border-[var(--app-border)] rounded-xl px-3 py-2 text-sm text-[var(--app-text-primary)] focus:ring-2 focus:ring-sky-400 focus:outline-none"
                >
                  {AVAILABLE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-[11px] text-[var(--app-text-muted)]">
                使用环境变量 GEMINI_API_KEY / VITE_GEMINI_API_KEY。
              </div>
            </div>
          )}

          {activeType === "chat" && config.textConfig.provider === "openrouter" && (
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4 space-y-3">
              <div>
                <div className="text-xs text-[var(--app-text-secondary)] mb-1">API Endpoint</div>
                <div className="text-sm text-[var(--app-text-secondary)]">{config.textConfig.baseUrl || OPENROUTER_BASE_URL}</div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-[var(--app-text-secondary)]">Target Model</label>
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
                    className="w-full bg-[var(--app-panel-muted)] border border-[var(--app-border)] rounded-xl px-3 py-2 text-sm text-[var(--app-text-primary)] focus:ring-2 focus:ring-sky-400 focus:outline-none"
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
                    className="w-full bg-[var(--app-panel-muted)] border border-[var(--app-border)] rounded-xl px-3 py-2 text-sm text-[var(--app-text-primary)] focus:ring-2 focus:ring-sky-400 focus:outline-none"
                  />
                )}
              </div>
              <div className="text-[11px] text-[var(--app-text-muted)]">
                使用环境变量 OPENROUTER_API_KEY / VITE_OPENROUTER_API_KEY。
              </div>
            </div>
          )}

          {activeType === "chat" && config.textConfig.provider === "qwen" && (
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-[var(--app-text-secondary)]">Aliyun Qwen</div>
              </div>
              <div className="text-[11px] text-[var(--app-text-muted)]">
                使用环境变量 QWEN_API_KEY / VITE_QWEN_API_KEY。
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] uppercase tracking-widest text-[var(--app-text-muted)]">
                      chat · {qwenChatModels.length}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleFetchQwenModels}
                        disabled={isLoadingQwenChatModels}
                        className="text-[11px] flex items-center gap-1 text-amber-300 hover:text-amber-200 disabled:opacity-50"
                      >
                        {isLoadingQwenChatModels ? <Loader2 size={12} className="animate-spin" /> : "拉取模型"}
                      </button>
                      {qwenModelsRaw && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(qwenModelsRaw);
                            } catch {
                              // Ignore clipboard failures.
                            }
                          }}
                          className="text-[11px] flex items-center gap-1 text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
                        >
                          复制原始返回
                        </button>
                      )}
                    </div>
                  </div>
                  {qwenChatFetchMessage && (
                    <div className={`text-[11px] flex items-center gap-1 ${qwenChatFetchMessage.type === "error" ? "text-red-400" : "text-emerald-300"}`}>
                      {qwenChatFetchMessage.type === "error" ? <AlertCircle size={10} /> : <CheckCircle size={10} />}
                      {qwenChatFetchMessage.text}
                    </div>
                  )}
                  <select
                    value={config.textConfig.model || QWEN_DEFAULT_MODEL}
                    onChange={(e) => setConfig({ ...config, textConfig: { ...config.textConfig, model: e.target.value } })}
                    className="w-full bg-[var(--app-panel-muted)] border border-[var(--app-border)] rounded-xl px-3 py-2 text-sm text-[var(--app-text-primary)] focus:ring-2 focus:ring-amber-300 focus:outline-none"
                  >
                    {(qwenChatModels.length ? qwenChatModels : [{ id: QWEN_DEFAULT_MODEL }]).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id}
                      </option>
                    ))}
                  </select>
                  <div className="pt-2 border-t border-[var(--app-border)]">
                    <div className="text-[11px] uppercase tracking-widest text-[var(--app-text-muted)] mb-2">Models</div>
                    {qwenChatModels.length === 0 ? (
                      <div className="text-[12px] text-[var(--app-text-muted)]">暂无模型信息，请先拉取。</div>
                    ) : (
                      <div className="space-y-4">
                        {qwenGroups.map((group) => {
                          const isCollapsed = collapsedGroups[group.key] ?? false;
                          return (
                            <div key={group.key} className="space-y-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setCollapsedGroups((prev) => ({ ...prev, [group.key]: !isCollapsed }))
                                }
                                className="w-full flex items-center justify-between text-[11px] uppercase tracking-widest text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)]"
                              >
                                <span className="flex items-center gap-2">
                                  <group.Icon size={12} />
                                  {group.label} · {group.items.length}
                                </span>
                                <ChevronDown size={12} className={`transition ${isCollapsed ? "-rotate-90" : "rotate-0"}`} />
                              </button>
                              {!isCollapsed && (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                  {group.items.map((model) =>
                                    renderQwenModelCard(model, config.textConfig.model === model.id, () =>
                                      setConfig({ ...config, textConfig: { ...config.textConfig, model: model.id } })
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {qwenModelsRaw && (
                      <div className="pt-3">
                        <button
                          type="button"
                          onClick={() => setShowQwenRaw((prev) => !prev)}
                          className="text-[11px] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
                        >
                          {showQwenRaw ? "隐藏原始返回" : "查看原始返回"}
                        </button>
                        {showQwenRaw && (
                          <pre className="mt-2 max-h-56 overflow-auto rounded-xl border border-[var(--app-border)] bg-black/30 p-3 text-[10px] text-[var(--app-text-secondary)] whitespace-pre-wrap">
                            {qwenModelsRaw}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] uppercase tracking-widest text-[var(--app-text-muted)]">
                      multimodal-generation · 1
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] px-3 py-3 text-[12px] text-[var(--app-text-secondary)]">
                    固定模型：<span className="text-[var(--app-text-primary)] font-semibold">{QWEN_WAN_IMAGE_MODEL}</span>
                  </div>
                  <div className="text-[11px] text-[var(--app-text-muted)]">用于 WAN Image 节点，端口已固定。</div>
                </div>

                <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-[var(--app-text-muted)]">
                      <Video size={12} />
                      video-generation · 1
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] px-3 py-3 text-[12px] text-[var(--app-text-secondary)]">
                    固定模型：<span className="text-[var(--app-text-primary)] font-semibold">{QWEN_WAN_VIDEO_MODEL}</span>
                  </div>
                  <div className="text-[11px] text-[var(--app-text-muted)]">用于 WAN Video 节点，端口已固定。</div>
                </div>
              </div>
            </div>
          )}

          {activeType === "chat" && config.textConfig.provider === "partner" && (
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4 space-y-2">
              <div className="text-sm font-semibold text-[var(--app-text-primary)]">合作专线</div>
              <div className="text-[11px] text-[var(--app-text-secondary)]">使用平台预置密钥与专属网关，无需配置。</div>
              <div className="text-[11px] text-[var(--app-text-muted)]">Base URL: {PARTNER_TEXT_BASE_URL}</div>
            </div>
          )}

          {activeType === "chat" && config.textConfig.provider === "deyunai" && (
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-[var(--app-text-secondary)]">模型</label>
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
                className="w-full bg-[var(--app-panel-muted)] border border-[var(--app-border)] rounded-xl px-3 py-2 text-sm text-[var(--app-text-primary)] focus:ring-2 focus:ring-emerald-300 focus:outline-none"
              >
                {(availableDeyunModels.length ? availableDeyunModels : DEYUNAI_MODELS.map((m) => ({ id: m, label: m }))).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[var(--app-text-secondary)] mb-1">思考强度</label>
                  <select
                    value={config.textConfig.reasoningEffort || "medium"}
                    onChange={(e) => setConfig({ ...config, textConfig: { ...config.textConfig, reasoningEffort: e.target.value as any } })}
                    className="w-full bg-[var(--app-panel-muted)] border border-[var(--app-border)] rounded-xl px-3 py-2 text-sm text-[var(--app-text-primary)] focus:ring-2 focus:ring-emerald-300 focus:outline-none"
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--app-text-secondary)] mb-1">输出详尽度</label>
                  <select
                    value={config.textConfig.verbosity || "medium"}
                    onChange={(e) => setConfig({ ...config, textConfig: { ...config.textConfig, verbosity: e.target.value as any } })}
                    className="w-full bg-[var(--app-panel-muted)] border border-[var(--app-border)] rounded-xl px-3 py-2 text-sm text-[var(--app-text-primary)] focus:ring-2 focus:ring-emerald-300 focus:outline-none"
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-[var(--app-text-secondary)]">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!config.textConfig.stream}
                    onChange={(e) => setConfig({ ...config, textConfig: { ...config.textConfig, stream: e.target.checked } })}
                    className="h-4 w-4 text-emerald-400 border-[var(--app-border)] rounded bg-[var(--app-panel-muted)]"
                  />
                  流式返回
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!config.textConfig.store}
                    onChange={(e) => setConfig({ ...config, textConfig: { ...config.textConfig, store: e.target.checked } })}
                    className="h-4 w-4 text-emerald-400 border-[var(--app-border)] rounded bg-[var(--app-panel-muted)]"
                  />
                  结果存储
                </label>
              </div>
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-3 space-y-2 text-[11px] text-[var(--app-text-secondary)]">
                <div className="text-[11px] font-semibold text-[var(--app-text-primary)]">常用工具</div>
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
                    className="h-4 w-4 text-emerald-400 border-[var(--app-border)] rounded bg-[var(--app-panel-muted)]"
                  />
                  启用网络搜索工具（web_search_preview）
                </label>
              </div>
              <div className="text-[11px] text-[var(--app-text-muted)]">
                使用环境变量 DEYUNAI_API_KEY / VITE_DEYUNAI_API_KEY。
              </div>
            </div>
          )}

          {activeType !== "chat" && (
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4 space-y-2">
              <div className="text-sm font-semibold text-[var(--app-text-primary)]">即将上线</div>
              <div className="text-[11px] text-[var(--app-text-secondary)]">
                {activeType === "multi" ? "Multimodal 路线正在规划中。" : "Video 路线正在规划中。"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
</div>
  );
};
