import {
  Agent,
  InputGuardrailTripwireTriggered,
  OutputGuardrailTripwireTriggered,
  Runner,
  ToolInputGuardrailTripwireTriggered,
  ToolOutputGuardrailTripwireTriggered,
  generateTraceId,
  getGlobalTraceProvider,
  setDefaultOpenAIClient,
  setOpenAIAPI,
  setTracingExportApiKey,
} from "@openai/agents";
import OpenAI from "openai";
import { OPENROUTER_RESPONSES_BASE_URL, QWEN_RESPONSES_BASE_URL } from "../../constants";
import { createScript2VideoTools } from "../../agents/tools";
import { createEdgeSessionInputCallback, EdgeMemorySession } from "../../agents/runtime/edgeSession";
import { createScript2VideoInputGuardrails, createScript2VideoOutputGuardrails } from "../../agents/runtime/guardrails";
import { composeAgentInstructions } from "../../agents/runtime/instructions";
import {
  AGENT_HTTP_STREAM_CONTENT_TYPE,
  serializeAgentStreamPacket,
  type AgentHttpRunRequest,
} from "../../agents/runtime/httpProtocol";
import type { AgentRuntimeEvent, Script2VideoRunResult } from "../../agents/runtime/types";
import type { ProjectData } from "../../types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

const resolveApiKey = (env: Record<string, unknown>, provider: "qwen" | "openrouter") => {
  const value =
    provider === "openrouter"
      ? env.OPENROUTER_API_KEY
      : env.QWEN_API_KEY || env.DASHSCOPE_API_KEY || env.OPENAI_API_KEY;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Pages Functions 未配置 ${provider} 的可用 API Key。`);
  }
  return value.trim();
};

const resolveBaseUrl = (provider: "qwen" | "openrouter", baseUrl?: string) => {
  const configured = (baseUrl || "").trim();
  if (configured) return configured;
  return provider === "openrouter" ? OPENROUTER_RESPONSES_BASE_URL : QWEN_RESPONSES_BASE_URL;
};

const resolveTracingApiKey = (env: Record<string, unknown>) => {
  const value = env.OPENAI_TRACING_API_KEY;
  if (typeof value !== "string" || !value.trim()) return "";
  return value.trim();
};

const resolveTraceIncludeSensitiveData = (env: Record<string, unknown>) => {
  const value = env.AGENT_TRACE_INCLUDE_SENSITIVE_DATA;
  return value === "1" || value === "true";
};

const unwrapProviderEvent = (data: any) => {
  if (data && typeof data === "object" && data.event && typeof data.event === "object") return data.event;
  if (data && typeof data === "object" && data.providerData && typeof data.providerData === "object") return data.providerData;
  return data;
};

const extractTextFromResponseOutput = (output: unknown): string => {
  if (!output || !Array.isArray(output)) return "";
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    if ((item as any).type === "message" && Array.isArray((item as any).content)) {
      for (const content of (item as any).content) {
        if (content?.type === "output_text" && typeof content.text === "string") parts.push(content.text);
      }
    }
    if ((item as any).type === "output_text" && typeof (item as any).text === "string") {
      parts.push((item as any).text);
    }
  }
  return parts.join("\n").trim();
};

const createReadOnlyBridge = (projectData: ProjectData) => ({
  getProjectData: () => projectData,
  updateProjectData: () => {
    throw new Error("当前 edge runtime 只支持查阅能力，不支持编辑。");
  },
  addTextNode: () => {
    throw new Error("当前 edge runtime 只支持查阅能力，不支持节点操作。");
  },
  createWorkflowNode: () => {
    throw new Error("当前 edge runtime 只支持查阅能力，不支持节点操作。");
  },
  connectWorkflowNodes: () => {
    throw new Error("当前 edge runtime 只支持查阅能力，不支持节点操作。");
  },
  createNodeWorkflow: () => {
    throw new Error("当前 edge runtime 只支持查阅能力，不支持节点操作。");
  },
  getViewport: () => null,
  getNodeCount: () => 0,
});

const createSseResponse = (stream: ReadableStream<Uint8Array>) =>
  new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": AGENT_HTTP_STREAM_CONTENT_TYPE,
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });

const emitEvent = (controller: ReadableStreamDefaultController<Uint8Array>, event: AgentRuntimeEvent) => {
  controller.enqueue(
    new TextEncoder().encode(serializeAgentStreamPacket({ kind: "event", event }))
  );
};

const emitResult = (controller: ReadableStreamDefaultController<Uint8Array>, result: Script2VideoRunResult) => {
  controller.enqueue(
    new TextEncoder().encode(serializeAgentStreamPacket({ kind: "result", result }))
  );
};

const emitError = (controller: ReadableStreamDefaultController<Uint8Array>, error: string) => {
  controller.enqueue(
    new TextEncoder().encode(serializeAgentStreamPacket({ kind: "error", error }))
  );
};

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });

export const onRequestPost = async (context: any) => {
  const body = (await context.request.json().catch(() => null)) as AgentHttpRunRequest | null;
  if (!body?.run?.sessionId || !body?.run?.userText || !body?.runtime?.model || !body?.projectData) {
    return new Response(JSON.stringify({ error: "请求缺少 run.sessionId、run.userText、runtime.model 或 projectData。" }), {
      status: 400,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }

  const runId = `edge-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const provider = body.runtime.provider === "openrouter" ? "openrouter" : "qwen";

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      const tracingApiKey = resolveTracingApiKey(context.env || {});
      const traceId = generateTraceId();
      const tracingEnabled = Boolean(tracingApiKey);
      try {
        emitEvent(controller, {
          type: "run_started",
          runId,
          sessionId: body.run.sessionId,
          traceId,
          tracingEnabled,
        });

        const apiKey = resolveApiKey(context.env || {}, provider);
        const client = new OpenAI({
          apiKey,
          baseURL: resolveBaseUrl(provider, body.runtime.baseUrl),
        });
        setOpenAIAPI("responses");
        setDefaultOpenAIClient(client);
        if (tracingEnabled) {
          setTracingExportApiKey(tracingApiKey);
        }

        const session = new EdgeMemorySession(body.run.sessionId);
        const sessionId = await session.getSessionId();
        const sessionItems = await session.getItems(24);
        emitEvent(controller, {
          type: "trace",
          runId,
          entry: {
            id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            at: Date.now(),
            stage: "session",
            status: "info",
            title: "Session attached",
            detail: `id=${sessionId} · items=${sessionItems.length}`,
          },
        });

        const agent = new Agent({
          name: "Script2Video Edge Agent",
          instructions: composeAgentInstructions({
            enabledSkills: [],
            requestedOutcome: body.run.requestedOutcome,
            uiContext: body.run.uiContext,
          }),
          handoffDescription: "Edge runtime scaffold for Script2Video.",
          model: body.runtime.model,
          modelSettings: {
            toolChoice: "auto",
            parallelToolCalls: false,
          },
          inputGuardrails: createScript2VideoInputGuardrails(),
          outputGuardrails: createScript2VideoOutputGuardrails(),
          resetToolChoice: true,
          tools: createScript2VideoTools({
            bridge: createReadOnlyBridge(body.projectData),
            emitEvent: (event: AgentRuntimeEvent) => emitEvent(controller, event),
            disabledTools: [
              "ping_tool",
              "write_understanding_resource",
              "create_workflow_node",
              "connect_workflow_nodes",
              "operate_project_workflow",
              "create_text_node",
              "create_node_workflow",
              "read_project_data",
              "search_script_data",
              "upsert_character",
              "upsert_location",
              "write_project_summary",
              "write_episode_summary",
              "get_episode_script",
              "get_scene_script",
            ],
          }),
        });

        const runner = new Runner({
          tracingDisabled: !tracingEnabled,
          traceIncludeSensitiveData: resolveTraceIncludeSensitiveData(context.env || {}),
          workflowName: "Script2Video Agent",
          traceId,
          groupId: body.run.sessionId,
          traceMetadata: {
            runtimeTarget: "edge",
            provider,
            model: body.runtime.model,
            requestedOutcome: body.run.requestedOutcome || "auto",
          },
          ...(tracingEnabled ? { tracing: { apiKey: tracingApiKey } } : {}),
        });

        let accumulatedText = "";
        let accumulatedReasoning = "";
        const result = await runner.run(agent, body.run.userText.trim(), {
          stream: true,
          maxTurns: 4,
          signal: context.request.signal,
          session,
          sessionInputCallback: createEdgeSessionInputCallback(),
          context: {
            runtimeMode: "edge_read_only",
            requestedOutcome: body.run.requestedOutcome || "auto",
          },
        });

        const streamReader = result.toStream().getReader();
        try {
          while (true) {
            const { done, value } = await streamReader.read();
            if (done) break;
            if (!value) continue;
            if (value.type !== "raw_model_stream_event") continue;
            const providerEvent = unwrapProviderEvent((value as any).data);
            const rawType = providerEvent?.type || (value as any)?.data?.type;
            if (rawType === "output_text_delta" && typeof providerEvent?.delta === "string") {
              accumulatedText += providerEvent.delta;
              emitEvent(controller, {
                type: "message_delta",
                runId,
                delta: providerEvent.delta,
                accumulatedText,
              });
            }
            if (
              (rawType === "response.reasoning_summary_text.delta" || rawType === "reasoning_summary_text.delta") &&
              typeof providerEvent?.delta === "string"
            ) {
              accumulatedReasoning += providerEvent.delta;
              emitEvent(controller, {
                type: "reasoning_delta",
                runId,
                delta: providerEvent.delta,
                accumulatedText: accumulatedReasoning,
              });
            }
            if (
              (rawType === "response.reasoning_summary_text.done" || rawType === "reasoning_summary_text.done") &&
              typeof providerEvent?.text === "string"
            ) {
              accumulatedReasoning = providerEvent.text;
              emitEvent(controller, {
                type: "reasoning_completed",
                runId,
                text: accumulatedReasoning,
              });
            }
          }
        } finally {
          streamReader.releaseLock();
        }

        await (result as any).completed;
        const finalText = String(result.finalOutput || "").trim() || accumulatedText || extractTextFromResponseOutput(result.rawResponses?.at(-1)?.output);
        const runResult: Script2VideoRunResult = {
          finalText,
          sessionId: body.run.sessionId,
          outputItems: [{ kind: "text", text: finalText }],
          toolCalls: [],
          tracing: {
            enabled: tracingEnabled,
            traceId,
          },
          usage: result.rawResponses?.at(-1)?.usage
            ? {
                inputTokens: result.rawResponses.at(-1)?.usage?.inputTokens,
                outputTokens: result.rawResponses.at(-1)?.usage?.outputTokens,
                totalTokens: result.rawResponses.at(-1)?.usage?.totalTokens,
              }
            : undefined,
        };
        emitEvent(controller, {
          type: "message_completed",
          runId,
          text: finalText,
        });
        emitEvent(controller, {
          type: "run_completed",
          runId,
          result: runResult,
        });
        emitResult(controller, runResult);
      } catch (error: any) {
        const isGuardrailError =
          error instanceof InputGuardrailTripwireTriggered ||
          error instanceof OutputGuardrailTripwireTriggered ||
          error instanceof ToolInputGuardrailTripwireTriggered ||
          error instanceof ToolOutputGuardrailTripwireTriggered;
        const message = isGuardrailError
          ? `Guardrail 已拦截当前请求：${error?.message || "请求不符合运行边界。"}`
          : error?.message || "Cloudflare Agent runtime 执行失败";
        emitEvent(controller, {
          type: "run_failed",
          runId,
          error: message,
        });
        emitError(controller, message);
      } finally {
        if (tracingEnabled) {
          await getGlobalTraceProvider().forceFlush().catch(() => undefined);
        }
        controller.close();
      }
    },
  });

  return createSseResponse(stream);
};
