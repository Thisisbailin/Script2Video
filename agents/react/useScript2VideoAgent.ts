import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, Message, StatusMessage } from "../../node-workspace/components/qalam/types";
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
  statusId: string,
  updater: (current: StatusMessage | null) => StatusMessage
) => {
  const index = messages.findIndex((message) => message.kind === "status" && message.statusCard.id === statusId);
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

const nextMessageOrder = (messages: Message[]) =>
  messages.reduce((max, message) => Math.max(max, message.order || 0), 0) + 1;

const humanizeToolName = (name: string) => {
  switch (name) {
    case "list_project_resources":
      return "查看项目目录";
    case "read_project_resource":
      return "查阅项目内容";
    case "search_project_resource":
      return "搜索项目内容";
    case "edit_project_resource":
      return "编辑项目资产";
    case "create_workflow_node":
      return "创建工作流节点";
    case "connect_workflow_nodes":
      return "连接工作流节点";
    case "operate_project_workflow":
      return "操作节点工作流";
    case "create_text_node":
      return "创建文本节点";
    default:
      return name;
  }
};

type StatusKind = "reasoning" | "response";

const completeStatusMessage = (
  messages: Message[],
  statusId: string,
  status: "success" | "error",
  patch?: Partial<StatusMessage["statusCard"]>
) =>
  messages.map((message) => {
    if (message.kind !== "status" || message.statusCard.id !== statusId) return message;
    return {
      ...message,
      statusCard: {
        ...message.statusCard,
        ...patch,
        status,
        updatedAt: Date.now(),
      },
    };
  });

export const useScript2VideoAgent = ({ runtime, sessionId, setMessages }: Options) => {
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const activeRunStartedAtRef = useRef<number | null>(null);
  const statusSequenceRef = useRef<Record<string, number>>({});
  const activeReasoningStatusIdRef = useRef<Record<string, string | undefined>>({});
  const activeResponseStatusIdRef = useRef<Record<string, string | undefined>>({});

  const createStatusId = useCallback((runId: string, kind: StatusKind) => {
    const next = (statusSequenceRef.current[runId] || 0) + 1;
    statusSequenceRef.current[runId] = next;
    return `${runId}-${kind}-${next}`;
  }, []);

  const ensureActiveStatusId = useCallback(
    (runId: string, kind: StatusKind) => {
      const ref = kind === "reasoning" ? activeReasoningStatusIdRef.current : activeResponseStatusIdRef.current;
      if (ref[runId]) return ref[runId] as string;
      const statusId = createStatusId(runId, kind);
      ref[runId] = statusId;
      return statusId;
    },
    [createStatusId]
  );

  const finalizeActiveReasoningStatus = useCallback((messages: Message[], runId: string, status: "success" | "error") => {
    const statusId = activeReasoningStatusIdRef.current[runId];
    if (!statusId) return messages;
    activeReasoningStatusIdRef.current[runId] = undefined;
    return completeStatusMessage(messages, statusId, status);
  }, []);

  const finalizeActiveResponseStatus = useCallback(
    (messages: Message[], runId: string, status: "success" | "error", patch?: Partial<StatusMessage["statusCard"]>) => {
      const statusId = activeResponseStatusIdRef.current[runId];
      if (!statusId) return messages;
      activeResponseStatusIdRef.current[runId] = undefined;
      return completeStatusMessage(messages, statusId, status, patch);
    },
    []
  );

  const handleEvent = useCallback(
    (event: AgentRuntimeEvent) => {
      if (event.type === "run_started") {
        activeRunIdRef.current = event.runId;
        activeRunStartedAtRef.current = Date.now();
        return;
      }

      if (event.type === "trace") {
        return;
      }

      if (event.type === "reasoning_delta") {
        const statusId = ensureActiveStatusId(event.runId, "reasoning");
        setMessages((prev) =>
          upsertStatusMessage(prev, statusId, (current) => ({
            role: "assistant",
            kind: "status",
            order: current?.order || nextMessageOrder(prev),
            statusCard: {
              id: statusId,
              runId: event.runId,
              status: current?.statusCard.status || "running",
              headline: "思考",
              detail: "模型正在分析并规划下一步。",
              summary: event.accumulatedText,
              steps: [],
              startedAt: current?.statusCard.startedAt || Date.now(),
              updatedAt: Date.now(),
              isThinking: true,
            },
          }))
        );
        return;
      }

      if (event.type === "reasoning_completed") {
        const statusId = ensureActiveStatusId(event.runId, "reasoning");
        setMessages((prev) =>
          upsertStatusMessage(prev, statusId, (current) => ({
            role: "assistant",
            kind: "status",
            order: current?.order || nextMessageOrder(prev),
            statusCard: {
              id: statusId,
              runId: event.runId,
              status: "success",
              headline: "思考",
              detail: "模型已完成这一段思考。",
              summary: event.text,
              steps: [],
              startedAt: current?.statusCard.startedAt || Date.now(),
              updatedAt: Date.now(),
              isThinking: true,
            },
          }))
        );
        activeReasoningStatusIdRef.current[event.runId] = undefined;
        return;
      }

      if (event.type === "message_delta") {
        const responseStatusId = ensureActiveStatusId(event.runId, "response");
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
            responseStatusId,
            (current) => ({
              role: "assistant",
              kind: "status",
              order: current?.order || nextMessageOrder(prev),
              statusCard: {
                id: responseStatusId,
                runId: event.runId,
                status: current?.statusCard.status || "running",
                headline: "生成回复",
                detail: "回答内容正在持续输出。",
                summary: undefined,
                steps: [],
                startedAt: current?.statusCard.startedAt || Date.now(),
                updatedAt: Date.now(),
                isThinking: false,
              },
            })
          )
        );
        setMessages((prev) => finalizeActiveReasoningStatus(prev, event.runId, "success"));
        return;
      }

      if (event.type === "tool_called") {
        recordAgentToolCalled(event.call);
        const actionLabel = humanizeToolName(event.call.name);
        setMessages((prev) => {
          const runId = activeRunIdRef.current;
          const withReasoningCompleted = runId ? finalizeActiveReasoningStatus(prev, runId, "success") : prev;
          return [
            ...withReasoningCompleted,
            {
              role: "assistant",
              kind: "tool",
              order: nextMessageOrder(withReasoningCompleted),
              tool: {
                callId: event.call.callId,
                name: event.call.name,
                status: "running",
                summary: event.call.summary || actionLabel,
              },
            },
          ];
        });
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
          return finalizeActiveResponseStatus(withStreamedAnswer, event.runId, "success", {
            headline: "回复完成",
            detail: "回答已生成完成。",
          });
        });
        return;
      }

      if (event.type === "run_completed") {
        activeRunIdRef.current = null;
        activeRunStartedAtRef.current = null;
        delete activeReasoningStatusIdRef.current[event.runId];
        delete activeResponseStatusIdRef.current[event.runId];
        delete statusSequenceRef.current[event.runId];
        return;
      }

      if (event.type === "run_failed") {
        activeRunIdRef.current = null;
        activeRunStartedAtRef.current = null;
        setMessages((prev) => {
          let withStatus = finalizeActiveReasoningStatus(prev, event.runId, "error");
          withStatus = finalizeActiveResponseStatus(withStatus, event.runId, "error", {
            headline: "回复中断",
            detail: event.error,
          });
          delete activeReasoningStatusIdRef.current[event.runId];
          delete activeResponseStatusIdRef.current[event.runId];
          delete statusSequenceRef.current[event.runId];
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
    [createStatusId, ensureActiveStatusId, finalizeActiveReasoningStatus, finalizeActiveResponseStatus, setMessages]
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
