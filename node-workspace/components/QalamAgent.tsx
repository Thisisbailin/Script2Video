import React, { useMemo, useState } from "react";
import { Bot, Send, Loader2, ChevronUp, ChevronDown } from "lucide-react";
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
    <div className="pointer-events-auto w-[380px] max-w-[90vw] rounded-2xl border border-white/10 bg-[#0b0d10]/95 text-white shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
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

      <div className="flex-1 max-h-64 overflow-y-auto px-4 py-3 space-y-2">
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

      <div className="border-t border-white/10 px-4 py-3 space-y-3">
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
        <div className="flex items-end gap-2">
          <textarea
            className="flex-1 bg-[#0d0f12] border border-white/10 rounded-xl px-3 py-2 text-[12px] text-white resize-none min-h-[60px]"
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
            className="h-11 w-11 rounded-full bg-emerald-500 text-white flex items-center justify-center disabled:opacity-50"
          >
            {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};
