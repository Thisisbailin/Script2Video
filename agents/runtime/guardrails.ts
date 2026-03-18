import {
  ToolGuardrailFunctionOutputFactory,
  defineToolInputGuardrail,
  defineToolOutputGuardrail,
  type InputGuardrail,
  type OutputGuardrail,
  type ToolInputGuardrailDefinition,
  type ToolOutputGuardrailDefinition,
} from "@openai/agents";
import type { ProjectData } from "../../types";
import { sanitizeShotList } from "../../utils/shotSchema";
import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";

export type Script2VideoGuardrailContext = {
  runtimeMode: "browser" | "edge_full";
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

const clipLength = (value: unknown) => (typeof value === "string" ? value.trim().length : 0);
const isValidNodeRef = (value: string) => /^[a-z][a-z0-9_:-]{1,63}$/i.test(value);

const toArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const extractStoryboardRows = (args: Record<string, unknown>) => {
  const directRows = toArray(args.shots ?? args.rows);
  if (directRows.length > 0) return directRows;
  const sceneBlocks = toArray(args.scene_blocks ?? args.sceneBlocks);
  if (sceneBlocks.length === 0) return [];
  return sceneBlocks.flatMap((block) => {
    if (!block || typeof block !== "object") return [];
    return toArray((block as Record<string, unknown>).shots ?? (block as Record<string, unknown>).rows);
  });
};

const findGuide = (projectData: ProjectData, itemId?: string, name?: string) =>
  [
    { item_id: "globalStyleGuide", title: "Style Guide", text: projectData.globalStyleGuide || "" },
    { item_id: "shotGuide", title: "Shot Guide", text: projectData.shotGuide || "" },
    { item_id: "soraGuide", title: "Sora Guide", text: projectData.soraGuide || "" },
    { item_id: "storyboardGuide", title: "Storyboard Guide", text: projectData.storyboardGuide || "" },
    { item_id: "dramaGuide", title: "Drama Guide", text: projectData.dramaGuide || "" },
  ].find((guide) => guide.item_id === itemId || guide.title === name);

export const createScript2VideoInputGuardrails = (): InputGuardrail[] => [
  {
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
  },
];

export const createScript2VideoOutputGuardrails = (): OutputGuardrail[] => [
  {
    name: "non_empty_output_guardrail",
    execute: async ({ agentOutput }) => {
      const text =
        typeof (agentOutput as any)?.text === "string"
          ? (agentOutput as any).text.trim()
          : typeof agentOutput === "string"
            ? agentOutput.trim()
            : "";
      return {
        tripwireTriggered: false,
        outputInfo: {
          message: text ? "ok" : "模型未产出可见回复文本，runtime 将尝试用已完成工具结果生成最小回复。",
          emptyText: !text,
        },
      };
    },
  },
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

          if (resourceType === "episode_script" || resourceType === "episode_storyboard" || resourceType === "episode_summary") {
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

  if (toolName === "edit_project_resource") {
    return [
      defineToolInputGuardrail({
        name: "edit_project_resource_guardrail",
        run: async ({ toolCall }) => {
          const args = parseToolArguments((toolCall as any).arguments);
          const projectData = bridge.getProjectData();
          const resourceType = typeof args.resource_type === "string" ? args.resource_type.trim() : "";
          const episodeId = Number(args.episode_id ?? args.episodeId);
          const name = typeof args.name === "string" ? args.name.trim() : "";
          const summaryLength = clipLength(args.summary);
          const bioLength = clipLength(args.bio);
          const descriptionLength = clipLength(args.description);
          const visualsLength = clipLength(args.visuals);
          const shots = extractStoryboardRows(args);

          if (!["project_summary", "episode_summary", "character_profile", "scene_profile", "episode_storyboard"].includes(resourceType)) {
            return ToolGuardrailFunctionOutputFactory.rejectContent(
              "edit_project_resource 仅支持 project_summary、episode_summary、character_profile、scene_profile、episode_storyboard。",
              { resourceType }
            );
          }

          if (resourceType === "project_summary" && summaryLength < 12) {
            return ToolGuardrailFunctionOutputFactory.rejectContent("项目摘要过短，至少提供 12 个字符再写入。", {
              resourceType,
              summaryLength,
            });
          }

          if (resourceType === "episode_summary") {
            const exists = (projectData.episodes || []).some((episode) => episode.id === episodeId);
            if (!exists) {
              return ToolGuardrailFunctionOutputFactory.rejectContent(
                `第 ${episodeId || "?"} 集不存在，不能写入分集摘要。请先 list 或 read 剧本目录。`,
                { resourceType, episodeId }
              );
            }
            if (summaryLength < 12) {
              return ToolGuardrailFunctionOutputFactory.rejectContent("分集摘要过短，至少提供 12 个字符再写入。", {
                resourceType,
                summaryLength,
              });
            }
          }

          if (resourceType === "character_profile") {
            if (!name) {
              return ToolGuardrailFunctionOutputFactory.rejectContent("角色档案写入需要 name。");
            }
            if (bioLength > 0 && bioLength < 8) {
              return ToolGuardrailFunctionOutputFactory.rejectContent("角色 bio 过短，至少提供 8 个字符。", {
                resourceType,
                name,
                bioLength,
              });
            }
          }

          if (resourceType === "scene_profile") {
            if (!name) {
              return ToolGuardrailFunctionOutputFactory.rejectContent("场景档案写入需要 name。");
            }
            if (descriptionLength === 0 && visualsLength === 0 && typeof args.type !== "string") {
              return ToolGuardrailFunctionOutputFactory.rejectContent("场景档案至少需要 description、visuals 或 type 之一。");
            }
            if (descriptionLength > 0 && descriptionLength < 8) {
              return ToolGuardrailFunctionOutputFactory.rejectContent("场景 description 过短，至少提供 8 个字符。", {
                resourceType,
                name,
                descriptionLength,
              });
            }
          }

          if (resourceType === "episode_storyboard") {
            const episode = (projectData.episodes || []).find((item) => item.id === episodeId);
            if (!episode) {
              return ToolGuardrailFunctionOutputFactory.rejectContent(
                `第 ${episodeId || "?"} 集不存在，不能写入分镜表。请先 list_project_resources 查看剧本目录。`,
                { resourceType, episodeId }
              );
            }
            if (!shots.length) {
              return ToolGuardrailFunctionOutputFactory.rejectContent(
                "分镜表写入至少需要 1 条 rows/shots 数据。请直接复用 read_project_resource 返回的 rows。",
                { resourceType, episodeId }
              );
            }
            const { issues } = sanitizeShotList(shots, {
              mode: "project",
              requireStructuredId: true,
              allowGeneratedIds: false,
            });
            if (issues.length > 0) {
              return ToolGuardrailFunctionOutputFactory.rejectContent(
                `分镜表结构不合法：${issues[0]?.message || "存在格式错误"}`,
                { resourceType, episodeId, issueCount: issues.length }
              );
            }
          }

          return ToolGuardrailFunctionOutputFactory.allow({ resourceType });
        },
      }),
    ];
  }

  if (toolName === "operate_project_resource") {
    return [
      defineToolInputGuardrail({
        name: "operate_project_resource_guardrail",
        run: async ({ toolCall }) => {
          const args = parseToolArguments((toolCall as any).arguments);
          const resourceType =
            typeof (args.resource_type ?? args.resourceType) === "string"
              ? String(args.resource_type ?? args.resourceType).trim()
              : "";

          if (resourceType === "workflow_node") {
            const nodeRef = typeof (args.node_ref ?? args.nodeRef) === "string" ? String(args.node_ref ?? args.nodeRef).trim() : "";
            const nodeKind = typeof (args.node_kind ?? args.nodeKind) === "string" ? String(args.node_kind ?? args.nodeKind).trim() : "";
            const textLength = clipLength(args.text);
            const episodeId = Number(args.episode_id ?? args.episodeId);
            const characterId =
              typeof (args.character_id ?? args.characterId) === "string"
                ? String(args.character_id ?? args.characterId).trim()
                : "";

            if (!nodeRef) {
              return ToolGuardrailFunctionOutputFactory.rejectContent("workflow_node 必须提供稳定的 node_ref。");
            }
            if (!isValidNodeRef(nodeRef)) {
              return ToolGuardrailFunctionOutputFactory.rejectContent("node_ref 必须使用简洁稳定的标识。", {
                nodeRef,
              });
            }
            if (bridge.getWorkflowNode({ nodeRef })) {
              return ToolGuardrailFunctionOutputFactory.rejectContent(`node_ref=${nodeRef} 已存在。请改用新的 node_ref。`, {
                nodeRef,
              });
            }
            if (!["text", "script_board", "storyboard_board", "character_card"].includes(nodeKind)) {
              return ToolGuardrailFunctionOutputFactory.rejectContent(
                "workflow_node 当前只支持 text、script_board、storyboard_board、character_card。",
                { nodeKind }
              );
            }
            if (nodeKind === "text" && textLength < 4) {
              return ToolGuardrailFunctionOutputFactory.rejectContent("文本节点内容过短，至少提供 4 个字符。", {
                nodeRef,
                textLength,
              });
            }
            if ((nodeKind === "script_board" || nodeKind === "storyboard_board") && !Number.isInteger(episodeId)) {
              return ToolGuardrailFunctionOutputFactory.rejectContent(`${nodeKind} 需要合法的 episode_id。`, {
                nodeRef,
                episodeId,
              });
            }
            if (nodeKind === "character_card") {
              if (!characterId) {
                return ToolGuardrailFunctionOutputFactory.rejectContent("character_card 需要 character_id。");
              }
              const exists = (bridge.getProjectData().context?.characters || []).some((character) => character.id === characterId);
              if (!exists) {
                return ToolGuardrailFunctionOutputFactory.rejectContent("目标角色不存在。请先查阅角色档案再创建角色卡片。", {
                  characterId,
                });
              }
            }
            return ToolGuardrailFunctionOutputFactory.allow({ resourceType, nodeRef, nodeKind });
          }

          if (resourceType === "workflow_connection") {
            const sourceRef =
              typeof (args.source_ref ?? args.sourceRef) === "string" ? String(args.source_ref ?? args.sourceRef).trim() : "";
            const targetRef =
              typeof (args.target_ref ?? args.targetRef) === "string" ? String(args.target_ref ?? args.targetRef).trim() : "";
            const sourceNodeId =
              typeof (args.source_node_id ?? args.sourceNodeId) === "string" ? String(args.source_node_id ?? args.sourceNodeId).trim() : "";
            const targetNodeId =
              typeof (args.target_node_id ?? args.targetNodeId) === "string" ? String(args.target_node_id ?? args.targetNodeId).trim() : "";
            const source = bridge.getWorkflowNode({ nodeRef: sourceRef || undefined, nodeId: sourceNodeId || undefined });
            const target = bridge.getWorkflowNode({ nodeRef: targetRef || undefined, nodeId: targetNodeId || undefined });

            if (!source || !target) {
              return ToolGuardrailFunctionOutputFactory.rejectContent(
                "workflow_connection 只能连接已存在节点。请先创建节点，并复用 node_ref。",
                { sourceRef, targetRef, sourceNodeId, targetNodeId }
              );
            }
            if (source.nodeId === target.nodeId) {
              return ToolGuardrailFunctionOutputFactory.rejectContent("不能把节点连接到自己。");
            }

            const sourceHandle =
              typeof (args.source_handle ?? args.sourceHandle) === "string" ? String(args.source_handle ?? args.sourceHandle).trim() : "";
            const targetHandle =
              typeof (args.target_handle ?? args.targetHandle) === "string" ? String(args.target_handle ?? args.targetHandle).trim() : "";
            const sourceCanOutputText = source.outputHandles.includes("text" as any);
            const targetCanInputText = target.inputHandles.includes("text" as any);
            const resolvedSourceHandle = sourceHandle || (sourceCanOutputText ? "text" : "");
            const resolvedTargetHandle = targetHandle || (sourceCanOutputText && targetCanInputText ? "text" : "");

            if (!resolvedSourceHandle || !resolvedTargetHandle) {
              return ToolGuardrailFunctionOutputFactory.rejectContent(
                `当前无法自动推断 ${source.nodeType} -> ${target.nodeType} 的端口，请显式提供 source_handle 和 target_handle。`,
                { sourceType: source.nodeType, targetType: target.nodeType }
              );
            }
            if (!source.outputHandles.includes(resolvedSourceHandle as any) || !target.inputHandles.includes(resolvedTargetHandle as any)) {
              return ToolGuardrailFunctionOutputFactory.rejectContent("提供的端口不属于目标节点，请检查节点类型或显式端口。", {
                sourceType: source.nodeType,
                targetType: target.nodeType,
                sourceHandle: resolvedSourceHandle,
                targetHandle: resolvedTargetHandle,
              });
            }

            return ToolGuardrailFunctionOutputFactory.allow({
              resourceType,
              sourceRef: source.nodeRef,
              targetRef: target.nodeRef,
            });
          }

          return ToolGuardrailFunctionOutputFactory.rejectContent(
            "operate_project_resource 仅支持 workflow_node 和 workflow_connection。",
            { resourceType }
          );
        },
      }),
    ];
  }

  return [];
};

export const createScript2VideoToolOutputGuardrails = (toolName: string): ToolOutputGuardrailDefinition[] => {
  if (toolName === "edit_project_resource") {
    return [
      defineToolOutputGuardrail({
        name: "edit_project_resource_output_guardrail",
        run: async ({ output }) => {
          const result = output && typeof output === "object" ? (output as Record<string, unknown>) : null;
          if (!result || result.updated !== true || typeof result.resource_type !== "string") {
            return ToolGuardrailFunctionOutputFactory.throwException({
              toolName,
              reason: "invalid_output_shape",
            });
          }
          return ToolGuardrailFunctionOutputFactory.allow({ resourceType: result.resource_type });
        },
      }),
    ];
  }

  if (toolName === "operate_project_resource") {
    return [
      defineToolOutputGuardrail({
        name: "operate_project_resource_output_guardrail",
        run: async ({ output }) => {
          const result = output && typeof output === "object" ? (output as Record<string, unknown>) : null;
          const resourceType = typeof result?.resource_type === "string" ? result.resource_type : "";
          if (resourceType === "workflow_node") {
            const nodeId = typeof result?.node_id === "string" ? result.node_id : "";
            const nodeRef = typeof result?.node_ref === "string" ? result.node_ref : "";
            if (!nodeId || !nodeRef) {
              return ToolGuardrailFunctionOutputFactory.throwException({
                toolName,
                reason: "missing_node_identity",
              });
            }
            return ToolGuardrailFunctionOutputFactory.allow({ resourceType, nodeId, nodeRef });
          }
          if (resourceType === "workflow_connection") {
            const edgeId = typeof result?.edge_id === "string" ? result.edge_id : "";
            const sourceNodeId = typeof result?.source_node_id === "string" ? result.source_node_id : "";
            const targetNodeId = typeof result?.target_node_id === "string" ? result.target_node_id : "";
            if (!edgeId || !sourceNodeId || !targetNodeId) {
              return ToolGuardrailFunctionOutputFactory.throwException({
                toolName,
                reason: "missing_edge_identity",
              });
            }
            return ToolGuardrailFunctionOutputFactory.allow({ resourceType, edgeId, sourceNodeId, targetNodeId });
          }
          return ToolGuardrailFunctionOutputFactory.throwException({
            toolName,
            reason: "invalid_output_shape",
          });
        },
      }),
    ];
  }

  return [];
};
