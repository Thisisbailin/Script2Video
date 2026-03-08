import { getSceneScript } from "../../node-workspace/components/qalam/toolActions";
import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";
import { getSceneScriptParameters, getSceneScriptSchema } from "./schemas";

export const getSceneScriptToolDef = {
  name: "get_scene_script",
  description: "Read a specific scene from the parsed script. Supports scene id like 3-2 or scene index within an episode.",
  parameters: getSceneScriptParameters,
  execute: (input: unknown, bridge: Script2VideoAgentBridge) => {
    const args = getSceneScriptSchema.parse(input);
    const hasSelector = !!args.sceneId?.trim() || args.sceneIndex !== undefined;
    if (!hasSelector) {
      throw new Error("get_scene_script 需要 sceneId 或 sceneIndex。");
    }
    if (args.sceneIndex !== undefined && !args.sceneId?.trim() && args.episodeId === undefined && !args.episodeTitle?.trim()) {
      throw new Error("get_scene_script 使用 sceneIndex 时需要同时提供 episodeId 或 episodeTitle。");
    }
    return getSceneScript(bridge.getProjectData(), args).result;
  },
  summarize: (output: any) => {
    const scene = output?.resolved?.scene;
    const episode = output?.resolved?.episode;
    if (!scene) return "未找到目标场景";
    return episode ? `已读取 ${episode.title} 的 ${scene.id}` : `已读取场景 ${scene.id}`;
  },
};
