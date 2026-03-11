import type { Shot } from "../types";

export const SHOT_FIELD_LABELS = {
  id: "镜号",
  duration: "时长",
  shotType: "景别",
  focalLength: "焦段",
  movement: "运镜",
  composition: "机位/构图",
  blocking: "调度/表演",
  dialogue: "台词/OS",
  sound: "声音",
  lightingVfx: "光色/VFX",
  editingNotes: "剪辑",
  notes: "备注（氛围/情绪）",
  soraPrompt: "Sora Prompt",
  storyboardPrompt: "Storyboard Prompt",
} as const;

export const SHOT_TABLE_COLUMNS = [
  { key: "id", label: "镜号" },
  { key: "duration", label: "时长" },
  { key: "shotType", label: "景别" },
  { key: "focalLength", label: "焦段" },
  { key: "movement", label: "运镜" },
  { key: "composition", label: "机位/构图" },
  { key: "blocking", label: "调度/表演" },
  { key: "dialogue", label: "台词/OS" },
  { key: "sound", label: "声音" },
  { key: "lightingVfx", label: "光色/VFX" },
  { key: "editingNotes", label: "剪辑" },
  { key: "notes", label: "备注（氛围/情绪）" },
  { key: "soraPrompt", label: "Sora Prompt" },
  { key: "storyboardPrompt", label: "Storyboard Prompt" },
] as const satisfies readonly { key: keyof Shot; label: string }[];

export const SHOT_CSV_COLUMNS = [
  { key: "episode", header: "剧集", aliases: ["剧集"] },
  { key: "id", header: "镜号", aliases: ["镜号"] },
  { key: "duration", header: "时长", aliases: ["时长"] },
  { key: "shotType", header: "景别", aliases: ["景别"] },
  { key: "focalLength", header: "焦段", aliases: ["焦段"] },
  { key: "movement", header: "运镜", aliases: ["运镜"] },
  { key: "composition", header: "机位/构图", aliases: ["机位/构图"] },
  { key: "blocking", header: "调度/表演", aliases: ["调度/表演"] },
  { key: "dialogue", header: "台词/OS", aliases: ["台词/OS"] },
  { key: "sound", header: "声音", aliases: ["声音"] },
  { key: "lightingVfx", header: "光色/VFX", aliases: ["光色/VFX"] },
  { key: "editingNotes", header: "剪辑", aliases: ["剪辑"] },
  { key: "notes", header: "备注（氛围/情绪）", aliases: ["备注（氛围/情绪）"] },
  { key: "soraPrompt", header: "Sora Prompt", aliases: ["Sora Prompt"] },
  { key: "storyboardPrompt", header: "Storyboard Prompt", aliases: ["Storyboard Prompt"] },
] as const;

export const SHOT_REQUIRED_STRING_KEYS = [
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
] as const satisfies readonly (keyof Shot)[];

export const SHOT_LLM_REQUIRED_NON_EMPTY_KEYS = [
  "id",
  "duration",
  "shotType",
  "focalLength",
  "movement",
  "composition",
  "blocking",
  "lightingVfx",
  "editingNotes",
  "notes",
] as const satisfies readonly (keyof Shot)[];

export const STRUCTURED_SHOT_ID_PATTERN = /^\d+-\d+-\d{2,}$/;
const GENERATED_SHOT_ID_PATTERN = /^gen-[\w-]+$/i;
const DURATION_PATTERN = /^(\d+(?:\.\d+)?)\s*(s|秒)(\s*[–—-]\s*(\d+(?:\.\d+)?)\s*(s|秒))?$/i;

export type ShotSchemaIssue = {
  field: keyof typeof SHOT_FIELD_LABELS | "count" | "duplicate";
  message: string;
  shotId?: string;
  index?: number;
};

type SanitizeMode = "llm" | "csv" | "project";

type SanitizeOptions = {
  mode: SanitizeMode;
  requireStructuredId?: boolean;
  allowGeneratedIds?: boolean;
};

const toText = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const toOptionalText = (value: unknown) => {
  const text = toText(value);
  return text || undefined;
};

export const buildShotOverview = (shot: Partial<Shot>) =>
  [shot.composition, shot.blocking, shot.dialogue, shot.sound, shot.lightingVfx, shot.editingNotes, shot.notes]
    .map((item) => toText(item))
    .filter(Boolean)
    .join("；");

export const getShotMinimumCountFromGuide = (guide?: string) => {
  if (!guide) return undefined;
  const match = guide.match(/(?:禁止低于|不得低于|不少于)\s*(\d+)\s*个/);
  if (!match) return undefined;
  const count = Number(match[1]);
  return Number.isFinite(count) && count > 0 ? count : undefined;
};

const isAcceptedShotId = (id: string, options: SanitizeOptions) => {
  if (!id) return false;
  if (options.allowGeneratedIds && GENERATED_SHOT_ID_PATTERN.test(id)) return true;
  if (!options.requireStructuredId) return true;
  return STRUCTURED_SHOT_ID_PATTERN.test(id);
};

export const sanitizeShot = (input: unknown, options: SanitizeOptions) => {
  const shot = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const normalized: Shot = {
    id: toText(shot.id),
    duration: toText(shot.duration),
    shotType: toText(shot.shotType),
    focalLength: toText(shot.focalLength),
    movement: toText(shot.movement),
    composition: toText(shot.composition),
    blocking: toText(shot.blocking),
    dialogue: toText(shot.dialogue),
    sound: toText(shot.sound),
    lightingVfx: toText(shot.lightingVfx),
    editingNotes: toText(shot.editingNotes),
    notes: toText(shot.notes),
    soraPrompt: toText(shot.soraPrompt),
    storyboardPrompt: toText(shot.storyboardPrompt),
    videoStatus: toOptionalText(shot.videoStatus) as Shot["videoStatus"],
    videoUrl: toOptionalText(shot.videoUrl),
    videoId: toOptionalText(shot.videoId),
    videoStartTime: typeof shot.videoStartTime === "number" && Number.isFinite(shot.videoStartTime) ? shot.videoStartTime : undefined,
    videoErrorMsg: toOptionalText(shot.videoErrorMsg),
    finalVideoPrompt: toOptionalText(shot.finalVideoPrompt),
    videoParams: typeof shot.videoParams === "object" && shot.videoParams !== null ? (shot.videoParams as Shot["videoParams"]) : undefined,
    isApproved: typeof shot.isApproved === "boolean" ? shot.isApproved : undefined,
  };

  const issues: ShotSchemaIssue[] = [];

  if (!isAcceptedShotId(normalized.id, options)) {
    issues.push({
      field: "id",
      message: options.requireStructuredId
        ? `镜号格式不合法，应为“场次-镜号”格式，例如 12-2-01，收到：${normalized.id || "空值"}`
        : "镜号为空",
    });
  }

  if (normalized.duration && !DURATION_PATTERN.test(normalized.duration)) {
    issues.push({
      field: "duration",
      message: `时长格式不合法，应为 3s / 2.5s / 2-3s，收到：${normalized.duration}`,
    });
  }

  if (options.mode === "llm") {
    SHOT_LLM_REQUIRED_NON_EMPTY_KEYS.forEach((key) => {
      if (!normalized[key]) {
        issues.push({
          field: key,
          message: `${SHOT_FIELD_LABELS[key]}为空`,
        });
      }
    });
  }

  return { shot: normalized, issues };
};

export const sanitizeShotList = (
  input: unknown[],
  options: SanitizeOptions & { minCount?: number }
) => {
  const shots: Shot[] = [];
  const issues: ShotSchemaIssue[] = [];
  const seenIds = new Set<string>();

  input.forEach((item, index) => {
    const { shot, issues: rowIssues } = sanitizeShot(item, options);
    rowIssues.forEach((issue) => issues.push({ ...issue, index, shotId: shot.id || issue.shotId }));

    if (shot.id) {
      if (seenIds.has(shot.id)) {
        issues.push({
          field: "duplicate",
          message: `镜号重复：${shot.id}`,
          shotId: shot.id,
          index,
        });
      }
      seenIds.add(shot.id);
    }

    shots.push(shot);
  });

  if (options.minCount !== undefined && shots.length < options.minCount) {
    issues.push({
      field: "count",
      message: `分镜数量不足，至少需要 ${options.minCount} 条，当前只有 ${shots.length} 条`,
    });
  }

  return { shots, issues };
};
