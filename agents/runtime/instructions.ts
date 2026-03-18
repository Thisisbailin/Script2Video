import type { RunContext } from "@openai/agents";
import type { AgentUiContext, Script2VideoAgentEnvironment, Script2VideoRunContext, Script2VideoSkillDefinition } from "./types";

const BASE_INSTRUCTION = [
  "You are the Script2Video creative operating agent.",
  "You are a single all-purpose agent.",
  "Work in Chinese unless the user explicitly requests another language.",
  "Respond directly when no project state, project facts, or workflow change is needed.",
  "Use tools when you need grounded project facts, durable edits, or workflow operations.",
  "You receive a structured environment snapshot in run context. Treat it as your first project map.",
  "Choose your own strategy. Use the environment snapshot first, then inspect the project only as much as needed.",
  "Treat project data and completed tool results as the source of truth.",
  "When the exact target is unknown, locate it before acting instead of guessing ids or names.",
  "When a user asks to change durable project state, use the editing tools instead of replying with pretend changes.",
  "When a user asks for workflow artifacts, create only the necessary nodes and connections.",
  "If required data or capability is missing, say what is missing and why it blocks the request.",
  "Do not pretend a write or node creation succeeded unless a tool actually completed it.",
  "Prefer concise, high-signal progress through the available tools over repetitive rereads.",
].join(" ");

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

const formatList = (items: string[]) => items.filter(Boolean).join(", ");

const formatEnvironmentInstruction = (environment?: Script2VideoAgentEnvironment) => {
  if (!environment) return "";

  const { project, capabilityManifest, runtimeCapabilities, recentSuccessfulActions } = environment;
  const lines: string[] = [];

  lines.push("[Environment Snapshot]");
  lines.push(
    `Runtime: ${runtimeCapabilities.runtimeMode}; enabled tools: ${formatList(runtimeCapabilities.enabledTools) || "none"}.`
  );
  lines.push(
    `Capabilities: read(${formatList(capabilityManifest.read.resources)}); edit(${formatList(capabilityManifest.edit.resources)}); operate(${formatList(capabilityManifest.operate.nodeKinds)} nodes + workflow_connection).`
  );
  lines.push(
    `Project: ${project.fileName || "untitled"}; episodes=${project.episodeCount}; understanding coverage => project_summary=${project.understandingCoverage.hasProjectSummary ? "yes" : "no"}, episode_summaries=${project.understandingCoverage.episodeSummaryCount}, primary_roles=${project.understandingCoverage.primaryRoleCount}, scene_roles=${project.understandingCoverage.sceneRoleCount}, guides=${project.understandingCoverage.guideCount}.`
  );

  if (project.projectSummary) {
    lines.push(`Project Summary: ${project.projectSummary}`);
  }
  if (project.episodeSummaries.length) {
    lines.push(
      `Episode Summaries: ${project.episodeSummaries
        .map((item) => `E${item.episodeId} ${item.label}: ${item.summary}`)
        .join(" | ")}`
    );
  }
  if (project.primaryRoles.length) {
    lines.push(
      `Primary Roles: ${project.primaryRoles
        .map((role) => `${role.displayName}: ${role.summary}${role.episodeUsage ? ` (${role.episodeUsage})` : ""}`)
        .join(" | ")}`
    );
  }
  if (project.sceneRoles.length) {
    lines.push(
      `Scene Roles: ${project.sceneRoles
        .map((role) => `${role.displayName}: ${role.summary}${role.episodeUsage ? ` (${role.episodeUsage})` : ""}`)
        .join(" | ")}`
    );
  }
  if (recentSuccessfulActions.length) {
    lines.push(
      `Recent Successful Actions: ${recentSuccessfulActions
        .map((item) => `${item.toolName}: ${item.summary}`)
        .join(" | ")}`
    );
  }

  return lines.join("\n");
};

export const composeAgentInstructions = ({
  enabledSkills,
}: {
  enabledSkills: Script2VideoSkillDefinition[];
}) => {
  const overlays = enabledSkills.map((skill) => `# Skill: ${skill.title}\n${skill.systemOverlay.trim()}`);
  return (runContext: RunContext<Script2VideoRunContext>) => {
    const environmentBlock = formatEnvironmentInstruction(runContext.context?.agentEnvironment);
    const uiBlock = uiContextInstruction(runContext.context?.uiContext as AgentUiContext | undefined);
    return [BASE_INSTRUCTION, environmentBlock, ...overlays, uiBlock].filter(Boolean).join("\n\n");
  };
};
