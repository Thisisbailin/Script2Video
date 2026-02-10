import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, ChevronUp, X, Plus, ArrowUp, Lightbulb, Sparkles, CircleHelp, ChevronDown as CaretDown, Globe, Columns, AtSign } from "lucide-react";
import * as GeminiService from "../../services/geminiService";
import { createQwenResponse } from "../../services/qwenResponsesService";
import type { AgentTool } from "../../services/toolingTypes";
import { useConfig } from "../../hooks/useConfig";
import { usePersistedState } from "../../hooks/usePersistedState";
import { ProjectData, Character, Location } from "../../types";
import { AVAILABLE_MODELS } from "../../constants";
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

const WORK_HINT_KEYWORDS = [
  "剧本",
  "剧情",
  "场景",
  "角色",
  "剧集",
  "镜头",
  "分镜",
  "对白",
  "台词",
  "理解",
  "understanding",
  "角色库",
  "场景库",
  "总结",
  "梳理",
  "分析",
  "查阅",
  "搜索",
  "提取",
  "生成",
  "写作",
  "改写",
  "优化",
  "Prompt",
  "Sora",
];

const toSearch = (value: string) => value.toLowerCase().replace(/\s+/g, "");

const parseMentions = (text: string) => {
  const matches = text.match(/@([\w\u4e00-\u9fa5-]+)/g) || [];
  const names: string[] = [];
  matches.forEach((m) => {
    const name = m.slice(1);
    if (!names.includes(name)) names.push(name);
  });
  return names;
};

const stripModePrefix = (text: string) => {
  const trimmed = text.trim();
  const patterns = [/^\/(work|chat)\s*/i, /^#(work|chat)\s*/i, /^(工作|闲聊)[:：]\s*/];
  for (const pattern of patterns) {
    if (pattern.test(trimmed)) {
      return trimmed.replace(pattern, "").trim();
    }
  }
  return trimmed;
};

const getForcedMode = (text: string) => {
  const trimmed = text.trim();
  if (/^\/chat\b/i.test(trimmed) || /^#chat\b/i.test(trimmed) || /^闲聊[:：]/.test(trimmed)) return "chat";
  if (/^\/work\b/i.test(trimmed) || /^#work\b/i.test(trimmed) || /^工作[:：]/.test(trimmed)) return "work";
  return "auto";
};

const hasEpisodeSceneRef = (text: string) => {
  if (!text) return false;
  if (/第\s*\d+\s*集/.test(text)) return true;
  if (/\d+\s*[-－–—]\s*\d+/.test(text)) return true; // scene id like 12-3
  return false;
};

const detectWorkIntent = (text: string, hasAttachments: boolean) => {
  if (!text) return false;
  const lowered = text.toLowerCase();
  if (hasAttachments) return true;
  if (hasEpisodeSceneRef(text)) return true;
  return WORK_HINT_KEYWORDS.some((kw) => lowered.includes(kw.toLowerCase()));
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
  const [inputMode, setInputMode] = useState<"auto" | "chat" | "work">("auto");
  const [modePickerOpen, setModePickerOpen] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const attachmentUrlsRef = useRef<string[]>([]);
  const [layoutMode, setLayoutMode] = useState<"floating" | "split">("floating");
  const [splitWidth, setSplitWidth] = useState(560);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const qalamToolSettings = useMemo(
    () => normalizeQalamToolSettings(config.textConfig?.qalamTools),
    [config.textConfig?.qalamTools]
  );
  const { handleToolCalls } = useQalamTooling({
    setMessages,
    setProjectData,
    toolSettings: config.textConfig?.qalamTools,
  });
  const mentionTargets = useMemo(() => {
    const targets: Array<{ kind: "character" | "location"; name: string; label: string; search: string; id?: string }> = [];
    (projectData.context?.characters || []).forEach((c) => {
      if (!c?.name) return;
      targets.push({
        kind: "character",
        name: c.name,
        label: `角色 · ${c.name}`,
        search: toSearch(c.name),
        id: c.id,
      });
    });
    (projectData.context?.locations || []).forEach((l) => {
      if (!l?.name) return;
      targets.push({
        kind: "location",
        name: l.name,
        label: `场景 · ${l.name}`,
        search: toSearch(l.name),
        id: l.id,
      });
    });
    return targets;
  }, [projectData.context?.characters, projectData.context?.locations]);
  const mentionIndex = useMemo(() => {
    const map = new Map<string, { kind: "character" | "location"; name: string; label: string; id?: string }>();
    mentionTargets.forEach((item) => {
      const key = toSearch(item.name);
      if (!key || map.has(key)) return;
      map.set(key, item);
    });
    return map;
  }, [mentionTargets]);
  const mentionState = useMemo(() => {
    const pos = Math.min(cursorPos, input.length);
    const textBefore = input.slice(0, pos);
    const match = textBefore.match(/@([\w\u4e00-\u9fa5-]*)$/);
    if (!match) return null;
    return {
      query: match[1] || "",
      start: textBefore.lastIndexOf("@"),
      end: pos,
    };
  }, [input, cursorPos]);
  const filteredMentions = useMemo(() => {
    if (!mentionState) return mentionTargets;
    const query = toSearch(mentionState.query.trim());
    if (!query) return mentionTargets;
    return mentionTargets.filter((item) => item.search.includes(query));
  }, [mentionState, mentionTargets]);
  const showMentionPicker = isInputFocused && !!mentionState;
  const mentionTags = useMemo(() => {
    const names = parseMentions(input);
    return names
      .map((name) => mentionIndex.get(toSearch(name)) || null)
      .filter(Boolean) as Array<{ kind: "character" | "location"; name: string; label: string; id?: string }>;
  }, [input, mentionIndex]);
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
    setModePickerOpen(false);
    const forcedMode = inputMode !== "auto" ? inputMode : getForcedMode(input);
    const cleanedInput = stripModePrefix(input);
    const userMsg: Message = { role: "user", text: cleanedInput, kind: "chat" };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setInputMode("auto");
    setIsSending(true);
    const isQwen = config.textConfig.provider === "qwen";
    try {
      const wantsWork = forcedMode === "work"
        ? true
        : forcedMode === "chat"
        ? false
        : detectWorkIntent(cleanedInput, attachments.length > 0);
      const useWorkMode = isQwen && wantsWork;
      const activeContext = useWorkMode ? contextText : "";
      const systemInstruction =
        "You are Qalam, a creative agent helping build this project. Keep responses concise. You can use Markdown. Do not include chain-of-thought or internal reasoning; respond with final answers only.";
      const toolHint = useWorkMode
        ? "\n[Tooling]\n- 当用户描述内容不够明确时，先调用 search_script_data 搜索，再决定要读取的剧集/场景。\n- 当用户提到具体剧集/场景/剧情片段，或需要理解/角色/场景库信息时，调用 read_project_data 获取对应内容再回答。\n- 当用户要求创建/更新角色或场景时，优先调用对应工具。\n- 证据仅给出剧集-场景（如 1-1）。\n- 允许局部更新，不要重复未变化字段。"
        : "";
      const mentionContext = (() => {
        if (!mentionTags.length) return "";
        const rows = mentionTags.map((tag) => `- @${tag.name} => ${tag.kind}${tag.id ? ` (${tag.id})` : ""}`);
        return `[Mentions]\n${rows.join("\n")}`;
      })();
      const memoryText = buildConversationMemory(messages);
      const memoryBlock = memoryText ? `[Conversation]\n${memoryText}\n\n` : "";
      const mentionBlock = mentionContext ? `${mentionContext}\n\n` : "";
      const prompt = `${activeContext ? activeContext + "\n\n" : ""}${mentionBlock}${memoryBlock}[System]\n${systemInstruction}${toolHint}\n\n${userMsg.text}\n\n请直接回答问题，简洁输出。`;

      if (useWorkMode) {
        if (attachments.length > 0) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: "提示：Qwen Responses 当前仅支持文本输入，已忽略图片附件。", kind: "chat" },
          ]);
        }
        const toolsFromConfig = Array.isArray(config.textConfig.tools) ? config.textConfig.tools : [];
        const mergedTools: AgentTool[] = [];
        const seen = new Set<string>();
        [...getQalamToolDefs(qalamToolSettings), ...toolsFromConfig].forEach((tool) => {
          const key = tool.type === "function" ? `function:${tool.name}` : tool.type;
          if (seen.has(key)) return;
          seen.add(key);
          mergedTools.push(tool);
        });

        const workModel = config.textConfig.workModel || "qwen3-max";
        const workBaseUrl = config.textConfig.workBaseUrl || config.textConfig.baseUrl || undefined;

        const firstRes = await createQwenResponse(
          prompt,
          { apiKey: config.textConfig.apiKey, baseUrl: workBaseUrl },
          {
            model: workModel,
            tools: mergedTools,
            toolChoice: "auto",
          }
        );

        const toolCalls = firstRes.toolCalls || [];
        if (!toolCalls.length && firstRes.text && firstRes.text.trim()) {
          const extracted = extractReasoningSection(firstRes.text || "");
          const parsed = parsePlanFromText(extracted.text || "");
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: parsed.text || firstRes.text, kind: "chat", meta: { planItems: parsed.planItems } },
          ]);
          setIsSending(false);
          setMood("thinking");
          return;
        }

        const toolOutputs = toolCalls.length ? await handleToolCalls(toolCalls) : [];
        if (!toolOutputs.length) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: firstRes.text || "（未返回有效结果）", kind: "chat" },
          ]);
          setIsSending(false);
          setMood("thinking");
          return;
        }

        const inputItems = [
          { role: "user", content: [{ type: "input_text", text: prompt }] },
          ...toolOutputs.map((item) => ({
            type: "function_call_output",
            call_id: item.callId,
            output: item.output,
          })),
        ];

        const followToolChoice = toolCalls.some((tc) => tc.name === "search_script_data") &&
          !toolCalls.some((tc) => tc.name === "read_project_data" || tc.name === "read_script_data")
          ? "auto"
          : "none";

        const followRes = await createQwenResponse(
          prompt,
          { apiKey: config.textConfig.apiKey, baseUrl: workBaseUrl },
          {
            model: workModel,
            tools: mergedTools,
            toolChoice: followToolChoice,
            inputItems,
          }
        );

        const followToolCalls = followRes.toolCalls || [];
        if (followToolCalls.length) {
          const secondOutputs = await handleToolCalls(followToolCalls);
          if (secondOutputs.length) {
            const finalItems = [
              { role: "user", content: [{ type: "input_text", text: prompt }] },
              ...toolOutputs.map((item) => ({
                type: "function_call_output",
                call_id: item.callId,
                output: item.output,
              })),
              ...secondOutputs.map((item) => ({
                type: "function_call_output",
                call_id: item.callId,
                output: item.output,
              })),
            ];
            const finalRes = await createQwenResponse(
              prompt,
              { apiKey: config.textConfig.apiKey, baseUrl: workBaseUrl },
              {
                model: workModel,
                tools: mergedTools,
                toolChoice: "none",
                inputItems: finalItems,
              }
            );
            const finalExtracted = extractReasoningSection(finalRes.text || "");
            const finalParsed = parsePlanFromText(finalExtracted.text || "");
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                text: finalParsed.text || finalRes.text || "",
                kind: "chat",
                meta: { planItems: finalParsed.planItems },
              },
            ]);
            setIsSending(false);
            setMood("thinking");
            return;
          }
        }

        const followExtracted = extractReasoningSection(followRes.text || "");
        const followParsed = parsePlanFromText(followExtracted.text || "");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: followParsed.text || followRes.text || "",
            kind: "chat",
            meta: { planItems: followParsed.planItems },
          },
        ]);
        setIsSending(false);
        setMood("thinking");
        return;
      }

      const res = await GeminiService.generateFreeformText(
        config.textConfig,
        prompt,
        systemInstruction
      );
      try {
        console.log("[Agent] Raw response", res);
      } catch {}
      const extracted = extractReasoningSection(res.outputText || "");
      const parsed = parsePlanFromText(extracted.text || "");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: parsed.text || "", kind: "chat", meta: { planItems: parsed.planItems } },
      ]);
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
    if (config.textConfig?.provider === "gemini") {
      return AVAILABLE_MODELS.slice().sort((a, b) => a.name.localeCompare(b.name));
    }
    // OpenRouter/Qwen: no preset list, keep current value as sole option
    const currentId = config.textConfig?.model || "custom";
    return [{ id: currentId, name: currentId }];
  }, [config.textConfig?.provider, config.textConfig?.model]);

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
          {(inputMode !== "auto" || mentionTags.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {inputMode !== "auto" && (
                <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] border border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] text-[var(--app-text-primary)]">
                  模式：{inputMode === "work" ? "工作" : "闲聊"}
                  <button
                    type="button"
                    onClick={() => setInputMode("auto")}
                    className="text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
                    title="清除模式"
                  >
                    ×
                  </button>
                </span>
              )}
              {mentionTags.map((tag) => (
                <span
                  key={`${tag.kind}-${tag.name}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border border-[var(--app-border)] bg-[var(--app-panel-muted)] text-[var(--app-text-secondary)]"
                >
                  <AtSign size={11} />
                  {tag.label}
                </span>
              ))}
            </div>
          )}
          <textarea
            ref={inputRef}
            className="w-full bg-transparent text-[13px] text-[var(--app-text-primary)] placeholder:text-[var(--app-text-secondary)] resize-none focus:outline-none"
            rows={3}
            placeholder="向 Qalam 提问，@ 提及角色/场景，/ 选择指令..."
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setCursorPos(e.target.selectionStart ?? e.target.value.length);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") {
                setModePickerOpen(false);
                return;
              }
              if (e.key === "/" && !e.shiftKey) {
                const pos = (e.currentTarget as HTMLTextAreaElement).selectionStart ?? 0;
                const textBefore = input.slice(0, pos);
                const lastChar = textBefore.slice(-1);
                const atTokenStart = !textBefore || /\s/.test(lastChar);
                if (atTokenStart) {
                  e.preventDefault();
                  setModePickerOpen(true);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            onKeyUp={(e) => {
              setCursorPos((e.currentTarget as HTMLTextAreaElement).selectionStart ?? input.length);
            }}
            onClick={(e) => {
              setCursorPos((e.currentTarget as HTMLTextAreaElement).selectionStart ?? input.length);
            }}
            onFocus={(e) => {
              setIsInputFocused(true);
              setCursorPos((e.currentTarget as HTMLTextAreaElement).selectionStart ?? input.length);
            }}
            onBlur={() => {
              setIsInputFocused(false);
            }}
          />
          {modePickerOpen && (
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 space-y-2">
              <div className="text-[10px] uppercase tracking-widest text-[var(--app-text-secondary)]">
                选择模式
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInputMode("chat");
                    setModePickerOpen(false);
                    inputRef.current?.focus();
                  }}
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--app-border)] text-[12px] text-[var(--app-text-primary)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-muted)] transition"
                >
                  /chat · 闲聊
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputMode("work");
                    setModePickerOpen(false);
                    inputRef.current?.focus();
                  }}
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--app-border)] text-[12px] text-[var(--app-text-primary)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-muted)] transition"
                >
                  /work · 工作
                </button>
              </div>
            </div>
          )}
          {showMentionPicker && (
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-2 space-y-2">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--app-text-secondary)]">
                <AtSign size={11} />
                选择绑定数据
                {mentionState?.query ? <span className="text-[var(--app-text-muted)]">@{mentionState.query}</span> : null}
              </div>
              {filteredMentions.length > 0 ? (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {filteredMentions.map((item) => (
                    <button
                      key={`${item.kind}-${item.name}-${item.id || "none"}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const start = mentionState ? mentionState.start : cursorPos;
                        const end = mentionState ? mentionState.end : cursorPos;
                        const before = input.slice(0, start);
                        const after = input.slice(end);
                        const insertion = `@${item.name} `;
                        const next = `${before}${insertion}${after}`;
                        const nextPos = start + insertion.length;
                        setInput(next);
                        setCursorPos(nextPos);
                        requestAnimationFrame(() => {
                          if (!inputRef.current) return;
                          inputRef.current.focus();
                          inputRef.current.setSelectionRange(nextPos, nextPos);
                        });
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-transparent hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-muted)] transition text-left"
                    >
                      <span className="text-[10px] uppercase tracking-widest text-[var(--app-text-muted)]">
                        {item.kind === "character" ? "角色" : "场景"}
                      </span>
                      <span className="text-[12px] text-[var(--app-text-primary)]">{item.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-[12px] text-[var(--app-text-secondary)]">未找到匹配项</div>
              )}
            </div>
          )}
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
