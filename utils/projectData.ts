import { Episode, ProjectData, Shot } from "../types";
import { INITIAL_PROJECT_DATA } from "../constants";

const normalizeShot = (shot: any): Shot => {
  if (!shot || typeof shot !== "object") return shot as Shot;
  return {
    ...shot,
    soraPrompt: typeof shot.soraPrompt === "string" ? shot.soraPrompt : ""
  };
};

const normalizeEpisode = (episode: any): Episode => {
  if (!episode || typeof episode !== "object") return episode as Episode;
  const shots = Array.isArray(episode.shots) ? episode.shots.map(normalizeShot) : [];
  return { ...episode, shots };
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
  return base;
};
