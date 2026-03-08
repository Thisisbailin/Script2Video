import { upsertLocation } from "../../node-workspace/components/qalam/toolActions";
import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";
import { upsertLocationParameters, upsertLocationSchema } from "./schemas";

export const upsertLocationToolDef = {
  name: "upsert_location",
  description: "Create or update location understanding records and zones.",
  parameters: upsertLocationParameters,
  execute: (input: unknown, bridge: Script2VideoAgentBridge) => {
    const args = upsertLocationSchema.parse(input);
    let result: any = null;
    bridge.updateProjectData((prev) => {
      const next = upsertLocation(prev, args);
      result = next.result;
      return next.next;
    });
    return result;
  },
  summarize: (output: any) =>
    `已${output?.action === "created" ? "创建" : "更新"}场景 ${output?.name || ""}`.trim(),
};
