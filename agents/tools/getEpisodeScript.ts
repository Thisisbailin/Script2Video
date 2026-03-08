import { getEpisodeScript } from "../../node-workspace/components/qalam/toolActions";
import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";
import { getEpisodeScriptParameters, getEpisodeScriptSchema } from "./schemas";

export const getEpisodeScriptToolDef = {
  name: "get_episode_script",
  description: "Read a specific episode from the parsed script. Returns episode content, scene list, and optional episode summary.",
  parameters: getEpisodeScriptParameters,
  execute: (input: unknown, bridge: Script2VideoAgentBridge) => {
    const args = getEpisodeScriptSchema.parse(input);
    const hasSelector = args.episodeId !== undefined || !!args.episodeTitle?.trim();
    if (!hasSelector) {
      throw new Error("get_episode_script 需要 episodeId 或 episodeTitle。");
    }
    return getEpisodeScript(bridge.getProjectData(), args).result;
  },
  summarize: (output: any) => {
    const episode = output?.resolved?.episode;
    const count = Array.isArray(output?.data?.sceneList) ? output.data.sceneList.length : 0;
    return episode ? `已读取 ${episode.title}，返回 ${count} 个场景` : "未找到目标剧集";
  },
};
