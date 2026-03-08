import { upsertCharacter } from "../../node-workspace/components/qalam/toolActions";
import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";
import { upsertCharacterSchema } from "./schemas";

export const upsertCharacterToolDef = {
  name: "upsert_character",
  description: "Create or update character understanding records and forms.",
  parameters: upsertCharacterSchema,
  execute: (input: unknown, bridge: Script2VideoAgentBridge) => {
    const args = upsertCharacterSchema.parse(input);
    let result: any = null;
    bridge.updateProjectData((prev) => {
      const next = upsertCharacter(prev, args);
      result = next.result;
      return next.next;
    });
    return result;
  },
  summarize: (output: any) =>
    `已${output?.action === "created" ? "创建" : "更新"}角色 ${output?.name || ""}`.trim(),
};
