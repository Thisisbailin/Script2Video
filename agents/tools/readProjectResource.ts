import { getEpisodeScript } from "../../node-workspace/components/qalam/toolActions";
import { getSceneScript } from "../../node-workspace/components/qalam/toolActions";
import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";

const readProjectResourceParameters = {
  type: "object",
  properties: {
    resource_type: {
      type: "string",
      enum: [
        "episode_script",
        "scene_script",
        "project_summary",
        "episode_summary",
        "character_profile",
        "scene_profile",
        "guide_document",
      ],
      description: "Which project resource to read.",
    },
    episode_id: {
      type: "integer",
      description: "Episode number, 1-based. Required for episode_script and episode_summary.",
    },
    scene_id: {
      type: "string",
      description: "Scene id like 1-3. Optional for scene_script when episode_id + scene_index are provided.",
    },
    scene_index: {
      type: "integer",
      description: "Scene index within the episode, 1-based. Use together with episode_id for scene_script.",
    },
    item_id: {
      type: "string",
      description: "Understanding item id for character_profile or scene_profile.",
    },
    name: {
      type: "string",
      description: "Understanding item name for character_profile or scene_profile.",
    },
    max_chars: {
      type: "integer",
      description: "Optional maximum characters to return for textual content.",
    },
  },
  required: ["resource_type"],
} as const;

type ResourceType =
  | "episode_script"
  | "scene_script"
  | "project_summary"
  | "episode_summary"
  | "character_profile"
  | "scene_profile"
  | "guide_document";

const toPositiveInteger = (value: unknown) => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return undefined;
};

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const parseArgs = (input: unknown) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("read_project_resource 需要对象参数。");
  }
  const raw = input as Record<string, unknown>;
  const resourceType = normalizeString(raw.resource_type);
  const episodeId = toPositiveInteger(raw.episode_id ?? raw.episodeId);
  const sceneId = normalizeString(raw.scene_id ?? raw.sceneId);
  const sceneIndex = toPositiveInteger(raw.scene_index ?? raw.sceneIndex);
  const itemId = normalizeString(raw.item_id ?? raw.itemId);
  const name = normalizeString(raw.name);
  const maxChars = toPositiveInteger(raw.max_chars ?? raw.maxChars);

  if (!resourceType) {
    throw new Error("read_project_resource 需要 resource_type。");
  }

  if (
    ![
      "episode_script",
      "scene_script",
      "project_summary",
      "episode_summary",
      "character_profile",
      "scene_profile",
      "guide_document",
    ].includes(resourceType)
  ) {
    throw new Error(`read_project_resource 不支持 resource_type=${resourceType}`);
  }

  if ((resourceType === "episode_script" || resourceType === "episode_summary") && !episodeId) {
    throw new Error(`${resourceType} 需要 episode_id。`);
  }

  if (resourceType === "scene_script" && !sceneId && !(episodeId && sceneIndex)) {
    throw new Error("scene_script 需要 scene_id，或同时提供 episode_id 和 scene_index。");
  }

  if ((resourceType === "character_profile" || resourceType === "scene_profile" || resourceType === "guide_document") && !itemId && !name) {
    throw new Error(`${resourceType} 需要 item_id 或 name。`);
  }

  return {
    resourceType: resourceType as ResourceType,
    episodeId,
    sceneId,
    sceneIndex,
    itemId,
    name,
    maxChars,
  };
};

const clipText = (value: string, maxChars?: number) => {
  if (!maxChars || value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}...`;
};

export const readProjectResourceToolDef = {
  name: "read_project_resource",
  description:
    "Read a concrete script or understanding resource from the current project. Supports episode script, scene script, project summary, episode summary, character profile, and scene profile.",
  parameters: readProjectResourceParameters,
  execute: (input: unknown, bridge: Script2VideoAgentBridge) => {
    const args = parseArgs(input);
    const data = bridge.getProjectData();

    if (args.resourceType === "episode_script") {
      const result = getEpisodeScript(data, {
        episodeId: args.episodeId,
        maxChars: args.maxChars,
        includeSceneList: false,
        includeEpisodeSummary: false,
        includeCharacters: false,
      }).result;
      const episodeData = result?.data?.episode;
      return episodeData
        ? {
            resource_type: "episode_script",
            found: true,
            episode_id: episodeData.id,
            label: episodeData.title,
            content: episodeData.content || "",
          }
        : {
            resource_type: "episode_script",
            found: false,
            episode_id: args.episodeId,
            warnings: Array.isArray(result?.warnings) ? result.warnings : [],
          };
    }

    if (args.resourceType === "scene_script") {
      const result = getSceneScript(data, {
        sceneId: args.sceneId,
        episodeId: args.episodeId,
        sceneIndex: args.sceneIndex,
        maxChars: args.maxChars,
        includeEpisodeSummary: false,
        includeCharacters: false,
        includeSceneMetadata: false,
      }).result;
      const sceneData = result?.data?.scene;
      return sceneData
        ? {
            resource_type: "scene_script",
            found: true,
            episode_id: result?.data?.episode?.id ?? args.episodeId ?? null,
            scene_id: sceneData.id,
            scene_title: sceneData.title,
            content: sceneData.content || "",
          }
        : {
            resource_type: "scene_script",
            found: false,
            scene_id: args.sceneId || null,
            episode_id: args.episodeId || null,
            scene_index: args.sceneIndex || null,
            warnings: Array.isArray(result?.warnings) ? result.warnings : [],
          };
    }

    if (args.resourceType === "project_summary") {
      const summary = (data.context?.projectSummary || "").trim();
      return {
        resource_type: "project_summary",
        exists: Boolean(summary),
        summary: clipText(summary, args.maxChars),
      };
    }

    if (args.resourceType === "episode_summary") {
      const summary =
        (data.context?.episodeSummaries || []).find((entry) => entry.episodeId === args.episodeId)?.summary ||
        data.episodes.find((episode) => episode.id === args.episodeId)?.summary ||
        "";
      return {
        resource_type: "episode_summary",
        episode_id: args.episodeId,
        exists: Boolean(summary.trim()),
        summary: clipText(summary.trim(), args.maxChars),
      };
    }

    if (args.resourceType === "character_profile") {
      const item = (data.context?.characters || []).find(
        (character) => character.id === args.itemId || character.name === args.name
      );
      return item
        ? {
            resource_type: "character_profile",
            found: true,
            item_id: item.id,
            name: item.name,
            role: item.role || "",
            is_main: Boolean(item.isMain),
            bio: clipText(item.bio || "", args.maxChars),
            forms_count: Array.isArray(item.forms) ? item.forms.length : 0,
            tags: item.tags || [],
          }
        : {
            resource_type: "character_profile",
            found: false,
            item_id: args.itemId || null,
            name: args.name || null,
          };
    }

    if (args.resourceType === "guide_document") {
      const guides = [
        { item_id: "globalStyleGuide", title: "Style Guide", text: data.globalStyleGuide || "" },
        { item_id: "shotGuide", title: "Shot Guide", text: data.shotGuide || "" },
        { item_id: "soraGuide", title: "Sora Guide", text: data.soraGuide || "" },
        { item_id: "storyboardGuide", title: "Storyboard Guide", text: data.storyboardGuide || "" },
        { item_id: "dramaGuide", title: "Drama Guide", text: data.dramaGuide || "" },
      ];
      const item = guides.find((guide) => guide.item_id === args.itemId || guide.title === args.name);
      return item
        ? {
            resource_type: "guide_document",
            found: true,
            item_id: item.item_id,
            title: item.title,
            content: clipText(item.text.trim(), args.maxChars),
          }
        : {
            resource_type: "guide_document",
            found: false,
            item_id: args.itemId || null,
            name: args.name || null,
          };
    }

    const item = (data.context?.locations || []).find(
      (location) => location.id === args.itemId || location.name === args.name
    );
    return item
      ? {
          resource_type: "scene_profile",
          found: true,
          item_id: item.id,
          name: item.name,
          type: item.type,
          description: clipText(item.description || "", args.maxChars),
          visuals: clipText(item.visuals || "", args.maxChars),
          zones_count: Array.isArray(item.zones) ? item.zones.length : 0,
        }
      : {
          resource_type: "scene_profile",
          found: false,
          item_id: args.itemId || null,
          name: args.name || null,
        };
  },
  summarize: (output: any) => {
    switch (output?.resource_type) {
      case "episode_script":
        return output?.found ? `已读取 ${output?.label || `第 ${output?.episode_id} 集`} 正文` : `未找到第 ${output?.episode_id ?? "?"} 集`;
      case "scene_script":
        return output?.found ? `已读取场景 ${output?.scene_id}` : "未找到目标场景";
      case "project_summary":
        return output?.exists ? "已读取项目概述" : "项目概述尚未写入";
      case "episode_summary":
        return output?.exists ? `已读取第 ${output?.episode_id} 集概述` : `第 ${output?.episode_id ?? "?"} 集概述尚未写入`;
      case "character_profile":
        return output?.found ? `已读取角色档案 ${output?.name || ""}`.trim() : "未找到目标角色档案";
      case "scene_profile":
        return output?.found ? `已读取场景档案 ${output?.name || ""}`.trim() : "未找到目标场景档案";
      case "guide_document":
        return output?.found ? `已读取理解指南 ${output?.title || ""}`.trim() : "未找到目标理解指南";
      default:
        return "已读取项目资源";
    }
  },
};
