import { Agent, run, setDefaultOpenAIClient, setOpenAIAPI } from "@openai/agents";
import OpenAI from "openai";
import type { Script2VideoAgentBridge } from "../bridge/script2videoBridge";
import { createScript2VideoTools } from "../tools";
import { normalizeQalamToolSettings } from "../../node-workspace/components/qalam/tooling";
import { composeAgentInstructions } from "./instructions";
import { OPENROUTER_RESPONSES_BASE_URL, QWEN_RESPONSES_BASE_URL } from "../../constants";
import type {
  AgentExecutedToolCall,
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

const toSessionToolMessage = (toolCall: AgentExecutedToolCall) => ({
  role: "tool" as const,
  text: toolCall.summary || toolCall.error || toolCall.name,
  createdAt: Date.now(),
  toolName: toolCall.name,
  toolCallId: toolCall.callId,
  toolStatus: toolCall.status === "error" ? "error" as const : "success" as const,
  toolOutput: toolCall.output ?? toolCall.error,
});

const buildRunInputText = (input: Script2VideoRunInput, sessionText: string) => {
  const blocks: string[] = [];
  if (sessionText.trim()) {
    blocks.push(`[Conversation Memory]\n${sessionText.trim()}`);
  }
  if (input.uiContext?.supplementalContextText?.trim()) {
    blocks.push(`[Supplemental Context]\n${input.uiContext.supplementalContextText.trim()}`);
  }
  blocks.push(`[User Request]\n${input.userText.trim()}`);
  return blocks.join("\n\n");
};

export const createScript2VideoAgentRuntime = ({
  bridge,
  skillLoader,
  configProvider,
  sessionStore,
  tracer,
}: RuntimeDeps): Script2VideoAgentRuntime => ({
  async run(input: Script2VideoRunInput, options?: Script2VideoRunOptions): Promise<Script2VideoRunResult> {
    if (input.attachments?.length) {
      const message = "新的 Agent runtime 暂不支持图片附件，请先移除附件后再发送。";
      options?.onEvent?.({ type: "run_failed", error: message });
      throw new Error(message);
    }

    options?.onEvent?.({ type: "run_started", sessionId: input.sessionId });
    tracer?.onRunStarted(input);

    const config = await configProvider.getConfig();
    const provider = config.provider === "openrouter" ? "openrouter" : "qwen";
    const apiKey = resolveApiKey(provider, config.apiKey);
    const baseURL = resolveBaseUrl(provider, config.baseUrl);
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

    const previousSession = (await sessionStore.getSession(input.sessionId)) || {
      id: input.sessionId,
      messages: [],
      updatedAt: Date.now(),
    };
    const sessionText = previousSession.messages
      .slice(-8)
      .map((message) => `${message.role === "user" ? "用户" : "助手"}: ${message.text}`)
      .join("\n");

    const toolEvents: AgentExecutedToolCall[] = [];
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
    if (!toolSettings.projectData.enabled) {
      disabledTools.push("read_project_data", "search_script_data");
    }
    if (!toolSettings.characterLocation.enabled) {
      disabledTools.push("upsert_character", "upsert_location");
    }
    if (!toolSettings.workflowBuilder.enabled) {
      disabledTools.push("create_text_node", "create_node_workflow");
    }
    const agent = new Agent({
      name: "Script2Video Agent",
      instructions: composeAgentInstructions({
        enabledSkills: enabledSkills as any,
        requestedOutcome: input.requestedOutcome,
        uiContext: input.uiContext,
      }),
      handoffDescription: "Single all-purpose Script2Video creative agent.",
      model: config.model,
      tools: createScript2VideoTools({
        bridge,
        emitEvent: emitToolEvent,
        disabledTools,
      }),
    });

    try {
      const result = await run(agent, buildRunInputText(input, sessionText), {
        signal: options?.signal,
      });
      const finalText = normalizeText(result.finalOutput);
      const runResult: Script2VideoRunResult = {
        finalText,
        sessionId: input.sessionId,
        outputItems: [
          ...toolEvents.map((toolCall) => ({ kind: "tool_result", toolCall }) as const),
          { kind: "text", text: finalText } as const,
        ],
        toolCalls: toolEvents,
      };

      await sessionStore.saveSession({
        id: input.sessionId,
        updatedAt: Date.now(),
        messages: [
          ...previousSession.messages,
          { role: "user", text: input.userText, createdAt: Date.now() },
          ...toolEvents
            .filter((toolCall) => toolCall.status === "success" || toolCall.status === "error")
            .map(toSessionToolMessage),
          { role: "assistant", text: finalText, createdAt: Date.now() },
        ].slice(-120),
      });

      options?.onEvent?.({ type: "message_completed", text: finalText });
      options?.onEvent?.({ type: "run_completed", result: runResult });
      tracer?.onRunCompleted(runResult);
      return runResult;
    } catch (error: any) {
      const message = error?.message || "Agent runtime 执行失败";
      await sessionStore.saveSession({
        id: input.sessionId,
        updatedAt: Date.now(),
        messages: [
          ...previousSession.messages,
          { role: "user", text: input.userText, createdAt: Date.now() },
          ...toolEvents
            .filter((toolCall) => toolCall.status === "success" || toolCall.status === "error")
            .map(toSessionToolMessage),
          { role: "assistant", text: `运行失败: ${message}`, createdAt: Date.now() },
        ].slice(-120),
      });
      options?.onEvent?.({ type: "run_failed", error: message });
      tracer?.onRunFailed(message);
      throw error;
    }
  },
});
