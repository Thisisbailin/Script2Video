import { TextServiceConfig, TokenUsage } from "../types";
import { wrapWithProxy } from "../utils/api";

export type QwenMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type QwenChatOptions = {
  baseUrl?: string;
  model?: string;
  stream?: boolean;
  responseFormat?: "json_object" | "text";
};

const DEFAULT_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1";

const resolveApiKey = () => {
  const envKey =
    (typeof import.meta !== "undefined"
      ? (import.meta.env.QWEN_API_KEY || import.meta.env.VITE_QWEN_API_KEY)
      : undefined) ||
    (typeof process !== "undefined"
      ? (process.env?.QWEN_API_KEY || process.env?.VITE_QWEN_API_KEY)
      : undefined);
  const key = (envKey || "").trim();
  if (!key) throw new Error("Missing Qwen API key. 请在环境变量 QWEN_API_KEY/VITE_QWEN_API_KEY 配置。");
  return key;
};

const resolveEndpoint = () => {
  const base = DEFAULT_BASE.replace(/\/+$/, "");
  if (base.endsWith("/chat/completions")) return base;
  if (base.endsWith("/v1")) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
};

const mapUsage = (usage: any): TokenUsage | undefined => {
  if (!usage) return undefined;
  const promptTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
  const responseTokens = usage.completion_tokens ?? usage.output_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? promptTokens + responseTokens;
  return { promptTokens, responseTokens, totalTokens };
};

const flattenContent = (content: any): string => {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        if (part?.type === "text" && typeof part?.text === "string") return part.text;
        return "";
      })
      .filter(Boolean)
      .join("");
  }
  if (typeof content === "object") {
    if (typeof content.content === "string") return content.content;
    if (typeof content.text === "string") return content.text;
  }
  return "";
};

const resolveModelsEndpoint = (baseUrl?: string) => {
  let base = (baseUrl || DEFAULT_BASE).trim().replace(/\/+$/, "");
  if (base.endsWith("/chat/completions")) {
    return base.replace(/\/chat\/completions$/, "/models");
  }
  if (base.endsWith("/generation")) {
    return base.replace(/\/generation$/, "/models");
  }
  if (base.endsWith("/video-synthesis")) {
    return base.replace(/\/video-synthesis$/, "/models");
  }
  if (base.endsWith("/models")) return base;
  if (base.endsWith("/v1")) return `${base}/models`;
  return `${base}/models`;
};

export type QwenModel = {
  id: string;
  object?: string;
  owned_by?: string;
  name?: string;
  description?: string;
  modalities?: string[];
  capabilities?: Record<string, any>;
  context_length?: number;
} & Record<string, any>;

export const fetchModels = async (
  baseUrl?: string
): Promise<{ models: QwenModel[]; raw: any }> => {
  const apiKey = resolveApiKey();
  const endpoint = resolveModelsEndpoint(baseUrl);

  const res = await fetch(wrapWithProxy(endpoint), {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Qwen models fetch failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  const models =
    (Array.isArray(data?.data) && data.data) ||
    (Array.isArray(data?.models) && data.models) ||
    (Array.isArray(data?.result) && data.result) ||
    [];
  const mapped = models
    .map((model: any) => ({
      ...model,
      id: model.id || model.model || model.name || model?.data?.id || "",
    }))
    .filter((model: QwenModel) => model.id);
  return { models: mapped, raw: data };
};

export const chatCompletion = async (
  messages: QwenMessage[],
  options?: QwenChatOptions
): Promise<{ text: string; usage?: TokenUsage; raw: any }> => {
  const apiKey = resolveApiKey();
  const endpoint = resolveEndpoint();
  const model = options?.model || "qwen-plus";
  const responseFormat =
    options?.responseFormat === "json_object" ? { type: "json_object" } : undefined;

  const body: any = {
    model,
    messages,
  };
  if (responseFormat) {
    body.response_format = responseFormat;
  }
  if (options?.stream) {
    body.stream = true;
  }

  const res = await fetch(wrapWithProxy(endpoint), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Qwen request failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const choice = data?.choices?.[0];
  const content = choice?.message?.content ?? choice?.delta?.content ?? "";
  const text = flattenContent(content);

  return {
    text,
    usage: mapUsage(data?.usage),
    raw: data,
  };
};
