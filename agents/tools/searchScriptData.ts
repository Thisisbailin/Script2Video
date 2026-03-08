import { searchScriptData } from "../../node-workspace/components/qalam/toolActions";
import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";
import { searchScriptDataSchema } from "./schemas";

export const searchScriptDataToolDef = {
  name: "search_script_data",
  description: "Search parsed script content to locate relevant episodes or scenes.",
  parameters: searchScriptDataSchema,
  execute: (input: unknown, bridge: Script2VideoAgentBridge) => {
    const args = searchScriptDataSchema.parse(input);
    return searchScriptData(bridge.getProjectData(), args).result;
  },
  summarize: (output: any) => {
    const count = Array.isArray(output?.data?.matches) ? output.data.matches.length : 0;
    return `剧本搜索完成，命中 ${count} 条`;
  },
};
