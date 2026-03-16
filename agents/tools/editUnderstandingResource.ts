import type { Character, Episode, Location, Shot } from "../../types";
import { SHOT_TABLE_COLUMNS, sanitizeShotList } from "../../utils/shotSchema";
import { ensureStableId, ensureTypedStableId } from "../../utils/id";
import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";

const editUnderstandingResourceParameters = {
  type: "object",
  properties: {
    resource_type: {
      type: "string",
      enum: ["project_summary", "episode_summary", "character_profile", "scene_profile", "episode_storyboard"],
      description: "Project resource type to write.",
    },
    episode_id: {
      type: "integer",
      description: "Episode number, 1-based. Required for episode_summary.",
    },
    name: {
      type: "string",
      description: "Character or scene name. Required for character_profile and scene_profile.",
    },
    summary: {
      type: "string",
      description: "Summary text for project_summary or episode_summary.",
    },
    role: {
      type: "string",
      description: "Character role label.",
    },
    bio: {
      type: "string",
      description: "Character bio or analysis paragraph.",
    },
    is_main: {
      type: "boolean",
      description: "Whether the character is a main character.",
    },
    type: {
      type: "string",
      enum: ["core", "secondary"],
      description: "Scene profile type.",
    },
    description: {
      type: "string",
      description: "Scene description or analysis paragraph.",
    },
    visuals: {
      type: "string",
      description: "Scene visual notes.",
    },
    shots: {
      type: "array",
      description:
        "Complete shot rows for episode_storyboard. Use the canonical columns: id, duration, shotType, focalLength, movement, composition, blocking, dialogue, sound, lightingVfx, editingNotes, notes, soraPrompt, storyboardPrompt.",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          duration: { type: "string" },
          shotType: { type: "string" },
          focalLength: { type: "string" },
          movement: { type: "string" },
          composition: { type: "string" },
          blocking: { type: "string" },
          dialogue: { type: "string" },
          sound: { type: "string" },
          lightingVfx: { type: "string" },
          editingNotes: { type: "string" },
          notes: { type: "string" },
          soraPrompt: { type: "string" },
          storyboardPrompt: { type: "string" },
        },
        required: [
          "id",
          "duration",
          "shotType",
          "focalLength",
          "movement",
          "composition",
          "blocking",
          "dialogue",
          "sound",
          "lightingVfx",
          "editingNotes",
          "notes",
          "soraPrompt",
          "storyboardPrompt",
        ],
      },
    },
  },
  required: ["resource_type"],
} as const;

type ResourceType = "project_summary" | "episode_summary" | "character_profile" | "scene_profile" | "episode_storyboard";

type ParsedArgs =
  | { resourceType: "project_summary"; summary: string }
  | { resourceType: "episode_summary"; episodeId: number; summary: string }
  | { resourceType: "character_profile"; name: string; role?: string; bio?: string; isMain?: boolean }
  | { resourceType: "scene_profile"; name: string; sceneType?: "core" | "secondary"; description?: string; visuals?: string }
  | { resourceType: "episode_storyboard"; episodeId: number; shots: Shot[] };

const toPositiveInteger = (value: unknown) => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return undefined;
};

const toTrimmedString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const toOptionalString = (value: unknown) => {
  const trimmed = toTrimmedString(value);
  return trimmed || undefined;
};

const deriveEpisodeStatus = (shots: Shot[]): Episode["status"] => {
  if (!shots.length) return "pending";
  if (shots.every((shot) => shot.storyboardPrompt.trim().length > 0)) return "review_storyboard";
  if (shots.every((shot) => shot.soraPrompt.trim().length > 0)) return "review_sora";
  return "confirmed_shots";
};

const formatIssues = (issues: string[]) => issues.slice(0, 6).join("；");

const parseArgs = (input: unknown): ParsedArgs => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("edit_project_resource 需要对象参数。");
  }
  const raw = input as Record<string, unknown>;
  const resourceType = toTrimmedString(raw.resource_type ?? raw.resourceType) as ResourceType;
  if (!["project_summary", "episode_summary", "character_profile", "scene_profile", "episode_storyboard"].includes(resourceType)) {
    throw new Error("edit_project_resource 需要合法的 resource_type。");
  }

  if (resourceType === "project_summary") {
    const summary = toTrimmedString(raw.summary);
    if (!summary) throw new Error("project_summary 需要 summary。");
    return { resourceType, summary };
  }

  if (resourceType === "episode_summary") {
    const episodeId = toPositiveInteger(raw.episode_id ?? raw.episodeId);
    const summary = toTrimmedString(raw.summary);
    if (!episodeId) throw new Error("episode_summary 需要 episode_id。");
    if (!summary) throw new Error("episode_summary 需要 summary。");
    return { resourceType, episodeId, summary };
  }

  if (resourceType === "character_profile") {
    const name = toTrimmedString(raw.name);
    if (!name) throw new Error("character_profile 需要 name。");
    const role = toOptionalString(raw.role);
    const bio = toOptionalString(raw.bio);
    const isMain = typeof raw.is_main === "boolean" ? raw.is_main : typeof raw.isMain === "boolean" ? raw.isMain : undefined;
    if (!role && !bio && typeof isMain === "undefined") {
      throw new Error("character_profile 至少需要 role、bio、is_main 之一。");
    }
    return { resourceType, name, role, bio, isMain };
  }

  if (resourceType === "episode_storyboard") {
    const episodeId = toPositiveInteger(raw.episode_id ?? raw.episodeId);
    const shots = Array.isArray(raw.shots) ? raw.shots : [];
    if (!episodeId) throw new Error("episode_storyboard 需要 episode_id。");
    if (!shots.length) throw new Error("episode_storyboard 需要至少 1 条 shots。");
    return { resourceType, episodeId, shots: shots as Shot[] };
  }

  const name = toTrimmedString(raw.name);
  if (!name) throw new Error("scene_profile 需要 name。");
  const sceneType = raw.type === "core" || raw.type === "secondary" ? raw.type : undefined;
  const description = toOptionalString(raw.description);
  const visuals = toOptionalString(raw.visuals);
  if (!sceneType && !description && !visuals) {
    throw new Error("scene_profile 至少需要 type、description、visuals 之一。");
  }
  return { resourceType, name, sceneType, description, visuals };
};

const upsertCharacter = (characters: Character[], args: Extract<ParsedArgs, { resourceType: "character_profile" }>) => {
  const existingIndex = characters.findIndex((item) => item.name === args.name);
  const existing = existingIndex >= 0 ? characters[existingIndex] : undefined;
  const characterId = ensureTypedStableId(existing?.id, "char");
  const primaryAlias = {
    id: ensureStableId(existing?.aliases?.find((item) => item.kind === "primary")?.id, "alias"),
    value: args.name,
    kind: "primary" as const,
    normalized: args.name.trim().toLowerCase(),
  };
  const next: Character = {
    id: characterId,
    slug: existing?.slug,
    name: args.name,
    role: args.role ?? existing?.role ?? "",
    isMain: args.isMain ?? existing?.isMain ?? false,
    isCore: existing?.isCore,
    bio: args.bio ?? existing?.bio ?? "",
    forms: existing?.forms || [],
    aliases: [
      primaryAlias,
      ...((existing?.aliases || []).filter((item) => item.kind !== "primary" && item.value.trim().toLowerCase() !== primaryAlias.normalized)),
    ],
    status: existing?.status ?? "draft",
    binding: {
      canonicalMention: args.name,
      defaultFormId: existing?.binding?.defaultFormId || existing?.forms?.find((form) => form.isDefault)?.id || existing?.forms?.[0]?.id,
      defaultVoiceScope: existing?.binding?.defaultVoiceScope ?? "character",
      mentionPolicy: existing?.binding?.mentionPolicy ?? "character-first",
    },
    version: typeof existing?.version === "number" ? existing.version + 1 : 1,
    appearanceCount: existing?.appearanceCount,
    assetPriority: existing?.assetPriority,
    archetype: existing?.archetype,
    episodeUsage: existing?.episodeUsage,
    tags: existing?.tags,
    voiceId: existing?.voiceId,
    voicePrompt: existing?.voicePrompt,
    previewAudioUrl: existing?.previewAudioUrl,
  };
  const updated = [...characters];
  if (existingIndex >= 0) updated[existingIndex] = next;
  else updated.push(next);
  updated.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
  return {
    updated,
    created: existingIndex < 0,
    item: next,
  };
};

const upsertLocation = (locations: Location[], args: Extract<ParsedArgs, { resourceType: "scene_profile" }>) => {
  const existingIndex = locations.findIndex((item) => item.name === args.name);
  const existing = existingIndex >= 0 ? locations[existingIndex] : undefined;
  const next: Location = {
    id: ensureStableId(existing?.id, "loc"),
    name: args.name,
    type: args.sceneType ?? existing?.type ?? "secondary",
    description: args.description ?? existing?.description ?? "",
    visuals: args.visuals ?? existing?.visuals ?? "",
    appearanceCount: existing?.appearanceCount,
    assetPriority: existing?.assetPriority,
    episodeUsage: existing?.episodeUsage,
    zones: existing?.zones || [],
  };
  const updated = [...locations];
  if (existingIndex >= 0) updated[existingIndex] = next;
  else updated.push(next);
  updated.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
  return {
    updated,
    created: existingIndex < 0,
    item: next,
  };
};

export const editUnderstandingResourceToolDef = {
  name: "edit_project_resource",
  description:
    "Edit project resources in the knowledge base. Supports project_summary, episode_summary, character_profile, scene_profile, and episode_storyboard.",
  parameters: editUnderstandingResourceParameters,
  execute: (input: unknown, bridge: Script2VideoAgentBridge) => {
    const args = parseArgs(input);

    if (args.resourceType === "project_summary") {
      bridge.updateProjectData((prev) => ({
        ...prev,
        context: {
          ...prev.context,
          projectSummary: args.summary,
        },
      }));
      return {
        updated: true,
        resource_type: args.resourceType,
        field: "context.projectSummary",
        chars: args.summary.length,
        summary: args.summary,
      };
    }

    if (args.resourceType === "episode_summary") {
      const projectData = bridge.getProjectData();
      const episode = (projectData.episodes || []).find((item) => item.id === args.episodeId);
      if (!episode) {
        throw new Error(`edit_project_resource 未找到第 ${args.episodeId} 集。`);
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
        resource_type: args.resourceType,
        episode_id: args.episodeId,
        field: "context.episodeSummaries",
        chars: args.summary.length,
        summary: args.summary,
      };
    }

    if (args.resourceType === "character_profile") {
      const projectData = bridge.getProjectData();
      const result = upsertCharacter(projectData.context?.characters || [], args);
      bridge.updateProjectData((prev) => ({
        ...prev,
        context: {
          ...prev.context,
          characters: result.updated,
        },
      }));
      return {
        updated: true,
        resource_type: args.resourceType,
        field: "context.characters",
        created: result.created,
        item_id: result.item.id,
        name: result.item.name,
        role: result.item.role,
      };
    }

    if (args.resourceType === "episode_storyboard") {
      const projectData = bridge.getProjectData();
      const episode = (projectData.episodes || []).find((item) => item.id === args.episodeId);
      if (!episode) {
        throw new Error(`edit_project_resource 未找到第 ${args.episodeId} 集。`);
      }

      const { shots, issues } = sanitizeShotList(args.shots, {
        mode: "project",
        requireStructuredId: true,
        allowGeneratedIds: false,
      });

      const sceneIds = new Set((episode.scenes || []).map((scene) => scene.id));
      const bindingIssues = shots.flatMap((shot, index) => {
        const sceneId = shot.id.split("-").slice(0, -1).join("-");
        if (!sceneId || sceneIds.has(sceneId)) return [];
        return [`第 ${index + 1} 条镜号 ${shot.id} 没有匹配到本集 scene id`];
      });

      if (issues.length || bindingIssues.length) {
        const messages = [...issues.map((issue) => issue.message), ...bindingIssues];
        throw new Error(`edit_project_resource 校验失败：${formatIssues(messages)}`);
      }

      const nextStatus = deriveEpisodeStatus(shots);
      bridge.updateProjectData((prev) => ({
        ...prev,
        episodes: (prev.episodes || []).map((item) =>
          item.id === args.episodeId
            ? {
                ...item,
                shots,
                status: nextStatus,
                errorMsg: undefined,
              }
            : item
        ),
      }));

      return {
        updated: true,
        resource_type: args.resourceType,
        episode_id: episode.id,
        episode_label: episode.title || `第${episode.id}集`,
        field: "episodes[].shots",
        shot_count: shots.length,
        status: nextStatus,
        columns: SHOT_TABLE_COLUMNS.map((column) => ({ key: column.key, label: column.label })),
      };
    }

    const projectData = bridge.getProjectData();
    const result = upsertLocation(projectData.context?.locations || [], args);
    bridge.updateProjectData((prev) => ({
      ...prev,
      context: {
        ...prev.context,
        locations: result.updated,
      },
    }));
    return {
      updated: true,
      resource_type: args.resourceType,
      field: "context.locations",
      created: result.created,
      item_id: result.item.id,
      name: result.item.name,
      type: result.item.type,
    };
  },
  summarize: (output: any) => {
    switch (output?.resource_type) {
      case "project_summary":
        return `已写入项目摘要（${output?.chars || 0} 字）`;
      case "episode_summary":
        return `已写入第 ${output?.episode_id ?? "?"} 集摘要（${output?.chars || 0} 字）`;
      case "character_profile":
        return `${output?.created ? "已创建" : "已更新"}角色档案 ${output?.name || ""}`.trim();
      case "episode_storyboard":
        return `已写入 ${output?.episode_label || `第 ${output?.episode_id ?? "?"} 集`} 分镜表（${output?.shot_count ?? 0} 条）`;
      case "scene_profile":
        return `${output?.created ? "已创建" : "已更新"}场景档案 ${output?.name || ""}`.trim();
      default:
        return "已编辑项目资产";
    }
  },
};
