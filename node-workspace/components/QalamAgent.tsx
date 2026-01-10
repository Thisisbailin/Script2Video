import React, { useMemo, useState } from "react";
import { Bot, X, Send, Loader2, ChevronUp } from "lucide-react";
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

  const canSend = input.trim().length > 0 && !isSending;
  const contextText = useMemo(() => buildContext(projectData, ctxSelection), [projectData, ctxSelection]);

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

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--bg-panel)]/90 border border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-primary)] shadow-lg hover:shadow-xl transition"
      >
        <Bot size={14} className="text-emerald-300" />
        <span>Qalam · 聊天辅助</span>
      </button>
    );
  }

  return (
    <div className="pointer-events-auto w-[360px] max-w-[90vw] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/95 backdrop-blur shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]/70">
        <div className="flex items-center gap-2 text-[var(--text-primary)]">
          <Bot size={16} className="text-emerald-300" />
          <div>
            <div className="text-sm font-semibold">Qalam · Agent</div>
            <div className="text-[10px] text-[var(--text-secondary)]">常驻助手 · 复用 LLM 能力</div>
          </div>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10"
        >
          <ChevronUp size={14} />
        </button>
      </div>

      <div className="flex-1 max-h-64 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <div className="text-[11px] text-[var(--text-secondary)]">
            提示：可选择上下文后直接提问，或让 Qalam 帮你生成/修改节点文本。
          </div>
        )}
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`rounded-xl px-3 py-2 text-[12px] leading-relaxed ${m.role === "user"
              ? "bg-[var(--accent-blue)]/15 text-[var(--text-primary)] border border-[var(--accent-blue)]/40 self-end"
              : "bg-white/5 text-[var(--text-primary)] border border-white/10"
              }`}
          >
            {m.text}
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--border-subtle)] px-3 py-2 space-y-2">
        <div className="flex flex-wrap gap-2 text-[10px] text-[var(--text-secondary)]">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={ctxSelection.script} onChange={(e) => setCtxSelection((s) => ({ ...s, script: e.target.checked }))} />
            剧本
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={ctxSelection.style} onChange={(e) => setCtxSelection((s) => ({ ...s, style: e.target.checked }))} />
            Style Guide
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={ctxSelection.guides} onChange={(e) => setCtxSelection((s) => ({ ...s, guides: e.target.checked }))} />
            Guides
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={ctxSelection.summary} onChange={(e) => setCtxSelection((s) => ({ ...s, summary: e.target.checked }))} />
            Summary
          </label>
        </div>
        <div className="flex items-center gap-2">
          <textarea
            className="flex-1 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-[12px] text-[var(--text-primary)] resize-none min-h-[60px]"
            placeholder="向 Qalam 提问或描述需求..."
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
          <button
            onClick={sendMessage}
            disabled={!canSend}
            className="h-10 w-10 rounded-full bg-[var(--accent-blue)] text-white flex items-center justify-center disabled:opacity-50"
          >
            {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};
