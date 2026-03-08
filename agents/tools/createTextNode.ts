import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";
import { createTextNodeParameters, createTextNodeSchema } from "./schemas";

export const createTextNodeToolDef = {
  name: "create_text_node",
  description: "Create a durable text node in NodeLab for synopsis, analysis, storyboard drafts, prompts, or notes.",
  parameters: createTextNodeParameters,
  execute: (input: unknown, bridge: Script2VideoAgentBridge) => {
    const args = createTextNodeSchema.parse(input);
    const title = args.title?.trim() || "文本节点";
    const text = args.text.trim();
    if (!text) {
      throw new Error("文本节点内容为空。");
    }
    return bridge.addTextNode({
      title,
      text,
      x: args.x,
      y: args.y,
      parentId: args.parentId,
    });
  },
  summarize: (output: any) => `已创建文本节点 ${output?.title || ""}`.trim(),
};
