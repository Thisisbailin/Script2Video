import type { ChatMessage } from "../../node-workspace/components/qalam/types";
import type { Script2VideoRunInput } from "../runtime/types";

const NODE_WORKFLOW_HINTS = [
  "节点",
  "工作流",
  "workflow",
  "node",
  "搭建流程",
  "创建流程",
  "创建节点",
  "生成节点",
];

const UNDERSTANDING_DOCUMENT_HINTS = [
  "情节梗概",
  "梳理",
  "总结",
  "分析",
  "角色分析",
  "场景分析",
  "人物小传",
  "分镜",
  "storyboard",
  "prompt",
  "提示词",
  "文档",
];

const parsePlanFromText = (text: string) => {
  const lines = (text || "").split("\n");
  const planItems: string[] = [];
  let inPlan = false;

  const headingRegex = /^\s*(计划|Plan)\b\s*[:：]?\s*$/i;
  const listRegex = /^\s*(?:[-*•]|\d+\.|\d+、)\s*(.+)$/;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!inPlan && headingRegex.test(line)) {
      inPlan = true;
      continue;
    }
    if (!inPlan) continue;
    if (!line.trim()) {
      if (planItems.length > 0) break;
      continue;
    }
    const match = line.match(listRegex);
    if (match) {
      planItems.push(match[1].trim());
      continue;
    }
    break;
  }

  return {
    text: (text || "").trim(),
    planItems: planItems.length ? planItems : undefined,
  };
};

export const buildAssistantChatMessage = (text: string): ChatMessage => {
  const parsed = parsePlanFromText(text);
  return {
    role: "assistant",
    kind: "chat",
    text: parsed.text,
    meta: {
      planItems: parsed.planItems,
    },
  };
};

export const inferRequestedOutcome = (
  text: string
): Script2VideoRunInput["requestedOutcome"] => {
  const lowered = text.trim().toLowerCase();
  if (NODE_WORKFLOW_HINTS.some((hint) => lowered.includes(hint.toLowerCase()))) {
    return "node_workflow";
  }
  if (UNDERSTANDING_DOCUMENT_HINTS.some((hint) => lowered.includes(hint.toLowerCase()))) {
    return "understanding_document";
  }
  return "auto";
};
