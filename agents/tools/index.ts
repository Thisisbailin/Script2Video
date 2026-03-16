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
          const output = await toolDef.execute(input, bridge);
          const summary = toolDef.summarize(output);
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
