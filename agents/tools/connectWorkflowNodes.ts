import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";

const connectWorkflowNodesParameters = {
  type: "object",
  properties: {
    source_node_id: {
      type: "string",
      description: "Source node id.",
    },
    target_node_id: {
      type: "string",
      description: "Target node id.",
    },
  },
  required: ["source_node_id", "target_node_id"],
} as const;

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const parseArgs = (input: unknown) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("connect_workflow_nodes 需要对象参数。");
  }
  const raw = input as Record<string, unknown>;
  const sourceNodeId = normalizeString(raw.source_node_id ?? raw.sourceNodeId);
  const targetNodeId = normalizeString(raw.target_node_id ?? raw.targetNodeId);
  if (!sourceNodeId || !targetNodeId) {
    throw new Error("connect_workflow_nodes 需要 source_node_id 和 target_node_id。");
  }
  if (sourceNodeId === targetNodeId) {
    throw new Error("connect_workflow_nodes 不能连接同一个节点到自己。");
  }
  return { sourceNodeId, targetNodeId };
};

export const connectWorkflowNodesToolDef = {
  name: "connect_workflow_nodes",
  description:
    "Connect two existing workflow nodes in NodeLab. The tool will infer the default legal handles for the current V1 node types.",
  parameters: connectWorkflowNodesParameters,
  execute: (input: unknown, bridge: Script2VideoAgentBridge) => {
    const args = parseArgs(input);
    return bridge.connectWorkflowNodes({
      sourceNodeId: args.sourceNodeId,
      targetNodeId: args.targetNodeId,
    });
  },
  summarize: (output: any) => `已连接 ${output?.sourceNodeId || output?.source_node_id || "源节点"} -> ${output?.targetNodeId || output?.target_node_id || "目标节点"}`,
};
