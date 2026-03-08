import type { AgentUiContext, Script2VideoRunInput, Script2VideoSkillDefinition } from "./types";

const BASE_INSTRUCTION = [
  "You are the Script2Video creative operating agent.",
  "You are a single all-purpose agent, not a router and not a multi-agent coordinator.",
  "Work in Chinese unless the user explicitly requests another language.",
  "For greetings, small talk, acknowledgements, or simple capability questions, reply directly without using any tool.",
  "Use tools when project facts, durable document writing, or node operations are required.",
  "Never call read_project_data without a concrete target, search query, or explicit include fields.",
  "After a successful write or node operation, stop repeating the same tool unless verification is explicitly necessary.",
  "Do not pretend a write or node creation succeeded unless a tool actually completed it.",
  "When answering grounded questions, prefer evidence from project data such as episode and scene references.",
].join(" ");

const outcomeInstruction = (requestedOutcome: Script2VideoRunInput["requestedOutcome"]) => {
  switch (requestedOutcome) {
    case "answer":
      return "Current preferred outcome: provide a direct grounded answer unless a tool is clearly needed.";
    case "understanding_document":
      return "Current preferred outcome: produce a durable understanding document derived from project data.";
    case "node_workflow":
      return "Current preferred outcome: create or extend NodeLab work artifacts when the task calls for execution support. Use create_node_workflow for connected multi-node flows, and use create_text_node only for a single standalone note node.";
    default:
      return "Choose the best outcome yourself: answer directly, write a durable understanding artifact, or create a node artifact.";
  }
};

const uiContextInstruction = (uiContext?: AgentUiContext) => {
  const parts: string[] = [];
  if (uiContext?.supplementalContextText?.trim()) {
    parts.push(`[Supplemental Context]\n${uiContext.supplementalContextText.trim()}`);
  }
  if (uiContext?.mentionTags?.length) {
    parts.push(
      `[Mentions]\n${uiContext.mentionTags
        .map((tag) => `- @${tag.name} => ${tag.kind}${tag.id ? ` (${tag.id})` : ""}`)
        .join("\n")}`
    );
  }
  return parts.join("\n\n");
};

export const composeAgentInstructions = ({
  enabledSkills,
  requestedOutcome,
  uiContext,
}: {
  enabledSkills: Script2VideoSkillDefinition[];
  requestedOutcome?: Script2VideoRunInput["requestedOutcome"];
  uiContext?: AgentUiContext;
}) => {
  const overlays = enabledSkills.map((skill) => `# Skill: ${skill.title}\n${skill.systemOverlay.trim()}`);
  const uiBlock = uiContextInstruction(uiContext);
  return [BASE_INSTRUCTION, outcomeInstruction(requestedOutcome), ...overlays, uiBlock]
    .filter(Boolean)
    .join("\n\n");
};
