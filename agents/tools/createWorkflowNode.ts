import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";

const createWorkflowNodeParameters = {
  type: "object",
  properties: {
    node_ref: {
      type: "string",
      description:
        "Stable semantic reference for this node, such as bull_prompt or poster_image. Reuse this ref in later connect_workflow_nodes calls.",
    },
    node_type: {
      type: "string",
      enum: ["text", "imageGen", "scriptBoard", "storyboardBoard", "identityCard"],
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
    episode_id: {
      type: "integer",
      description: "Optional episode id for scriptBoard or storyboardBoard nodes.",
    },
    scene_id: {
      type: "string",
      description: "Optional scene id for storyboardBoard nodes.",
    },
    entity_type: {
      type: "string",
      enum: ["character", "scene"],
      description: "Identity card mode.",
    },
    entity_id: {
      type: "string",
      description: "Optional character id or scene/location id for identity cards.",
    },
  },
  required: ["node_type", "node_ref"],
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
  const nodeRef = normalizeString(raw.node_ref ?? raw.nodeRef);
  const nodeType = normalizeString(raw.node_type ?? raw.nodeType);
  const title = normalizeString(raw.title);
  const text = normalizeString(raw.text);
  const aspectRatio = normalizeString(raw.aspect_ratio ?? raw.aspectRatio);
  const sceneId = normalizeString(raw.scene_id ?? raw.sceneId);
  const entityType = normalizeString(raw.entity_type ?? raw.entityType);
  const entityId = normalizeString(raw.entity_id ?? raw.entityId);
  const episodeId =
    typeof (raw.episode_id ?? raw.episodeId) === "number"
      ? Number(raw.episode_id ?? raw.episodeId)
      : Number.parseInt(String(raw.episode_id ?? raw.episodeId ?? ""), 10);

  if (!nodeRef) {
    throw new Error("create_workflow_node 需要稳定的 node_ref，供后续连接节点时复用。");
  }
  if (!["text", "imageGen", "scriptBoard", "storyboardBoard", "identityCard"].includes(nodeType)) {
    throw new Error("create_workflow_node 当前仅支持 text、imageGen、scriptBoard、storyboardBoard、identityCard。");
  }
  if (nodeType === "text" && !text) {
    throw new Error("create_workflow_node 创建 text 节点时需要 text。");
  }
  if (aspectRatio && !["1:1", "16:9", "9:16", "4:3", "21:9"].includes(aspectRatio)) {
    throw new Error("create_workflow_node 收到不支持的 aspect_ratio。");
  }
  if (nodeType === "storyboardBoard" && sceneId && !Number.isFinite(episodeId)) {
    throw new Error("create_workflow_node 创建 storyboardBoard 且提供 scene_id 时，建议同时提供 episode_id。");
  }
  if (nodeType === "identityCard" && entityType && entityType !== "character" && entityType !== "scene") {
    throw new Error("create_workflow_node 的 identityCard 只支持 entity_type=character 或 scene。");
  }

  return {
    nodeRef,
    nodeType: nodeType as "text" | "imageGen" | "scriptBoard" | "storyboardBoard" | "identityCard",
    title:
      title ||
      (nodeType === "text"
        ? "文本节点"
        : nodeType === "imageGen"
          ? "Img Gen"
          : nodeType === "scriptBoard"
            ? "剧本卡片"
            : nodeType === "storyboardBoard"
              ? "分镜表格卡片"
              : "身份卡片"),
    text,
    aspectRatio: aspectRatio || "1:1",
    episodeId: Number.isFinite(episodeId) ? episodeId : undefined,
    sceneId,
    entityType: entityType === "scene" ? "scene" : "character",
    entityId,
  };
};

export const createWorkflowNodeToolDef = {
  name: "create_workflow_node",
  description:
    "Create a workflow node in NodeLab. Always provide a stable node_ref so later connections can refer to the node semantically. Supported types include text, imageGen, scriptBoard, storyboardBoard, and identityCard.",
  parameters: createWorkflowNodeParameters,
  execute: (input: unknown, bridge: Script2VideoAgentBridge) => {
    const args = parseArgs(input);
    return bridge.createWorkflowNode({
      type: args.nodeType,
      nodeRef: args.nodeRef,
      title: args.title,
      text: args.nodeType === "text" ? args.text : undefined,
      aspectRatio: args.nodeType === "imageGen" ? args.aspectRatio : undefined,
      episodeId: args.nodeType === "scriptBoard" || args.nodeType === "storyboardBoard" ? args.episodeId : undefined,
      sceneId: args.nodeType === "storyboardBoard" ? args.sceneId : undefined,
      entityType: args.nodeType === "identityCard" ? args.entityType : undefined,
      entityId: args.nodeType === "identityCard" ? args.entityId : undefined,
    });
  },
  summarize: (output: any) =>
    `已创建 ${output?.nodeType || output?.node_type || "节点"} ${output?.title || ""}${output?.nodeRef || output?.node_ref ? `（ref:${output?.nodeRef || output?.node_ref}）` : ""}${output?.nodeId || output?.node_id ? `（${output?.nodeId || output?.node_id}）` : ""}`.trim(),
};
