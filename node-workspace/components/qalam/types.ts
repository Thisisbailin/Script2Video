export type ToolStatus = "queued" | "running" | "success" | "error";
export type TraceStatus = "running" | "success" | "error";
export type TraceEntryStatus = "info" | "running" | "success" | "error";
export type TraceStage = "runtime" | "session" | "model" | "tool" | "result";

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
  order?: number;
  meta?: {
    runId?: string;
    isStreaming?: boolean;
    planItems?: string[];
    searchEnabled?: boolean;
    searchUsed?: boolean;
    searchQueries?: string[];
  };
};

export type ToolMessage = { role: "assistant"; kind: "tool" | "tool_result"; order?: number; tool: ToolPayload };
export type StatusStep = {
  id: string;
  label: string;
  status: "running" | "success" | "error";
  detail?: string;
};

export type StatusPayload = {
  id: string;
  runId: string;
  status: TraceStatus;
  headline: string;
  detail?: string;
  summary?: string;
  steps: StatusStep[];
  startedAt: number;
  updatedAt: number;
  isThinking?: boolean;
};
export type StatusMessage = { role: "assistant"; kind: "status"; order?: number; statusCard: StatusPayload };

export type Message = ChatMessage | ToolMessage | StatusMessage;

export const isToolMessage = (message: Message): message is ToolMessage =>
  message.kind === "tool" || message.kind === "tool_result";

export const isStatusMessage = (message: Message): message is StatusMessage => message.kind === "status";
