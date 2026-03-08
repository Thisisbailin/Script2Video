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
  meta?: {
    runId?: string;
    isStreaming?: boolean;
    planItems?: string[];
    reasoningSummary?: string;
    thinkingStatus?: "active" | "done";
    searchEnabled?: boolean;
    searchUsed?: boolean;
    searchQueries?: string[];
  };
};

export type ToolMessage = { role: "assistant"; kind: "tool" | "tool_result"; tool: ToolPayload };
export type StatusStep = {
  id: string;
  label: string;
  status: "running" | "success" | "error";
  detail?: string;
};

export type StatusPayload = {
  runId: string;
  status: TraceStatus;
  headline: string;
  detail?: string;
  steps: StatusStep[];
  startedAt: number;
  updatedAt: number;
  isThinking?: boolean;
};
export type StatusMessage = { role: "assistant"; kind: "status"; statusCard: StatusPayload };

export type Message = ChatMessage | ToolMessage | StatusMessage;

export const isToolMessage = (message: Message): message is ToolMessage =>
  message.kind === "tool" || message.kind === "tool_result";

export const isStatusMessage = (message: Message): message is StatusMessage => message.kind === "status";
