import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";

const operateProjectWorkflowParameters = {
  type: "object",
  properties: {
    action_type: {
      type: "string",
      enum: ["create_text_to_image_flow"],
      description: "Workflow action to perform.",
    },
    title: {
      type: "string",
      description: "Optional workflow title shown on the group wrapper.",
    },
    prompt_title: {
      type: "string",
      description: "Optional title for the text prompt node.",
    },
    prompt_text: {
      type: "string",
      description: "Prompt text to place into the text node. This will feed the image generation node.",
    },
    image_title: {
      type: "string",
      description: "Optional title for the image generation node.",
    },
    aspect_ratio: {
      type: "string",
      enum: ["1:1", "16:9", "9:16", "4:3", "21:9"],
      description: "Optional aspect ratio for the image generation node.",
    },
  },
  required: ["action_type", "prompt_text"],
} as const;

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const parseArgs = (input: unknown) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("operate_project_workflow 需要对象参数。");
  }
  const raw = input as Record<string, unknown>;
  const actionType = normalizeString(raw.action_type ?? raw.actionType);
  const promptText = normalizeString(raw.prompt_text ?? raw.promptText);
  const title = normalizeString(raw.title);
  const promptTitle = normalizeString(raw.prompt_title ?? raw.promptTitle);
  const imageTitle = normalizeString(raw.image_title ?? raw.imageTitle);
  const aspectRatio = normalizeString(raw.aspect_ratio ?? raw.aspectRatio);

  if (actionType !== "create_text_to_image_flow") {
    throw new Error("operate_project_workflow 当前仅支持 action_type=create_text_to_image_flow。");
  }
  if (!promptText) {
    throw new Error("operate_project_workflow 需要 prompt_text。");
  }
  if (aspectRatio && !["1:1", "16:9", "9:16", "4:3", "21:9"].includes(aspectRatio)) {
    throw new Error("operate_project_workflow 收到不支持的 aspect_ratio。");
  }

  return {
    actionType: "create_text_to_image_flow" as const,
    title: title || "图像生成工作流",
    promptTitle: promptTitle || "图像提示词",
    promptText,
    imageTitle: imageTitle || "Img Gen",
    aspectRatio: aspectRatio || "1:1",
  };
};

export const operateProjectWorkflowToolDef = {
  name: "operate_project_workflow",
  description:
    "Operate NodeLab workflow artifacts. In the current V1, use this to create a connected text-to-image workflow with one text node wired into one image generation node.",
  parameters: operateProjectWorkflowParameters,
  execute: (input: unknown, bridge: Script2VideoAgentBridge) => {
    const args = parseArgs(input);

    const result = bridge.createNodeWorkflow({
      title: args.title,
      description: "Created by Script2Video Agent",
      wrapInGroup: true,
      layout: "horizontal",
      nodes: [
        {
          key: "prompt",
          type: "text",
          title: args.promptTitle,
          text: args.promptText,
        },
        {
          key: "image",
          type: "imageGen",
          title: args.imageTitle,
          data: {
            aspectRatio: args.aspectRatio,
          },
        },
      ],
      edges: [
        {
          from: "prompt",
          to: "image",
          fromHandle: "text",
          toHandle: "text",
        },
      ],
    });

    const textNode = result.nodes.find((node) => node.key === "prompt");
    const imageNode = result.nodes.find((node) => node.key === "image");

    return {
      action_type: args.actionType,
      workflow_title: args.title,
      group_id: result.groupId || null,
      text_node_id: textNode?.id || null,
      image_node_id: imageNode?.id || null,
      edge_count: result.edgeCount,
      aspect_ratio: args.aspectRatio,
    };
  },
  summarize: (output: any) => {
    const edgeCount = typeof output?.edge_count === "number" ? output.edge_count : 0;
    return `已创建 text -> imageGen 工作流（${edgeCount} 条连线）`;
  },
};
