import type { ChatMessage } from "../../node-workspace/components/qalam/types";
import type { Script2VideoRunInput } from "../runtime/types";

const EXPLICIT_NODE_WORKFLOW_PATTERNS = [
  /创建.*节点/,
  /新建.*节点/,
  /加载.*节点/,
  /连接.*节点/,
  /放到.*工作流/,
  /写入.*工作流/,
  /插入.*工作流/,
  /搭建.*工作流/,
  /扩展.*工作流/,
  /\bscriptboard\b/i,
  /\bstoryboardboard\b/i,
  /\bidentitycard\b/i,
];

const EXPLICIT_UNDERSTANDING_DOCUMENT_PATTERNS = [
  /写成.*文档/,
  /整理成.*文档/,
  /保存为.*文档/,
  /沉淀为.*文档/,
  /写入.*摘要/,
  /写入.*概述/,
  /写入.*档案/,
  /更新.*摘要/,
  /更新.*概述/,
  /更新.*档案/,
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
  const trimmed = text.trim();
  if (EXPLICIT_NODE_WORKFLOW_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return "node_workflow";
  }
  if (EXPLICIT_UNDERSTANDING_DOCUMENT_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return "understanding_document";
  }
  return "auto";
};

export const shouldPreferBrowserRuntime = (text: string) =>
  EXPLICIT_NODE_WORKFLOW_PATTERNS.some((pattern) => pattern.test(text.trim()));
