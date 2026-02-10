import { AgentTool, AgentToolCall } from "./toolingTypes";
import type { TokenUsage } from "../types";
import { wrapWithProxy } from "../utils/api";

export interface QwenResponsesConfig {
  apiKey?: string;
  baseUrl?: string;
}

export interface QwenResponsesOptions {
  model?: string;
  tools?: AgentTool[];
  toolChoice?: "auto" | "none";
  parallelToolCalls?: boolean;
  inputItems?: any[];
  inputContent?: Array<{
    type: "input_text";
    text: string;
  }>;
}

export interface QwenResponsesResult<T = any> {
  text: string;
  usage?: TokenUsage;
  raw: T;
  toolCalls?: AgentToolCall[];
}

const DEFAULT_BASE = "https://dashscope-intl.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1";

const resolveApiKey = (config: QwenResponsesConfig) => {
  const envKey =
    (typeof import.meta !== "undefined"
      ? (import.meta.env.QWEN_API_KEY || import.meta.env.VITE_QWEN_API_KEY)
      : undefined) ||
    (typeof process !== "undefined"
      ? (process.env?.QWEN_API_KEY || process.env?.VITE_QWEN_API_KEY)
      : undefined);
  const key = (config.apiKey || envKey || "").trim();
  if (!key) throw new Error("Missing Qwen API key. 请配置 QWEN_API_KEY/VITE_QWEN_API_KEY 或在设置中填写。");
  return key;
};

const resolveEndpoint = (baseUrl?: string) => {
  const base = (baseUrl || DEFAULT_BASE).trim().replace(/\/+$/, "");
  if (base.endsWith("/responses")) return base;
  return `${base}/responses`;
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
        if (part?.type === "output_text" && typeof part?.text === "string") return part.text;
        return "";
      })
      .filter(Boolean)
      .join("");
  }
  if (typeof content === "object") {
    if (typeof content.text === "string") return content.text;
    if (typeof content.content === "string") return content.content;
  }
  return "";
};

const collectToolCalls = (data: any): AgentToolCall[] => {
  const calls: AgentToolCall[] = [];
  const pushFromItem = (item: any) => {
    if (!item) return;
    const itemType = typeof item?.type === "string" ? item.type : "";
    const name = item?.name || item?.function?.name || item?.tool?.name || "";
    const isFunction =
      itemType === "function_call" ||
      itemType === "tool_call" ||
      itemType === "function" ||
      Boolean(name && (item?.arguments || item?.function?.arguments || item?.tool?.arguments));
    if (!isFunction || !name) return;
    const rawArgs = item?.arguments ?? item?.function?.arguments ?? item?.tool?.arguments ?? {};
    const args = typeof rawArgs === "string" ? rawArgs : JSON.stringify(rawArgs || {});
    calls.push({
      type: "function",
      name,
      arguments: args,
      callId: item?.call_id || item?.id || item?.tool_call_id,
      status: item?.status,
    });
  };

  const output = data?.output;
  if (Array.isArray(output)) {
    for (const item of output) pushFromItem(item);
  }
  const responseOutput = data?.response?.output;
  if (Array.isArray(responseOutput)) {
    for (const item of responseOutput) pushFromItem(item);
  }
  if (data?.item) pushFromItem(data.item);
  if (data?.output_item) pushFromItem(data.output_item);

  const toolCalls = data?.choices?.[0]?.message?.tool_calls || data?.choices?.[0]?.delta?.tool_calls;
  if (Array.isArray(toolCalls)) {
    for (const tc of toolCalls) {
      if (tc?.type === "function") {
        calls.push({
          type: "function",
          name: tc.function?.name || "",
          arguments:
            typeof tc.function?.arguments === "string"
              ? tc.function.arguments
              : JSON.stringify(tc.function?.arguments || {}),
          callId: tc.id || tc.call_id,
          status: tc.status,
        });
      }
    }
  }

  return calls;
};

const extractText = (data: any): string => {
  const output = data?.output;
  if (Array.isArray(output)) {
    const text = output
      .map((item: any) => {
        if (typeof item?.text === "string") return item.text;
        if (typeof item?.output_text === "string") return item.output_text;
        if (typeof item?.output_text?.text === "string") return item.output_text.text;
        if (Array.isArray(item?.content)) return flattenContent(item.content);
        return "";
      })
      .filter(Boolean)
      .join("");
    if (text) return text;
  }
  const choice = data?.choices?.[0];
  const messageText =
    flattenContent(choice?.message?.content) ||
    flattenContent(data?.output) ||
    (Array.isArray(data?.output) ? JSON.stringify(data.output) : data.output) ||
    "";
  return typeof messageText === "string" ? messageText : JSON.stringify(messageText);
};

export const createQwenResponse = async (
  prompt: string,
  config: QwenResponsesConfig,
  options?: QwenResponsesOptions
): Promise<QwenResponsesResult> => {
  const apiKey = resolveApiKey(config);
  const endpoint = resolveEndpoint(config.baseUrl);
  const inputContent = options?.inputContent?.length
    ? options.inputContent
    : [
        {
          type: "input_text",
          text: prompt,
        },
      ];
  const inputItems =
    options?.inputItems && Array.isArray(options.inputItems) && options.inputItems.length
      ? options.inputItems
      : [
          {
            role: "user",
            content: inputContent,
          },
        ];

  const body: any = {
    model: options?.model || "qwen3-max",
    input: inputItems,
    tools: options?.tools || [],
    tool_choice: options?.toolChoice || (Array.isArray(options?.tools) && options.tools.length ? "auto" : undefined),
    parallel_tool_calls: options?.parallelToolCalls ?? true,
    stream: false,
  };

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
    throw new Error(`Qwen Responses request failed (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return {
    text: extractText(data),
    usage: mapUsage(data?.usage),
    raw: data,
    toolCalls: collectToolCalls(data),
  };
};
