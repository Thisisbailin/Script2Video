import type { Shot } from "../types";

export const SHOT_FIELD_LABELS = {
  id: "镜号",
  duration: "时长",
  shotType: "景别",
  focalLength: "焦段建议",
  movement: "运镜",
  composition: "机位/构图",
  blocking: "演员调度/动作表演",
  dialogue: "台词/OS",
  sound: "声音",
  lightingVfx: "光色/VFX",
  editingNotes: "剪辑维度",
  notes: "备注（氛围/情绪）",
  difficulty: "难度",
  soraPrompt: "Sora Prompt",
  storyboardPrompt: "Storyboard Prompt",
} as const;

export const SHOT_CSV_COLUMNS = [
  { key: "episode", header: "Episode", aliases: ["Episode", "集数", "剧集"] },
  { key: "id", header: "Shot ID", aliases: ["Shot ID", "镜号"] },
  { key: "duration", header: "Duration", aliases: ["Duration", "时长"] },
  { key: "shotType", header: "Shot Size", aliases: ["Shot Size", "Type", "景别"] },
  { key: "focalLength", header: "Focal Length", aliases: ["Focal Length", "焦段建议", "焦段"] },
  { key: "movement", header: "Movement", aliases: ["Movement", "运镜"] },
  { key: "composition", header: "Composition", aliases: ["Composition", "机位/构图", "机位", "构图"] },
  { key: "blocking", header: "Blocking", aliases: ["Blocking", "演员调度/动作表演", "演员调度", "动作表演"] },
  { key: "dialogue", header: "Dialogue", aliases: ["Dialogue", "台词/OS", "台词"] },
  { key: "sound", header: "Sound", aliases: ["Sound", "声音"] },
  { key: "lightingVfx", header: "Lighting/VFX", aliases: ["Lighting/VFX", "光色/VFX", "光色", "VFX"] },
  { key: "editingNotes", header: "Editing Notes", aliases: ["Editing Notes", "剪辑维度", "剪辑"] },
  { key: "notes", header: "Notes", aliases: ["Notes", "备注", "备注（氛围/情绪）"] },
  { key: "difficulty", header: "Difficulty", aliases: ["Difficulty", "难度"] },
  { key: "soraPrompt", header: "Sora Prompt", aliases: ["Sora Prompt", "Sora提示词"] },
  { key: "storyboardPrompt", header: "Storyboard Prompt", aliases: ["Storyboard Prompt", "Storyboard提示词"] },
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

const toDifficulty = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  const num = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(num)) return undefined;
  return Math.min(10, Math.max(0, Math.round(num * 10) / 10));
};

export const buildShotDescription = (shot: Partial<Shot>) =>
  [shot.composition, shot.blocking, shot.lightingVfx, shot.sound, shot.notes]
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
    description: toText(shot.description),
    dialogue: toText(shot.dialogue),
    sound: toText(shot.sound),
    lightingVfx: toText(shot.lightingVfx),
    editingNotes: toText(shot.editingNotes),
    notes: toText(shot.notes),
    soraPrompt: toText(shot.soraPrompt),
    storyboardPrompt: toText(shot.storyboardPrompt),
    difficulty: toDifficulty(shot.difficulty),
    videoStatus: toOptionalText(shot.videoStatus) as Shot["videoStatus"],
    videoUrl: toOptionalText(shot.videoUrl),
    videoId: toOptionalText(shot.videoId),
    videoStartTime: typeof shot.videoStartTime === "number" && Number.isFinite(shot.videoStartTime) ? shot.videoStartTime : undefined,
    videoErrorMsg: toOptionalText(shot.videoErrorMsg),
    finalVideoPrompt: toOptionalText(shot.finalVideoPrompt),
    videoParams: typeof shot.videoParams === "object" && shot.videoParams !== null ? (shot.videoParams as Shot["videoParams"]) : undefined,
    isApproved: typeof shot.isApproved === "boolean" ? shot.isApproved : undefined,
  };

  if (!normalized.description) {
    normalized.description = buildShotDescription(normalized);
  }

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
