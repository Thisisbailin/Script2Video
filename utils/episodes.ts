import { Episode } from "../types";

export const isEpisodeSoraComplete = (ep?: Episode) => {
  if (!ep || ep.shots.length === 0) return false;
  return ep.status === "review_sora" || ep.shots.every((s) => s.soraPrompt && s.soraPrompt.trim().length > 0);
};

export const findNextSoraIndex = (episodes: Episode[], startIndex = 0) => {
  for (let i = startIndex; i < episodes.length; i++) {
    const ep = episodes[i];
    if (!ep || ep.shots.length === 0) continue;
    if (!isEpisodeSoraComplete(ep)) return i;
  }
  return -1;
};
