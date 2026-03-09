import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";

const connectWorkflowNodesParameters = {
  type: "object",
  properties: {
    source_ref: {
      type: "string",
      description: "Preferred semantic ref of the source node tail. Use the node_ref returned by create_workflow_node.",
    },
    target_ref: {
      type: "string",
      description: "Preferred semantic ref of the target node head. Use the node_ref returned by create_workflow_node.",
    },
    source_node_id: {
      type: "string",
      description: "Fallback source node id when a semantic ref is not available.",
    },
    target_node_id: {
      type: "string",
      description: "Fallback target node id when a semantic ref is not available.",
    },
    source_handle: {
      type: "string",
      enum: ["text", "image"],
      description: "Optional source handle. Use when you need a non-default connection.",
    },
    target_handle: {
      type: "string",
      enum: ["text", "image"],
      description: "Optional target handle. Use when you need a non-default connection.",
    },
  },
  required: [],
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
  const sourceRef = normalizeString(raw.source_ref ?? raw.sourceRef);
  const targetRef = normalizeString(raw.target_ref ?? raw.targetRef);
  const sourceNodeId = normalizeString(raw.source_node_id ?? raw.sourceNodeId);
  const targetNodeId = normalizeString(raw.target_node_id ?? raw.targetNodeId);
  const sourceHandle = normalizeString(raw.source_handle ?? raw.sourceHandle) || undefined;
  const targetHandle = normalizeString(raw.target_handle ?? raw.targetHandle) || undefined;
  if ((!sourceRef && !sourceNodeId) || (!targetRef && !targetNodeId)) {
    throw new Error("connect_workflow_nodes 需要为尾端和首端节点分别提供 ref 或 node_id。优先使用 ref。");
  }
  const sourceIdentity = sourceRef || sourceNodeId;
  const targetIdentity = targetRef || targetNodeId;
  if (sourceIdentity && targetIdentity && sourceIdentity === targetIdentity) {
    throw new Error("connect_workflow_nodes 不能连接同一个节点到自己。");
  }
  return { sourceRef, targetRef, sourceNodeId, targetNodeId, sourceHandle, targetHandle };
};

export const connectWorkflowNodesToolDef = {
  name: "connect_workflow_nodes",
  description:
    "Connect two existing workflow nodes in NodeLab from the previous node's output tail to the next node's input head. Prefer source_ref and target_ref instead of random node ids. For the current V1, text to text defaults to text -> text, and text to imageGen defaults to text -> text. Use explicit handles only for special cases.",
  parameters: connectWorkflowNodesParameters,
  execute: (input: unknown, bridge: Script2VideoAgentBridge) => {
    const args = parseArgs(input);
    return bridge.connectWorkflowNodes({
      sourceRef: args.sourceRef || undefined,
      targetRef: args.targetRef || undefined,
      sourceNodeId: args.sourceNodeId,
      targetNodeId: args.targetNodeId,
      sourceHandle: args.sourceHandle as "text" | "image" | undefined,
      targetHandle: args.targetHandle as "text" | "image" | undefined,
    });
  },
  summarize: (output: any) =>
    `已连接 ${output?.sourceRef || output?.source_ref || output?.sourceNodeId || output?.source_node_id || "源节点"} -> ${output?.targetRef || output?.target_ref || output?.targetNodeId || output?.target_node_id || "目标节点"}`,
};
