import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, ChevronUp, ChevronDown, Plus, ArrowUp, Image as ImageIcon, Lightbulb, Sparkles, CircleHelp, ChevronDown as CaretDown } from "lucide-react";
import * as GeminiService from "../../services/geminiService";
import { useConfig } from "../../hooks/useConfig";
import { ProjectData } from "../../types";
import { AVAILABLE_MODELS, DEYUNAI_MODELS } from "../../constants";

type Props = {
  projectData: ProjectData;
  onOpenStats?: () => void;
};

type Message = { role: "user" | "assistant"; text: string };

const buildContext = (projectData: ProjectData, selected: Record<string, boolean>) => {
  const parts: string[] = [];
  if (selected.script && projectData.rawScript) parts.push(`[Script]\n${projectData.rawScript.slice(0, 6000)}`);
  if (selected.style && projectData.globalStyleGuide) parts.push(`[Style Guide]\n${projectData.globalStyleGuide.slice(0, 2000)}`);
  if (selected.guides && projectData.shotGuide) parts.push(`[Shot Guide]\n${projectData.shotGuide.slice(0, 2000)}`);
  if (selected.guides && projectData.soraGuide) parts.push(`[Sora Guide]\n${projectData.soraGuide.slice(0, 2000)}`);
  if (selected.guides && projectData.dramaGuide) parts.push(`[Drama Guide]\n${projectData.dramaGuide.slice(0, 2000)}`);
  if (selected.summary && projectData.context?.projectSummary) parts.push(`[Project Summary]\n${projectData.context.projectSummary.slice(0, 2000)}`);
  return parts.join("\n\n");
};

export const QalamAgent: React.FC<Props> = ({ projectData, onOpenStats }) => {
  const { config, setConfig } = useConfig("script2video_config_v1");
  const [collapsed, setCollapsed] = useState(true);
  const [mood, setMood] = useState<"default" | "thinking" | "loading" | "playful" | "question">("default");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [ctxSelection, setCtxSelection] = useState({
    script: true,
    style: true,
    guides: false,
    summary: false,
  });
  const [mode, setMode] = useState<"creative" | "precise" | "fun">("creative");
  const [attachments, setAttachments] = useState<{ name: string; url: string; size: number; type: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentUrlsRef = useRef<string[]>([]);

  const canSend = input.trim().length > 0 && !isSending;
  const contextText = useMemo(() => {
    const base = buildContext(projectData, ctxSelection);
    const attachText =
      attachments.length > 0
        ? `\n[Images]\n${attachments
            .map(
              (item, i) => `#${i + 1}: ${item.name} (${item.type}, ${(item.size / 1024).toFixed(1)} KB)`
            )
            .join("\n")}`
        : "";
    const modeHint =
      mode === "creative"
        ? "\n[Mode] 更有创意，主动补充灵感。"
        : mode === "precise"
        ? "\n[Mode] 更精准实干，直接输出可用方案。"
        : "\n[Mode] 风趣幽默，轻松交流。";
    return `${base}${attachText}${modeHint}`;
  }, [projectData, ctxSelection, attachments, mode]);

  const sendMessage = async () => {
    if (!canSend) return;
    setMood("loading");
    const userMsg: Message = { role: "user", text: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);
    const useStream = config.textConfig.provider === "deyunai" && config.textConfig.stream;
    let assistantIndex = -1;
    try {
      const prompt = `${contextText ? contextText + "\n\n" : ""}${userMsg.text}\n\n请直接回答问题，简洁输出。`;
      if (useStream) {
        setMessages((prev) => {
          assistantIndex = prev.length;
          return [...prev, { role: "assistant", text: "" }];
        });
      }
      const res = await GeminiService.generateFreeformText(
        config.textConfig,
        prompt,
        "You are Qalam, a creative agent helping build this project. Keep responses concise.",
        useStream
          ? {
              onStream: (delta) => {
                setMessages((prev) => {
                  if (assistantIndex === -1) assistantIndex = prev.length - 1;
                  return prev.map((m, idx) => (idx === assistantIndex ? { ...m, text: (m.text || "") + delta } : m));
                });
              },
            }
          : undefined
      );
      try {
        console.log("[Agent] Raw response", res);
      } catch {}
      if (useStream && assistantIndex !== -1) {
        setMessages((prev) => prev.map((m, idx) => (idx === assistantIndex ? { ...m, text: res.outputText || m.text } : m)));
      } else {
        setMessages((prev) => [...prev, { role: "assistant", text: res.outputText || "" }]);
      }
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: "assistant", text: `请求失败: ${err?.message || err}` }]);
    } finally {
      setIsSending(false);
      setMood("thinking");
    }
  };

  const moodVisual = () => {
    if (isSending || mood === "loading") {
      return { icon: <Loader2 size={16} className="animate-spin text-sky-300" />, bg: "bg-sky-500/20", ring: "ring-sky-300/30" };
    }
    switch (mood) {
      case "thinking":
        return { icon: <Lightbulb size={16} className="text-amber-300" />, bg: "bg-amber-500/15", ring: "ring-amber-300/30" };
      case "playful":
        return { icon: <Sparkles size={16} className="text-pink-300" />, bg: "bg-pink-500/15", ring: "ring-pink-300/30" };
      case "question":
        return { icon: <CircleHelp size={16} className="text-purple-300" />, bg: "bg-purple-500/15", ring: "ring-purple-300/30" };
      default:
        return { icon: <Bot size={16} className="text-emerald-300" />, bg: "bg-emerald-500/15", ring: "ring-emerald-300/30" };
    }
  };
  const moodState = moodVisual();

  const tokenUsage = useMemo(() => {
    const sumPhase = (obj: any) =>
      Object.values(obj || {}).reduce((acc: number, item: any) => acc + (item?.totalTokens || 0), 0);
    return (
      (projectData.contextUsage?.totalTokens || 0) +
      sumPhase(projectData.phase1Usage) +
      (projectData.phase4Usage?.totalTokens || 0) +
      (projectData.phase5Usage?.totalTokens || 0)
    );
  }, [projectData]);

  const formatNumber = (n: number) => n.toLocaleString();
  const providerModelOptions = useMemo(() => {
    if (config.textConfig?.provider === "deyunai") {
      const remote = (config.textConfig.deyunModels || []).map((m) => ({ id: m.id, name: m.label || m.id }));
      const fallback = DEYUNAI_MODELS.map((id) => ({ id, name: id }));
      const merged: { id: string; name: string }[] = [];
      [...remote, ...fallback].forEach((item) => {
        if (!merged.find((m) => m.id === item.id)) merged.push(item);
      });
      return merged;
    }
    if (config.textConfig?.provider === "gemini") {
      return AVAILABLE_MODELS.slice().sort((a, b) => a.name.localeCompare(b.name));
    }
    // OpenRouter/Partner: no preset list, keep current value as sole option
    const currentId = config.textConfig?.model || "custom";
    return [{ id: currentId, name: currentId }];
  }, [config.textConfig?.provider, config.textConfig?.model, config.textConfig?.deyunModels]);

  const modelValue = useMemo(() => {
    const ids = providerModelOptions.map((m) => m.id);
    if (config.textConfig?.model && ids.includes(config.textConfig.model)) return config.textConfig.model;
    return providerModelOptions[0]?.id || config.textConfig?.model || "";
  }, [providerModelOptions, config.textConfig?.model]);

  const currentModelLabel =
    providerModelOptions.find((m) => m.id === modelValue)?.name ||
    modelValue ||
    "model";

  useEffect(() => {
    if (isSending) return;
    const order: Array<typeof mood> = ["default", "thinking", "playful", "question"];
    const timer = setInterval(() => {
      setMood((prev) => {
        const next = order[(order.indexOf(prev) + 1) % order.length];
        return next;
      });
    }, 6000);
    return () => clearInterval(timer);
  }, [isSending]);

  const handleUploadClick = () => fileInputRef.current?.click();
  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const images = Array.from(files).filter((file) => file.type?.startsWith("image/"));
    if (images.length === 0) {
      setMessages((prev) => [...prev, { role: "assistant", text: "仅支持图片文件作为上下文附件。" }]);
      return;
    }
    const mapped = images.map((file) => {
      const url = URL.createObjectURL(file);
      attachmentUrlsRef.current.push(url);
      return {
        name: file.name,
        url,
        size: file.size,
        type: file.type || "image/*",
      };
    });
    setAttachments((prev) => [...prev, ...mapped].slice(-5)); // 最多保留 5 个
  };

  useEffect(() => {
    return () => {
      attachmentUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-2 h-10 px-3 rounded-full border border-white/10 bg-[#0d0f12]/90 text-white shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur transition-all duration-300 ease-out"
      >
        <span className={`flex items-center justify-center h-7 w-7 rounded-full ${moodState.bg} transition-all duration-300 ease-out`}>
          {moodState.icon}
        </span>
        <span className="text-xs font-semibold">Qalam</span>
        <ChevronUp size={14} className="text-white/60" />
      </button>
    );
  }

  // Safe spacing: use symmetric top/bottom gaps equal to the bottom offset (16px).
  return (
    <div className="pointer-events-auto w-[400px] max-w-[95vw] h-[calc(100vh-32px)] max-h-[calc(100vh-32px)] rounded-2xl border border-white/10 bg-[#0b0d10]/95 text-white shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur flex flex-col overflow-hidden qalam-panel">
      <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500/30 via-emerald-500/10 to-transparent border border-white/10 flex items-center justify-center">
            <Bot size={16} className="text-emerald-200" />
          </div>
          <div className="space-y-0.5">
            <div className="text-sm font-semibold">Qalam</div>
            <button
              type="button"
              onClick={onOpenStats}
              className="text-[11px] text-white/60 hover:text-white/90 underline decoration-dashed decoration-white/40 transition"
              title="查看 Dashboard"
            >
              Tokens · {formatNumber(tokenUsage)}
            </button>
          </div>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="h-8 w-8 rounded-full border border-white/10 hover:border-white/30 hover:bg-white/5 transition"
          title="Collapse"
        >
          <ChevronDown size={14} className="mx-auto text-white/70" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m, idx) => {
          const isUser = m.role === "user";
          return (
            <div key={idx} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed border shadow-sm ${
                  isUser
                    ? "bg-white text-black border-white/80"
                    : "bg-white/6 border-white/15 text-white"
                }`}
              >
                {m.text}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "script", label: "剧本" },
            { key: "style", label: "Style Guide" },
            { key: "guides", label: "Guides" },
            { key: "summary", label: "Summary" },
          ].map((item) => {
            const active = (ctxSelection as any)[item.key];
            return (
              <button
                key={item.key}
                onClick={() => setCtxSelection((s) => ({ ...s, [item.key]: !active }))}
                className={`px-3 py-1.5 rounded-full text-[11px] border transition ${
                  active ? "bg-white/10 border-white/40 text-white" : "border-white/10 text-white/60 hover:border-white/30 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="rounded-2xl bg-white/10 border border-white/15 px-3 py-3 space-y-3">
          <textarea
            className="w-full bg-transparent text-[13px] text-white placeholder:text-white/70 resize-none focus:outline-none"
            rows={3}
            placeholder="向 Qalam 提问，@ 提及角色形态，/ 选择指令..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <div className="flex items-center gap-2 text-[12px] text-white/80">
            <button
              onClick={handleUploadClick}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:border-white/25 hover:bg-white/10 transition"
              title="上传图片作为上下文"
            >
              <Plus size={14} />
            </button>
            <div className="relative h-8 px-3 rounded-full bg-white/5 border border-white/10 hover:border-white/25 hover:bg-white/10 transition flex items-center gap-2 min-w-[140px]">
              <span className="truncate text-white/85">{currentModelLabel}</span>
              <CaretDown size={12} className="text-white/50 pointer-events-none" />
              <select
                aria-label="选择模型"
                value={modelValue}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    textConfig: { ...prev.textConfig, model: e.target.value }
                  }))
                }
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              >
                {[...providerModelOptions, { id: config.textConfig?.model || "custom", name: config.textConfig?.model || "custom" }].reduce((acc: any[], item) => {
                  if (!acc.find((x) => x.id === item.id)) acc.push(item);
                  return acc;
                }, []).map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#0b0d10] text-white">
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative h-8 px-3 rounded-full bg-white/5 border border-white/10 hover:border-white/25 hover:bg-white/10 transition flex items-center gap-2 min-w-[110px]">
              <span className="truncate capitalize text-white/85">{mode}</span>
              <CaretDown size={12} className="text-white/50 pointer-events-none" />
              <select
                aria-label="选择模式"
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              >
                <option value="creative">creative</option>
                <option value="precise">precise</option>
                <option value="fun">humor</option>
              </select>
            </div>
            <div className="flex-1" />
            <button
              onClick={sendMessage}
              disabled={!canSend}
              className="h-8 w-8 rounded-full bg-emerald-500 text-white flex items-center justify-center disabled:opacity-50 disabled:bg-emerald-500/40 hover:bg-emerald-400 transition"
              title="发送"
            >
              {isSending ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
            </button>
          </div>
          {attachments.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {attachments.map((item, idx) => (
                <span
                  key={`${item.name}-${idx}`}
                  className="inline-flex items-center gap-2 px-2 py-1.5 rounded-full border border-white/10 bg-white/8 text-[11px]"
                  title={`${item.name} (${(item.size / 1024).toFixed(1)} KB)`}
                >
                  <div className="h-7 w-7 rounded-md overflow-hidden border border-white/10 bg-white/5">
                    <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
                  </div>
                  <span className="truncate max-w-[120px]">{item.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
};
