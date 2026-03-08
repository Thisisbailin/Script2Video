import { useCallback, useRef, useState } from "react";
import type { Message } from "../../node-workspace/components/qalam/types";
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

export const useScript2VideoAgent = ({ runtime, sessionId, setMessages }: Options) => {
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleEvent = useCallback(
    (event: AgentRuntimeEvent) => {
      if (event.type === "tool_called") {
        recordAgentToolCalled(event.call);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            kind: "tool",
            tool: {
              callId: event.call.callId,
              name: event.call.name,
              status: "running",
              summary: event.call.summary || "工具执行中",
            },
          },
        ]);
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
      }
      if (event.type === "message_completed") {
        setMessages((prev) => [...prev, buildAssistantChatMessage(event.text)]);
      }
      if (event.type === "run_failed") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            kind: "chat",
            text: `请求失败: ${event.error}`,
          },
        ]);
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
