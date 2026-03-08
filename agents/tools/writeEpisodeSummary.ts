import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";

const writeEpisodeSummaryParameters = {
  type: "object",
  properties: {
    episode_id: {
      type: "integer",
      description: "Episode number, 1-based.",
    },
    summary: {
      type: "string",
      description: "Episode-level understanding summary in Chinese.",
    },
  },
  required: ["episode_id", "summary"],
} as const;

const toPositiveInteger = (value: unknown) => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return undefined;
};

const parseArgs = (input: unknown) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("write_episode_summary 需要对象参数。");
  }
  const raw = input as Record<string, unknown>;
  const episodeId = toPositiveInteger(raw.episode_id ?? raw.episodeId);
  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  if (!episodeId) {
    throw new Error("write_episode_summary 需要 episode_id。");
  }
  if (!summary) {
    throw new Error("write_episode_summary 需要 summary。");
  }
  return { episodeId, summary };
};

export const writeEpisodeSummaryToolDef = {
  name: "write_episode_summary",
  description: "Persist an episode-level understanding summary into the project knowledge base.",
  parameters: writeEpisodeSummaryParameters,
  execute: (input: unknown, bridge: Script2VideoAgentBridge) => {
    const args = parseArgs(input);
    const projectData = bridge.getProjectData();
    const episode = (projectData.episodes || []).find((item) => item.id === args.episodeId);
    if (!episode) {
      throw new Error(`write_episode_summary 未找到第 ${args.episodeId} 集。`);
    }

    bridge.updateProjectData((prev) => {
      const updatedEpisodes = (prev.episodes || []).map((item) =>
        item.id === args.episodeId ? { ...item, summary: args.summary } : item
      );
      const restSummaries = (prev.context?.episodeSummaries || []).filter((item) => item.episodeId !== args.episodeId);
      return {
        ...prev,
        episodes: updatedEpisodes,
        context: {
          ...prev.context,
          episodeSummaries: [...restSummaries, { episodeId: args.episodeId, summary: args.summary }].sort(
            (a, b) => a.episodeId - b.episodeId
          ),
        },
      };
    });

    return {
      updated: true,
      episode_id: args.episodeId,
      episode_label: episode.title,
      field: "context.episodeSummaries",
      chars: args.summary.length,
      summary: args.summary,
    };
  },
  summarize: (output: any) => `已写入第 ${output?.episode_id ?? "?"} 集摘要（${output?.chars || 0} 字）`,
};
