import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, ChevronUp, X, Plus, ArrowUp, Image as ImageIcon, Lightbulb, Sparkles, CircleHelp, ChevronDown as CaretDown, Globe, Columns } from "lucide-react";
import * as GeminiService from "../../services/geminiService";
import * as DeyunAIService from "../../services/deyunaiService";
import type { DeyunAITool, DeyunAIToolCall } from "../../services/deyunaiService";
import { useConfig } from "../../hooks/useConfig";
import { usePersistedState } from "../../hooks/usePersistedState";
import { ProjectData } from "../../types";
import { AVAILABLE_MODELS, DEYUNAI_MODELS } from "../../constants";
import { createStableId, ensureStableId } from "../../utils/id";

type Props = {
  projectData: ProjectData;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;
  onOpenStats?: () => void;
  onToggleAgentSettings?: () => void;
};

type ToolStatus = "queued" | "running" | "success" | "error";

type ToolPayload = {
  name: string;
  status: ToolStatus;
  summary?: string;
  evidence?: string[];
  callId?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  kind?: "chat";
  meta?: {
    planItems?: string[];
    reasoningSummary?: string;
    thinkingStatus?: "active" | "done";
    searchEnabled?: boolean;
    searchUsed?: boolean;
    searchQueries?: string[];
  };
};
type ToolMessage = { role: "assistant"; kind: "tool" | "tool_result"; tool: ToolPayload };
type Message = ChatMessage | ToolMessage;

const isToolMessage = (message: Message): message is ToolMessage =>
  message.kind === "tool" || message.kind === "tool_result";

const TOOL_DEFS: DeyunAITool[] = [
  {
    type: "function",
    name: "upsert_character",
    description: "Create or update a character (with forms). Supports partial updates.",
    parameters: {
      type: "object",
      properties: {
        character: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            role: { type: "string" },
            isMain: { type: "boolean" },
            bio: { type: "string" },
            assetPriority: { type: "string", enum: ["high", "medium", "low"] },
            episodeUsage: { type: "string" },
            archetype: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            forms: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  formName: { type: "string" },
                  episodeRange: { type: "string" },
                  description: { type: "string" },
                  visualTags: { type: "string" },
                  identityOrState: { type: "string" },
                },
                required: ["formName", "episodeRange"],
              },
            },
          },
          required: ["name"],
        },
        mergeStrategy: { type: "string", enum: ["patch", "replace"] },
        formsMode: { type: "string", enum: ["merge", "replace"] },
        formsToDelete: { type: "array", items: { type: "string" } },
        evidence: { type: "array", items: { type: "string" } },
      },
      required: ["character"],
    },
  },
  {
    type: "function",
    name: "upsert_location",
    description: "Create or update a location (with zones). Supports partial updates.",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            type: { type: "string", enum: ["core", "secondary"] },
            description: { type: "string" },
            visuals: { type: "string" },
            assetPriority: { type: "string", enum: ["high", "medium", "low"] },
            episodeUsage: { type: "string" },
            zones: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  kind: { type: "string", enum: ["interior", "exterior", "transition", "unspecified"] },
                  episodeRange: { type: "string" },
                  layoutNotes: { type: "string" },
                  keyProps: { type: "string" },
                  lightingWeather: { type: "string" },
                  materialPalette: { type: "string" },
                },
                required: ["name", "episodeRange"],
              },
            },
          },
          required: ["name"],
        },
        mergeStrategy: { type: "string", enum: ["patch", "replace"] },
        zonesMode: { type: "string", enum: ["merge", "replace"] },
        zonesToDelete: { type: "array", items: { type: "string" } },
        evidence: { type: "array", items: { type: "string" } },
      },
      required: ["location"],
    },
  },
];

const parseToolArguments = (value: string) => {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const buildToolSummary = (name: string, args: any) => {
  if (name === "upsert_character") {
    const target = args?.character?.name || args?.character?.id || "未命名角色";
    const formsCount = Array.isArray(args?.character?.forms) ? args.character.forms.length : 0;
    return `角色：${target} · 形态 ${formsCount} 个`;
  }
  if (name === "upsert_location") {
    const target = args?.location?.name || args?.location?.id || "未命名场景";
    const zonesCount = Array.isArray(args?.location?.zones) ? args.location.zones.length : 0;
    return `场景：${target} · 分区 ${zonesCount} 个`;
  }
  return "工具调用";
};

const parsePlanFromText = (text: string) => {
  const lines = (text || "").split("\n");
  const planItems: string[] = [];
  let inPlan = false;

  const headingRegex = /^\s*(计划|Plan)\b\s*[:：]?\s*$/i;
  const listRegex = /^\s*(?:[-*•]|\\d+\\.|\\d+、)\\s*(.+)$/;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!inPlan && headingRegex.test(line)) {
      inPlan = true;
      continue;
    }
    if (inPlan) {
      if (!line.trim()) {
        if (planItems.length > 0) {
          inPlan = false;
          continue;
        }
        continue;
      }
      const match = line.match(listRegex);
      if (match) {
        planItems.push(match[1].trim());
        continue;
      }
      inPlan = false;
    }
  }

  return {
    text: (text || "").trim(),
    planItems: planItems.length ? planItems : undefined,
  };
};

const extractReasoningSection = (text: string) => {
  const lines = (text || "").split("\n");
  let start = -1;
  let end = -1;
  let inlineReasoning = "";

  const normalizeHeadingLine = (line: string) => {
    let cleaned = line.trim().replace(/^#{1,4}\s*/, "");
    if (cleaned.startsWith("**")) {
      const endBold = cleaned.indexOf("**", 2);
      if (endBold !== -1) {
        const inside = cleaned.slice(2, endBold);
        const rest = cleaned.slice(endBold + 2);
        cleaned = `${inside}${rest}`;
      }
    }
    return cleaned.trim();
  };

  const matchReasoningHeading = (line: string) => {
    const cleaned = normalizeHeadingLine(line);
    const match = cleaned.match(/^(思考过程|思考|Reasoning|Thoughts)(?:\s*[\(（][^)）]+[\)）])?\s*[:：]?\s*(.*)$/i);
    if (!match) return null;
    return { inline: match[2]?.trim() || "" };
  };

  for (let i = 0; i < lines.length; i += 1) {
    const match = matchReasoningHeading(lines[i]);
    if (match) {
      start = i;
      inlineReasoning = match.inline;
      break;
    }
  }
  if (start === -1) {
    return { text: (text || "").trim(), reasoning: undefined };
  }

  end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (!line.trim()) break;
    if (line.match(/^(#{1,4})\s+/)) break;
    if (line.match(/^\s*\*\*(.+)\*\*\s*$/)) break;
    if (inlineReasoning) {
      if (!line.match(/^\s*(?:[-*•]|\d+\.|\d+、)\s+/) && !line.match(/^\s{2,}/)) {
        break;
      }
    }
    end += 1;
  }

  const reasoningLines = [
    ...(inlineReasoning ? [inlineReasoning] : []),
    ...lines.slice(start + 1, end),
  ];
  const reasoning = reasoningLines.join("\n").trim();
  const cleaned = [...lines.slice(0, start), ...lines.slice(end)].join("\n").trim();
  return { text: cleaned, reasoning: reasoning || undefined };
};

const extractReasoningSummary = (raw: any) => {
  const extractFromItem = (item: any) => {
    if (!item || item.type !== "reasoning") return "";
    const summary = item.summary;
    if (typeof summary === "string") return summary;
    if (Array.isArray(summary)) {
      return summary.map((s: any) => (typeof s === "string" ? s : s?.text || "")).join("");
    }
    return "";
  };

  if (!raw) return undefined;

  if (Array.isArray(raw)) {
    let text = "";
    raw.forEach((event) => {
      const type = typeof event?.type === "string" ? event.type : "";
      if (type.includes("reasoning_summary_text.delta") && typeof event.delta === "string") {
        text += event.delta;
        return;
      }
      if (type.includes("reasoning_summary_part.added")) {
        const part = event?.part || event?.summary || event?.item;
        const partText = typeof part === "string" ? part : part?.text;
        if (partText) text += partText;
        return;
      }
      if (event?.item) {
        const itemText = extractFromItem(event.item);
        if (itemText) text += itemText;
      }
      if (Array.isArray(event?.output)) {
        const outSummary = extractReasoningSummary({ output: event.output });
        if (outSummary) text += outSummary;
      }
    });
    return text.trim() ? text : undefined;
  }

  const eventType = typeof raw?.type === "string" ? raw.type : "";
  if (eventType.includes("reasoning_summary_text.delta") && typeof raw.delta === "string") return raw.delta;
  if (eventType.includes("reasoning_summary_part.added")) {
    const part = raw?.part || raw?.summary || raw?.item;
    const partText = typeof part === "string" ? part : part?.text;
    if (partText) return partText;
  }
  if (raw?.item) {
    const itemText = extractFromItem(raw.item);
    if (itemText) return itemText;
  }

  const output = raw?.output;
  if (!Array.isArray(output)) return undefined;
  for (const item of output) {
    const summary = extractFromItem(item);
    if (summary) return summary;
  }
  return undefined;
};

const extractSearchUsage = (raw: any) => {
  if (!raw) return false;
  if (Array.isArray(raw)) {
    return raw.some((event) => {
      const type = typeof event?.type === "string" ? event.type : "";
      if (type.includes("web_search")) return true;
      if (event?.item?.type && `${event.item.type}`.includes("web_search")) return true;
      if (Array.isArray(event?.output)) return extractSearchUsage({ output: event.output });
      return false;
    });
  }
  const output = raw?.output;
  if (!Array.isArray(output)) return false;
  return output.some((item: any) => {
    const type = typeof item?.type === "string" ? item.type : "";
    return type.includes("web_search");
  });
};

const extractSearchQueries = (raw: any) => {
  if (!raw) return [];
  const queries: string[] = [];
  const collectFromItem = (item: any) => {
    if (!item || typeof item !== "object") return;
    const type = typeof item.type === "string" ? item.type : "";
    if (!type.includes("web_search")) return;
    const query = item.query || item.input || item.q;
    if (typeof query === "string" && query.trim()) queries.push(query.trim());
  };
  if (Array.isArray(raw)) {
    raw.forEach((event) => {
      collectFromItem(event?.item);
      if (Array.isArray(event?.output)) {
        extractSearchQueries({ output: event.output }).forEach((q) => queries.push(q));
      }
    });
    return Array.from(new Set(queries));
  }
  const output = raw?.output;
  if (!Array.isArray(output)) return [];
  output.forEach((item: any) => collectFromItem(item));
  return Array.from(new Set(queries));
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

const hasKey = (obj: any, key: string) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const mergeCharacterForms = (
  existingForms: any[],
  incomingForms: any[] | undefined,
  mode: "merge" | "replace",
  formsToDelete: string[]
) => {
  if (!Array.isArray(existingForms)) existingForms = [];
  const deleteSet = new Set(formsToDelete || []);
  if (!Array.isArray(incomingForms)) {
    return existingForms.filter((form) => !deleteSet.has(form.id));
  }

  const normalizedIncoming = incomingForms.map((form) => ({
    ...form,
    id: ensureStableId(form?.id, "form"),
  }));

  if (mode === "replace") {
    const next = normalizedIncoming.map((form) => ({
      id: form.id,
      formName: form.formName || "Standard",
      episodeRange: form.episodeRange || "",
      description: form.description || "",
      visualTags: form.visualTags || "",
      identityOrState: form.identityOrState,
      hair: form.hair,
      face: form.face,
      body: form.body,
      costume: form.costume,
      accessories: form.accessories,
      props: form.props,
      materialPalette: form.materialPalette,
      poses: form.poses,
      expressions: form.expressions,
      lightingOrPalette: form.lightingOrPalette,
      turnaroundNeeded: form.turnaroundNeeded,
      deliverables: form.deliverables,
      designRationale: form.designRationale,
      styleRef: form.styleRef,
      genPrompts: form.genPrompts,
    }));
    return next.filter((form) => !deleteSet.has(form.id));
  }

  const nextForms = existingForms.map((form) => ({ ...form }));
  const indexById = new Map(nextForms.map((form, idx) => [form.id, idx]));
  const additions: any[] = [];

  normalizedIncoming.forEach((incoming) => {
    const idx = indexById.get(incoming.id);
    if (idx !== undefined) {
      const current = nextForms[idx];
      const updated = { ...current };
      if (hasKey(incoming, "formName")) updated.formName = incoming.formName;
      if (hasKey(incoming, "episodeRange")) updated.episodeRange = incoming.episodeRange;
      if (hasKey(incoming, "description")) updated.description = incoming.description;
      if (hasKey(incoming, "visualTags")) updated.visualTags = incoming.visualTags;
      if (hasKey(incoming, "identityOrState")) updated.identityOrState = incoming.identityOrState;
      if (hasKey(incoming, "hair")) updated.hair = incoming.hair;
      if (hasKey(incoming, "face")) updated.face = incoming.face;
      if (hasKey(incoming, "body")) updated.body = incoming.body;
      if (hasKey(incoming, "costume")) updated.costume = incoming.costume;
      if (hasKey(incoming, "accessories")) updated.accessories = incoming.accessories;
      if (hasKey(incoming, "props")) updated.props = incoming.props;
      if (hasKey(incoming, "materialPalette")) updated.materialPalette = incoming.materialPalette;
      if (hasKey(incoming, "poses")) updated.poses = incoming.poses;
      if (hasKey(incoming, "expressions")) updated.expressions = incoming.expressions;
      if (hasKey(incoming, "lightingOrPalette")) updated.lightingOrPalette = incoming.lightingOrPalette;
      if (hasKey(incoming, "turnaroundNeeded")) updated.turnaroundNeeded = incoming.turnaroundNeeded;
      if (hasKey(incoming, "deliverables")) updated.deliverables = incoming.deliverables;
      if (hasKey(incoming, "designRationale")) updated.designRationale = incoming.designRationale;
      if (hasKey(incoming, "styleRef")) updated.styleRef = incoming.styleRef;
      if (hasKey(incoming, "genPrompts")) updated.genPrompts = incoming.genPrompts;
      nextForms[idx] = updated;
      return;
    }
    additions.push({
      id: incoming.id,
      formName: incoming.formName || "Standard",
      episodeRange: incoming.episodeRange || "",
      description: incoming.description || "",
      visualTags: incoming.visualTags || "",
      identityOrState: incoming.identityOrState,
      hair: incoming.hair,
      face: incoming.face,
      body: incoming.body,
      costume: incoming.costume,
      accessories: incoming.accessories,
      props: incoming.props,
      materialPalette: incoming.materialPalette,
      poses: incoming.poses,
      expressions: incoming.expressions,
      lightingOrPalette: incoming.lightingOrPalette,
      turnaroundNeeded: incoming.turnaroundNeeded,
      deliverables: incoming.deliverables,
      designRationale: incoming.designRationale,
      styleRef: incoming.styleRef,
      genPrompts: incoming.genPrompts,
    });
  });

  return [...nextForms, ...additions].filter((form) => !deleteSet.has(form.id));
};

const mergeLocationZones = (
  existingZones: any[],
  incomingZones: any[] | undefined,
  mode: "merge" | "replace",
  zonesToDelete: string[]
) => {
  if (!Array.isArray(existingZones)) existingZones = [];
  const deleteSet = new Set(zonesToDelete || []);
  if (!Array.isArray(incomingZones)) {
    return existingZones.filter((zone) => !deleteSet.has(zone.id));
  }

  const normalizedIncoming = incomingZones.map((zone) => ({
    ...zone,
    id: ensureStableId(zone?.id, "zone"),
  }));

  if (mode === "replace") {
    const next = normalizedIncoming.map((zone) => ({
      id: zone.id,
      name: zone.name || "主分区",
      kind: zone.kind || "unspecified",
      episodeRange: zone.episodeRange || "",
      layoutNotes: zone.layoutNotes || "",
      keyProps: zone.keyProps || "",
      lightingWeather: zone.lightingWeather || "",
      materialPalette: zone.materialPalette || "",
      designRationale: zone.designRationale,
      deliverables: zone.deliverables,
      genPrompts: zone.genPrompts,
    }));
    return next.filter((zone) => !deleteSet.has(zone.id));
  }

  const nextZones = existingZones.map((zone) => ({ ...zone }));
  const indexById = new Map(nextZones.map((zone, idx) => [zone.id, idx]));
  const additions: any[] = [];

  normalizedIncoming.forEach((incoming) => {
    const idx = indexById.get(incoming.id);
    if (idx !== undefined) {
      const current = nextZones[idx];
      const updated = { ...current };
      if (hasKey(incoming, "name")) updated.name = incoming.name;
      if (hasKey(incoming, "kind")) updated.kind = incoming.kind;
      if (hasKey(incoming, "episodeRange")) updated.episodeRange = incoming.episodeRange;
      if (hasKey(incoming, "layoutNotes")) updated.layoutNotes = incoming.layoutNotes;
      if (hasKey(incoming, "keyProps")) updated.keyProps = incoming.keyProps;
      if (hasKey(incoming, "lightingWeather")) updated.lightingWeather = incoming.lightingWeather;
      if (hasKey(incoming, "materialPalette")) updated.materialPalette = incoming.materialPalette;
      if (hasKey(incoming, "designRationale")) updated.designRationale = incoming.designRationale;
      if (hasKey(incoming, "deliverables")) updated.deliverables = incoming.deliverables;
      if (hasKey(incoming, "genPrompts")) updated.genPrompts = incoming.genPrompts;
      nextZones[idx] = updated;
      return;
    }
    additions.push({
      id: incoming.id,
      name: incoming.name || "主分区",
      kind: incoming.kind || "unspecified",
      episodeRange: incoming.episodeRange || "",
      layoutNotes: incoming.layoutNotes || "",
      keyProps: incoming.keyProps || "",
      lightingWeather: incoming.lightingWeather || "",
      materialPalette: incoming.materialPalette || "",
      designRationale: incoming.designRationale,
      deliverables: incoming.deliverables,
      genPrompts: incoming.genPrompts,
    });
  });

  return [...nextZones, ...additions].filter((zone) => !deleteSet.has(zone.id));
};

const updateDesignAssetsForCharacter = (assets: any[], character: any, formsToDelete: string[]) => {
  const prefix = `${character.id}|`;
  const deleteSet = new Set(formsToDelete || []);
  const formNameById = new Map((character.forms || []).map((form: any) => [form.id, form.formName]));
  return (assets || [])
    .filter((asset) => {
      if (asset.category !== "form" || !asset.refId?.startsWith(prefix)) return true;
      const formId = asset.refId.slice(prefix.length);
      return !deleteSet.has(formId);
    })
    .map((asset) => {
      if (asset.category !== "form" || !asset.refId?.startsWith(prefix)) return asset;
      const formId = asset.refId.slice(prefix.length);
      const formName = formNameById.get(formId);
      if (!formName) return asset;
      return { ...asset, label: `${character.name} · ${formName}` };
    });
};

const updateDesignAssetsForLocation = (assets: any[], location: any, zonesToDelete: string[]) => {
  const prefix = `${location.id}|`;
  const deleteSet = new Set(zonesToDelete || []);
  const zoneNameById = new Map((location.zones || []).map((zone: any) => [zone.id, zone.name]));
  return (assets || [])
    .filter((asset) => {
      if (asset.category !== "zone" || !asset.refId?.startsWith(prefix)) return true;
      const zoneId = asset.refId.slice(prefix.length);
      return !deleteSet.has(zoneId);
    })
    .map((asset) => {
      if (asset.category !== "zone" || !asset.refId?.startsWith(prefix)) return asset;
      const zoneId = asset.refId.slice(prefix.length);
      const zoneName = zoneNameById.get(zoneId);
      if (!zoneName) return asset;
      return { ...asset, label: `${location.name} · ${zoneName}` };
    });
};

const upsertCharacter = (prev: ProjectData, args: any) => {
  const input = args?.character || {};
  const mergeStrategy = args?.mergeStrategy === "replace" ? "replace" : "patch";
  const formsMode = args?.formsMode === "replace" ? "replace" : "merge";
  const formsToDelete = Array.isArray(args?.formsToDelete) ? args.formsToDelete : [];
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const chars = [...(prev.context.characters || [])];
  let matchIndex = -1;
  if (input.id) {
    matchIndex = chars.findIndex((c) => c.id === input.id);
  }
  if (matchIndex < 0 && name) {
    matchIndex = chars.findIndex((c) => c.name === name);
  }
  const existing = matchIndex >= 0 ? chars[matchIndex] : null;
  const id = input.id || existing?.id || createStableId("char");

  let next = existing
    ? { ...existing }
    : {
        id,
        name: name || "",
        role: "",
        isMain: false,
        bio: "",
        forms: [],
      };

  if (mergeStrategy === "replace") {
    next = {
      id,
      name: name || existing?.name || "",
      role: "",
      isMain: false,
      bio: "",
      forms: Array.isArray(existing?.forms) ? existing?.forms : [],
      assetPriority: existing?.assetPriority,
      archetype: existing?.archetype,
      episodeUsage: existing?.episodeUsage,
      tags: existing?.tags,
      appearanceCount: existing?.appearanceCount,
    };
  }

  if (hasKey(input, "name")) next.name = input.name;
  if (hasKey(input, "role")) next.role = input.role;
  if (hasKey(input, "isMain")) next.isMain = input.isMain;
  if (hasKey(input, "bio")) next.bio = input.bio;
  if (hasKey(input, "assetPriority")) next.assetPriority = input.assetPriority;
  if (hasKey(input, "archetype")) next.archetype = input.archetype;
  if (hasKey(input, "episodeUsage")) next.episodeUsage = input.episodeUsage;
  if (hasKey(input, "tags")) next.tags = input.tags;

  const hasIncomingForms = Array.isArray(input.forms);
  if (hasIncomingForms || formsToDelete.length > 0) {
    next.forms = mergeCharacterForms(
      next.forms || [],
      hasIncomingForms ? input.forms : undefined,
      formsMode,
      formsToDelete
    );
  }

  const designAssets = updateDesignAssetsForCharacter(prev.designAssets || [], next, formsToDelete);
  const updatedChars = [...chars];
  if (existing && matchIndex >= 0) {
    updatedChars[matchIndex] = next;
  } else {
    updatedChars.push(next);
  }

  return {
    next: {
      ...prev,
      context: { ...prev.context, characters: updatedChars },
      designAssets,
    },
    result: {
      kind: "character",
      action: existing ? "updated" : "created",
      id: next.id,
      name: next.name,
      formsCount: (next.forms || []).length,
    },
  };
};

const upsertLocation = (prev: ProjectData, args: any) => {
  const input = args?.location || {};
  const mergeStrategy = args?.mergeStrategy === "replace" ? "replace" : "patch";
  const zonesMode = args?.zonesMode === "replace" ? "replace" : "merge";
  const zonesToDelete = Array.isArray(args?.zonesToDelete) ? args.zonesToDelete : [];
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const locations = [...(prev.context.locations || [])];
  let matchIndex = -1;
  if (input.id) {
    matchIndex = locations.findIndex((l) => l.id === input.id);
  }
  if (matchIndex < 0 && name) {
    matchIndex = locations.findIndex((l) => l.name === name);
  }
  const existing = matchIndex >= 0 ? locations[matchIndex] : null;
  const id = input.id || existing?.id || createStableId("loc");

  let next = existing
    ? { ...existing }
    : {
        id,
        name: name || "",
        type: "secondary",
        description: "",
        visuals: "",
        zones: [],
      };

  if (mergeStrategy === "replace") {
    next = {
      id,
      name: name || existing?.name || "",
      type: existing?.type || "secondary",
      description: "",
      visuals: "",
      zones: Array.isArray(existing?.zones) ? existing?.zones : [],
      assetPriority: existing?.assetPriority,
      episodeUsage: existing?.episodeUsage,
    };
  }

  if (hasKey(input, "name")) next.name = input.name;
  if (hasKey(input, "type") && (input.type === "core" || input.type === "secondary")) next.type = input.type;
  if (hasKey(input, "description")) next.description = input.description;
  if (hasKey(input, "visuals")) next.visuals = input.visuals;
  if (hasKey(input, "assetPriority")) next.assetPriority = input.assetPriority;
  if (hasKey(input, "episodeUsage")) next.episodeUsage = input.episodeUsage;

  const hasIncomingZones = Array.isArray(input.zones);
  if (hasIncomingZones || zonesToDelete.length > 0) {
    next.zones = mergeLocationZones(
      next.zones || [],
      hasIncomingZones ? input.zones : undefined,
      zonesMode,
      zonesToDelete
    );
  }

  const designAssets = updateDesignAssetsForLocation(prev.designAssets || [], next, zonesToDelete);
  const updatedLocs = [...locations];
  if (existing && matchIndex >= 0) {
    updatedLocs[matchIndex] = next;
  } else {
    updatedLocs.push(next);
  }

  return {
    next: {
      ...prev,
      context: { ...prev.context, locations: updatedLocs },
      designAssets,
    },
    result: {
      kind: "location",
      action: existing ? "updated" : "created",
      id: next.id,
      name: next.name,
      zonesCount: (next.zones || []).length,
    },
  };
};

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

const buildConversationMemory = (messages: Message[], limit = 8) => {
  const history = messages
    .filter((m) => !isToolMessage(m))
    .map((m) => {
      const text = (m as ChatMessage).text?.trim();
      if (!text) return null;
      const clipped = text.length > 800 ? `${text.slice(0, 800)}...` : text;
      const label = m.role === "user" ? "用户" : "助手";
      return `${label}: ${clipped}`;
    })
    .filter(Boolean) as string[];
  return history.slice(-limit).join("\n");
};

export const QalamAgent: React.FC<Props> = ({ projectData, setProjectData, onOpenStats, onToggleAgentSettings }) => {
  const { config, setConfig } = useConfig("script2video_config_v1");
  const [collapsed, setCollapsed] = useState(true);
  const [mood, setMood] = useState<"default" | "thinking" | "loading" | "playful" | "question">("default");
  const [input, setInput] = useState("");
  const [messages, setMessagesState] = usePersistedState<Message[]>({
    key: "script2video_qalam_messages_v1",
    initialValue: [],
    serialize: (value) => JSON.stringify(value),
    deserialize: (value) => {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
  });
  const clampMessages = useCallback((items: Message[]) => items.slice(-120), []);
  const setMessages = useCallback(
    (updater: Message[] | ((prev: Message[]) => Message[])) => {
      setMessagesState((prev) => {
        const next = typeof updater === "function" ? (updater as (p: Message[]) => Message[])(prev) : updater;
        return clampMessages(next);
      });
    },
    [setMessagesState, clampMessages]
  );
  const [isSending, setIsSending] = useState(false);
  const [ctxSelection, setCtxSelection] = useState({
    script: true,
    style: true,
    guides: false,
    summary: false,
  });
  const [attachments, setAttachments] = useState<{ name: string; url: string; size: number; type: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentUrlsRef = useRef<string[]>([]);
  const messagesRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [layoutMode, setLayoutMode] = useState<"floating" | "split">("floating");
  const [splitWidth, setSplitWidth] = useState(560);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const isDeyunaiProvider = config.textConfig.provider === "deyunai";
  const searchEnabledInUi = useMemo(
    () => Array.isArray(config.textConfig.tools) && config.textConfig.tools.some((tool: any) => tool?.type === "web_search_preview"),
    [config.textConfig.tools]
  );

  const updateToolStatus = (callId: string, status: ToolStatus, summary?: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (!isToolMessage(m) || m.tool.callId !== callId) return m;
        return { ...m, tool: { ...m.tool, status, summary: summary ?? m.tool.summary } };
      })
    );
  };

  const appendToolResult = (payload: ToolPayload) => {
    setMessages((prev) => [...prev, { role: "assistant", kind: "tool_result", tool: payload }]);
  };

  const executeToolCall = (call: DeyunAIToolCall) => {
    const args = parseToolArguments(call.arguments);
    if (call.name === "upsert_character") {
      let result: any = null;
      setProjectData((prev) => {
        const { next, result: res } = upsertCharacter(prev, args);
        result = res;
        return next;
      });
      return result;
    }
    if (call.name === "upsert_location") {
      let result: any = null;
      setProjectData((prev) => {
        const { next, result: res } = upsertLocation(prev, args);
        result = res;
        return next;
      });
      return result;
    }
    throw new Error(`未知工具: ${call.name || "unknown"}`);
  };

  const canSend = input.trim().length > 0 && !isSending;
  const splitMinWidth = Math.min(360, Math.max(280, Math.round(viewportWidth * 0.4)));
  const splitMaxWidth = viewportWidth;
  const splitThreshold = 0.72;
  const handleSplitToggle = () => {
    setLayoutMode((prev) => (prev === "split" ? "floating" : "split"));
    setIsFullscreen(false);
    if (typeof window !== "undefined") {
      const width = window.innerWidth;
      setViewportWidth(width);
      if (layoutMode !== "split") {
        const target = Math.round(width * 0.5);
        const localMin = Math.min(360, Math.max(280, Math.round(width * 0.4)));
        const nextWidth = Math.min(Math.max(target, localMin), width);
        setSplitWidth(nextWidth);
        setIsFullscreen(nextWidth >= width * splitThreshold);
      }
    }
  };

  const toggleSearch = () => {
    if (!isDeyunaiProvider) return;
    setConfig((prev) => {
      const tools = Array.isArray(prev.textConfig.tools) ? [...prev.textConfig.tools] : [];
      const hasSearch = tools.some((tool: any) => tool?.type === "web_search_preview");
      const nextTools = hasSearch
        ? tools.filter((tool: any) => tool?.type !== "web_search_preview")
        : [...tools, { type: "web_search_preview" }];
      return { ...prev, textConfig: { ...prev.textConfig, tools: nextTools } };
    });
  };

  useEffect(() => {
    if (layoutMode !== "split") return;
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      setIsFullscreen(splitWidth >= window.innerWidth * splitThreshold);
    };
    const handleMove = (e: MouseEvent) => {
      if (!dragStateRef.current) return;
      const delta = e.clientX - dragStateRef.current.startX;
      const nextWidth = Math.min(splitMaxWidth, Math.max(splitMinWidth, dragStateRef.current.startWidth + delta));
      const isWide = nextWidth >= window.innerWidth * splitThreshold;
      setSplitWidth(nextWidth);
      setIsFullscreen(isWide);
    };
    const handleUp = () => {
      dragStateRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("resize", handleResize);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("resize", handleResize);
    };
  }, [layoutMode, splitMaxWidth, splitMinWidth, splitThreshold, splitWidth]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const className = "qalam-split";
    const shouldSplit = layoutMode === "split" && !collapsed;
    if (shouldSplit) {
      root.classList.add(className);
      const width = isFullscreen ? viewportWidth : splitWidth;
      root.style.setProperty("--qalam-split-width", `${width}px`);
    } else {
      root.classList.remove(className);
      root.style.removeProperty("--qalam-split-width");
    }
    return () => {
      root.classList.remove(className);
      root.style.removeProperty("--qalam-split-width");
    };
  }, [layoutMode, splitWidth, isFullscreen, viewportWidth, collapsed]);
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
    return `${base}${attachText}`;
  }, [projectData, ctxSelection, attachments]);

  const sendMessage = async () => {
    if (!canSend) return;
    setMood("loading");
    const userMsg: Message = { role: "user", text: input.trim(), kind: "chat" };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);
    const isDeyunai = config.textConfig.provider === "deyunai";
    const useStream = isDeyunai ? config.textConfig.stream ?? true : false;
    let assistantIndex = -1;
    try {
      const systemInstruction =
        "You are Qalam, a creative agent helping build this project. Keep responses concise. You can use Markdown. Do not include chain-of-thought or internal reasoning; respond with final answers only.";
      const toolHint = isDeyunai
        ? "\n[Tooling]\n- 当用户要求创建/更新角色或场景时，优先调用对应工具。\n- 证据仅给出剧集-场景（如 1-1）。\n- 允许局部更新，不要重复未变化字段。"
        : "";
      const memoryText = buildConversationMemory(messages);
      const memoryBlock = memoryText ? `[Conversation]\n${memoryText}\n\n` : "";
      const prompt = `${contextText ? contextText + "\n\n" : ""}${memoryBlock}[System]\n${systemInstruction}${toolHint}\n\n${userMsg.text}\n\n请直接回答问题，简洁输出。`;

      if (isDeyunai) {
        const toolsFromConfig = Array.isArray(config.textConfig.tools) ? config.textConfig.tools : [];
        const searchEnabled = toolsFromConfig.some((tool: any) => tool?.type === "web_search_preview");
        const mergedTools: DeyunAITool[] = [];
        const seen = new Set<string>();
        [...TOOL_DEFS, ...toolsFromConfig].forEach((tool) => {
          const key = tool.type === "function" ? `function:${tool.name}` : tool.type;
          if (seen.has(key)) return;
          seen.add(key);
          mergedTools.push(tool);
        });

        if (useStream) {
          setMessages((prev) => {
            assistantIndex = prev.length;
            return [
              ...prev,
              {
                role: "assistant",
                text: "",
                kind: "chat",
                meta: { thinkingStatus: "active", searchEnabled },
              },
            ];
          });
        }

        let reasoningSummary = "";
        let searchUsed = false;
        let searchQueries: string[] = [];
        const { text, toolCalls, raw } = await DeyunAIService.createReasoningResponse(
          prompt,
          { apiKey: config.textConfig.apiKey, baseUrl: config.textConfig.baseUrl },
          {
            model: config.textConfig.model || "gpt-5.1",
            reasoningEffort: config.textConfig.reasoningEffort || "medium",
            verbosity: config.textConfig.verbosity || "medium",
            stream: useStream,
            store: config.textConfig.store ?? true,
            tools: mergedTools,
          },
          useStream
            ? (delta, rawDelta) => {
                if (delta) {
                  setMessages((prev) => {
                    if (assistantIndex === -1) assistantIndex = prev.length - 1;
                    return prev.map((m, idx) => {
                      if (idx !== assistantIndex || isToolMessage(m)) return m;
                      return { ...m, text: (m.text || "") + delta };
                    });
                  });
                }
                const summary = extractReasoningSummary(rawDelta);
                const usedSearch = extractSearchUsage(rawDelta);
                const queries = extractSearchQueries(rawDelta);
                if (queries.length) {
                  searchQueries = Array.from(new Set([...searchQueries, ...queries]));
                  setMessages((prev) =>
                    prev.map((m, idx) => {
                      if (idx !== assistantIndex || isToolMessage(m)) return m;
                      return { ...m, meta: { ...m.meta, searchQueries, searchEnabled } };
                    })
                  );
                }
                if (usedSearch && !searchUsed) {
                  searchUsed = true;
                  setMessages((prev) =>
                    prev.map((m, idx) => {
                      if (idx !== assistantIndex || isToolMessage(m)) return m;
                      return { ...m, meta: { ...m.meta, searchUsed: true, searchEnabled } };
                    })
                  );
                }
                if (summary) {
                  reasoningSummary = `${reasoningSummary}${summary}`;
                  setMessages((prev) =>
                    prev.map((m, idx) => {
                      if (idx !== assistantIndex || isToolMessage(m)) return m;
                      return {
                        ...m,
                        meta: {
                          ...m.meta,
                          reasoningSummary,
                          thinkingStatus: "active",
                          searchEnabled,
                          searchUsed,
                          searchQueries,
                        },
                      };
                    })
                  );
                }
              }
            : undefined
        );
        try {
          console.log("[Agent] DeyunAI full response", {
            text,
            toolCalls,
            raw,
          });
        } catch {}

        const summaryFromRaw = extractReasoningSummary(raw);
        const usedSearchFromRaw = extractSearchUsage(raw);
        const queriesFromRaw = extractSearchQueries(raw);
        if (queriesFromRaw.length) {
          searchQueries = Array.from(new Set([...searchQueries, ...queriesFromRaw]));
        }
        if (usedSearchFromRaw) searchUsed = true;
        if (summaryFromRaw) reasoningSummary = summaryFromRaw;

        const extractedReasoning = extractReasoningSection(text || "");
        const parsed = parsePlanFromText(extractedReasoning.text || "");
        if (useStream && assistantIndex !== -1) {
          setMessages((prev) =>
            prev.map((m, idx) => {
              if (idx !== assistantIndex || isToolMessage(m)) return m;
              return {
                ...m,
                text: parsed.text || m.text,
                meta: {
                  ...m.meta,
                  planItems: parsed.planItems,
                  reasoningSummary:
                    reasoningSummary || (m.meta?.reasoningSummary === "思考中..." ? undefined : m.meta?.reasoningSummary),
                  thinkingStatus: "done",
                  searchEnabled,
                  searchUsed,
                  searchQueries,
                },
              };
            })
          );
        } else if (text && text.trim()) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: parsed.text || text,
              kind: "chat",
              meta: {
                planItems: parsed.planItems,
                reasoningSummary: reasoningSummary || undefined,
                thinkingStatus: "done",
                searchEnabled,
                searchUsed,
                searchQueries,
              },
            },
          ]);
        }

        if (toolCalls?.length) {
          const baseTs = Date.now();
          const toolMeta = toolCalls.map((tc: DeyunAIToolCall, idx: number) => {
            const args = parseToolArguments(tc.arguments);
            const callId = tc.callId || `${tc.name || "tool"}-${baseTs}-${idx}`;
            return { tc, args, callId };
          });
          const toolMessages: ToolMessage[] = toolMeta.map(({ tc, args, callId }) => ({
            role: "assistant",
            kind: "tool",
            tool: {
              name: tc.name || "tool",
              status: "queued",
              summary: buildToolSummary(tc.name, args),
              evidence: Array.isArray(args?.evidence) ? args.evidence : undefined,
              callId,
            },
          }));
          setMessages((prev) => [...prev, ...toolMessages]);

          for (const { tc, args, callId } of toolMeta) {
            updateToolStatus(callId, "running");
            try {
              if (tc.name !== "upsert_character" && tc.name !== "upsert_location") {
                updateToolStatus(callId, "success");
                appendToolResult({
                  name: tc.name || "tool",
                  status: "success",
                  summary: "系统工具已执行",
                  evidence: Array.isArray(args?.evidence) ? args.evidence : undefined,
                  callId,
                });
                continue;
              }
              const result = executeToolCall(tc);
              updateToolStatus(callId, "success");
              const summary =
                result?.kind === "character"
                  ? `已${result.action === "created" ? "创建" : "更新"}角色 ${result.name}（形态 ${result.formsCount ?? 0} 个）`
                  : result?.kind === "location"
                  ? `已${result.action === "created" ? "创建" : "更新"}场景 ${result.name}（分区 ${result.zonesCount ?? 0} 个）`
                  : buildToolSummary(tc.name, args);
              appendToolResult({
                name: tc.name || "tool",
                status: "success",
                summary,
                evidence: Array.isArray(args?.evidence) ? args.evidence : undefined,
                callId,
              });
            } catch (toolErr: any) {
              updateToolStatus(callId, "error");
              appendToolResult({
                name: tc.name || "tool",
                status: "error",
                summary: toolErr?.message || "工具执行失败",
                evidence: Array.isArray(args?.evidence) ? args.evidence : undefined,
                callId,
              });
            }
          }
        }

        setIsSending(false);
        setMood("thinking");
        return;
      }

      if (useStream) {
        setMessages((prev) => {
          assistantIndex = prev.length;
          return [...prev, { role: "assistant", text: "", kind: "chat" }];
        });
      }
      const res = await GeminiService.generateFreeformText(
        config.textConfig,
        prompt,
        systemInstruction,
        useStream
          ? {
              onStream: (delta) => {
                setMessages((prev) => {
                  if (assistantIndex === -1) assistantIndex = prev.length - 1;
                  return prev.map((m, idx) => {
                    if (idx !== assistantIndex || isToolMessage(m)) return m;
                    return { ...m, text: (m.text || "") + delta };
                  });
                });
              },
            }
          : undefined
      );
      try {
        console.log("[Agent] Raw response", res);
      } catch {}
      if (useStream && assistantIndex !== -1) {
        const extracted = extractReasoningSection(res.outputText || "");
        const parsed = parsePlanFromText(extracted.text || "");
        setMessages((prev) =>
          prev.map((m, idx) => {
            if (idx !== assistantIndex || isToolMessage(m)) return m;
            return { ...m, text: parsed.text || m.text, meta: { ...m.meta, planItems: parsed.planItems } };
          })
        );
      } else {
        const extracted = extractReasoningSection(res.outputText || "");
        const parsed = parsePlanFromText(extracted.text || "");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: parsed.text || "", kind: "chat", meta: { planItems: parsed.planItems } },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `请求失败: ${err?.message || err}`, kind: "chat" },
      ]);
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
  const isSplit = layoutMode === "split";
  const panelClassName = isSplit
    ? "pointer-events-auto app-panel flex flex-col overflow-hidden qalam-panel border-r border-[var(--app-border)] rounded-none"
    : "pointer-events-auto w-[400px] max-w-[95vw] h-[calc(100vh-32px)] max-h-[calc(100vh-32px)] rounded-2xl app-panel flex flex-col overflow-hidden qalam-panel";
  const panelStyle: React.CSSProperties | undefined = isSplit
    ? {
        position: "fixed",
        top: 0,
        bottom: 0,
        left: 0,
        right: isFullscreen ? 0 : undefined,
        width: isFullscreen ? "100vw" : splitWidth,
        maxWidth: "100vw",
      }
    : undefined;
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

  const renderAssistantPanel = (message: ChatMessage) => {
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
            defaultOpen
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

  useEffect(() => {
    if (!messagesRef.current) return;
    const node = messagesRef.current;
    requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
  }, [messages, isSending]);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-2 h-10 px-3 rounded-full app-panel transition-all duration-300 ease-out"
      >
        <span className={`flex items-center justify-center h-7 w-7 rounded-full ${moodState.bg} transition-all duration-300 ease-out`}>
          {moodState.icon}
        </span>
        <span className="text-xs font-semibold">Qalam</span>
        <ChevronUp size={14} className="text-[var(--app-text-secondary)]" />
      </button>
    );
  }

  // Safe spacing: use symmetric top/bottom gaps equal to the bottom offset (16px).
  return (
    <div className={panelClassName} style={panelStyle}>
      {isSplit && !isFullscreen && (
        <div
          className="absolute right-0 top-0 h-full w-2 cursor-col-resize z-20"
          onMouseDown={(e) => {
            dragStateRef.current = { startX: e.clientX, startWidth: splitWidth };
          }}
        />
      )}
      <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-[var(--app-border)]">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500/30 via-emerald-500/10 to-transparent border border-[var(--app-border)] flex items-center justify-center">
            <Bot size={16} className="text-emerald-200" />
          </div>
          <div className="space-y-0.5">
            <div className="text-sm font-semibold">Qalam</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleAgentSettings}
                className="h-6 w-6 flex items-center justify-center rounded-full border border-[var(--app-border)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-muted)] transition"
                title="服务商设置"
              >
                <Globe size={12} className="text-[var(--app-text-secondary)]" />
              </button>
              <button
                type="button"
                onClick={onOpenStats}
                className="text-[11px] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] underline decoration-dashed decoration-[var(--app-border-strong)] transition"
                title="查看 Dashboard"
              >
                Tokens · {formatNumber(tokenUsage)}
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSplitToggle}
            className="h-8 w-8 rounded-full border border-[var(--app-border)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-muted)] transition"
            title={isSplit ? "Exit Split View" : "Split View"}
          >
            <Columns size={14} className="mx-auto text-[var(--app-text-secondary)]" />
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="h-8 w-8 rounded-full border border-[var(--app-border)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-muted)] transition"
            title="Close"
          >
            <X size={14} className="mx-auto text-[var(--app-text-secondary)]" />
          </button>
        </div>
      </div>

      <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m, idx) => {
          const isUser = m.role === "user";
          const isAssistantPanel = !isUser && !isToolMessage(m);
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
                renderAssistantPanel(m)
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
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
                  active ? "bg-[var(--app-panel-soft)] border-[var(--app-border-strong)] text-[var(--app-text-primary)]" : "border-[var(--app-border)] text-[var(--app-text-secondary)] hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-primary)]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="rounded-2xl bg-[var(--app-panel-soft)] border border-[var(--app-border)] px-3 py-3 space-y-3">
          <textarea
            className="w-full bg-transparent text-[13px] text-[var(--app-text-primary)] placeholder:text-[var(--app-text-secondary)] resize-none focus:outline-none"
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
          <div className="flex items-center gap-2 text-[12px] text-[var(--app-text-secondary)]">
            <button
              onClick={handleUploadClick}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-[var(--app-panel-muted)] border border-[var(--app-border)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-soft)] transition"
              title="上传图片作为上下文"
            >
              <Plus size={14} />
            </button>
            <div className="relative h-8 px-3 rounded-full bg-[var(--app-panel-muted)] border border-[var(--app-border)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-soft)] transition flex items-center gap-2 min-w-[140px]">
              <span className="truncate text-[var(--app-text-primary)]">{currentModelLabel}</span>
              <CaretDown size={12} className="text-[var(--app-text-muted)] pointer-events-none" />
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
                  <option key={m.id} value={m.id} className="bg-[var(--app-panel)] text-[var(--app-text-primary)]">
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            {isDeyunaiProvider && (
              <button
                type="button"
                onClick={toggleSearch}
                className={`h-8 px-3 rounded-full border text-[11px] flex items-center gap-2 transition ${
                  searchEnabledInUi
                    ? "border-sky-400/60 text-sky-200 bg-sky-400/10"
                    : "border-[var(--app-border)] text-[var(--app-text-secondary)] hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-primary)]"
                }`}
                title={searchEnabledInUi ? "关闭搜索" : "开启搜索"}
              >
                <Globe size={12} />
                搜索
              </button>
            )}
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
                  className="inline-flex items-center gap-2 px-2 py-1.5 rounded-full border border-[var(--app-border)] bg-white/8 text-[11px]"
                  title={`${item.name} (${(item.size / 1024).toFixed(1)} KB)`}
                >
                  <div className="h-7 w-7 rounded-md overflow-hidden border border-[var(--app-border)] bg-[var(--app-panel-muted)]">
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
