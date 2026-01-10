import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, ChevronUp, ChevronDown, Plus, ArrowRight, Image as ImageIcon } from "lucide-react";
import * as GeminiService from "../../services/geminiService";
import { useConfig } from "../../hooks/useConfig";
import { ProjectData } from "../../types";

type Props = {
  projectData: ProjectData;
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

export const QalamAgent: React.FC<Props> = ({ projectData }) => {
  const { config } = useConfig("script2video_config_v1");
  const [collapsed, setCollapsed] = useState(true);
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
    const userMsg: Message = { role: "user", text: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);
    try {
      const prompt = `${contextText ? contextText + "\n\n" : ""}${userMsg.text}\n\n请直接回答问题，简洁输出。`;
      const res = await GeminiService.generateFreeformText(config.textConfig, prompt, "You are Qalam, a creative agent helping build this project. Keep responses concise.");
      setMessages((prev) => [...prev, { role: "assistant", text: res.outputText || "" }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: "assistant", text: `请求失败: ${err?.message || err}` }]);
    } finally {
      setIsSending(false);
    }
  };

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
        className="flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 bg-[#0d0f12]/90 text-white shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur"
      >
        <span className="flex items-center gap-1.5">
          <Bot size={14} className="text-emerald-300" />
        </span>
        <span className="text-xs font-semibold">Qalam</span>
        <ChevronUp size={14} className="text-white/60" />
      </button>
    );
  }

  return (
    <div className="pointer-events-auto w-[420px] max-w-[95vw] h-[72vh] max-h-[80vh] rounded-2xl border border-white/10 bg-[#0b0d10]/95 text-white shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500/30 via-emerald-500/10 to-transparent border border-white/10 flex items-center justify-center">
            <Bot size={16} className="text-emerald-200" />
          </div>
          <div>
            <div className="text-sm font-semibold">Qalam</div>
            <div className="text-[11px] text-white/50">{config.textConfig?.model || "LLM"}</div>
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

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-[11px] text-white/60">
            选择上下文后直接提问，或让 Qalam 帮你生成/修改文案。
          </div>
        )}
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`rounded-xl px-3 py-2 text-[12px] leading-relaxed border ${
              m.role === "user"
                ? "bg-white/5 border-white/15 text-white"
                : "bg-[var(--bg-panel)] border-white/10 text-white"
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 px-4 py-4 space-y-3">
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
        <div className="rounded-2xl bg-white/6 border border-white/10 px-3 py-3 space-y-2">
          <textarea
            className="w-full bg-transparent text-[13px] text-white placeholder:text-white/60 resize-none focus:outline-none"
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
          <div className="flex items-center gap-2 flex-wrap text-[12px] text-white/80">
            <button
              onClick={handleUploadClick}
              className="h-8 w-8 rounded-full border border-white/10 hover:border-white/30 hover:bg-white/6 flex items-center justify-center"
              title="上传图片作为上下文"
            >
              <Plus size={14} />
            </button>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              className="h-8 rounded-full border border-white/12 bg-white/5 px-3 pr-6 text-[12px] text-white/90 focus:outline-none"
            >
              <option value="creative">创意模式</option>
              <option value="precise">精准实干</option>
              <option value="fun">风趣幽默</option>
            </select>
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
            <div className="flex-1" />
            <button
              onClick={sendMessage}
              disabled={!canSend}
              className="h-9 w-9 rounded-full bg-emerald-500 text-white flex items-center justify-center disabled:opacity-50 disabled:bg-emerald-500/40"
              title="发送"
            >
              {isSending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            </button>
          </div>
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
