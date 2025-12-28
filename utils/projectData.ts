import { Episode, ProjectData, Shot } from "../types";
import { INITIAL_PROJECT_DATA } from "../constants";

const stripConflictMarkers = (value: string) => {
  const cleaned = value
    .replace(/^[ \t]*<<<REMOTE VERSION>>>[ \t]*\n?/gm, "")
    .replace(/^[ \t]*<<<LOCAL VERSION>>>[ \t]*\n?/gm, "");
  return cleaned.replace(/\n{3,}/g, "\n\n");
};

const sanitizeValue = (value: unknown): unknown => {
  if (typeof value === "string") return stripConflictMarkers(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeValue(entry)])
    );
  }
  return value;
};

const toSafeString = (value: unknown, fallback = "") => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const toOptionalString = (value: unknown) => (typeof value === "string" ? value : undefined);

const toOptionalNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const num = Number(trimmed);
    if (Number.isFinite(num)) return num;
  }
  return undefined;
};

const normalizeShot = (shot: any): Shot => {
  if (!shot || typeof shot !== "object") return shot as Shot;
  return {
    ...shot,
    id: toSafeString(shot.id),
    duration: toSafeString(shot.duration),
    shotType: toSafeString(shot.shotType),
    movement: toSafeString(shot.movement),
    description: toSafeString(shot.description),
    dialogue: toSafeString(shot.dialogue),
    soraPrompt: toSafeString(shot.soraPrompt),
    difficulty: toOptionalNumber(shot.difficulty),
    finalVideoPrompt: toOptionalString(shot.finalVideoPrompt),
    videoUrl: toOptionalString(shot.videoUrl),
    videoId: toOptionalString(shot.videoId),
    videoErrorMsg: toOptionalString(shot.videoErrorMsg)
  };
};

const normalizeEpisode = (episode: any): Episode => {
  if (!episode || typeof episode !== "object") return episode as Episode;
  const shots = Array.isArray(episode.shots) ? episode.shots.map(normalizeShot) : [];
  return {
    ...episode,
    title: toSafeString(episode.title),
    content: toSafeString(episode.content),
    summary: toOptionalString(episode.summary),
    shots
  };
};

export const normalizeProjectData = (data: any): ProjectData => {
  const base: ProjectData = {
    ...INITIAL_PROJECT_DATA,
    ...data,
    context: { ...INITIAL_PROJECT_DATA.context, ...(data?.context || {}) },
    phase1Usage: { ...INITIAL_PROJECT_DATA.phase1Usage, ...(data?.phase1Usage || {}) },
    phase4Usage: data?.phase4Usage || INITIAL_PROJECT_DATA.phase4Usage,
    phase5Usage: data?.phase5Usage || INITIAL_PROJECT_DATA.phase5Usage,
    stats: { ...INITIAL_PROJECT_DATA.stats, ...(data?.stats || {}) }
  };
  base.episodes = Array.isArray(data?.episodes) ? data.episodes.map(normalizeEpisode) : [];
  base.shotGuide = data?.shotGuide || INITIAL_PROJECT_DATA.shotGuide;
  base.soraGuide = data?.soraGuide || INITIAL_PROJECT_DATA.soraGuide;
  base.globalStyleGuide = data?.globalStyleGuide || INITIAL_PROJECT_DATA.globalStyleGuide;
  base.rawScript = typeof data?.rawScript === "string" ? data.rawScript : "";
  base.fileName = typeof data?.fileName === "string" ? data.fileName : "";
  return sanitizeValue(base) as ProjectData;
};
