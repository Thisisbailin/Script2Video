import { useCallback } from "react";
import type { AgentToolCall } from "../../../services/toolingTypes";
import type { ProjectData } from "../../../types";
import type { Message, ToolMessage, ToolPayload, ToolStatus } from "./types";
import { buildToolMessages, buildToolCallMeta, buildToolSummary, normalizeQalamToolSettings } from "./tooling";
import {
  getEpisodeScript,
  getSceneScript,
  readProjectData,
  searchScriptData,
  upsertCharacter,
  upsertLocation,
} from "./toolActions";
import { useWorkflowStore } from "../../store/workflowStore";

type Options = {
  setMessages: (updater: Message[] | ((prev: Message[]) => Message[])) => void;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;
  toolSettings?: Parameters<typeof normalizeQalamToolSettings>[0];
};

type ToolOutput = {
  name: string;
  callId: string;
  output: string;
};

export const useQalamTooling = ({
  setMessages,
  setProjectData,
  toolSettings,
}: Options) => {
  const settings = normalizeQalamToolSettings(toolSettings);
  const { addNode, nodes, viewport } = useWorkflowStore((state) => ({
    addNode: state.addNode,
    nodes: state.nodes,
    viewport: state.viewport,
  }));
  const updateToolStatus = useCallback(
    (callId: string, status: ToolStatus, summary?: string) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.kind !== "tool" || m.tool.callId !== callId) return m;
          return { ...m, tool: { ...m.tool, status, summary: summary ?? m.tool.summary } };
        })
      );
    },
    [setMessages]
  );

  const appendToolResult = useCallback(
    (payload: ToolPayload) => {
      setMessages((prev) => [...prev, { role: "assistant", kind: "tool_result", tool: payload }]);
    },
    [setMessages]
  );

  const executeToolCall = useCallback(
    (call: AgentToolCall) => {
      const toolMeta = buildToolCallMeta([call], settings);
      const args = toolMeta[0]?.args || {};
      if (call.name === "upsert_character") {
        let result: any = null;
        setProjectData((prev) => {
          const { next, result: res } = upsertCharacter(prev, args);
          result = res;
          return next;
        });
        return result;
      }
      if (call.name === "upsert_location") {
        let result: any = null;
        setProjectData((prev) => {
          const { next, result: res } = upsertLocation(prev, args);
          result = res;
          return next;
        });
        return result;
      }
      if (call.name === "read_project_data" || call.name === "read_script_data") {
        let result: any = null;
        setProjectData((prev) => {
          result = readProjectData(prev, args).result;
          return prev;
        });
        return result;
      }
      if (call.name === "get_episode_script") {
        let result: any = null;
        setProjectData((prev) => {
          result = getEpisodeScript(prev, args).result;
          return prev;
        });
        return result;
      }
      if (call.name === "get_scene_script") {
        let result: any = null;
        setProjectData((prev) => {
          result = getSceneScript(prev, args).result;
          return prev;
        });
        return result;
      }
      if (call.name === "search_script_data") {
        let result: any = null;
        setProjectData((prev) => {
          result = searchScriptData(prev, args).result;
          return prev;
        });
        return result;
      }
      if (call.name === "create_text_node") {
        const text = typeof args?.text === "string" ? args.text.trim() : "";
        if (!text) {
          throw new Error("文本节点内容为空，无法创建。");
        }
        const title = typeof args?.title === "string" && args.title.trim() ? args.title.trim() : "文本节点";
        const hasXY = typeof args?.x === "number" && typeof args?.y === "number";
        const baseX = viewport ? (-viewport.x + 120) / viewport.zoom : 120;
        const baseY = viewport ? (-viewport.y + 120) / viewport.zoom : 120;
        const offset = (nodes.length % 5) * 24;
        const position = hasXY ? { x: args.x, y: args.y } : { x: Math.round(baseX + offset), y: Math.round(baseY + offset) };
        const parentId = typeof args?.parentId === "string" && args.parentId.trim() ? args.parentId.trim() : undefined;
        const nodeId = addNode("text", position, parentId, { title, text });
        return { kind: "text_node", id: nodeId, title };
      }
      throw new Error(`未知工具: ${call.name || "unknown"}`);
    },
    [addNode, nodes.length, setProjectData, viewport, settings]
  );

  const handleToolCalls = useCallback(
    async (toolCalls: AgentToolCall[]) => {
      if (!toolCalls?.length) return [] as ToolOutput[];
      const toolMeta = buildToolCallMeta(toolCalls, settings);
      const toolMessages: ToolMessage[] = buildToolMessages(toolMeta);
      setMessages((prev) => [...prev, ...toolMessages]);
      const outputs: ToolOutput[] = [];

      for (const { tc, args, callId } of toolMeta) {
        updateToolStatus(callId, "running");
        try {
          if (
            tc.name !== "upsert_character" &&
            tc.name !== "upsert_location" &&
            tc.name !== "get_episode_script" &&
            tc.name !== "get_scene_script" &&
            tc.name !== "read_project_data" &&
            tc.name !== "read_script_data" &&
            tc.name !== "search_script_data" &&
            tc.name !== "create_text_node"
          ) {
            updateToolStatus(callId, "success");
            appendToolResult({
              name: tc.name || "tool",
              status: "success",
              summary: "系统工具已执行",
              evidence: Array.isArray(args?.evidence) ? args.evidence : undefined,
              callId,
            });
            outputs.push({
              name: tc.name || "tool",
              callId,
              output: JSON.stringify({ status: "success" }),
            });
            continue;
          }
          const result = executeToolCall(tc);
          updateToolStatus(callId, "success");
          const summary =
            result?.kind === "character"
              ? `已${result.action === "created" ? "创建" : "更新"}角色 ${result.name}（形态 ${result.formsCount ?? 0} 个）`
              : result?.kind === "location"
              ? `已${result.action === "created" ? "创建" : "更新"}场景 ${result.name}（分区 ${result.zonesCount ?? 0} 个）`
              : buildToolSummary(tc.name, args);
          if (
            tc.name === "get_episode_script" ||
            tc.name === "get_scene_script" ||
            tc.name === "read_project_data" ||
            tc.name === "read_script_data" ||
            tc.name === "search_script_data"
          ) {
            const output = JSON.stringify(result || {});
            outputs.push({ name: tc.name || "tool", callId, output });
            appendToolResult({
              name: tc.name || "tool",
              status: "success",
              summary,
              evidence: Array.isArray(args?.evidence) ? args.evidence : undefined,
              callId,
              output,
            });
          } else if (tc.name === "create_text_node") {
            const output = JSON.stringify(result || {});
            outputs.push({ name: tc.name || "tool", callId, output });
            appendToolResult({
              name: tc.name || "tool",
              status: "success",
              summary,
              callId,
              output,
            });
          } else {
            outputs.push({
              name: tc.name || "tool",
              callId,
              output: JSON.stringify({ status: "success", summary }),
            });
            appendToolResult({
              name: tc.name || "tool",
              status: "success",
              summary,
              evidence: Array.isArray(args?.evidence) ? args.evidence : undefined,
              callId,
            });
          }
        } catch (toolErr: any) {
          updateToolStatus(callId, "error");
          appendToolResult({
            name: tc.name || "tool",
            status: "error",
            summary: toolErr?.message || "工具执行失败",
            evidence: Array.isArray(args?.evidence) ? args.evidence : undefined,
            callId,
          });
          outputs.push({
            name: tc.name || "tool",
            callId,
            output: JSON.stringify({ error: toolErr?.message || "工具执行失败" }),
          });
        }
      }
      return outputs;
    },
    [appendToolResult, executeToolCall, setMessages, settings, updateToolStatus]
  );

  return { handleToolCalls };
};
