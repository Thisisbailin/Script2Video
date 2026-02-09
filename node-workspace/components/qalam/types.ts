export type ToolStatus = "queued" | "running" | "success" | "error";

export type ToolPayload = {
  name: string;
  status: ToolStatus;
  summary?: string;
  evidence?: string[];
  output?: string;
  callId?: string;
};

export type ChatMessage = {
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

export type ToolMessage = { role: "assistant"; kind: "tool" | "tool_result"; tool: ToolPayload };

export type Message = ChatMessage | ToolMessage;

export const isToolMessage = (message: Message): message is ToolMessage =>
  message.kind === "tool" || message.kind === "tool_result";
