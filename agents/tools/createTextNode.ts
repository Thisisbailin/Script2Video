import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";

const createTextNodeParameters = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Short node title.",
    },
    text: {
      type: "string",
      description: "Main text content to persist into a NodeLab text node.",
    },
  },
  required: ["text"],
} as const;

const parseArgs = (input: unknown) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("create_text_node 需要对象参数。");
  }
  const raw = input as Record<string, unknown>;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  if (!text) {
    throw new Error("create_text_node 需要 text。");
  }
  return {
    title: title || "文本节点",
    text,
  };
};

export const createTextNodeToolDef = {
  name: "create_text_node",
  description: "Create a durable text node in NodeLab for synopsis, analysis, storyboard drafts, prompts, or notes.",
  parameters: createTextNodeParameters,
  execute: (input: unknown, bridge: Script2VideoAgentBridge) => {
    const args = parseArgs(input);
    return bridge.addTextNode({
      title: args.title,
      text: args.text,
    });
  },
  summarize: (output: any) => `已创建文本节点 ${output?.title || ""}`.trim(),
};
