import type { DeyunAITool } from "../../../services/deyunaiService";

export const TOOL_DEFS: DeyunAITool[] = [
  {
    type: "function",
    name: "upsert_character",
    description: "Create or update a character (with forms). Supports partial updates.",
    parameters: {
      type: "object",
      properties: {
        character: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            role: { type: "string" },
            isMain: { type: "boolean" },
            bio: { type: "string" },
            assetPriority: { type: "string", enum: ["high", "medium", "low"] },
            episodeUsage: { type: "string" },
            archetype: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            forms: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  formName: { type: "string" },
                  episodeRange: { type: "string" },
                  description: { type: "string" },
                  visualTags: { type: "string" },
                  identityOrState: { type: "string" },
                },
                required: ["formName", "episodeRange"],
              },
            },
          },
          required: ["name"],
        },
        mergeStrategy: { type: "string", enum: ["patch", "replace"] },
        formsMode: { type: "string", enum: ["merge", "replace"] },
        formsToDelete: { type: "array", items: { type: "string" } },
        evidence: { type: "array", items: { type: "string" } },
      },
      required: ["character"],
    },
  },
  {
    type: "function",
    name: "upsert_location",
    description: "Create or update a location (with zones). Supports partial updates.",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            type: { type: "string", enum: ["core", "secondary"] },
            description: { type: "string" },
            visuals: { type: "string" },
            assetPriority: { type: "string", enum: ["high", "medium", "low"] },
            episodeUsage: { type: "string" },
            zones: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  kind: { type: "string", enum: ["interior", "exterior", "transition", "unspecified"] },
                  episodeRange: { type: "string" },
                  layoutNotes: { type: "string" },
                  keyProps: { type: "string" },
                  lightingWeather: { type: "string" },
                  materialPalette: { type: "string" },
                },
                required: ["name", "episodeRange"],
              },
            },
          },
          required: ["name"],
        },
        mergeStrategy: { type: "string", enum: ["patch", "replace"] },
        zonesMode: { type: "string", enum: ["merge", "replace"] },
        zonesToDelete: { type: "array", items: { type: "string" } },
        evidence: { type: "array", items: { type: "string" } },
      },
      required: ["location"],
    },
  },
];

export const parseToolArguments = (value: string) => {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

export const buildToolSummary = (name: string, args: any) => {
  if (name === "upsert_character") {
    const target = args?.character?.name || args?.character?.id || "未命名角色";
    const formsCount = Array.isArray(args?.character?.forms) ? args.character.forms.length : 0;
    return `角色：${target} · 形态 ${formsCount} 个`;
  }
  if (name === "upsert_location") {
    const target = args?.location?.name || args?.location?.id || "未命名场景";
    const zonesCount = Array.isArray(args?.location?.zones) ? args.location.zones.length : 0;
    return `场景：${target} · 分区 ${zonesCount} 个`;
  }
  return "工具调用";
};
