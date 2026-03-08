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
    planItems?: string[];
    reasoningSummary?: string;
    thinkingStatus?: "active" | "done";
    searchEnabled?: boolean;
    searchUsed?: boolean;
    searchQueries?: string[];
  };
};

export type ToolMessage = { role: "assistant"; kind: "tool" | "tool_result"; tool: ToolPayload };
export type TracePayload = {
  runId: string;
  status: TraceStatus;
  entries: Array<{
    id: string;
    at: number;
    stage: TraceStage;
    status: TraceEntryStatus;
    title: string;
    detail?: string;
    payload?: string;
  }>;
};
export type TraceMessage = { role: "assistant"; kind: "trace"; trace: TracePayload };

export type Message = ChatMessage | ToolMessage | TraceMessage;

export const isToolMessage = (message: Message): message is ToolMessage =>
  message.kind === "tool" || message.kind === "tool_result";

export const isTraceMessage = (message: Message): message is TraceMessage => message.kind === "trace";
