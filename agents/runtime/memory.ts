import type { AgentInputItem } from "@openai/agents";
import type { AgentAttachment } from "./types";
import type { AgentSessionMessage, Script2VideoAgentMemory, Script2VideoRunInput } from "./types";

const MAX_RECENT_TURNS = 8;
const MAX_RECENT_TOOLS = 6;
const MAX_MEMORY_TEXT = 220;
const HISTORY_REPLAY_WINDOW = 10;

const clipText = (value: string, limit = MAX_MEMORY_TEXT) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length <= limit ? trimmed : `${trimmed.slice(0, limit)}...`;
};

const buildUserMessageContent = (input: Script2VideoRunInput) => {
  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: input.userText.trim(),
    },
  ];

  (input.attachments || []).forEach((attachment) => {
    if (attachment.kind !== "image" || !attachment.url) return;
    content.push({
      type: "input_image",
      image_url: attachment.url,
      detail: "auto",
    });
  });

  return content;
};

export const buildRunInputItems = (input: Script2VideoRunInput): AgentInputItem[] => [
  {
    role: "user",
    content: buildUserMessageContent(input) as any,
  } as AgentInputItem,
];

export const buildAgentMemorySnapshot = (messages: AgentSessionMessage[] | undefined): Script2VideoAgentMemory => {
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      recentTurns: [],
      recentSuccessfulTools: [],
      recentFailedTools: [],
    };
  }

  const recentTurns = messages
    .filter((message): message is Extract<AgentSessionMessage, { role: "user" | "assistant" }> => message.role === "user" || message.role === "assistant")
    .slice(-MAX_RECENT_TURNS)
    .map((message) => ({
      role: message.role,
      text: clipText(message.text, 280),
      createdAt: message.createdAt,
    }));

  const toolMessages = messages.filter(
    (message): message is Extract<AgentSessionMessage, { role: "tool" }> => message.role === "tool"
  );

  return {
    recentTurns,
    recentSuccessfulTools: toolMessages
      .filter((message) => message.toolStatus === "success")
      .slice(-MAX_RECENT_TOOLS)
      .reverse()
      .map((message) => ({
        toolName: message.toolName,
        status: "success" as const,
        summary: clipText(message.text),
        createdAt: message.createdAt,
      })),
    recentFailedTools: toolMessages
      .filter((message) => message.toolStatus === "error")
      .slice(-MAX_RECENT_TOOLS)
      .reverse()
      .map((message) => ({
        toolName: message.toolName,
        status: "error" as const,
        summary: clipText(message.text),
        createdAt: message.createdAt,
      })),
  };
};

const isReplayableMessageItem = (item: AgentInputItem) => {
  if (!item || typeof item !== "object") return false;
  const role = (item as any).role;
  return role === "user" || role === "assistant";
};

const buildMemoryNote = (memory: Script2VideoAgentMemory) => {
  const lines: string[] = [];

  if (memory.recentTurns.length) {
    lines.push(
      `Recent Turns: ${memory.recentTurns.map((turn) => `${turn.role}: ${turn.text}`).join(" | ")}`
    );
  }
  if (memory.recentSuccessfulTools.length) {
    lines.push(
      `Recent Successful Tool Results: ${memory.recentSuccessfulTools
        .map((tool) => `${tool.toolName}: ${tool.summary}`)
        .join(" | ")}`
    );
  }
  if (memory.recentFailedTools.length) {
    lines.push(
      `Recent Failed Tool Results: ${memory.recentFailedTools
        .map((tool) => `${tool.toolName}: ${tool.summary}`)
        .join(" | ")}`
    );
  }

  if (!lines.length) return null;

  return {
    role: "assistant",
    content: [
      {
        type: "output_text",
        text: `[Session Memory Snapshot]\n${lines.join("\n")}`,
      },
    ],
  } as AgentInputItem;
};

export const createAgentSessionInputCallback =
  (memory: Script2VideoAgentMemory, historyWindow = HISTORY_REPLAY_WINDOW) =>
  async (historyItems: AgentInputItem[], newItems: AgentInputItem[]) => {
    const trimmedHistory = historyItems.filter(isReplayableMessageItem).slice(-historyWindow);
    const memoryNote = buildMemoryNote(memory);
    return [...trimmedHistory, ...(memoryNote ? [memoryNote] : []), ...newItems];
  };

