import React, { useEffect, useRef, useState } from "react";
import { Globe } from "lucide-react";
import type { ChatMessage, Message, ToolMessage, ToolPayload, ToolStatus, TraceMessage } from "./types";
import { isToolMessage, isTraceMessage } from "./types";

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

const renderToolOutput = (tool: ToolPayload) => {
  if (!tool.output) return null;
  let parsed: any = null;
  try {
    parsed = JSON.parse(tool.output);
  } catch {
    parsed = tool.output;
  }

  if (!parsed || typeof parsed === "string") {
    return (
      <div className="text-[12px] text-[var(--app-text-secondary)] whitespace-pre-wrap">
        {String(parsed || "")}
      </div>
    );
  }

  const data = parsed.data || {};
  const warnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];
  const matches = Array.isArray(data.matches) ? data.matches : [];
  const sceneList = Array.isArray(data.sceneList) ? data.sceneList : [];
  const episodeCharacters = Array.isArray(data.episodeCharacters) ? data.episodeCharacters : [];
  const episodeSummaries = Array.isArray(data.episodeSummaries) ? data.episodeSummaries : [];
  const characterList = Array.isArray(data.characters) ? data.characters : [];
  const locationList = Array.isArray(data.locations) ? data.locations : [];

  const renderSection = (title: string, content: React.ReactNode) => (
    <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 space-y-1">
      <div className="text-[10px] uppercase tracking-widest text-[var(--app-text-secondary)]">{title}</div>
      {content}
    </div>
  );

  const blocks: React.ReactNode[] = [];

  if (warnings.length > 0) {
    blocks.push(
      renderSection(
        "Warnings",
        <ul className="text-[11px] text-[var(--app-text-secondary)] list-disc pl-4 space-y-1">
          {warnings.map((w: string, idx: number) => (
            <li key={`${idx}-${w}`}>{w}</li>
          ))}
        </ul>
      )
    );
  }

  if (matches.length > 0) {
    blocks.push(
      renderSection(
        "Matches",
        <ul className="text-[12px] text-[var(--app-text-secondary)] space-y-2">
          {matches.map((m: any, idx: number) => (
            <li key={`${idx}-${m.sceneId || m.episodeId || "m"}`} className="space-y-1">
              <div className="text-[11px] text-[var(--app-text-muted)]">
                {m.episodeId ? `Ep ${m.episodeId}` : ""}
                {m.episodeTitle ? ` · ${m.episodeTitle}` : ""}
                {m.sceneId ? ` · Scene ${m.sceneId}` : ""}
                {m.sceneTitle ? ` · ${m.sceneTitle}` : ""}
                {m.characterName ? ` · ${m.characterName}` : ""}
                {m.locationName ? ` · ${m.locationName}` : ""}
                {m.scope ? ` · ${m.scope}` : ""}
              </div>
              {m.snippet ? (
                <div className="text-[12px] text-[var(--app-text-secondary)] whitespace-pre-wrap">{m.snippet}</div>
              ) : null}
            </li>
          ))}
        </ul>
      )
    );
  }

  if (data.sceneContent) {
    blocks.push(
      renderSection(
        "Scene Content",
        <div className="text-[12px] text-[var(--app-text-secondary)] whitespace-pre-wrap">{data.sceneContent}</div>
      )
    );
  }
  if (data.episodeContent) {
    blocks.push(
      renderSection(
        "Episode Content",
        <div className="text-[12px] text-[var(--app-text-secondary)] whitespace-pre-wrap">{data.episodeContent}</div>
      )
    );
  }
  if (data.projectSummary) {
    blocks.push(
      renderSection(
        "Project Summary",
        <div className="text-[12px] text-[var(--app-text-secondary)] whitespace-pre-wrap">{data.projectSummary}</div>
      )
    );
  }
  if (data.episodeSummary) {
    blocks.push(
      renderSection(
        "Episode Summary",
        <div className="text-[12px] text-[var(--app-text-secondary)] whitespace-pre-wrap">{data.episodeSummary}</div>
      )
    );
  }
  if (episodeSummaries.length > 0) {
    blocks.push(
      renderSection(
        "Episode Summaries",
        <ul className="text-[12px] text-[var(--app-text-secondary)] space-y-1">
          {episodeSummaries.map((s: any, idx: number) => (
            <li key={`${idx}-${s.episodeId}`}>
              <span className="text-[11px] text-[var(--app-text-muted)]">Ep {s.episodeId}: </span>
              {s.summary}
            </li>
          ))}
        </ul>
      )
    );
  }
  if (episodeCharacters.length > 0) {
    blocks.push(
      renderSection(
        "Episode Characters",
        <div className="text-[12px] text-[var(--app-text-secondary)]">{episodeCharacters.join(", ")}</div>
      )
    );
  }
  if (sceneList.length > 0) {
    blocks.push(
      renderSection(
        "Scene List",
        <ul className="text-[12px] text-[var(--app-text-secondary)] space-y-1">
          {sceneList.map((sc: any) => (
            <li key={`${sc.id}-${sc.title}`}>
              <span className="text-[11px] text-[var(--app-text-muted)]">{sc.id}</span> {sc.title}
            </li>
          ))}
        </ul>
      )
    );
  }
  if (characterList.length > 0) {
    blocks.push(
      renderSection(
        "Characters",
        <ul className="text-[12px] text-[var(--app-text-secondary)] space-y-1">
          {characterList.map((c: any) => (
            <li key={`${c.id || c.name}-${c.name}`}>
              <span className="text-[11px] text-[var(--app-text-muted)]">{c.name}</span>
              {c.role ? ` · ${c.role}` : ""}
              {typeof c.isMain === "boolean" ? ` · ${c.isMain ? "Main" : "Side"}` : ""}
            </li>
          ))}
        </ul>
      )
    );
  }
  if (locationList.length > 0) {
    blocks.push(
      renderSection(
        "Locations",
        <ul className="text-[12px] text-[var(--app-text-secondary)] space-y-1">
          {locationList.map((loc: any) => (
            <li key={`${loc.id || loc.name}-${loc.name}`}>
              <span className="text-[11px] text-[var(--app-text-muted)]">{loc.name}</span>
              {loc.type ? ` · ${loc.type}` : ""}
            </li>
          ))}
        </ul>
      )
    );
  }
  if (data.character) {
    const c = data.character;
    blocks.push(
      renderSection(
        "Character",
        <div className="text-[12px] text-[var(--app-text-secondary)] space-y-1">
          <div className="font-semibold text-[var(--app-text-primary)]">{c.name}</div>
          {c.role ? <div>Role: {c.role}</div> : null}
          {typeof c.isMain === "boolean" ? <div>Main: {c.isMain ? "Yes" : "No"}</div> : null}
          {c.tags?.length ? <div>Tags: {c.tags.join(", ")}</div> : null}
          {c.bio ? <div className="whitespace-pre-wrap">{c.bio}</div> : null}
          {Array.isArray(c.forms) && c.forms.length > 0 ? (
            <div className="text-[11px] text-[var(--app-text-muted)]">Forms: {c.forms.length}</div>
          ) : null}
        </div>
      )
    );
  }
  if (data.location) {
    const loc = data.location;
    blocks.push(
      renderSection(
        "Location",
        <div className="text-[12px] text-[var(--app-text-secondary)] space-y-1">
          <div className="font-semibold text-[var(--app-text-primary)]">{loc.name}</div>
          {loc.type ? <div>Type: {loc.type}</div> : null}
          {loc.description ? <div className="whitespace-pre-wrap">{loc.description}</div> : null}
          {Array.isArray(loc.zones) && loc.zones.length > 0 ? (
            <div className="text-[11px] text-[var(--app-text-muted)]">Zones: {loc.zones.length}</div>
          ) : null}
        </div>
      )
    );
  }

  if (blocks.length === 0) {
    return (
      <pre className="text-[11px] text-[var(--app-text-secondary)] whitespace-pre-wrap">
        {JSON.stringify(parsed, null, 2)}
      </pre>
    );
  }

  return <div className="space-y-2">{blocks}</div>;
};

const renderToolCard = (message: ToolMessage) => {
  const isResult = message.kind === "tool_result";
  const summaryText = message.tool.summary || message.tool.name;
  const isLookup = message.tool.name.includes("read_") || message.tool.name.includes("search_");
  const label = isLookup ? (isResult ? "查阅结果" : "查阅请求") : (isResult ? "工具结果" : "工具调用");
  return (
    <details className="max-w-[85%]">
      <summary className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[10px] uppercase tracking-widest text-[var(--app-text-secondary)]">
        <span>{label}</span>
        <span className={toolStatusClass[message.tool.status]}>{toolStatusLabel[message.tool.status]}</span>
        <span className="text-[var(--app-text-primary)] normal-case text-[12px]">{summaryText}</span>
      </summary>
      <div className="mt-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] px-3 py-2 space-y-2">
        <div className="text-[12px] font-semibold text-[var(--app-text-primary)]">{message.tool.name}</div>
        {message.tool.summary ? (
          <div className="text-[12px] text-[var(--app-text-secondary)]">{message.tool.summary}</div>
        ) : null}
        {message.tool.evidence && message.tool.evidence.length > 0 ? (
          <div className="text-[11px] text-[var(--app-text-secondary)]">
            证据：{message.tool.evidence.join(", ")}
          </div>
        ) : null}
        {isResult ? renderToolOutput(message.tool) : null}
      </div>
    </details>
  );
};

const traceStageLabel: Record<TraceMessage["trace"]["entries"][number]["stage"], string> = {
  runtime: "Runtime",
  session: "Session",
  model: "Model",
  tool: "Tool",
  result: "Result",
};

const traceStatusClass: Record<TraceMessage["trace"]["entries"][number]["status"], string> = {
  info: "border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-text-secondary)]",
  running: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  error: "border-rose-400/30 bg-rose-500/10 text-rose-200",
};

const renderTraceCard = (message: TraceMessage) => {
  const trace = message.trace;
  const isActive = trace.status === "running";
  const headerClass =
    trace.status === "error"
      ? "border-rose-400/30 bg-rose-500/8"
      : trace.status === "success"
        ? "border-emerald-400/30 bg-emerald-500/8"
        : "border-[var(--app-border)] bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(15,23,42,0.06))]";
  return (
    <details open className="w-full max-w-[92%]">
      <summary
        className={`cursor-pointer list-none rounded-2xl border px-4 py-3 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)] ${headerClass}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-text-secondary)]">
              <span>Agent Trace</span>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold ${
                  trace.status === "error"
                    ? "border-rose-400/30 text-rose-200"
                    : trace.status === "success"
                      ? "border-emerald-400/30 text-emerald-200"
                      : "border-amber-400/30 text-amber-200"
                }`}
              >
                {trace.status}
              </span>
            </div>
            <div className="mt-1 text-[13px] font-semibold text-[var(--app-text-primary)]">
              {isActive ? "正在运行 Agent 执行链路" : "Agent 执行链路已完成"}
            </div>
            <div className="mt-1 text-[11px] text-[var(--app-text-secondary)]">
              runId: {trace.runId} · {trace.entries.length} events
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            {trace.entries.slice(-3).map((entry) => (
              <span
                key={entry.id}
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] ${traceStatusClass[entry.status]}`}
              >
                {traceStageLabel[entry.stage]}
              </span>
            ))}
          </div>
        </div>
      </summary>
      <div className="mt-3 rounded-[1.4rem] border border-[var(--app-border)] bg-[rgba(7,20,18,0.42)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="space-y-3">
          {trace.entries.map((entry, index) => (
            <div key={entry.id} className="grid grid-cols-[auto_1fr] gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`mt-1 h-2.5 w-2.5 rounded-full ${
                    entry.status === "error"
                      ? "bg-rose-400"
                      : entry.status === "success"
                        ? "bg-emerald-400"
                        : entry.status === "running"
                          ? "bg-amber-300 animate-pulse"
                          : "bg-sky-300"
                  }`}
                />
                {index < trace.entries.length - 1 && <span className="mt-1 h-full w-px bg-[var(--app-border)]" />}
              </div>
              <div className="min-w-0 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-text-muted)]">
                        {traceStageLabel[entry.stage]}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${traceStatusClass[entry.status]}`}>
                        {entry.status}
                      </span>
                    </div>
                    <div className="mt-1 text-[12px] font-semibold text-[var(--app-text-primary)]">{entry.title}</div>
                    {entry.detail ? (
                      <div className="mt-1 text-[12px] text-[var(--app-text-secondary)] whitespace-pre-wrap">
                        {entry.detail}
                      </div>
                    ) : null}
                    {entry.payload ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-[var(--app-text-muted)]">
                          Payload
                        </summary>
                        <pre className="mt-2 overflow-x-auto rounded-xl border border-[var(--app-border)] bg-black/20 px-3 py-2 text-[10px] leading-relaxed text-[var(--app-text-secondary)] whitespace-pre-wrap">
                          {entry.payload}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                  <div className="text-[10px] text-[var(--app-text-muted)] whitespace-nowrap">
                    {new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
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
    <div ref={messagesRef} className="qalam-chat-scroll flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {messages.length === 0 && (
        <div className="qalam-empty-state rounded-[24px] border border-[var(--app-border)] px-4 py-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-text-muted)]">Workspace Assistant</div>
          <div className="mt-2 text-[15px] font-semibold tracking-[-0.02em] text-[var(--app-text-primary)]">
            让 Qalam 帮你查阅、理解和操作当前项目
          </div>
          <div className="mt-2 text-[12px] leading-6 text-[var(--app-text-secondary)]">
            可直接问剧情、角色、场景，也可以要求它生成工作流骨架。
          </div>
        </div>
      )}
      {messages.map((m, idx) => {
        const isUser = m.role === "user";
        const isAssistantPanel = !isUser && !isToolMessage(m) && !isTraceMessage(m);
        const reasoningKey = `reasoning-${idx}`;
        const reasoningOpen = openPanels[reasoningKey] ?? true;
        return (
          <div
            key={idx}
            className={`flex ${isUser ? "justify-end" : "justify-start"} ${isAssistantPanel ? "w-full" : ""}`}
          >
            {isTraceMessage(m) ? (
              renderTraceCard(m)
            ) : isToolMessage(m) ? (
              renderToolCard(m)
            ) : isUser ? (
              <div className="qalam-user-bubble max-w-[85%] rounded-[22px] px-3.5 py-2.5 text-[13px] leading-relaxed border">
                {m.text}
              </div>
            ) : (
              <div className="qalam-assistant-bubble max-w-[88%] rounded-[24px] border px-3.5 py-3">
                {renderAssistantPanel(m, {
                  reasoningOpen,
                  onToggleReasoning: (open) =>
                    setOpenPanels((prev) => ({
                      ...prev,
                      [reasoningKey]: open,
                    })),
                })}
              </div>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};
