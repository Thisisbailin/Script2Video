import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";

const listProjectResourcesParameters = {
  type: "object",
  properties: {
    resource_type: {
      type: "string",
      enum: ["episodes", "understanding_project", "understanding_episodes"],
      description: "Which resource directory to inspect.",
    },
    max_items: {
      type: "integer",
      description: "Optional maximum number of items to return for list results.",
    },
  },
  required: ["resource_type"],
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
    throw new Error("list_project_resources 需要对象参数。");
  }
  const raw = input as Record<string, unknown>;
  const resourceType = typeof raw.resource_type === "string" ? raw.resource_type.trim() : "";
  const maxItems = toPositiveInteger(raw.max_items ?? raw.maxItems);
  if (!resourceType) {
    throw new Error("list_project_resources 需要 resource_type。");
  }
  if (!["episodes", "understanding_project", "understanding_episodes"].includes(resourceType)) {
    throw new Error(`list_project_resources 不支持 resource_type=${resourceType}`);
  }
  return {
    resourceType: resourceType as "episodes" | "understanding_project" | "understanding_episodes",
    maxItems: Math.max(1, Math.min(200, maxItems || 50)),
  };
};

export const listProjectResourcesToolDef = {
  name: "list_project_resources",
  description:
    "List available script and understanding resources before reading them. Use this to inspect episode directories or understanding coverage.",
  parameters: listProjectResourcesParameters,
  execute: (input: unknown, bridge: Script2VideoAgentBridge) => {
    const args = parseArgs(input);
    const data = bridge.getProjectData();

    if (args.resourceType === "episodes") {
      const items = (data.episodes || []).slice(0, args.maxItems).map((episode) => ({
        episode_id: episode.id,
        label: episode.title || `第${episode.id}集`,
        scene_count: (episode.scenes || []).length,
        has_summary: Boolean((episode.summary || "").trim() || data.context?.episodeSummaries?.some((entry) => entry.episodeId === episode.id && entry.summary?.trim())),
      }));
      return {
        resource_type: "episodes",
        total: (data.episodes || []).length,
        items,
      };
    }

    if (args.resourceType === "understanding_project") {
      const summary = (data.context?.projectSummary || "").trim();
      return {
        resource_type: "understanding_project",
        exists: Boolean(summary),
        chars: summary.length,
      };
    }

    const items = (data.episodes || []).slice(0, args.maxItems).map((episode) => {
      const summary =
        (data.context?.episodeSummaries || []).find((entry) => entry.episodeId === episode.id)?.summary ||
        episode.summary ||
        "";
      return {
        episode_id: episode.id,
        label: episode.title || `第${episode.id}集`,
        has_summary: Boolean(summary.trim()),
        chars: summary.trim().length,
      };
    });
    return {
      resource_type: "understanding_episodes",
      total: items.length,
      items,
    };
  },
  summarize: (output: any) => {
    if (output?.resource_type === "episodes") {
      return `已列出剧本目录，共 ${output?.total ?? 0} 集`;
    }
    if (output?.resource_type === "understanding_project") {
      return output?.exists ? "已检查项目概述：已存在" : "已检查项目概述：尚未写入";
    }
    return `已列出分集理解目录，共 ${output?.items?.length ?? 0} 项`;
  },
};
