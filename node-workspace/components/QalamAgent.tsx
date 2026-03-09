import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, ChevronUp, X, ArrowUp, Lightbulb, Sparkles, CircleHelp, ChevronDown as CaretDown, Globe, Columns, AtSign } from "lucide-react";
import { useConfig } from "../../hooks/useConfig";
import { usePersistedState } from "../../hooks/usePersistedState";
import { ProjectData } from "../../types";
import { createStableId } from "../../utils/id";
import { QalamChatContent } from "./qalam/QalamChatContent";
import type { ChatMessage, Message } from "./qalam/types";
import { useWorkflowStore } from "../store/workflowStore";
import { inferRequestedOutcome } from "../../agents/adapters/qalamMessageAdapter";
import type { Script2VideoAgentBridge } from "../../agents/bridge/script2videoBridge";
import { createNodeWorkflowWithBridge } from "../../agents/bridge/workflowBuilder";
import { createScript2VideoAgentRuntime } from "../../agents/runtime/agent";
import { LocalSkillLoader } from "../../agents/runtime/skills";
import { LocalStorageSessionStore } from "../../agents/runtime/session";
import { useScript2VideoAgent } from "../../agents/react/useScript2VideoAgent";
import { getNodeHandles, isValidConnection } from "../utils/handles";

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
  "节点",
  "工作流",
  "workflow",
];

const toSearch = (value: string) => value.toLowerCase().replace(/\s+/g, "");

const edgeIdFromConnection = (sourceNodeId: string, targetNodeId: string, sourceHandle: string, targetHandle: string) =>
  `edge-${sourceNodeId}-${targetNodeId}-${sourceHandle || "default"}-${targetHandle || "default"}`;

const getWorkflowSnapshot = () => useWorkflowStore.getState();

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
  const addNode = useWorkflowStore((state) => state.addNode);
  const updateNodeStyle = useWorkflowStore((state) => state.updateNodeStyle);
  const onConnect = useWorkflowStore((state) => state.onConnect);
  const toggleEdgePause = useWorkflowStore((state) => state.toggleEdgePause);
  const removeNode = useWorkflowStore((state) => state.removeNode);
  const removeEdge = useWorkflowStore((state) => state.removeEdge);
  const nodes = useWorkflowStore((state) => state.nodes);
  const viewport = useWorkflowStore((state) => state.viewport);
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [layoutMode, setLayoutMode] = useState<"floating" | "split">("floating");
  const [splitWidth, setSplitWidth] = useState(560);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const skillLoaderRef = useRef(new LocalSkillLoader());
  const sessionStoreRef = useRef(new LocalStorageSessionStore());
  const bridge = useMemo<Script2VideoAgentBridge>(
    () => ({
      getProjectData: () => projectData,
      updateProjectData: (updater) => setProjectData((prev) => updater(prev)),
      addTextNode: ({ title, text, x, y, parentId }) => {
        const snapshot = getWorkflowSnapshot();
        const hasXY = typeof x === "number" && typeof y === "number";
        const activeViewport = snapshot.viewport || viewport;
        const baseX = activeViewport ? (-activeViewport.x + 120) / activeViewport.zoom : 120;
        const baseY = activeViewport ? (-activeViewport.y + 120) / activeViewport.zoom : 120;
        const offset = (snapshot.nodes.length % 5) * 24;
        const position = hasXY
          ? { x: x as number, y: y as number }
          : { x: Math.round(baseX + offset), y: Math.round(baseY + offset) };
        const nodeId = addNode("text", position, parentId, { title, text });
        return { id: nodeId, title };
      },
      createWorkflowNode: ({ type, title, text, aspectRatio, x, y, parentId }) => {
        const snapshot = getWorkflowSnapshot();
        const hasXY = typeof x === "number" && typeof y === "number";
        const activeViewport = snapshot.viewport || viewport;
        const baseX = activeViewport ? (-activeViewport.x + 120) / activeViewport.zoom : 120;
        const baseY = activeViewport ? (-activeViewport.y + 120) / activeViewport.zoom : 120;
        const offset = (snapshot.nodes.length % 5) * 24;
        const position = hasXY
          ? { x: x as number, y: y as number }
          : { x: Math.round(baseX + offset), y: Math.round(baseY + offset) };
        if (type !== "text" && type !== "imageGen") {
          throw new Error("createWorkflowNode 当前仅支持 text 和 imageGen。");
        }
        const resolvedTitle = (title || "").trim() || (type === "text" ? "文本节点" : "Img Gen");
        const extraData =
          type === "text"
            ? {
                title: resolvedTitle,
                text: (text || "").trim(),
              }
            : {
                title: resolvedTitle,
                aspectRatio: (aspectRatio || "1:1").trim() || "1:1",
              };
        if (type === "text" && !String(extraData.text || "").trim()) {
          throw new Error("createWorkflowNode 创建文本节点时缺少 text。");
        }
        const nodeId = addNode(type, position, parentId, extraData);
        return {
          nodeId,
          node_id: nodeId,
          nodeType: type,
          node_type: type,
          title: resolvedTitle,
        };
      },
      connectWorkflowNodes: ({ sourceNodeId, targetNodeId, sourceHandle, targetHandle }) => {
        const snapshot = getWorkflowSnapshot();
        const sourceNode = snapshot.nodes.find((node) => node.id === sourceNodeId);
        const targetNode = snapshot.nodes.find((node) => node.id === targetNodeId);
        if (!sourceNode || !targetNode) {
          throw new Error("connectWorkflowNodes 引用了不存在的节点。");
        }
        const sourceHandles = getNodeHandles(sourceNode.type).outputs;
        const targetHandles = getNodeHandles(targetNode.type).inputs;
        if (sourceHandles.length === 0 || targetHandles.length === 0) {
          throw new Error("当前节点类型不存在可用的输入/输出 handle。");
        }
        const resolvedSourceHandle =
          sourceHandle || (targetHandle && sourceHandles.includes(targetHandle) ? targetHandle : sourceHandles[0]);
        const resolvedTargetHandle =
          targetHandle || (sourceHandle && targetHandles.includes(sourceHandle) ? sourceHandle : targetHandles[0]);
        if (!sourceHandles.includes(resolvedSourceHandle) || !targetHandles.includes(resolvedTargetHandle)) {
          throw new Error("connectWorkflowNodes 收到无效的 handle。");
        }
        if (!isValidConnection({ sourceHandle: resolvedSourceHandle, targetHandle: resolvedTargetHandle })) {
          throw new Error("connectWorkflowNodes 收到不合法的连线类型。");
        }
        onConnect({
          source: sourceNodeId,
          target: targetNodeId,
          sourceHandle: resolvedSourceHandle,
          targetHandle: resolvedTargetHandle,
        });
        return {
          edgeId: edgeIdFromConnection(sourceNodeId, targetNodeId, resolvedSourceHandle, resolvedTargetHandle),
          edge_id: edgeIdFromConnection(sourceNodeId, targetNodeId, resolvedSourceHandle, resolvedTargetHandle),
          sourceNodeId,
          source_node_id: sourceNodeId,
          targetNodeId,
          target_node_id: targetNodeId,
          sourceHandle: resolvedSourceHandle as "image" | "text",
          source_handle: resolvedSourceHandle as "image" | "text",
          targetHandle: resolvedTargetHandle as "image" | "text",
          target_handle: resolvedTargetHandle as "image" | "text",
        };
      },
      createNodeWorkflow: (input) => {
        const baseX = viewport ? (-viewport.x + 120) / viewport.zoom : 120;
        const baseY = viewport ? (-viewport.y + 120) / viewport.zoom : 120;
        const offset = (nodes.length % 5) * 24;
        return createNodeWorkflowWithBridge(
          {
            ...input,
            originX: input.originX ?? Math.round(baseX + offset),
            originY: input.originY ?? Math.round(baseY + offset),
          },
          {
            addNode,
            updateNodeStyle,
            onConnect,
            toggleEdgePause,
            removeNode,
            removeEdge,
          }
        );
      },
      getViewport: () => viewport,
      getNodeCount: () => nodes.length,
    }),
    [addNode, nodes.length, onConnect, projectData, removeEdge, removeNode, setProjectData, toggleEdgePause, updateNodeStyle, viewport]
  );
  const runtime = useMemo(
    () =>
      createScript2VideoAgentRuntime({
        bridge,
        skillLoader: skillLoaderRef.current,
        sessionStore: sessionStoreRef.current,
        configProvider: {
          getConfig: () => ({
            provider: config.textConfig?.provider,
            apiKey: config.textConfig?.apiKey,
            baseUrl: config.textConfig?.baseUrl || undefined,
            model: config.textConfig?.model || "qwen-plus",
            qalamTools: config.textConfig?.qalamTools,
            tracingDisabled: true,
          }),
        },
      }),
    [bridge, config.textConfig?.apiKey, config.textConfig?.baseUrl, config.textConfig?.model, config.textConfig?.qalamTools]
  );
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
  const { sendMessage: runAgentMessage } = useScript2VideoAgent({
    runtime,
    sessionId: activeConversation?.id || conversationState.activeId || "qalam-default",
    setMessages,
  });
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
  }, [activeConversation?.id]);

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
  const sendMessage = async () => {
    if (!canSend) return;
    setMood("loading");
    setModePickerOpen(false);
    const forcedMode = inputMode !== "auto" ? inputMode : getForcedMode(input);
    const cleanedInput = stripModePrefix(input);
    setMessages((prev) => {
      const nextOrder = prev.reduce((max, message) => Math.max(max, message.order || 0), 0) + 1;
      const userMsg: Message = { role: "user", text: cleanedInput, kind: "chat", order: nextOrder };
      return [...prev, userMsg];
    });
    setInput("");
    setInputMode("auto");
    setIsSending(true);
    try {
      await runAgentMessage({
        userText: cleanedInput,
        requestedOutcome: inferRequestedOutcome(cleanedInput, forcedMode),
        uiContext: {
          mentionTags: mentionTags.map((tag) => ({
            kind: tag.kind,
            name: tag.name,
            id: tag.id,
          })),
        },
      });
    } catch (err: any) {
      setMessages((prev) => {
        const nextOrder = prev.reduce((max, message) => Math.max(max, message.order || 0), 0) + 1;
        return [
          ...prev,
          { role: "assistant", text: `请求失败: ${err?.message || err}`, kind: "chat", order: nextOrder },
        ];
      });
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
            <div
              className="h-8 px-3 flex items-center justify-center rounded-full bg-[var(--app-panel-muted)] border border-[var(--app-border)] text-[11px] text-[var(--app-text-secondary)]"
              title="图片附件将在多模态 runtime 接入后重新开放"
            >
              附件功能待接入
            </div>
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
        </div>
      </div>
    </div>
  );
};
