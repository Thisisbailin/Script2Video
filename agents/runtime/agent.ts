import { Agent, run, setDefaultOpenAIClient, setOpenAIAPI } from "@openai/agents";
import OpenAI from "openai";
import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";
import { createScript2VideoTools } from "../tools";
import { normalizeQalamToolSettings } from "../../node-workspace/components/qalam/tooling";
import { composeAgentInstructions } from "./instructions";
import { OPENROUTER_RESPONSES_BASE_URL, QWEN_RESPONSES_BASE_URL } from "../../constants";
import type {
  AgentExecutedToolCall,
  AgentTraceEntry,
  Script2VideoAgentRuntime,
  AgentRuntimeEvent,
  Script2VideoAgentConfigProvider,
  Script2VideoAgentTracer,
  Script2VideoRunInput,
  Script2VideoRunOptions,
  Script2VideoRunResult,
  Script2VideoSessionStore,
  Script2VideoSkillLoader,
} from "./types";

const WRITE_TOOL_NAMES = new Set([
  "create_text_node",
  "create_node_workflow",
  "upsert_character",
  "upsert_location",
]);
const STABILIZATION_DISABLED_TOOLS = [
  "search_script_data",
  "upsert_character",
  "upsert_location",
  "create_text_node",
  "create_node_workflow",
] as const;

type RuntimeDeps = {
  bridge: Script2VideoAgentBridge;
  skillLoader: Script2VideoSkillLoader;
  configProvider: Script2VideoAgentConfigProvider;
  sessionStore: Script2VideoSessionStore;
  tracer?: Script2VideoAgentTracer;
};

const resolveApiKey = (provider: "qwen" | "openrouter" | undefined, apiKey?: string) => {
  const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;
  const processEnv = typeof process !== "undefined" ? process.env : undefined;
  const envKey =
    provider === "openrouter"
      ? env?.OPENROUTER_API_KEY ||
        env?.VITE_OPENROUTER_API_KEY ||
        processEnv?.OPENROUTER_API_KEY ||
        processEnv?.VITE_OPENROUTER_API_KEY
      : env?.QWEN_API_KEY ||
        env?.VITE_QWEN_API_KEY ||
        env?.DASHSCOPE_API_KEY ||
        env?.VITE_DASHSCOPE_API_KEY ||
        processEnv?.QWEN_API_KEY ||
        processEnv?.VITE_QWEN_API_KEY ||
        processEnv?.DASHSCOPE_API_KEY ||
        processEnv?.VITE_DASHSCOPE_API_KEY ||
        env?.OPENAI_API_KEY ||
        env?.VITE_OPENAI_API_KEY ||
        processEnv?.OPENAI_API_KEY ||
        processEnv?.VITE_OPENAI_API_KEY;
  const finalKey = (apiKey || envKey || "").trim();
  if (!finalKey) {
    throw new Error("缺少 OpenAI 兼容 API Key，无法运行新的 Agent runtime。");
  }
  return finalKey;
};

const resolveBaseUrl = (provider: "qwen" | "openrouter" | undefined, baseUrl?: string) => {
  const configured = (baseUrl || "").trim();
  if (configured) return configured;
  if (provider === "openrouter") return OPENROUTER_RESPONSES_BASE_URL;
  return QWEN_RESPONSES_BASE_URL;
};

const normalizeText = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const createTraceEntry = (
  stage: AgentTraceEntry["stage"],
  status: AgentTraceEntry["status"],
  title: string,
  detail?: string,
  payload?: string
): AgentTraceEntry => ({
  id: `${stage}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  at: Date.now(),
  stage,
  status,
  title,
  detail,
  payload,
});

const buildToolDrivenFinalOutput = (toolResults: any[]) => {
  const writeResults = toolResults.filter(
    (toolResult) => toolResult?.type === "function_output" && WRITE_TOOL_NAMES.has(toolResult?.tool?.name)
  );
  if (!writeResults.length) return null;
  const lines = writeResults.map((toolResult) => {
    const payload = toolResult.output;
    if (typeof payload === "string") {
      try {
        const parsed = JSON.parse(payload);
        if (parsed?.summary) return `- ${parsed.summary}`;
      } catch {}
      return `- ${toolResult.tool.name} 已完成`;
    }
    return `- ${toolResult.tool.name} 已完成`;
  });
  return ["操作已完成：", ...lines, "如需继续扩展，我可以基于当前结果继续处理。"].join("\n");
};

const consumeRunStream = async (
  streamResult: Awaited<ReturnType<typeof run>>,
  onEvent: (streamEvent: any) => void
) => {
  if (!("toStream" in streamResult) || typeof streamResult.toStream !== "function") {
    return;
  }
  const stream = streamResult.toStream();
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) onEvent(value);
    }
  } finally {
    reader.releaseLock();
  }
};

const extractTextFromResponseOutput = (output: unknown): string => {
  if (!output) return "";
  if (typeof output === "string") return output.trim();
  if (!Array.isArray(output)) return "";
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    if ((item as any).type === "message" && Array.isArray((item as any).content)) {
      for (const content of (item as any).content) {
        if (content?.type === "output_text" && typeof content.text === "string") {
          parts.push(content.text);
        }
      }
    }
    if ((item as any).type === "output_text" && typeof (item as any).text === "string") {
      parts.push((item as any).text);
    }
  }
  return parts.join("\n").trim();
};

export const createScript2VideoAgentRuntime = ({
  bridge,
  skillLoader,
  configProvider,
  sessionStore,
  tracer,
}: RuntimeDeps): Script2VideoAgentRuntime => ({
  async run(input: Script2VideoRunInput, options?: Script2VideoRunOptions): Promise<Script2VideoRunResult> {
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const emitTrace = (
      stage: AgentTraceEntry["stage"],
      status: AgentTraceEntry["status"],
      title: string,
      detail?: string,
      payload?: string
    ) => {
      options?.onEvent?.({
        type: "trace",
        runId,
        entry: createTraceEntry(stage, status, title, detail, payload),
      });
    };

    if (input.attachments?.length) {
      const message = "新的 Agent runtime 暂不支持图片附件，请先移除附件后再发送。";
      options?.onEvent?.({ type: "run_failed", runId, error: message });
      throw new Error(message);
    }

    options?.onEvent?.({ type: "run_started", sessionId: input.sessionId, runId });
    emitTrace("runtime", "running", "Run started", `session=${input.sessionId}`);
    tracer?.onRunStarted(input);

    const config = await configProvider.getConfig();
    const provider = config.provider === "openrouter" ? "openrouter" : "qwen";
    const apiKey = resolveApiKey(provider, config.apiKey);
    const baseURL = resolveBaseUrl(provider, config.baseUrl);
    emitTrace("runtime", "info", "Config resolved", `${provider} · ${config.model}`, baseURL);
    setOpenAIAPI("responses");
    const client = new OpenAI({
      apiKey,
      baseURL,
      dangerouslyAllowBrowser: true,
    });
    setDefaultOpenAIClient(client);

    const enabledSkills = (
      await Promise.all((input.enabledSkillIds || []).map((skillId) => skillLoader.getSkill(skillId)))
    ).filter(Boolean);
    emitTrace(
      "runtime",
      "info",
      "Instructions prepared",
      `skills=${enabledSkills.length} · outcome=${input.requestedOutcome || "auto"}`
    );

    const session = await sessionStore.getSession(input.sessionId);
    const sessionId = await session.getSessionId();
    const sessionItems = await session.getItems(12);
    emitTrace("session", "info", "Session attached", `id=${sessionId} · items=${sessionItems.length}`);

    const toolEvents: AgentExecutedToolCall[] = [];
    let streamedTextDelta = "";
    let streamedResponseText = "";
    const emitToolEvent = (event: AgentRuntimeEvent) => {
      if (event.type === "tool_called") {
        toolEvents.push(event.call);
        tracer?.onToolCalled(event.call);
      }
      if (event.type === "tool_completed") {
        const index = toolEvents.findIndex((toolCall) => toolCall.callId === event.call.callId);
        if (index >= 0) toolEvents[index] = event.call;
        tracer?.onToolCompleted(event.call);
      }
      if (event.type === "tool_failed") {
        const index = toolEvents.findIndex((toolCall) => toolCall.callId === event.call.callId);
        if (index >= 0) toolEvents[index] = event.call;
      }
      options?.onEvent?.(event);
    };

    const toolSettings = normalizeQalamToolSettings(config.qalamTools);
    const disabledTools = enabledSkills.flatMap((skill) => skill?.disabledTools || []);
    disabledTools.push(...STABILIZATION_DISABLED_TOOLS);
    if (!toolSettings.projectData.enabled) {
      disabledTools.push("get_episode_script", "get_scene_script", "read_project_data", "search_script_data");
    }
    if (!toolSettings.characterLocation.enabled) {
      disabledTools.push("upsert_character", "upsert_location");
    }
    if (!toolSettings.workflowBuilder.enabled) {
      disabledTools.push("create_text_node", "create_node_workflow");
    }
    const enabledToolNames = createScript2VideoTools({
      bridge,
      disabledTools,
    }).map((tool) => tool.name);
    emitTrace(
      "tool",
      "info",
      "Tool catalog ready",
      `enabled=${enabledToolNames.length} · disabled=${Array.from(new Set(disabledTools)).length}`,
      enabledToolNames.join(", ")
    );
    const agent = new Agent({
      name: "Script2Video Agent",
      instructions: composeAgentInstructions({
        enabledSkills: enabledSkills as any,
        requestedOutcome: input.requestedOutcome,
        uiContext: input.uiContext,
      }),
      handoffDescription: "Single all-purpose Script2Video creative agent.",
      model: config.model,
      modelSettings: {
        toolChoice: "auto",
        parallelToolCalls: false,
      },
      resetToolChoice: true,
      toolUseBehavior: async (_context, toolResults) => {
        const finalOutput = buildToolDrivenFinalOutput(toolResults as any[]);
        if (!finalOutput) {
          return {
            isFinalOutput: false as const,
            isInterrupted: undefined,
          };
        }
        return {
          isFinalOutput: true as const,
          isInterrupted: undefined,
          finalOutput,
        };
      },
      tools: createScript2VideoTools({
        bridge,
        emitEvent: emitToolEvent,
        disabledTools,
      }),
    });
    emitTrace("runtime", "info", "Agent created", agent.name, `model=${config.model}`);

    try {
      emitTrace("model", "running", "Streaming started", input.userText.trim());
      const result = await run(agent, input.userText.trim(), {
        signal: options?.signal,
        maxTurns: 8,
        session,
        stream: true,
      });
      await consumeRunStream(result, (streamEvent) => {
        if (streamEvent.type === "agent_updated_stream_event") {
          emitTrace("runtime", "info", "Agent updated", streamEvent.agent.name);
          return;
        }
        if (streamEvent.type === "run_item_stream_event") {
          const itemType = (streamEvent.item as any)?.type || (streamEvent.item as any)?.rawItem?.type || "unknown";
          const rawItem = (streamEvent.item as any)?.rawItem;
          const detail =
            itemType === "function_call"
              ? `${rawItem?.name || "tool"}`
              : itemType === "function_call_result"
                ? `${rawItem?.name || "tool"} · ${rawItem?.status || "completed"}`
                : streamEvent.name;
          const payload =
            itemType === "function_call"
              ? rawItem?.arguments
              : itemType === "function_call_result"
                ? normalizeText(rawItem?.output)
                : undefined;
          emitTrace(
            itemType === "function_call" || itemType === "function_call_result" ? "tool" : "model",
            itemType === "function_call_result" ? "success" : "info",
            `Stream item: ${streamEvent.name}`,
            detail,
            payload
          );
          return;
        }
        if (streamEvent.type === "raw_model_stream_event") {
          const rawType = (streamEvent.data as any)?.type || "raw_event";
          if (rawType === "output_text_delta" && typeof (streamEvent.data as any)?.delta === "string") {
            streamedTextDelta += (streamEvent.data as any).delta;
          }
          if (rawType === "response_done") {
            const candidate = extractTextFromResponseOutput((streamEvent.data as any)?.response?.output);
            if (candidate) {
              streamedResponseText = candidate;
            }
          }
          emitTrace("model", "info", `Raw event: ${rawType}`);
        }
      });
      await result.completed;
      const finalText = normalizeText(result.finalOutput) || streamedTextDelta.trim() || streamedResponseText.trim();
      const runResult: Script2VideoRunResult = {
        finalText,
        sessionId: input.sessionId,
        outputItems: [
          ...toolEvents.map((toolCall) => ({ kind: "tool_result", toolCall }) as const),
          { kind: "text", text: finalText } as const,
        ],
        toolCalls: toolEvents,
        usage: result.rawResponses?.at(-1)?.usage
          ? {
              inputTokens: result.rawResponses.at(-1)?.usage?.inputTokens,
              outputTokens: result.rawResponses.at(-1)?.usage?.outputTokens,
              totalTokens: result.rawResponses.at(-1)?.usage?.totalTokens,
            }
          : undefined,
      };

      emitTrace(
        "result",
        "success",
        "Run completed",
        `tools=${toolEvents.length} · response=${result.lastResponseId || "n/a"}`,
        finalText
      );
      options?.onEvent?.({ type: "message_completed", text: finalText });
      options?.onEvent?.({ type: "run_completed", runId, result: runResult });
      tracer?.onRunCompleted(runResult);
      return runResult;
    } catch (error: any) {
      const isMaxTurns = error?.name === "MaxTurnsExceededError" || String(error?.message || "").includes("Max turns");
      const toolTrace = toolEvents
        .slice(-5)
        .map((toolCall) => `${toolCall.name}:${toolCall.status}${toolCall.summary ? `(${toolCall.summary})` : ""}`)
        .join(" -> ");
      const fallbackText = streamedTextDelta.trim() || streamedResponseText.trim();
      if (isMaxTurns && !toolEvents.length && fallbackText) {
        const runResult: Script2VideoRunResult = {
          finalText: fallbackText,
          sessionId: input.sessionId,
          outputItems: [{ kind: "text", text: fallbackText }],
          toolCalls: [],
        };
        emitTrace("result", "success", "Fallback text recovered", "SDK 未识别 finalOutput，已从 raw response 恢复文本。", fallbackText);
        options?.onEvent?.({ type: "message_completed", text: fallbackText });
        options?.onEvent?.({ type: "run_completed", runId, result: runResult });
        tracer?.onRunCompleted(runResult);
        return runResult;
      }
      const message = isMaxTurns
        ? `Agent 在工具调用中未能收敛，已中止。${toolTrace ? ` 最近工具链路：${toolTrace}` : ""}`
        : error?.message || "Agent runtime 执行失败";
      emitTrace("result", "error", "Run failed", message);
      options?.onEvent?.({ type: "run_failed", runId, error: message });
      tracer?.onRunFailed(message);
      throw new Error(message);
    }
  },
});
