import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";

const createWorkflowNodeParameters = {
  type: "object",
  properties: {
    node_type: {
      type: "string",
      enum: ["text", "imageGen"],
      description: "Workflow node type to create.",
    },
    title: {
      type: "string",
      description: "Optional node title shown in NodeLab.",
    },
    text: {
      type: "string",
      description: "Text content for text nodes.",
    },
    aspect_ratio: {
      type: "string",
      enum: ["1:1", "16:9", "9:16", "4:3", "21:9"],
      description: "Optional aspect ratio for image generation nodes.",
    },
  },
  required: ["node_type"],
} as const;

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const parseArgs = (input: unknown) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("create_workflow_node 需要对象参数。");
  }
  const raw = input as Record<string, unknown>;
  const nodeType = normalizeString(raw.node_type ?? raw.nodeType);
  const title = normalizeString(raw.title);
  const text = normalizeString(raw.text);
  const aspectRatio = normalizeString(raw.aspect_ratio ?? raw.aspectRatio);

  if (nodeType !== "text" && nodeType !== "imageGen") {
    throw new Error("create_workflow_node 当前仅支持 node_type=text 或 imageGen。");
  }
  if (nodeType === "text" && !text) {
    throw new Error("create_workflow_node 创建 text 节点时需要 text。");
  }
  if (aspectRatio && !["1:1", "16:9", "9:16", "4:3", "21:9"].includes(aspectRatio)) {
    throw new Error("create_workflow_node 收到不支持的 aspect_ratio。");
  }

  return {
    nodeType: nodeType as "text" | "imageGen",
    title: title || (nodeType === "text" ? "文本节点" : "Img Gen"),
    text,
    aspectRatio: aspectRatio || "1:1",
  };
};

export const createWorkflowNodeToolDef = {
  name: "create_workflow_node",
  description:
    "Create a workflow node in NodeLab. In the current V1, only text nodes and image generation nodes are supported.",
  parameters: createWorkflowNodeParameters,
  execute: (input: unknown, bridge: Script2VideoAgentBridge) => {
    const args = parseArgs(input);
    return bridge.createWorkflowNode({
      type: args.nodeType,
      title: args.title,
      text: args.nodeType === "text" ? args.text : undefined,
      aspectRatio: args.nodeType === "imageGen" ? args.aspectRatio : undefined,
    });
  },
  summarize: (output: any) =>
    `已创建 ${output?.nodeType || output?.node_type || "节点"} ${output?.title || ""}${output?.nodeId || output?.node_id ? `（${output?.nodeId || output?.node_id}）` : ""}`.trim(),
};
