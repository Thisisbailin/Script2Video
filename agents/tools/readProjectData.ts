import { readProjectData } from "../../node-workspace/components/qalam/toolActions";
import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";
import { readProjectDataParameters, readProjectDataSchema } from "./schemas";

export const readProjectDataToolDef = {
  name: "read_project_data",
  description: "Read project data such as script, summaries, characters, locations, and scene content.",
  parameters: readProjectDataParameters,
  execute: (input: unknown, bridge: Script2VideoAgentBridge) => {
    const args = readProjectDataSchema.parse(input);
    return readProjectData(bridge.getProjectData(), args).result;
  },
  summarize: (output: any) => {
    const warnings = Array.isArray(output?.warnings) && output.warnings.length ? `，警告 ${output.warnings.length} 条` : "";
    return `已读取项目数据${warnings}`;
  },
};
