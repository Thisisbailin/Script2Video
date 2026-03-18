import { tool } from "@openai/agents";
import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";
import type { AgentExecutedToolCall, AgentRuntimeEvent } from "../runtime/types";
import { createScript2VideoToolInputGuardrails, createScript2VideoToolOutputGuardrails } from "../runtime/guardrails";
import { connectWorkflowNodesToolDef } from "./connectWorkflowNodes";
import { createNodeWorkflowToolDef } from "./createNodeWorkflow";
import { operateProjectWorkflowToolDef } from "./operateProjectWorkflow";
import { createWorkflowNodeToolDef } from "./createWorkflowNode";
import { createTextNodeToolDef } from "./createTextNode";
import { listProjectResourcesToolDef } from "./listProjectResources";
import { pingToolDef } from "./ping";
import { readProjectDataToolDef } from "./readProjectData";
import { readProjectResourceToolDef } from "./readProjectResource";
import { searchProjectResourceToolDef } from "./searchProjectResource";
import { searchScriptDataToolDef } from "./searchScriptData";
import { upsertCharacterToolDef } from "./upsertCharacter";
import { upsertLocationToolDef } from "./upsertLocation";
import { editUnderstandingResourceToolDef } from "./editUnderstandingResource";

const LOOKUP_TOOL_NAMES = new Set([
  "list_project_resources",
  "read_project_resource",
  "search_project_resource",
]);

const TOOL_DEFS = [
  pingToolDef,
  listProjectResourcesToolDef,
  readProjectResourceToolDef,
  searchProjectResourceToolDef,
  editUnderstandingResourceToolDef,
  createWorkflowNodeToolDef,
  connectWorkflowNodesToolDef,
  operateProjectWorkflowToolDef,
  readProjectDataToolDef,
  searchScriptDataToolDef,
  upsertCharacterToolDef,
  upsertLocationToolDef,
  createTextNodeToolDef,
  createNodeWorkflowToolDef,
] as const;

const stableSerialize = (value: unknown): string => {
  if (value == null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`).join(",")}}`;
};

export const createScript2VideoTools = ({
  bridge,
  emitEvent,
  disabledTools = [],
}: {
  bridge: Script2VideoAgentBridge;
  emitEvent?: (event: AgentRuntimeEvent) => void;
  disabledTools?: string[];
}) => {
  const disabled = new Set(disabledTools);
  const lookupCache = new Map<string, { output: unknown; summary: string }>();

  return TOOL_DEFS.filter((toolDef) => !disabled.has(toolDef.name)).map((toolDef) =>
    tool({
      name: toolDef.name,
      description: toolDef.description,
      parameters: toolDef.parameters,
      inputGuardrails: createScript2VideoToolInputGuardrails(toolDef.name, bridge),
      outputGuardrails: createScript2VideoToolOutputGuardrails(toolDef.name),
      execute: async (input) => {
        const callId = `${toolDef.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const runningCall: AgentExecutedToolCall = {
          callId,
          name: toolDef.name,
          status: "running",
          input,
        };
        emitEvent?.({ type: "tool_called", call: runningCall });
        try {
          const isLookupTool = LOOKUP_TOOL_NAMES.has(toolDef.name);
          const lookupSignature = isLookupTool ? `${toolDef.name}:${stableSerialize(input)}` : "";

          if (isLookupTool && lookupCache.has(lookupSignature)) {
            const cached = lookupCache.get(lookupSignature)!;
            const completedCall: AgentExecutedToolCall = {
              ...runningCall,
              status: "success",
              output: cached.output,
              summary: `${cached.summary}（复用本轮已有结果）`,
            };
            emitEvent?.({ type: "tool_completed", call: completedCall });
            return cached.output;
          }

          const output = await toolDef.execute(input, bridge);
          const summary = toolDef.summarize(output);
          if (isLookupTool) {
            lookupCache.set(lookupSignature, { output, summary });
          }
          const completedCall: AgentExecutedToolCall = {
            ...runningCall,
            status: "success",
            output,
            summary,
          };
          emitEvent?.({ type: "tool_completed", call: completedCall });
          return output;
        } catch (error: any) {
          const failedCall: AgentExecutedToolCall = {
            ...runningCall,
            status: "error",
            error: error?.message || "工具执行失败",
          };
          emitEvent?.({
            type: "tool_failed",
            call: failedCall,
            error: failedCall.error || "工具执行失败",
          });
          throw error;
        }
      },
    })
  );
};
