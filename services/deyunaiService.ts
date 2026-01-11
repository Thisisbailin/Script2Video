import { DeyunAIConfig, TokenUsage } from "../types";

type Role = "system" | "user" | "assistant";

type InputContent =
  | string
  | Array<{
      type: "input_text" | "text";
      text: string;
    }>;

export type DeyunAIMessage = {
  role: Role;
  content: InputContent;
};

export type DeyunAITool =
  | { type: "web_search_preview" }
  | {
      type: "function";
      name: string;
      description?: string;
      parameters: Record<string, any>;
      strict?: boolean;
    };

export type DeyunAIReasoningEffort = "low" | "medium" | "high";

export type DeyunAIToolCall = {
  type: "function";
  name: string;
  arguments: string;
  callId?: string;
  status?: string;
};

export interface DeyunAIResponse<T = any> {
  text: string;
  usage?: TokenUsage;
  raw: T;
  toolCalls?: DeyunAIToolCall[];
  output?: any[];
  choices?: any;
}

export interface DeyunAIModelMeta {
  id: string;
  root?: string;
  description?: string;
  modalities?: string[];
  capabilities?: Record<string, any>;
}

const DEFAULT_BASE = "https://api.deyunai.com/v1";

const mapUsage = (usage: any): TokenUsage | undefined => {
  if (!usage) return undefined;
  const promptTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
  const responseTokens = usage.completion_tokens ?? usage.output_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? promptTokens + responseTokens;
  return { promptTokens, responseTokens, totalTokens };
};

const getEndpoint = (config: DeyunAIConfig) => {
  const base = (config.baseUrl || DEFAULT_BASE).replace(/\/+$/, "");
  return `${base}/responses`;
};

const getModelsEndpoint = (config: DeyunAIConfig) => {
  let base = (config.baseUrl || DEFAULT_BASE).replace(/\/+$/, "");
  base = base.replace(/\/responses$/, ""); // 防止直接传入 responses 路径
  return `${base}/models`;
};

const assertApiKey = (config: DeyunAIConfig) => {
  const envKey =
    (typeof import.meta !== "undefined"
      ? (import.meta.env.VITE_DEYUNAI_API_KEY || import.meta.env.DEYUNAI_API_KEY)
      : undefined) ||
    (typeof process !== "undefined"
      ? (process.env?.VITE_DEYUNAI_API_KEY || process.env?.DEYUNAI_API_KEY)
      : undefined);

  if (!config.apiKey && !envKey) {
    throw new Error("Missing DeyunAI API key. 请在后端环境变量配置 VITE_DEYUNAI_API_KEY（或 DEYUNAI_API_KEY）。");
  }
  if (!config.apiKey) {
    config.apiKey = envKey!;
  }
};

const extractTextFromChunk = (json: any): string => {
  const choice = json?.choices?.[0];
  if (!choice) return "";
  const delta = choice.delta || choice.message;
  const content = delta?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) => part?.text || part?.content || "")
      .join("");
  }
  return "";
};

const collectToolCalls = (data: any): DeyunAIToolCall[] => {
  const calls: DeyunAIToolCall[] = [];
  const output = data?.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (item?.type === "function_call") {
        calls.push({
          type: "function",
          name: item.name,
          arguments: typeof item.arguments === "string" ? item.arguments : JSON.stringify(item.arguments || {}),
          callId: item.call_id,
          status: item.status,
        });
      }
    }
  }

  const toolCalls = data?.choices?.[0]?.message?.tool_calls || data?.choices?.[0]?.delta?.tool_calls;
  if (Array.isArray(toolCalls)) {
    for (const tc of toolCalls) {
      if (tc?.type === "function") {
        calls.push({
          type: "function",
          name: tc.function?.name || "",
          arguments: typeof tc.function?.arguments === "string" ? tc.function.arguments : JSON.stringify(tc.function?.arguments || {}),
          callId: tc.id || tc.call_id,
          status: tc.status,
        });
      }
    }
  }

  return calls;
};

const readStream = async (
  response: Response,
  onDelta?: (text: string, raw: any) => void
): Promise<{ text: string; toolCalls: DeyunAIToolCall[] }> => {
  if (!response.body) throw new Error("Streaming response body missing.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  const toolCalls: DeyunAIToolCall[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.replace(/^data:\s*/, "");
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const deltaText = extractTextFromChunk(json);
        const deltaTools = collectToolCalls(json);
        if (deltaTools.length) {
          toolCalls.push(...deltaTools);
        }
        if (deltaText) {
          fullText += deltaText;
          onDelta?.(deltaText, json);
        }
      } catch {
        // Swallow JSON parse errors per chunk to keep stream flowing.
      }
    }
  }
  return { text: fullText, toolCalls };
};

const postResponse = async <T = any>(
  body: Record<string, any>,
  config: DeyunAIConfig,
  onDelta?: (text: string, raw: any) => void
): Promise<DeyunAIResponse<T>> => {
  assertApiKey(config);
  const endpoint = getEndpoint(config);
  const isStream = Boolean(body.stream);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "script2video://local",
      "X-Title": "Script2Video",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeyunAI API Error ${response.status}: ${errText}`);
  }

  if (isStream) {
    const { text, toolCalls } = await readStream(response, onDelta);
    return { text, raw: null as any, usage: undefined, toolCalls };
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const messageText =
    choice?.message?.content ||
    (Array.isArray(data.output) ? JSON.stringify(data.output) : data.output) ||
    "";

  const toolCalls = collectToolCalls(data);

  return {
    text: typeof messageText === "string" ? messageText : JSON.stringify(messageText),
    raw: data,
    usage: mapUsage(data.usage),
    toolCalls,
    output: data.output,
    choices: data.choices,
  };
};

// 1) 创建网络搜索
export const createWebSearch = async (
  query: string,
  config: DeyunAIConfig,
  options?: {
    model?: string;
    tools?: DeyunAITool[];
    store?: boolean;
    temperature?: number;
  }
): Promise<DeyunAIResponse> => {
  const body = {
    model: options?.model || "gpt-4.1-2025-04-14",
    tools: options?.tools || [{ type: "web_search_preview" }],
    input: query,
    store: options?.store ?? false,
    temperature: options?.temperature ?? 0.7,
  };
  return postResponse(body, config);
};

// 2) 创建模型响应（gpt-5 启用思考）
export const createReasoningResponse = async (
  prompt: string,
  config: DeyunAIConfig,
  options?: {
    model?: string;
    reasoningEffort?: DeyunAIReasoningEffort;
    reasoningSummary?: "auto" | "always" | "never";
    verbosity?: "low" | "medium" | "high";
    stream?: boolean;
    store?: boolean;
    tools?: DeyunAITool[];
  },
  onDelta?: (text: string, raw: any) => void
): Promise<DeyunAIResponse> => {
  const body = {
    model: options?.model || "gpt-5-2025-08-07",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: prompt,
          },
        ],
      },
    ],
    tools: options?.tools || [],
    text: {
      format: { type: "text" },
      verbosity: options?.verbosity || "medium",
    },
    reasoning: {
      effort: options?.reasoningEffort || "medium",
      summary: options?.reasoningSummary || "auto",
    },
    stream: options?.stream ?? true,
    store: options?.store ?? true,
  };
  return postResponse(body, config, onDelta);
};

// 3) / 5) 创建函数调用（并行工具调用）
export const createFunctionCallResponse = async (
  prompt: string,
  tools: DeyunAITool[],
  config: DeyunAIConfig,
  options?: {
    model?: string;
    metadata?: Record<string, any>;
    toolChoice?: "auto" | "none";
    stream?: boolean;
    parallelToolCalls?: boolean;
  },
  onDelta?: (text: string, raw: any) => void
): Promise<DeyunAIResponse> => {
  const body = {
    input: [
      {
        role: "user",
        content: prompt,
      },
    ],
    metadata: options?.metadata,
    model: options?.model || "gpt-4.1",
    tool_choice: options?.toolChoice || "auto",
    tools,
    parallel_tool_calls: options?.parallelToolCalls ?? true,
    stream: options?.stream ?? false,
  };
  return postResponse(body, config, onDelta);
};

// 4) 创建模型响应（纯文本）
export const createModelResponse = async (
  prompt: string,
  config: DeyunAIConfig,
  options?: {
    model?: string;
    temperature?: number;
    store?: boolean;
    tools?: DeyunAITool[];
  }
): Promise<DeyunAIResponse> => {
  const body = {
    model: options?.model || "gpt-5.1",
    input: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: options?.temperature ?? 0.7,
    store: options?.store ?? false,
    tools: options?.tools,
  };
  return postResponse(body, config);
};

// 6) 创建模型响应（流式返回）
export const createStreamingModelResponse = async (
  prompt: string,
  config: DeyunAIConfig,
  options?: {
    model?: string;
    temperature?: number;
    tools?: DeyunAITool[];
  },
  onDelta?: (text: string, raw: any) => void
): Promise<DeyunAIResponse> => {
  const body = {
    model: options?.model || "gpt-4.1",
    stream: true,
    input: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: options?.temperature ?? 0.7,
    tools: options?.tools,
  };
  return postResponse(body, config, onDelta);
};

export const fetchModels = async (
  config: DeyunAIConfig
): Promise<DeyunAIModelMeta[]> => {
  assertApiKey(config);
  const endpoint = getModelsEndpoint(config);
  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "script2video://local",
        "X-Title": "Script2Video",
      },
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`DeyunAI models error ${res.status}: ${msg}`);
    }
    const data = await res.json();
    const models =
      (Array.isArray(data) && data) ||
      data.data ||
      data.models ||
      data.result ||
      data.items ||
      [];
    return models
      .map((m: any) => ({
        id: m.id || m.model || "",
        root: m.root,
        description: m.description,
        modalities: m.modalities || m.capabilities?.modalities || m.supports || [],
        capabilities: m.capabilities || m.metadata || {},
      }))
      .filter((m: any) => m.id);
  } catch (e: any) {
    console.error("DeyunAI models fetch failed:", e);
    throw e;
  }
};

// 7) 创建模型响应（控制思考长度）
export const createControlledReasoningResponse = async (
  prompt: string,
  config: DeyunAIConfig,
  options?: {
    model?: string;
    effort?: DeyunAIReasoningEffort;
    temperature?: number;
    store?: boolean;
  }
): Promise<DeyunAIResponse> => {
  const body = {
    model: options?.model || "gpt-5.1",
    input: [
      {
        role: "user",
        content: prompt,
      },
    ],
    reasoning: {
      effort: options?.effort || "high",
    },
    temperature: options?.temperature ?? 0.7,
    store: options?.store ?? false,
  };
  return postResponse(body, config);
};
