import type { DeyunAITool, DeyunAIToolCall } from "../../../services/deyunaiService";
import type { ToolMessage } from "./types";
import type { QalamToolSettings } from "../../../types";

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

export const normalizeQalamToolSettings = (value: QalamToolSettings | undefined) => {
  const characterLocation = value?.characterLocation || {};
  return {
    characterLocation: {
      enabled: characterLocation.enabled ?? true,
      mergeStrategy: characterLocation.mergeStrategy === "replace" ? "replace" : "patch",
      formsMode: characterLocation.formsMode === "replace" ? "replace" : "merge",
      zonesMode: characterLocation.zonesMode === "replace" ? "replace" : "merge",
    },
  };
};

export const getQalamToolDefs = (settings: ReturnType<typeof normalizeQalamToolSettings>) => {
  if (!settings.characterLocation.enabled) return [];
  return TOOL_DEFS;
};

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

export const applyToolDefaults = (
  name: string | undefined,
  args: any,
  settings: ReturnType<typeof normalizeQalamToolSettings>
) => {
  if (!args || typeof args !== "object") return args;
  if (name === "upsert_character") {
    const next = { ...args };
    if (!next.mergeStrategy) next.mergeStrategy = settings.characterLocation.mergeStrategy;
    if (!next.formsMode) next.formsMode = settings.characterLocation.formsMode;
    return next;
  }
  if (name === "upsert_location") {
    const next = { ...args };
    if (!next.mergeStrategy) next.mergeStrategy = settings.characterLocation.mergeStrategy;
    if (!next.zonesMode) next.zonesMode = settings.characterLocation.zonesMode;
    return next;
  }
  return args;
};

export type ToolCallMeta = {
  tc: DeyunAIToolCall;
  args: any;
  callId: string;
};

export const buildToolCallMeta = (
  toolCalls: DeyunAIToolCall[],
  settings: ReturnType<typeof normalizeQalamToolSettings>
): ToolCallMeta[] => {
  const baseTs = Date.now();
  return toolCalls.map((tc, idx) => {
    const parsed = parseToolArguments(tc.arguments);
    const args = applyToolDefaults(tc.name, parsed, settings);
    const callId = tc.callId || `${tc.name || "tool"}-${baseTs}-${idx}`;
    return { tc, args, callId };
  });
};

export const buildToolMessages = (toolMeta: ToolCallMeta[]): ToolMessage[] =>
  toolMeta.map(({ tc, args, callId }) => ({
    role: "assistant",
    kind: "tool",
    tool: {
      name: tc.name || "tool",
      status: "queued",
      summary: buildToolSummary(tc.name, args),
      evidence: Array.isArray(args?.evidence) ? args.evidence : undefined,
      callId,
    },
  }));
