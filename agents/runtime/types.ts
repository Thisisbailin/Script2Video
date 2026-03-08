import type { QalamToolSettings } from "../../types";

export type AgentAttachment = {
  id: string;
  kind: "image";
  name: string;
  mimeType: string;
  url: string;
};

export type AgentUiContext = {
  supplementalContextText?: string;
  mentionTags?: Array<{ kind: "character" | "location"; name: string; id?: string }>;
};

export type AgentExecutedToolCall = {
  callId: string;
  name: string;
  status: "running" | "success" | "error";
  summary?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
};

export type AgentOutputItem =
  | { kind: "text"; text: string }
  | { kind: "tool_result"; toolCall: AgentExecutedToolCall };

export type Script2VideoRunInput = {
  sessionId: string;
  userText: string;
  attachments?: AgentAttachment[];
  enabledSkillIds?: string[];
  uiContext?: AgentUiContext;
  requestedOutcome?: "answer" | "understanding_document" | "node_workflow" | "auto";
};

export type Script2VideoRunResult = {
  finalText: string;
  sessionId: string;
  outputItems: AgentOutputItem[];
  toolCalls: AgentExecutedToolCall[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};

export interface Script2VideoAgentRuntime {
  run(input: Script2VideoRunInput, options?: Script2VideoRunOptions): Promise<Script2VideoRunResult>;
}

export type AgentRuntimeEvent =
  | { type: "run_started"; sessionId: string }
  | { type: "tool_called"; call: AgentExecutedToolCall }
  | { type: "tool_completed"; call: AgentExecutedToolCall }
  | { type: "tool_failed"; call: AgentExecutedToolCall; error: string }
  | { type: "message_completed"; text: string }
  | { type: "run_completed"; result: Script2VideoRunResult }
  | { type: "run_failed"; error: string };

export type Script2VideoRunOptions = {
  onEvent?: (event: AgentRuntimeEvent) => void;
  signal?: AbortSignal;
};

export type Script2VideoAgentConfig = {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  qalamTools?: QalamToolSettings;
  tracingDisabled?: boolean;
};

export interface Script2VideoAgentConfigProvider {
  getConfig(): Promise<Script2VideoAgentConfig> | Script2VideoAgentConfig;
}

export type Script2VideoSkillDefinition = {
  id: string;
  title: string;
  description: string;
  systemOverlay: string;
  preferredOutcome?: "answer" | "understanding_document" | "node_workflow";
  preferredTools?: string[];
  disabledTools?: string[];
};

export interface Script2VideoSkillLoader {
  listSkills(): Promise<Script2VideoSkillDefinition[]> | Script2VideoSkillDefinition[];
  getSkill(id: string): Promise<Script2VideoSkillDefinition | null> | Script2VideoSkillDefinition | null;
}

export type AgentSessionMessage = {
  role: "user" | "assistant";
  text: string;
  createdAt: number;
};

export type Script2VideoSessionRecord = {
  id: string;
  messages: AgentSessionMessage[];
  updatedAt: number;
};

export interface Script2VideoSessionStore {
  getSession(sessionId: string): Promise<Script2VideoSessionRecord | null> | Script2VideoSessionRecord | null;
  saveSession(record: Script2VideoSessionRecord): Promise<void> | void;
}

export interface Script2VideoAgentTracer {
  onRunStarted(input: Script2VideoRunInput): void;
  onToolCalled(call: AgentExecutedToolCall): void;
  onToolCompleted(call: AgentExecutedToolCall): void;
  onRunCompleted(result: Script2VideoRunResult): void;
  onRunFailed(error: string): void;
}
