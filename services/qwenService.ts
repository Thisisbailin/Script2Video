import { TextServiceConfig, TokenUsage } from "../types";

export type QwenMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type QwenChatOptions = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  stream?: boolean;
  responseFormat?: "json_object" | "text";
};

const DEFAULT_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1";

const resolveApiKey = (config?: QwenChatOptions | Partial<TextServiceConfig>) => {
  const envKey = 
    (typeof import.meta !== "undefined"
      ? (import.meta.env.QWEN_API_KEY || import.meta.env.VITE_QWEN_API_KEY)
      : undefined) ||
    (typeof process !== "undefined"
      ? (process.env?.QWEN_API_KEY || process.env?.VITE_QWEN_API_KEY)
      : undefined);
  const key = (config?.apiKey || (config as any)?.textApiKey || envKey || "").trim();
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

const resolveModelsEndpoint = () => {
  let base = DEFAULT_BASE.replace(/\/+$/, "");
  base = base.replace(/\/chat\/completions$/, "");
  if (base.endsWith("/models")) return base;
  if (base.endsWith("/v1")) return `${base}/models`;
  return `${base}/v1/models`;
};

export type QwenModel = { id: string; object?: string } & Record<string, any>;

export const fetchModels = async (
  options?: QwenChatOptions
): Promise<QwenModel[]> => {
  const apiKey = resolveApiKey(options);
  const endpoint = resolveModelsEndpoint();

  const res = await fetch(endpoint, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Qwen models fetch failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  if (Array.isArray(data?.data)) return data.data as QwenModel[];
  if (Array.isArray(data?.models)) return data.models as QwenModel[];
  return [];
};

export const chatCompletion = async (
  messages: QwenMessage[],
  options?: QwenChatOptions
): Promise<{ text: string; usage?: TokenUsage; raw: any }> => {
  const apiKey = resolveApiKey(options);
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

  const res = await fetch(endpoint, {
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
