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

const DIRECT_REPLY_HINTS = [
  "你好",
  "您好",
  "hi",
  "hello",
  "在吗",
  "你是谁",
  "你能做什么",
  "介绍一下你自己",
];

const normalizeHeadingLine = (line: string) => {
  let cleaned = line.trim().replace(/^#{1,4}\s*/, "");
  if (cleaned.startsWith("**")) {
    const endBold = cleaned.indexOf("**", 2);
    if (endBold !== -1) {
      const inside = cleaned.slice(2, endBold);
      const rest = cleaned.slice(endBold + 2);
      cleaned = `${inside}${rest}`;
    }
  }
  return cleaned.trim();
};

const extractReasoningSection = (text: string) => {
  const lines = (text || "").split("\n");
  let start = -1;
  let end = -1;
  let inlineReasoning = "";

  const matchReasoningHeading = (line: string) => {
    const cleaned = normalizeHeadingLine(line);
    const match = cleaned.match(/^(思考过程|思考|Reasoning|Thoughts)(?:\s*[\(（][^)）]+[\)）])?\s*[:：]?\s*(.*)$/i);
    if (!match) return null;
    return { inline: match[2]?.trim() || "" };
  };

  for (let i = 0; i < lines.length; i += 1) {
    const match = matchReasoningHeading(lines[i]);
    if (match) {
      start = i;
      inlineReasoning = match.inline;
      break;
    }
  }
  if (start === -1) {
    return { text: (text || "").trim(), reasoning: undefined };
  }

  end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (!line.trim()) break;
    if (line.match(/^(#{1,4})\s+/)) break;
    if (line.match(/^\s*\*\*(.+)\*\*\s*$/)) break;
    if (inlineReasoning) {
      if (!line.match(/^\s*(?:[-*•]|\d+\.|\d+、)\s+/) && !line.match(/^\s{2,}/)) {
        break;
      }
    }
    end += 1;
  }

  const reasoningLines = [
    ...(inlineReasoning ? [inlineReasoning] : []),
    ...lines.slice(start + 1, end),
  ];
  const reasoning = reasoningLines.join("\n").trim();
  const cleaned = [...lines.slice(0, start), ...lines.slice(end)].join("\n").trim();
  return { text: cleaned, reasoning: reasoning || undefined };
};

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
  const extracted = extractReasoningSection(text);
  const parsed = parsePlanFromText(extracted.text);
  return {
    role: "assistant",
    kind: "chat",
    text: parsed.text,
    meta: {
      planItems: parsed.planItems,
      reasoningSummary: extracted.reasoning,
      thinkingStatus: extracted.reasoning ? "done" : undefined,
    },
  };
};

export const inferRequestedOutcome = (
  text: string,
  forcedMode: "auto" | "chat" | "work"
): Script2VideoRunInput["requestedOutcome"] => {
  if (forcedMode === "chat") return "answer";
  const lowered = text.trim().toLowerCase();
  if (DIRECT_REPLY_HINTS.some((hint) => lowered === hint.toLowerCase() || lowered.startsWith(`${hint.toLowerCase()} `))) {
    return "answer";
  }
  if (NODE_WORKFLOW_HINTS.some((hint) => lowered.includes(hint.toLowerCase()))) {
    return "node_workflow";
  }
  if (
    forcedMode === "work" ||
    UNDERSTANDING_DOCUMENT_HINTS.some((hint) => lowered.includes(hint.toLowerCase()))
  ) {
    return "understanding_document";
  }
  return "auto";
};
