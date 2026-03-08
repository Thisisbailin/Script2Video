import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";
import { createNodeWorkflowParameters, createNodeWorkflowSchema } from "./schemas";

export const createNodeWorkflowToolDef = {
  name: "create_node_workflow",
  description:
    "Create a multi-node NodeLab workflow skeleton with optional group wrapper and explicit edges. Use this for real workflow construction, not single note outputs.",
  parameters: createNodeWorkflowParameters,
  execute: (input: unknown, bridge: Script2VideoAgentBridge) => {
    const args = createNodeWorkflowSchema.parse(input);
    return bridge.createNodeWorkflow(args);
  },
  summarize: (output: any) => {
    const nodeCount = Array.isArray(output?.nodes) ? output.nodes.length : 0;
    const edgeCount = typeof output?.edgeCount === "number" ? output.edgeCount : 0;
    return `已创建工作流：${nodeCount} 个节点，${edgeCount} 条连线`;
  },
};
