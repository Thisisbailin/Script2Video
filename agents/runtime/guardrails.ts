import {
  ToolGuardrailFunctionOutputFactory,
  defineOutputGuardrail,
  defineToolInputGuardrail,
  type InputGuardrailDefinition,
  type InputGuardrailFunction,
  type InputGuardrailFunctionArgs,
  type OutputGuardrailDefinition,
  type ToolInputGuardrailDefinition,
} from "@openai/agents";
import type { ProjectData } from "../../types";
import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";

export type Script2VideoGuardrailContext = {
  runtimeMode: "browser" | "edge_read_only" | "edge_full";
  requestedOutcome?: "answer" | "understanding_document" | "node_workflow" | "auto";
};

const extractInputText = (input: string | any[]) => {
  if (typeof input === "string") return input.trim();
  if (!Array.isArray(input)) return "";
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      if (typeof (item as any).content === "string") return (item as any).content;
      if (!Array.isArray((item as any).content)) return "";
      return (item as any).content
        .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
        .filter(Boolean)
        .join("\n");
    })
    .filter(Boolean)
    .join("\n")
    .trim();
};

const parseToolArguments = (value: unknown) => {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const findGuide = (projectData: ProjectData, itemId?: string, name?: string) =>
  [
    { item_id: "globalStyleGuide", title: "Style Guide", text: projectData.globalStyleGuide || "" },
    { item_id: "shotGuide", title: "Shot Guide", text: projectData.shotGuide || "" },
    { item_id: "soraGuide", title: "Sora Guide", text: projectData.soraGuide || "" },
    { item_id: "storyboardGuide", title: "Storyboard Guide", text: projectData.storyboardGuide || "" },
    { item_id: "dramaGuide", title: "Drama Guide", text: projectData.dramaGuide || "" },
  ].find((guide) => guide.item_id === itemId || guide.title === name);

const defineInputGuardrailCompat = ({
  name,
  execute,
  runInParallel = true,
}: {
  name: string;
  execute: InputGuardrailFunction;
  runInParallel?: boolean;
}): InputGuardrailDefinition => ({
  type: "input",
  name,
  guardrailFunction: execute,
  runInParallel,
  async run(args: InputGuardrailFunctionArgs) {
    return {
      guardrail: { type: "input", name },
      output: await execute(args),
    };
  },
});

export const createScript2VideoInputGuardrails = (): InputGuardrailDefinition[] => [
  defineInputGuardrailCompat({
    name: "input_size_guardrail",
    runInParallel: false,
    execute: async ({ input }) => {
      const text = extractInputText(input);
      if (!text) {
        return {
          tripwireTriggered: true,
          outputInfo: { message: "输入为空，Agent 不应启动空回合。" },
        };
      }
      if (text.length > 12000) {
        return {
          tripwireTriggered: true,
          outputInfo: { message: "输入过长，请先缩小任务范围或分步执行。" },
        };
      }
      return {
        tripwireTriggered: false,
        outputInfo: { chars: text.length },
      };
    },
  }),
  defineInputGuardrailCompat({
    name: "edge_read_only_mode_guardrail",
    runInParallel: false,
    execute: async ({ context }) => {
      const guardrailContext = (context?.context as Script2VideoGuardrailContext | undefined) || undefined;
      if (
        guardrailContext?.runtimeMode === "edge_read_only" &&
        (guardrailContext.requestedOutcome === "understanding_document" ||
          guardrailContext.requestedOutcome === "node_workflow")
      ) {
        return {
          tripwireTriggered: true,
          outputInfo: { message: "当前 Edge runtime 仅支持查阅能力，请先切回 browser runtime 再执行编辑或操作。" },
        };
      }
      return {
        tripwireTriggered: false,
        outputInfo: { mode: guardrailContext?.runtimeMode || "browser" },
      };
    },
  }),
];

export const createScript2VideoOutputGuardrails = (): OutputGuardrailDefinition[] => [
  defineOutputGuardrail({
    name: "non_empty_output_guardrail",
    execute: async ({ agentOutput }) => {
      const text =
        typeof (agentOutput as any)?.text === "string"
          ? (agentOutput as any).text.trim()
          : typeof agentOutput === "string"
            ? agentOutput.trim()
            : "";
      return {
        tripwireTriggered: !text,
        outputInfo: {
          message: text ? "ok" : "模型未产出可见回复文本。",
        },
      };
    },
  }),
];

export const createScript2VideoToolInputGuardrails = (
  toolName: string,
  bridge: Script2VideoAgentBridge
): ToolInputGuardrailDefinition[] => {
  if (toolName === "search_project_resource") {
    return [
      defineToolInputGuardrail({
        name: "search_query_guardrail",
        run: async ({ toolCall }) => {
          const args = parseToolArguments((toolCall as any).arguments);
          const query = typeof args.query === "string" ? args.query.trim() : "";
          if (query.length < 2) {
            return ToolGuardrailFunctionOutputFactory.rejectContent(
              "search_project_resource 的 query 至少需要 2 个字符，请提供更明确的检索词。",
              { queryLength: query.length }
            );
          }
          return ToolGuardrailFunctionOutputFactory.allow({ queryLength: query.length });
        },
      }),
    ];
  }

  if (toolName === "read_project_resource") {
    return [
      defineToolInputGuardrail({
        name: "read_locator_guardrail",
        run: async ({ toolCall }) => {
          const args = parseToolArguments((toolCall as any).arguments);
          const projectData = bridge.getProjectData();
          const resourceType = typeof args.resource_type === "string" ? args.resource_type.trim() : "";
          const episodeId = Number(args.episode_id ?? args.episodeId);
          const sceneId = typeof (args.scene_id ?? args.sceneId) === "string" ? String(args.scene_id ?? args.sceneId).trim() : "";
          const sceneIndex = Number(args.scene_index ?? args.sceneIndex);
          const itemId = typeof (args.item_id ?? args.itemId) === "string" ? String(args.item_id ?? args.itemId).trim() : "";
          const name = typeof args.name === "string" ? args.name.trim() : "";

          if (resourceType === "episode_script" || resourceType === "episode_summary") {
            const exists = (projectData.episodes || []).some((episode) => episode.id === episodeId);
            if (!exists) {
              return ToolGuardrailFunctionOutputFactory.rejectContent(
                `第 ${episodeId || "?"} 集不存在。请先调用 list_project_resources 查看剧本目录。`,
                { resourceType, episodeId }
              );
            }
          }

          if (resourceType === "scene_script") {
            const existsBySceneId =
              sceneId && (projectData.episodes || []).some((episode) => (episode.scenes || []).some((scene) => scene.id === sceneId));
            const existsByIndex =
              episodeId > 0 &&
              sceneIndex > 0 &&
              (projectData.episodes || []).some(
                (episode) => episode.id === episodeId && Array.isArray(episode.scenes) && episode.scenes.length >= sceneIndex
              );
            if (!existsBySceneId && !existsByIndex) {
              return ToolGuardrailFunctionOutputFactory.rejectContent(
                "目标场景不存在。请先读取剧集或搜索剧本，再使用 read_project_resource 精确读取场景。",
                { resourceType, episodeId, sceneId, sceneIndex }
              );
            }
          }

          if (resourceType === "character_profile") {
            const exists = (projectData.context?.characters || []).some(
              (character) => character.id === itemId || character.name === name
            );
            if (!exists) {
              return ToolGuardrailFunctionOutputFactory.rejectContent(
                "目标角色档案不存在。请先调用 list_project_resources 或 search_project_resource。",
                { resourceType, itemId, name }
              );
            }
          }

          if (resourceType === "scene_profile") {
            const exists = (projectData.context?.locations || []).some(
              (location) => location.id === itemId || location.name === name
            );
            if (!exists) {
              return ToolGuardrailFunctionOutputFactory.rejectContent(
                "目标场景档案不存在。请先调用 list_project_resources 或 search_project_resource。",
                { resourceType, itemId, name }
              );
            }
          }

          if (resourceType === "guide_document") {
            const guide = findGuide(projectData, itemId, name);
            if (!guide) {
              return ToolGuardrailFunctionOutputFactory.rejectContent(
                "目标理解指南不存在。请先调用 list_project_resources 查看 guides 目录。",
                { resourceType, itemId, name }
              );
            }
          }

          return ToolGuardrailFunctionOutputFactory.allow({ resourceType });
        },
      }),
    ];
  }

  return [];
};
