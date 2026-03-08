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

const upsertStatusStep = (steps: StatusStep[], step: StatusStep) => {
  const index = steps.findIndex((item) => item.id === step.id);
  if (index >= 0) {
    const clone = [...steps];
    clone[index] = {
      ...clone[index],
      ...step,
    };
    return clone;
  }
  return [...steps, step].slice(-8);
};

const completeRunningSteps = (steps: StatusStep[], status: "success" | "error") =>
  steps.map((step) => (step.status === "running" ? { ...step, status } : step));

const normalizeStreamingStepStack = (steps: StatusStep[]) =>
  steps.filter((step, index, array) => {
    if (step.id !== "streaming-response") return true;
    return array.findIndex((candidate) => candidate.id === "streaming-response") === index;
  });

const nextMessageOrder = (messages: Message[]) =>
  messages.reduce((max, message) => Math.max(max, message.order || 0), 0) + 1;

const buildStatusLabelFromTrace = (entry: TraceLikeEntry) => {
  if (entry.stage === "model" && (entry.title === "Streaming started" || entry.title === "Model request started")) {
    return {
      headline: "思考 生成回复",
      detail: "模型正在生成回答，或决定是否继续调用工具。",
      step: { id: "model-processing", label: "生成回复", status: "running" as const, detail: entry.detail },
      isThinking: true,
    };
  }
  return null;
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
            order: nextMessageOrder(prev),
            statusCard: {
              runId,
              status: "running",
              headline: "思考 处理中",
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
              detail: `已运行 ${elapsedSeconds}s`,
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
            order: nextMessageOrder(prev),
            statusCard: {
              runId: event.runId,
              status: "running",
              headline: "思考 处理中",
              detail: "已接收请求，正在准备分析。",
              steps: [],
              startedAt: activeRunStartedAtRef.current || Date.now(),
              updatedAt: Date.now(),
              isThinking: true,
            },
          }))
        );
        return;
      }

      if (event.type === "trace") {
        const patch = buildStatusLabelFromTrace(event.entry as TraceLikeEntry);
        if (!patch) return;
        setMessages((prev) =>
          upsertStatusMessage(prev, event.runId, (current) => {
            const existing = current?.statusCard;
            return {
              role: "assistant",
              kind: "status",
              order: current?.order || nextMessageOrder(prev),
              statusCard: {
                runId: event.runId,
                status: existing?.status || "running",
                headline: patch.headline,
                detail: patch.detail,
                summary: existing?.summary,
                steps: patch.step ? upsertStatusStep(existing?.steps || [], patch.step) : existing?.steps || [],
                startedAt: existing?.startedAt || Date.now(),
                updatedAt: Date.now(),
                isThinking: patch.isThinking ?? existing?.isThinking,
              },
            };
          })
        );
        return;
      }

      if (event.type === "reasoning_delta") {
        setMessages((prev) =>
          upsertStatusMessage(prev, event.runId, (current) => ({
            role: "assistant",
            kind: "status",
            order: current?.order || nextMessageOrder(prev),
            statusCard: {
              runId: event.runId,
              status: current?.statusCard.status || "running",
              headline: "思考 处理中",
              detail: current?.statusCard.detail || "模型正在分析请求。",
              summary: event.accumulatedText,
              steps: current?.statusCard.steps || [],
              startedAt: current?.statusCard.startedAt || Date.now(),
              updatedAt: Date.now(),
              isThinking: true,
            },
          }))
        );
        return;
      }

      if (event.type === "reasoning_completed") {
        setMessages((prev) =>
          upsertStatusMessage(prev, event.runId, (current) => ({
            role: "assistant",
            kind: "status",
            order: current?.order || nextMessageOrder(prev),
            statusCard: {
              runId: event.runId,
              status: current?.statusCard.status || "running",
              headline: current?.statusCard.headline || "思考 处理中",
              detail: current?.statusCard.detail,
              summary: event.text,
              steps: current?.statusCard.steps || [],
              startedAt: current?.statusCard.startedAt || Date.now(),
              updatedAt: Date.now(),
              isThinking: true,
            },
          }))
        );
        return;
      }

      if (event.type === "message_delta") {
        setMessages((prev) =>
          upsertStatusMessage(
            upsertStreamingAssistantMessage(prev, event.runId, (current) => ({
              role: "assistant",
              kind: "chat",
              order: current?.order || nextMessageOrder(prev),
              text: event.accumulatedText,
              meta: {
                ...current?.meta,
                runId: event.runId,
                isStreaming: true,
              },
            })),
            event.runId,
            (current) => ({
              role: "assistant",
              kind: "status",
              order: current?.order || nextMessageOrder(prev),
              statusCard: {
                runId: event.runId,
                status: current?.statusCard.status || "running",
                headline: "思考 生成回复",
                detail: "回答内容正在持续输出。",
                summary: current?.statusCard.summary,
                steps: normalizeStreamingStepStack(
                  upsertStatusStep(current?.statusCard.steps || [], {
                    id: "streaming-response",
                    label: "生成回复",
                    status: "running",
                  })
                ),
                startedAt: current?.statusCard.startedAt || Date.now(),
                updatedAt: Date.now(),
                isThinking: true,
              },
            })
          )
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
            order: nextMessageOrder(prev),
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
            order: nextMessageOrder(prev),
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
            order: nextMessageOrder(prev),
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
          const built = buildAssistantChatMessage(event.text);
          const withStreamedAnswer = upsertStreamingAssistantMessage(prev, event.runId, (current) => {
            return current
              ? {
                  ...current,
                  order: current.order || nextMessageOrder(prev),
                  text: event.text || current.text,
                  meta: {
                    ...current.meta,
                    runId: event.runId,
                    isStreaming: false,
                    planItems: built.meta?.planItems,
                  },
                }
              : {
                  ...built,
                  order: nextMessageOrder(prev),
                  meta: {
                    ...built.meta,
                    runId: event.runId,
                    isStreaming: false,
                  },
                };
          });
          return withStreamedAnswer.map((message) => {
            if (message.kind !== "status" || message.statusCard.runId !== event.runId) return message;
            return {
              ...message,
              statusCard: {
                ...message.statusCard,
                status: "success",
                headline: "思考完成",
                detail: message.statusCard.detail,
                summary: message.statusCard.summary,
                steps: completeRunningSteps(message.statusCard.steps, "success"),
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
            order: current?.order || nextMessageOrder(prev),
            statusCard: {
              runId: event.runId,
              status: "success",
              headline: current?.statusCard.headline || "思考完成",
              detail: current?.statusCard.detail,
              summary: current?.statusCard.summary,
              steps: completeRunningSteps(current?.statusCard.steps || [], "success"),
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
            order: current?.order || nextMessageOrder(prev),
            statusCard: {
              runId: event.runId,
              status: "error",
              headline: "思考中断",
              detail: event.error,
              summary: current?.statusCard.summary,
              steps: completeRunningSteps(current?.statusCard.steps || [], "error"),
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
              order: nextMessageOrder(withStatus),
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
