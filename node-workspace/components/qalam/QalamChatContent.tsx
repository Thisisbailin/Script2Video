import React, { useEffect, useMemo, useRef, useState } from "react";
import { Globe } from "lucide-react";
import type { ChatMessage, Message, StatusMessage, ToolMessage, ToolPayload, ToolStatus } from "./types";
import { isStatusMessage, isToolMessage } from "./types";

type Props = {
  messages: Message[];
  isSending: boolean;
};

const toolStatusLabel: Record<ToolStatus, string> = {
  queued: "等待中",
  running: "执行中",
  success: "成功",
  error: "失败",
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

  const simpleFields: Array<{ label: string; value: string }> = [];
  if (typeof parsed.episode_label === "string") simpleFields.push({ label: "剧集", value: parsed.episode_label });
  if (typeof parsed.episode_id === "number") simpleFields.push({ label: "集数", value: `第${parsed.episode_id}集` });
  if (typeof parsed.scene_id === "string") simpleFields.push({ label: "场景", value: parsed.scene_id });
  if (typeof parsed.scene_title === "string") simpleFields.push({ label: "场景标题", value: parsed.scene_title });
  if (typeof parsed.field === "string") simpleFields.push({ label: "写入字段", value: parsed.field });
  if (typeof parsed.chars === "number") simpleFields.push({ label: "字数", value: String(parsed.chars) });
  if (typeof parsed.nodeId === "string") simpleFields.push({ label: "节点 ID", value: parsed.nodeId });

  if (
    typeof parsed.content === "string" ||
    typeof parsed.summary === "string" ||
    simpleFields.length > 0
  ) {
    return (
      <div className="space-y-2">
        {simpleFields.length > 0 ? (
          <dl className="grid gap-x-4 gap-y-1 text-[12px] text-[var(--app-text-secondary)] sm:grid-cols-2">
            {simpleFields.map((item) => (
              <div key={`${item.label}-${item.value}`} className="min-w-0">
                <dt className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-text-muted)]">{item.label}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-[var(--app-text-primary)]">{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {typeof parsed.summary === "string" ? (
          <div className="border-l border-[var(--app-border)] pl-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-text-muted)]">摘要</div>
            <div className="mt-1 text-[12px] text-[var(--app-text-primary)] whitespace-pre-wrap">{parsed.summary}</div>
          </div>
        ) : null}
        {typeof parsed.content === "string" ? (
          <div className="border-l border-[var(--app-border)] pl-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-text-muted)]">正文</div>
            <div className="mt-1 text-[12px] text-[var(--app-text-primary)] whitespace-pre-wrap">{parsed.content}</div>
          </div>
        ) : null}
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
    <div className="border-l border-[var(--app-border)] pl-3 space-y-1">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-text-muted)]">{title}</div>
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

const READ_TOOL_NAMES = new Set(["get_episode_script", "get_scene_script", "read_project_data", "read_script_data", "search_script_data"]);
const WRITE_TOOL_NAMES = new Set(["write_project_summary", "write_episode_summary", "upsert_character", "upsert_location"]);
const OPERATE_TOOL_NAMES = new Set(["create_text_node", "create_node_workflow"]);

const trimToolSummary = (summary?: string, fallback?: string) => {
  if (!summary?.trim()) return fallback || "工具";
  const cleaned = summary.replace(/^[^：:]+[：:]\s*/, "").trim();
  return cleaned || summary;
};

const buildToolActionLabel = (tool: ToolPayload) => {
  const subject = trimToolSummary(tool.summary, tool.name);
  if (READ_TOOL_NAMES.has(tool.name)) return `查阅 ${subject}`;
  if (WRITE_TOOL_NAMES.has(tool.name)) return `编辑 ${subject}`;
  if (OPERATE_TOOL_NAMES.has(tool.name)) return `操作 ${subject}`;
  return `操作 ${subject}`;
};

const renderFoldoutSurface = (title: string, children: React.ReactNode, footer?: React.ReactNode) => (
  <div className="mt-2 ml-4 rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(193,201,211,0.16),rgba(138,148,160,0.12))] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_28px_-24px_rgba(0,0,0,0.48)] backdrop-blur-md">
    <div className="text-[10px] uppercase tracking-[0.18em] text-[rgba(230,235,241,0.64)]">{title}</div>
    <div className="mt-2 space-y-2 text-[12px] leading-relaxed text-[var(--app-text-primary)]">{children}</div>
    {footer ? <div className="mt-3 border-t border-white/8 pt-2 text-[11px] text-[rgba(230,235,241,0.56)]">{footer}</div> : null}
  </div>
);

type ToolThread = {
  key: string;
  request?: ToolMessage;
  result?: ToolMessage;
};

const renderToolThread = (thread: ToolThread) => {
  const effectiveTool = thread.result?.tool || thread.request?.tool;
  if (!effectiveTool) return null;
  const hasDetails =
    !!thread.result?.tool.output ||
    !!thread.result?.tool.summary ||
    !!thread.result?.tool.evidence?.length;
  const actionLabel = buildToolActionLabel(effectiveTool);
  const status = thread.result?.tool.status || thread.request?.tool.status || "queued";
  const statusText = toolStatusLabel[status];

  if (!hasDetails && !thread.result) {
    return (
      <div className="max-w-[88%] text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
        <span className="font-medium text-[var(--app-text-primary)]">{actionLabel}</span>
        <span className={`ml-2 text-[11px] ${toolStatusClass[status]}`}>{statusText}</span>
      </div>
    );
  }

  return (
    <details className="max-w-[90%] text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
      <summary className="cursor-pointer marker:text-[var(--app-text-muted)]">
        <span className="font-medium text-[var(--app-text-primary)]">{actionLabel}</span>
        <span className={`ml-2 text-[11px] ${toolStatusClass[status]}`}>{statusText}</span>
      </summary>
      {renderFoldoutSurface(
        thread.result ? "结果反馈" : "执行上下文",
        <>
          {thread.request?.tool.summary ? (
            <div className="text-[12px] text-[var(--app-text-secondary)]">{thread.request.tool.summary}</div>
          ) : null}
          {thread.result?.tool.summary ? (
            <div className="text-[12px] text-[var(--app-text-secondary)]">{thread.result.tool.summary}</div>
          ) : null}
          {thread.result?.tool.evidence && thread.result.tool.evidence.length > 0 ? (
            <div className="text-[11px] text-[var(--app-text-muted)]">
              {thread.result.tool.evidence.join(" · ")}
            </div>
          ) : null}
          {thread.result ? renderToolOutput(thread.result.tool) : <div className="text-[12px] text-[var(--app-text-secondary)]">等待工具返回结果。</div>}
        </>,
        `${effectiveTool.name} · ${statusText}`
      )}
    </details>
  );
};

const buildThinkingLabel = (status: StatusMessage["statusCard"]) => {
  const latestStep = status.steps.at(-1);
  if (latestStep?.label) {
    if (latestStep.label === "生成最终回复") return "思考 完成回复整理";
    if (latestStep.label === "流式生成回复") return "思考 生成回复";
    return `思考 ${latestStep.label}`;
  }
  if (status.headline === "已接收请求") return "思考 理解请求";
  if (status.headline === "正在规划处理方式") return "思考 规划处理方式";
  if (status.headline === "已载入当前会话") return "思考 关联会话上下文";
  if (status.headline === "处理完成") return "思考 完成处理";
  if (status.headline === "处理失败") return "思考 处理中断";
  return `思考 ${status.headline}`;
};

const renderStatusLine = (message: StatusMessage) => {
  const status = message.statusCard;
  const toneClass =
    status.status === "error"
      ? "text-rose-400"
      : status.status === "success"
        ? "text-emerald-400"
        : "text-sky-400";

  if (!status.steps.length && !status.detail) {
    return (
      <div className="max-w-[88%] text-[12px] text-[var(--app-text-secondary)]">
        <span className={`font-medium ${toneClass}`}>{status.headline}</span>
      </div>
    );
  }

  return (
    <details className="max-w-[90%] text-[12px] text-[var(--app-text-secondary)]">
      <summary className="cursor-pointer marker:text-[var(--app-text-muted)]">
        <span className={`font-medium ${toneClass}`}>{buildThinkingLabel(status)}</span>
        <span className="ml-2 text-[11px] text-[var(--app-text-muted)]">
          {new Date(status.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </summary>
      {renderFoldoutSurface(
        "思考摘要",
        <>
          {status.detail ? <div className="whitespace-pre-wrap text-[var(--app-text-secondary)]">{status.detail}</div> : null}
          {status.steps.length > 0 ? (
            <div className="space-y-2">
              {status.steps.map((step) => (
                <div key={step.id} className="rounded-xl border border-white/8 bg-black/10 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        step.status === "error"
                          ? "bg-rose-400"
                          : step.status === "success"
                            ? "bg-emerald-400"
                            : "bg-amber-300 animate-pulse"
                      }`}
                    />
                    <div className="text-[12px] font-medium text-[var(--app-text-primary)]">{step.label}</div>
                  </div>
                  {step.detail ? (
                    <div className="mt-1 text-[11px] text-[var(--app-text-muted)] whitespace-pre-wrap">{step.detail}</div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-[var(--app-text-secondary)]">当前尚未产生更多可展示的思考摘要。</div>
          )}
        </>,
        `${status.status === "running" ? "处理中" : status.status === "success" ? "已完成" : "失败"} · ${status.isThinking ? "思考中" : "待机"}`
      )}
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
          className="text-[12px] text-[var(--app-text-secondary)]"
        >
          <summary className="cursor-pointer marker:text-[var(--app-text-muted)]">
            思考摘要（系统）
          </summary>
          {renderFoldoutSurface("系统思考摘要", <>{renderMarkdownLite(reasoningSummary)}</>, thinkingStatus === "done" ? "已完成" : "处理中")}
        </details>
      ) : null}
      {showNoSummary && (
        <div className="text-[12px] text-[var(--app-text-secondary)]">
          当前模型未提供思考摘要。
        </div>
      )}
      {searchQueries.length > 0 && (
        <details className="text-[12px] text-[var(--app-text-secondary)]">
          <summary className="cursor-pointer marker:text-[var(--app-text-muted)]">
            搜索记录
          </summary>
          {renderFoldoutSurface(
            "搜索记录",
            <ul className="list-disc space-y-1 pl-5 text-[12px] text-[var(--app-text-secondary)]">
              {searchQueries.map((q, idx) => (
                <li key={`${idx}-${q.slice(0, 8)}`}>{q}</li>
              ))}
            </ul>
          )}
        </details>
      )}
      {planItems.length > 0 ? (
        <details className="text-[12px] text-[var(--app-text-secondary)]">
          <summary className="cursor-pointer marker:text-[var(--app-text-muted)]">查看计划</summary>
          {renderFoldoutSurface(
            "计划",
            <ul className="list-decimal space-y-1 pl-5 text-[12px] leading-relaxed text-[var(--app-text-primary)]">
              {planItems.map((item, idx) => (
                <li key={`${idx}-${item.slice(0, 8)}`}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          )}
        </details>
      ) : null}
      {message.text ? renderMarkdownLite(message.text) : null}
    </div>
  );
};

export const QalamChatContent: React.FC<Props> = ({ messages, isSending }) => {
  const messagesRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({});
  const displayMessages = useMemo(() => {
    const consumed = new Set<number>();
    const items: Array<
      | { kind: "status"; key: string; message: StatusMessage }
      | { kind: "tool"; key: string; thread: ToolThread }
      | { kind: "chat"; key: string; message: ChatMessage }
    > = [];

    for (let i = 0; i < messages.length; i += 1) {
      if (consumed.has(i)) continue;
      const message = messages[i];

      if (isToolMessage(message)) {
        if (message.kind === "tool") {
          const resultIndex = messages.findIndex(
            (candidate, idx) =>
              idx > i &&
              isToolMessage(candidate) &&
              candidate.kind === "tool_result" &&
              candidate.tool.callId &&
              candidate.tool.callId === message.tool.callId
          );
          const result =
            resultIndex >= 0 && isToolMessage(messages[resultIndex]) ? (messages[resultIndex] as ToolMessage) : undefined;
          if (resultIndex >= 0) consumed.add(resultIndex);
          items.push({
            kind: "tool",
            key: message.tool.callId || `tool-${i}`,
            thread: {
              key: message.tool.callId || `tool-${i}`,
              request: message,
              result,
            },
          });
          continue;
        }

        items.push({
          kind: "tool",
          key: message.tool.callId || `tool-result-${i}`,
          thread: {
            key: message.tool.callId || `tool-result-${i}`,
            result: message,
          },
        });
        continue;
      }

      if (isStatusMessage(message)) {
        items.push({ kind: "status", key: `${message.statusCard.runId}-${i}`, message });
        continue;
      }

      items.push({ kind: "chat", key: `chat-${i}`, message });
    }

    return items;
  }, [messages]);

  useEffect(() => {
    if (!messagesRef.current) return;
    const node = messagesRef.current;
    requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
  }, [messages, isSending]);

  return (
    <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {displayMessages.map((item, idx) => {
        const isUser = item.kind === "chat" && item.message.role === "user";
        const isAssistantPanel = item.kind === "chat" && !isUser;
        const reasoningKey = `reasoning-${item.key}-${idx}`;
        const reasoningOpen = openPanels[reasoningKey] ?? true;
        return (
          <div
            key={item.key}
            className={`flex ${isUser ? "justify-end" : "justify-start"} ${isAssistantPanel ? "w-full" : ""}`}
          >
            {item.kind === "status" ? (
              renderStatusLine(item.message)
            ) : item.kind === "tool" ? (
              renderToolThread(item.thread)
            ) : isUser ? (
              <div className="max-w-[82%] rounded-[22px] border border-[var(--app-border)] bg-[var(--app-panel-strong)] px-4 py-3 text-[13px] leading-relaxed text-[var(--app-text-primary)] shadow-[0_10px_24px_-20px_rgba(0,0,0,0.28)]">
                {item.message.text}
              </div>
            ) : (
              renderAssistantPanel(item.message, {
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
