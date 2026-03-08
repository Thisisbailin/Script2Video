import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, Message, StatusMessage, StatusStep } from "../../node-workspace/components/qalam/types";
import { buildAssistantChatMessage } from "../adapters/qalamMessageAdapter";
import {
  recordAgentToolCalled,
  recordAgentToolCompleted,
  recordAgentToolFailed,
} from "../runtime/activity";
import type {
  AgentRuntimeEvent,
  Script2VideoAgentRuntime,
  Script2VideoRunInput,
  Script2VideoRunResult,
} from "../runtime/types";

type Options = {
  runtime: Script2VideoAgentRuntime;
  sessionId: string;
  setMessages: (updater: Message[] | ((prev: Message[]) => Message[])) => void;
};

const upsertToolStatus = (messages: Message[], callId: string, status: "running" | "success" | "error", summary?: string) =>
  messages.map((message) => {
    if (message.kind !== "tool" || message.tool.callId !== callId) return message;
    return {
      ...message,
      tool: {
        ...message.tool,
        status,
        summary: summary ?? message.tool.summary,
      },
    };
  });

const upsertStatusMessage = (
  messages: Message[],
  runId: string,
  updater: (current: StatusMessage | null) => StatusMessage
) => {
  const index = messages.findIndex((message) => message.kind === "status" && message.statusCard.runId === runId);
  const current = index >= 0 ? (messages[index] as StatusMessage) : null;
  const next = updater(current);
  if (index >= 0) {
    const clone = [...messages];
    clone[index] = next;
    return clone;
  }
  return [...messages, next];
};

const upsertStreamingAssistantMessage = (
  messages: Message[],
  runId: string,
  updater: (current: ChatMessage | null) => ChatMessage
) => {
  const index = messages.findIndex(
    (message) => message.role === "assistant" && (message.kind === "chat" || message.kind == null) && message.meta?.runId === runId
  );
  const current = index >= 0 ? (messages[index] as ChatMessage) : null;
  const next = updater(current);
  if (index >= 0) {
    const clone = [...messages];
    clone[index] = next;
    return clone;
  }
  return [...messages, next];
};

const appendOrReplaceRunningStep = (steps: StatusStep[], step: StatusStep) => {
  const next = steps.map((item) =>
    item.status === "running"
      ? {
          ...item,
          status: "success" as const,
        }
      : item
  );
  next.push(step);
  return next.slice(-8);
};

const humanizeToolName = (name: string) => {
  switch (name) {
    case "get_episode_script":
      return "查阅整集正文";
    case "get_scene_script":
      return "查阅场景正文";
    case "write_project_summary":
      return "写入项目摘要";
    case "write_episode_summary":
      return "写入分集摘要";
    case "create_text_node":
      return "创建文本节点";
    default:
      return name;
  }
};

type TraceLikeEntry = {
  stage: "runtime" | "session" | "model" | "tool" | "result";
  status: "info" | "running" | "success" | "error";
  title: string;
  detail?: string;
};

const mapTraceEntryToStatusPatch = (entry: TraceLikeEntry) => {
  if (entry.stage === "runtime" && entry.title === "Run started") {
    return {
      headline: "已接收请求",
      detail: "正在理解你的目标并规划下一步。",
      step: { id: "request-received", label: "接收请求", status: "success" as const },
      isThinking: true,
    };
  }
  if (entry.stage === "runtime" && entry.title === "Instructions prepared") {
    return {
      headline: "正在规划处理方式",
      detail: "已分析请求类型，正在决定使用直接回答、查阅、写入还是操作工具。",
      step: { id: "request-planned", label: "理解请求", status: "success" as const, detail: entry.detail },
      isThinking: true,
    };
  }
  if (entry.stage === "session" && entry.title === "Session attached") {
    return {
      headline: "已载入当前会话",
      detail: "历史上下文已接入，准备执行本轮任务。",
      step: { id: "session-attached", label: "载入会话", status: "success" as const, detail: entry.detail },
      isThinking: true,
    };
  }
  if (entry.stage === "model" && (entry.title === "Streaming started" || entry.title === "Model request started")) {
    return {
      headline: "模型正在处理",
      detail: "正在生成回答，或判断是否需要调用工具。",
      step: { id: "model-processing", label: "模型处理中", status: "running" as const, detail: entry.detail },
      isThinking: true,
    };
  }
  if (entry.stage === "model" && entry.title === "Raw response received") {
    return {
      headline: "模型已返回结果",
      detail: "正在整理最终回复内容。",
      step: { id: "model-response", label: "接收模型结果", status: "success" as const, detail: entry.detail },
      isThinking: false,
    };
  }
  return null;
};

export const useScript2VideoAgent = ({ runtime, sessionId, setMessages }: Options) => {
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const activeRunStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning || !activeRunIdRef.current) return;
    const interval = window.setInterval(() => {
      const runId = activeRunIdRef.current;
      const startedAt = activeRunStartedAtRef.current;
      if (!runId || !startedAt) return;
      const elapsedSeconds = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
      setMessages((prev) =>
        upsertStatusMessage(prev, runId, (current) => {
          if (!current || current.statusCard.status !== "running") return current || {
            role: "assistant",
            kind: "status",
            statusCard: {
              runId,
              status: "running",
              headline: "Qalam 正在处理请求",
              detail: `已运行 ${elapsedSeconds}s`,
              steps: [],
              startedAt,
              updatedAt: Date.now(),
              isThinking: true,
            },
          };
          return {
            ...current,
            statusCard: {
              ...current.statusCard,
              detail: current.statusCard.isThinking
                ? `正在分析与生成结果，已运行 ${elapsedSeconds}s`
                : `正在等待下一步结果，已运行 ${elapsedSeconds}s`,
              updatedAt: Date.now(),
            },
          };
        })
      );
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRunning, setMessages]);

  const handleEvent = useCallback(
    (event: AgentRuntimeEvent) => {
      if (event.type === "run_started") {
        activeRunIdRef.current = event.runId;
        activeRunStartedAtRef.current = Date.now();
        setMessages((prev) =>
          upsertStatusMessage(prev, event.runId, () => ({
            role: "assistant",
            kind: "status",
            statusCard: {
              runId: event.runId,
              status: "running",
              headline: "Qalam 正在处理请求",
              detail: "已接收请求，正在准备执行。",
              steps: [{ id: "boot", label: "启动执行", status: "running" }],
              startedAt: activeRunStartedAtRef.current || Date.now(),
              updatedAt: Date.now(),
              isThinking: true,
            },
          }))
        );
        return;
      }

      if (event.type === "trace") {
        const patch = mapTraceEntryToStatusPatch(event.entry as TraceLikeEntry);
        if (!patch) return;
        setMessages((prev) =>
          upsertStatusMessage(prev, event.runId, (current) => {
            const existing = current?.statusCard;
            const nextSteps = patch.step
              ? appendOrReplaceRunningStep(existing?.steps || [], patch.step)
              : existing?.steps || [];
            return {
              role: "assistant",
              kind: "status",
              statusCard: {
                runId: event.runId,
                status: existing?.status || "running",
                headline: patch.headline,
                detail: patch.detail,
                steps: nextSteps,
                startedAt: existing?.startedAt || Date.now(),
                updatedAt: Date.now(),
                isThinking: patch.isThinking ?? existing?.isThinking,
              },
            };
          })
        );
        return;
      }

      if (event.type === "message_delta") {
        setMessages((prev) =>
          upsertStreamingAssistantMessage(prev, event.runId, (current) => ({
            role: "assistant",
            kind: "chat",
            text: event.accumulatedText,
            meta: {
              ...current?.meta,
              runId: event.runId,
              isStreaming: true,
              thinkingStatus: "active",
            },
          }))
        );
        setMessages((prev) =>
          upsertStatusMessage(prev, event.runId, (current) => ({
            role: "assistant",
            kind: "status",
            statusCard: {
              runId: event.runId,
              status: current?.statusCard.status || "running",
              headline: "正在生成回复",
              detail: "回答内容正在持续输出。",
              steps: appendOrReplaceRunningStep(current?.statusCard.steps || [], {
                id: "streaming-response",
                label: "流式生成回复",
                status: "running",
              }),
              startedAt: current?.statusCard.startedAt || Date.now(),
              updatedAt: Date.now(),
              isThinking: true,
            },
          }))
        );
        return;
      }

      if (event.type === "tool_called") {
        recordAgentToolCalled(event.call);
        const actionLabel = humanizeToolName(event.call.name);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            kind: "tool",
            tool: {
              callId: event.call.callId,
              name: event.call.name,
              status: "running",
              summary: event.call.summary || actionLabel,
            },
          },
        ]);
        return;
      }

      if (event.type === "tool_completed") {
        recordAgentToolCompleted(event.call);
        setMessages((prev) => [
          ...upsertToolStatus(prev, event.call.callId, "success", event.call.summary),
          {
            role: "assistant",
            kind: "tool_result",
            tool: {
              callId: event.call.callId,
              name: event.call.name,
              status: "success",
              summary: event.call.summary,
              output: typeof event.call.output === "string" ? event.call.output : JSON.stringify(event.call.output || {}),
            },
          },
        ]);
        return;
      }

      if (event.type === "tool_failed") {
        recordAgentToolFailed(event.call, event.error);
        setMessages((prev) => [
          ...upsertToolStatus(prev, event.call.callId, "error", event.error),
          {
            role: "assistant",
            kind: "tool_result",
            tool: {
              callId: event.call.callId,
              name: event.call.name,
              status: "error",
              summary: event.error,
            },
          },
        ]);
        return;
      }

      if (event.type === "message_completed") {
        setMessages((prev) => {
          const withStreamedAnswer = upsertStreamingAssistantMessage(prev, event.runId, (current) => {
            const built = buildAssistantChatMessage(event.text);
            return current
              ? {
                  ...current,
                  text: event.text || current.text,
                  meta: {
                    ...current.meta,
                    runId: event.runId,
                    isStreaming: false,
                    thinkingStatus: "done",
                  },
                }
              : {
                  ...built,
                  meta: {
                    ...built.meta,
                    runId: event.runId,
                    isStreaming: false,
                    thinkingStatus: "done",
                  },
                };
          });
          return withStreamedAnswer.map((message) => {
            if (message.kind !== "status" || message.statusCard.runId !== event.runId) return message;
            return {
              ...message,
              statusCard: {
                ...message.statusCard,
                headline: "已生成最终回复",
                detail: "正在展示结果。",
                steps: appendOrReplaceRunningStep(message.statusCard.steps, {
                  id: "final-response",
                  label: "生成最终回复",
                  status: "success",
                }),
                updatedAt: Date.now(),
                isThinking: false,
              },
            };
          });
        });
        return;
      }

      if (event.type === "run_completed") {
        activeRunIdRef.current = null;
        activeRunStartedAtRef.current = null;
        setMessages((prev) =>
          upsertStatusMessage(prev, event.runId, (current) => ({
            role: "assistant",
            kind: "status",
            statusCard: {
              runId: event.runId,
              status: "success",
              headline: "处理完成",
              detail: event.result.toolCalls.length > 0 ? "本轮任务已执行完成，并已返回结果。" : "本轮回答已完成。",
              steps: (current?.statusCard.steps || []).map((step) =>
                step.status === "running" ? { ...step, status: "success" } : step
              ),
              startedAt: current?.statusCard.startedAt || Date.now(),
              updatedAt: Date.now(),
              isThinking: false,
            },
          }))
        );
        return;
      }

      if (event.type === "run_failed") {
        activeRunIdRef.current = null;
        activeRunStartedAtRef.current = null;
        setMessages((prev) => {
          const withStatus = upsertStatusMessage(prev, event.runId, (current) => ({
            role: "assistant",
            kind: "status",
            statusCard: {
              runId: event.runId,
              status: "error",
              headline: "处理失败",
              detail: event.error,
              steps: (current?.statusCard.steps || []).map((step) =>
                step.status === "running" ? { ...step, status: "error", detail: event.error } : step
              ),
              startedAt: current?.statusCard.startedAt || Date.now(),
              updatedAt: Date.now(),
              isThinking: false,
            },
          }));
          return [
            ...withStatus,
            {
              role: "assistant",
              kind: "chat",
              text: `请求失败: ${event.error}`,
            },
          ];
        });
      }
    },
    [setMessages]
  );

  const sendMessage = useCallback(
    async (input: Omit<Script2VideoRunInput, "sessionId">): Promise<Script2VideoRunResult> => {
      const controller = new AbortController();
      abortRef.current = controller;
      setIsRunning(true);
      try {
        return await runtime.run(
          {
            ...input,
            sessionId,
          },
          {
            signal: controller.signal,
            onEvent: handleEvent,
          }
        );
      } finally {
        abortRef.current = null;
        setIsRunning(false);
      }
    },
    [handleEvent, runtime, sessionId]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { isRunning, sendMessage, cancel };
};
