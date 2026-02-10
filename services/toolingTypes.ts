export type AgentTool =
  | { type: "web_search_preview" }
  | {
      type: "function";
      name: string;
      description?: string;
      parameters: Record<string, any>;
      strict?: boolean;
    };

export type AgentToolCall = {
  type: "function";
  name: string;
  arguments: string;
  callId?: string;
  status?: string;
};
