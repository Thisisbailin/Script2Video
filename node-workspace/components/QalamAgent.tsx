import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, ChevronUp, X, Plus, ArrowUp, Lightbulb, Sparkles, CircleHelp, ChevronDown as CaretDown, Globe, Columns } from "lucide-react";
import * as GeminiService from "../../services/geminiService";
import * as DeyunAIService from "../../services/deyunaiService";
import type { DeyunAITool, DeyunAIToolCall } from "../../services/deyunaiService";
import { useConfig } from "../../hooks/useConfig";
import { usePersistedState } from "../../hooks/usePersistedState";
import { ProjectData, Character, Location } from "../../types";
import { AVAILABLE_MODELS, DEYUNAI_MODELS } from "../../constants";
import { createStableId } from "../../utils/id";
import { buildApiUrl } from "../../utils/api";
import { QalamChatContent } from "./qalam/QalamChatContent";
import { isToolMessage } from "./qalam/types";
import type { ChatMessage, Message } from "./qalam/types";
import { getQalamToolDefs, normalizeQalamToolSettings } from "./qalam/tooling";
import { useQalamTooling } from "./qalam/useQalamTooling";

type Props = {
  projectData: ProjectData;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;
  onOpenStats?: () => void;
  onToggleAgentSettings?: () => void;
};

type ConversationRecord = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
};

type ConversationState = {
  activeId: string;
  items: ConversationRecord[];
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

  const extractDeltaText = (event: any) => {
    if (!event || typeof event !== "object") return "";
    if (typeof event.delta === "string") return event.delta;
    if (typeof event.text === "string") return event.text;
    if (typeof event.part?.text === "string") return event.part.text;
    if (typeof event.data?.delta === "string") return event.data.delta;
    if (typeof event.data?.text === "string") return event.data.text;
    return "";
  };

  if (Array.isArray(raw)) {
    let deltaText = "";
    let fallbackText = "";
    raw.forEach((event) => {
      const type = typeof event?.type === "string" ? event.type : "";
      if (type.includes("reasoning_summary_text.delta")) {
        const chunk = extractDeltaText(event);
        if (chunk) deltaText += chunk;
        return;
      }
      if (type.includes("reasoning_summary_part.added")) {
        const part = event?.part || event?.summary || event?.item;
        const partText = typeof part === "string" ? part : part?.text;
        if (partText) fallbackText += partText;
        return;
      }
      if (event?.item) {
        const itemText = extractFromItem(event.item);
        if (itemText) fallbackText += itemText;
      }
      if (event?.response) {
        const responseSummary = extractReasoningSummary(event.response);
        if (responseSummary) fallbackText += responseSummary;
      }
      if (Array.isArray(event?.output)) {
        const outSummary = extractReasoningSummary({ output: event.output });
        if (outSummary) fallbackText += outSummary;
      }
    });
    const finalText = deltaText.trim() ? deltaText : fallbackText.trim() ? fallbackText : "";
    return finalText || undefined;
  }

  const eventType = typeof raw?.type === "string" ? raw.type : "";
  if (eventType.includes("reasoning_summary_text.delta")) {
    const deltaText = extractDeltaText(raw);
    if (deltaText) return deltaText;
  }
  if (eventType.includes("reasoning_summary_part.added")) {
    return undefined;
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

const uploadAgentImage = async (source: string, contentType?: string) => {
  const response = await fetch(source);
  const blob = await response.blob();
  const finalType = blob.type || contentType || "image/png";
  const ext = finalType.split("/")[1] || "png";
  const fileName = `agent-inputs/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const signedRes = await fetch(buildApiUrl("/api/upload-url"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, bucket: "assets", contentType: finalType }),
  });
  if (!signedRes.ok) {
    const err = await signedRes.text();
    throw new Error(`上传 URL 获取失败 (${signedRes.status}): ${err}`);
  }
  const signedData = await signedRes.json();
  if (!signedData?.signedUrl) {
    throw new Error("上传失败：未返回签名 URL。");
  }

  const uploadRes = await fetch(signedData.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": finalType },
    body: blob,
  });
  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`上传失败 (${uploadRes.status}): ${err}`);
  }

  if (signedData.publicUrl) return signedData.publicUrl as string;
  if (signedData.path) {
    const downloadRes = await fetch(buildApiUrl("/api/download-url"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: signedData.path, bucket: signedData.bucket || "assets" }),
    });
    if (!downloadRes.ok) {
      const err = await downloadRes.text();
      throw new Error(`下载 URL 获取失败 (${downloadRes.status}): ${err}`);
    }
    const downloadData = await downloadRes.json();
    if (downloadData?.signedUrl) return downloadData.signedUrl as string;
  }

  throw new Error("上传失败：无法获取可访问的图片 URL。");
};


const buildContext = (projectData: ProjectData, selected: Record<string, boolean>) => {
  const parts: string[] = [];
  if (selected.script && projectData.rawScript) parts.push(`[Script]\n${projectData.rawScript.slice(0, 6000)}`);
  if (selected.style && projectData.globalStyleGuide) parts.push(`[Style Guide]\n${projectData.globalStyleGuide.slice(0, 2000)}`);
  if (selected.guides && projectData.shotGuide) parts.push(`[Shot Guide]\n${projectData.shotGuide.slice(0, 2000)}`);
  if (selected.guides && projectData.soraGuide) parts.push(`[Sora Guide]\n${projectData.soraGuide.slice(0, 2000)}`);
  if (selected.guides && projectData.storyboardGuide) parts.push(`[Storyboard Guide]\n${projectData.storyboardGuide.slice(0, 2000)}`);
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

const buildConversationTitle = (messages: Message[]) => {
  const firstUser = messages.find((m) => m.role === "user" && (m as ChatMessage).text?.trim()) as ChatMessage | undefined;
  if (!firstUser) return "新对话";
  const text = firstUser.text.trim();
  return text.length > 20 ? `${text.slice(0, 20)}...` : text;
};

const createConversationRecord = (messages: Message[] = []): ConversationRecord => {
  const now = Date.now();
  const title = buildConversationTitle(messages);
  return {
    id: createStableId("chat"),
    title,
    createdAt: now,
    updatedAt: now,
    messages,
  };
};

export const QalamAgent: React.FC<Props> = ({ projectData, setProjectData, onOpenStats, onToggleAgentSettings }) => {
  const { config, setConfig } = useConfig("script2video_config_v1");
  const [collapsed, setCollapsed] = useState(true);
  const [mood, setMood] = useState<"default" | "thinking" | "loading" | "playful" | "question">("default");
  const [input, setInput] = useState("");
  const [conversationState, setConversationState] = usePersistedState<ConversationState>({
    key: "script2video_qalam_conversations_v1",
    initialValue: { activeId: "", items: [] },
    serialize: (value) => JSON.stringify(value),
    deserialize: (value) => {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
          return {
            activeId: typeof parsed.activeId === "string" ? parsed.activeId : "",
            items: parsed.items,
          } as ConversationState;
        }
        return { activeId: "", items: [] };
      } catch {
        return { activeId: "", items: [] };
      }
    },
  });
  const clampMessages = useCallback((items: Message[]) => items.slice(-120), []);
  const activeConversation = useMemo(() => {
    if (!conversationState.items.length) return null;
    return (
      conversationState.items.find((item) => item.id === conversationState.activeId) ||
      conversationState.items[0] ||
      null
    );
  }, [conversationState.items, conversationState.activeId]);
  const messages = activeConversation?.messages || [];
  const setMessages = useCallback(
    (updater: Message[] | ((prev: Message[]) => Message[])) => {
      setConversationState((prev) => {
        let items = [...prev.items];
        let activeId = prev.activeId;
        if (!items.length) {
          const created = createConversationRecord();
          items = [created];
          activeId = created.id;
        }
        if (!activeId && items.length) activeId = items[0].id;
        let idx = items.findIndex((item) => item.id === activeId);
        if (idx < 0) {
          const created = createConversationRecord();
          items = [created, ...items];
          activeId = created.id;
          idx = 0;
        }
        const current = items[idx];
        const currentMessages = Array.isArray(current.messages) ? current.messages : [];
        const nextMessages =
          typeof updater === "function" ? (updater as (p: Message[]) => Message[])(currentMessages) : updater;
        const clamped = clampMessages(nextMessages);
        const nextTitle = current.title && current.title !== "新对话" ? current.title : buildConversationTitle(clamped);
        items[idx] = {
          ...current,
          title: nextTitle,
          messages: clamped,
          updatedAt: Date.now(),
        };
        return { ...prev, activeId, items };
      });
    },
    [setConversationState, clampMessages]
  );
  const [isSending, setIsSending] = useState(false);
  const [ctxSelection, setCtxSelection] = useState({
    script: true,
    style: true,
    guides: false,
    summary: false,
  });
  const [attachments, setAttachments] = useState<{ name: string; url: string; size: number; type: string; remoteUrl?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentUrlsRef = useRef<string[]>([]);
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

  const qalamToolSettings = useMemo(
    () => normalizeQalamToolSettings(config.textConfig?.qalamTools),
    [config.textConfig?.qalamTools]
  );
  const { handleToolCalls } = useQalamTooling({
    setMessages,
    setProjectData,
    toolSettings: config.textConfig?.qalamTools,
  });
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
      if (typeof document !== "undefined") {
        document.body.classList.remove("qalam-resizing");
      }
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
    if (conversationState.items.length) return;
    try {
      const stored = localStorage.getItem("script2video_qalam_messages_v1");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) {
          const migrated = createConversationRecord(clampMessages(parsed));
          setConversationState({ activeId: migrated.id, items: [migrated] });
          localStorage.removeItem("script2video_qalam_messages_v1");
          return;
        }
      }
    } catch {}
    if (!conversationState.items.length) {
      const created = createConversationRecord();
      setConversationState({ activeId: created.id, items: [created] });
    }
  }, [conversationState.items.length, setConversationState, clampMessages]);

  useEffect(() => {
    if (!conversationState.items.length) return;
    if (!conversationState.activeId) {
      setConversationState((prev) => ({ ...prev, activeId: prev.items[0]?.id || "" }));
      return;
    }
    if (!conversationState.items.find((item) => item.id === conversationState.activeId)) {
      setConversationState((prev) => ({ ...prev, activeId: prev.items[0]?.id || "" }));
    }
  }, [conversationState.activeId, conversationState.items, setConversationState]);

  useEffect(() => {
    setInput("");
    setAttachments([]);
  }, [activeConversation?.id]);

  const resolveAttachmentUrls = useCallback(async () => {
    if (!attachments.length) return [];
    const updated = [...attachments];
    const results: string[] = [];
    let changed = false;
    for (let i = 0; i < attachments.length; i += 1) {
      const item = attachments[i];
      if (item.remoteUrl) {
        results.push(item.remoteUrl);
        continue;
      }
      if (item.url.startsWith("http://") || item.url.startsWith("https://")) {
        results.push(item.url);
        updated[i] = { ...item, remoteUrl: item.url };
        changed = true;
        continue;
      }
      try {
        const remoteUrl = await uploadAgentImage(item.url, item.type);
        results.push(remoteUrl);
        updated[i] = { ...item, remoteUrl };
        changed = true;
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: `图片上传失败：${item.name}。${err?.message || ""}`.trim(), kind: "chat" },
        ]);
      }
    }
    if (changed) setAttachments(updated);
    return results;
  }, [attachments, setAttachments, setMessages]);

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
        const imageUrls = await resolveAttachmentUrls();
        const toolsFromConfig = Array.isArray(config.textConfig.tools) ? config.textConfig.tools : [];
        const searchEnabled = toolsFromConfig.some((tool: any) => tool?.type === "web_search_preview");
        const mergedTools: DeyunAITool[] = [];
        const seen = new Set<string>();
        [...getQalamToolDefs(qalamToolSettings), ...toolsFromConfig].forEach((tool) => {
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
        const inputContent: Array<{
          type: "input_text" | "input_image";
          text?: string;
          image_url?: { url: string; detail?: "low" | "high" | "auto" };
        }> = [
          { type: "input_text", text: prompt },
          ...imageUrls.map((url) => ({ type: "input_image" as const, image_url: { url } })),
        ];
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
            inputContent: imageUrls.length ? inputContent : undefined,
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
          await handleToolCalls(toolCalls);
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

  const tokenUsage = useMemo(() => {
    const sumPhase = (obj: any): number => {
      if (!obj) return 0;
      return Object.keys(obj).reduce((acc: number, key) => acc + (obj[key]?.totalTokens || 0), 0);
    };
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
            e.preventDefault();
            e.stopPropagation();
            dragStateRef.current = { startX: e.clientX, startWidth: splitWidth };
            if (typeof document !== "undefined") {
              document.body.classList.add("qalam-resizing");
            }
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

      <QalamChatContent messages={messages} isSending={isSending} />

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
