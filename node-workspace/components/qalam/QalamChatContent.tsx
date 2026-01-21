import React, { useEffect, useRef, useState } from "react";
import { Globe } from "lucide-react";
import type { ChatMessage, Message, ToolMessage, ToolStatus } from "./types";
import { isToolMessage } from "./types";

type Props = {
  messages: Message[];
  isSending: boolean;
};

const toolStatusLabel: Record<ToolStatus, string> = {
  queued: "Queued",
  running: "Running",
  success: "Success",
  error: "Error",
};

const toolStatusClass: Record<ToolStatus, string> = {
  queued: "text-slate-400",
  running: "text-amber-300",
  success: "text-emerald-300",
  error: "text-rose-400",
};

const sanitizeUrl = (value: string) => {
  let url = value.trim();
  while (url && /[)\],.;:!?]$/.test(url)) {
    url = url.slice(0, -1);
  }
  return url;
};

const extractUrls = (text: string) => {
  const matches = text.match(/https?:\/\/[^\s)]+/g);
  if (!matches) return [];
  const cleaned = matches.map((m) => sanitizeUrl(m)).filter(Boolean);
  return Array.from(new Set(cleaned));
};

const stripUrls = (text: string) =>
  text.replace(/https?:\/\/[^\s)]+/g, "").replace(/\s{2,}/g, " ").trim();

const renderInlineMarkdown = (text: string) => {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("http://", i) || text.startsWith("https://", i)) {
      let end = i;
      while (end < text.length && !/\s/.test(text[end])) end += 1;
      const raw = text.slice(i, end);
      const clean = sanitizeUrl(raw);
      const tail = raw.slice(clean.length);
      nodes.push(
        <a
          key={`u-${i}`}
          href={clean}
          target="_blank"
          rel="noreferrer"
          className="text-sky-300 underline underline-offset-2"
        >
          {clean}
        </a>
      );
      if (tail) nodes.push(tail);
      i = end;
      continue;
    }
    if (text.startsWith("[", i)) {
      const close = text.indexOf("](", i);
      const end = text.indexOf(")", close + 2);
      if (close !== -1 && end !== -1) {
        const label = text.slice(i + 1, close);
        const url = text.slice(close + 2, end);
        nodes.push(
          <a
            key={`a-${i}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-sky-300 underline underline-offset-2"
          >
            {label}
          </a>
        );
        i = end + 1;
        continue;
      }
    }
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        nodes.push(<strong key={`b-${i}`}>{text.slice(i + 2, end)}</strong>);
        i = end + 2;
        continue;
      }
    }
    if (text.startsWith("`", i)) {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        nodes.push(
          <code
            key={`c-${i}`}
            className="px-1.5 py-0.5 rounded bg-[var(--app-panel-soft)] border border-[var(--app-border)] text-[12px]"
          >
            {text.slice(i + 1, end)}
          </code>
        );
        i = end + 1;
        continue;
      }
    }
    if (text.startsWith("*", i)) {
      const end = text.indexOf("*", i + 1);
      if (end !== -1) {
        nodes.push(<em key={`i-${i}`}>{text.slice(i + 1, end)}</em>);
        i = end + 1;
        continue;
      }
    }
    const next = Math.min(
      ...["[", "**", "`", "*"].map((token) => {
        const idx = text.indexOf(token, i + 1);
        return idx === -1 ? text.length : idx;
      })
    );
    nodes.push(text.slice(i, next));
    i = next;
  }
  return nodes;
};

const renderLinkCard = (url: string, idx: number) => {
  let host = url;
  let path = "";
  try {
    const parsed = new URL(url);
    host = parsed.hostname.replace(/^www\./, "");
    path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";
  } catch {}
  return (
    <a
      key={`${idx}-${url}`}
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 hover:border-[var(--app-border-strong)] transition"
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-[var(--app-text-secondary)]">
        <Globe size={12} className="text-sky-300" />
        Link
      </div>
      <div className="mt-1 text-[13px] text-[var(--app-text-primary)]">{host}{path ? ` · ${path}` : ""}</div>
      <div className="mt-1 text-[11px] text-[var(--app-text-secondary)] truncate">{url}</div>
    </a>
  );
};

const renderMarkdownLite = (text: string) => {
  const lines = (text || "").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (/^\s*[-*_]{3,}\s*$/.test(line)) {
      blocks.push(<div key={`hr-${i}`} className="h-px bg-[var(--app-border)]" />);
      i += 1;
      continue;
    }

    if (line.trim().startsWith("```")) {
      const fenceLang = line.trim().slice(3).trim();
      i += 1;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <pre
          key={`code-${i}`}
          className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 overflow-x-auto text-[12px] leading-relaxed"
        >
          {fenceLang ? <div className="text-[10px] text-[var(--app-text-secondary)] mb-1">{fenceLang}</div> : null}
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2];
      const size =
        level === 1 ? "text-[16px]" : level === 2 ? "text-[14px]" : level === 3 ? "text-[13px]" : "text-[12px]";
      blocks.push(
        <div key={`h-${i}`} className={`font-semibold ${size} text-[var(--app-text-primary)]`}>
          {renderInlineMarkdown(title)}
        </div>
      );
      i += 1;
      continue;
    }

    if (line.trim().startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={`q-${i}`}
          className="border-l-2 border-[var(--app-border-strong)] pl-3 text-[12px] text-[var(--app-text-secondary)] whitespace-pre-wrap"
        >
          {renderInlineMarkdown(quoteLines.join("\n"))}
        </blockquote>
      );
      continue;
    }

    const taskMatch = line.match(/^\s*[-*•]\s+\[(\s|x|X)\]\s+(.+)$/);
    if (taskMatch) {
      const tasks: Array<{ text: string; checked: boolean }> = [];
      while (i < lines.length) {
        const current = lines[i];
        const match = current.match(/^\s*[-*•]\s+\[(\s|x|X)\]\s+(.+)$/);
        if (!match) break;
        tasks.push({ text: match[2].trim(), checked: match[1].toLowerCase() === "x" });
        i += 1;
      }
      blocks.push(
        <ul key={`t-${i}`} className="space-y-1">
          {tasks.map((task, idx) => (
            <li key={`${idx}-${task.text.slice(0, 8)}`} className="flex items-start gap-2 text-[12px]">
              <span
                className={`mt-0.5 h-3.5 w-3.5 rounded border ${
                  task.checked ? "bg-emerald-500/70 border-emerald-400" : "border-[var(--app-border)]"
                }`}
              />
              <span
                className={`text-[var(--app-text-primary)] ${task.checked ? "line-through opacity-70" : ""}`}
              >
                {renderInlineMarkdown(task.text)}
              </span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const separatorMatch = nextLine.match(/^\s*\|?\s*[-:]+(\s*\|\s*[-:]+)+\s*\|?\s*$/);
      if (separatorMatch) {
        const parseRow = (row: string) =>
          row
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((cell) => cell.trim());
        const headers = parseRow(line);
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
          rows.push(parseRow(lines[i]));
          i += 1;
        }
        blocks.push(
          <div key={`tbl-${i}`} className="overflow-x-auto">
            <table className="min-w-full text-[12px] border-collapse">
              <thead>
                <tr>
                  {headers.map((h, idx) => (
                    <th
                      key={`${idx}-${h}`}
                      className="text-left font-semibold text-[var(--app-text-primary)] border-b border-[var(--app-border)] pb-1 pr-4"
                    >
                      {renderInlineMarkdown(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr key={`r-${rIdx}`}>
                    {row.map((cell, cIdx) => (
                      <td key={`${rIdx}-${cIdx}`} className="py-1 pr-4 text-[var(--app-text-secondary)]">
                        {renderInlineMarkdown(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    const listMatch = line.match(/^\s*(?:[-*•]|\d+\.|\d+、)\s+/);
    if (listMatch) {
      const items: string[] = [];
      let ordered = false;
      while (i < lines.length) {
        const current = lines[i];
        const bulletMatch = current.match(/^\s*([-*•])\s+(.+)$/);
        const orderedMatch = current.match(/^\s*(\d+\.|\d+、)\s+(.+)$/);
        if (!bulletMatch && !orderedMatch) break;
        if (orderedMatch) ordered = true;
        items.push((orderedMatch?.[2] || bulletMatch?.[2] || "").trim());
        i += 1;
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag key={`l-${i}`} className={`pl-5 text-[12px] space-y-1 ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((item, idx) => (
            <li key={`${idx}-${item.slice(0, 8)}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ListTag>
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length && lines[i].trim()) {
      const nextLine = lines[i];
      if (nextLine.trim().startsWith("```")) break;
      if (nextLine.match(/^(#{1,4})\s+/)) break;
      if (nextLine.trim().startsWith(">")) break;
      if (nextLine.match(/^\s*(?:[-*•]|\d+\.|\d+、)\s+/)) break;
      paragraphLines.push(nextLine);
      i += 1;
    }
    const paragraphText = paragraphLines.join("\n").trim();
    const urls = extractUrls(paragraphText);
    const stripped = stripUrls(paragraphText);
    if (stripped) {
      blocks.push(
        <div key={`p-${i}`} className="text-[13px] leading-relaxed text-[var(--app-text-primary)] whitespace-pre-wrap">
          {renderInlineMarkdown(paragraphText)}
        </div>
      );
    }
    if (urls.length > 0) {
      blocks.push(
        <div key={`p-links-${i}`} className="space-y-2">
          {urls.map((url, idx) => renderLinkCard(url, idx))}
        </div>
      );
    }
  }

  return <div className="space-y-2">{blocks}</div>;
};

const renderToolCard = (message: ToolMessage) => {
  const kindLabel = message.kind === "tool_result" ? "Tool Result" : "Tool Call";
  return (
    <div className="max-w-[85%] rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 space-y-2">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[var(--app-text-secondary)]">
        <span>{kindLabel}</span>
        <span className={toolStatusClass[message.tool.status]}>{toolStatusLabel[message.tool.status]}</span>
      </div>
      <div className="text-[13px] font-semibold text-[var(--app-text-primary)]">{message.tool.name}</div>
      {message.tool.summary ? (
        <div className="text-[12px] text-[var(--app-text-secondary)]">{message.tool.summary}</div>
      ) : null}
      {message.tool.evidence && message.tool.evidence.length > 0 ? (
        <div className="text-[11px] text-[var(--app-text-secondary)]">
          证据：{message.tool.evidence.join(", ")}
        </div>
      ) : null}
    </div>
  );
};

const renderAssistantPanel = (
  message: ChatMessage,
  options: {
    reasoningOpen: boolean;
    onToggleReasoning: (open: boolean) => void;
  }
) => {
  const planItems = message.meta?.planItems || [];
  const reasoningSummary = message.meta?.reasoningSummary;
  const thinkingStatus = message.meta?.thinkingStatus;
  const searchEnabled = message.meta?.searchEnabled;
  const searchUsed = message.meta?.searchUsed;
  const searchQueries = message.meta?.searchQueries || [];
  const showNoSummary = thinkingStatus === "done" && !reasoningSummary;
  return (
    <div className="w-full space-y-3">
      {(thinkingStatus || searchEnabled || searchUsed) && (
        <div className="flex flex-wrap items-center gap-2">
          {thinkingStatus && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] uppercase tracking-widest border border-[var(--app-border)] text-[var(--app-text-secondary)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {thinkingStatus === "active" ? "思考中" : "思考完成"}
            </span>
          )}
          {(searchEnabled || searchUsed) && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] uppercase tracking-widest border border-[var(--app-border)] text-[var(--app-text-secondary)]">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              {searchUsed ? "已搜索" : "搜索开启"}
            </span>
          )}
        </div>
      )}
      {reasoningSummary ? (
        <details
          open={options.reasoningOpen}
          onToggle={(event) => options.onToggleReasoning((event.currentTarget as HTMLDetailsElement).open)}
          className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] px-3 py-2"
        >
          <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-[var(--app-text-secondary)]">
            思考摘要（系统）
          </summary>
          <div className="mt-2 text-[12px] leading-relaxed text-[var(--app-text-primary)]">
            {renderMarkdownLite(reasoningSummary)}
          </div>
        </details>
      ) : null}
      {showNoSummary && (
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 text-[12px] text-[var(--app-text-secondary)]">
          当前模型未提供思考摘要。
        </div>
      )}
      {searchQueries.length > 0 && (
        <details className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2">
          <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-[var(--app-text-secondary)]">
            搜索记录
          </summary>
          <ul className="mt-2 text-[12px] space-y-1 text-[var(--app-text-secondary)] list-disc pl-4">
            {searchQueries.map((q, idx) => (
              <li key={`${idx}-${q.slice(0, 8)}`}>{q}</li>
            ))}
          </ul>
        </details>
      )}
      {planItems.length > 0 ? (
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2">
          <div className="text-[10px] uppercase tracking-widest text-[var(--app-text-secondary)]">Plan</div>
          <ul className="text-[12px] leading-relaxed text-[var(--app-text-primary)] list-decimal pl-4 space-y-1">
            {planItems.map((item, idx) => (
              <li key={`${idx}-${item.slice(0, 8)}`}>{renderInlineMarkdown(item)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {message.text ? renderMarkdownLite(message.text) : null}
    </div>
  );
};

export const QalamChatContent: React.FC<Props> = ({ messages, isSending }) => {
  const messagesRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!messagesRef.current) return;
    const node = messagesRef.current;
    requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
  }, [messages, isSending]);

  return (
    <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {messages.map((m, idx) => {
        const isUser = m.role === "user";
        const isAssistantPanel = !isUser && !isToolMessage(m);
        const reasoningKey = `reasoning-${idx}`;
        const reasoningOpen = openPanels[reasoningKey] ?? true;
        return (
          <div
            key={idx}
            className={`flex ${isUser ? "justify-end" : "justify-start"} ${isAssistantPanel ? "w-full" : ""}`}
          >
            {isToolMessage(m) ? (
              renderToolCard(m)
            ) : isUser ? (
              <div className="max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed border bg-[var(--app-text-primary)] text-[var(--app-bg)] border-[var(--app-border-strong)]">
                {m.text}
              </div>
            ) : (
              renderAssistantPanel(m, {
                reasoningOpen,
                onToggleReasoning: (open) =>
                  setOpenPanels((prev) => ({
                    ...prev,
                    [reasoningKey]: open,
                  })),
              })
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};
