import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";

const writeProjectSummaryParameters = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "Project-level understanding summary in Chinese.",
    },
  },
  required: ["summary"],
} as const;

const parseArgs = (input: unknown) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("write_project_summary 需要对象参数。");
  }
  const raw = input as Record<string, unknown>;
  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  if (!summary) {
    throw new Error("write_project_summary 需要 summary。");
  }
  return { summary };
};

export const writeProjectSummaryToolDef = {
  name: "write_project_summary",
  description: "Persist a project-level understanding summary into the project knowledge base.",
  parameters: writeProjectSummaryParameters,
  execute: (input: unknown, bridge: Script2VideoAgentBridge) => {
    const args = parseArgs(input);
    bridge.updateProjectData((prev) => ({
      ...prev,
      context: {
        ...prev.context,
        projectSummary: args.summary,
      },
    }));
    return {
      updated: true,
      field: "context.projectSummary",
      chars: args.summary.length,
      summary: args.summary,
    };
  },
  summarize: (output: any) => `已写入项目摘要（${output?.chars || 0} 字）`,
};
