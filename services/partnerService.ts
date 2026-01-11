import { TextServiceConfig, TokenUsage } from "../types";

const resolvePartnerApiKey = (config: TextServiceConfig): string => {
  const envKey =
    (typeof import.meta !== "undefined"
      ? (import.meta.env.VITE_PARTNER_API_KEY || import.meta.env.PARTNER_API_KEY)
      : undefined) ||
    (typeof process !== "undefined" ? (process.env?.PARTNER_API_KEY || process.env?.VITE_PARTNER_API_KEY) : undefined);
  const configKey = config.apiKey?.trim();
  const apiKey = envKey || configKey;
  if (!apiKey) {
    throw new Error("Partner API key missing. 请在环境变量 PARTNER_API_KEY / VITE_PARTNER_API_KEY 配置。");
  }
  return apiKey;
};

const resolvePartnerBase = (config: TextServiceConfig): string => {
  const envBase =
    (typeof import.meta !== "undefined" ? import.meta.env.VITE_PARTNER_API_BASE : undefined) ||
    (typeof process !== "undefined" ? process.env?.PARTNER_API_BASE : undefined);
  const base = (config.baseUrl || envBase || "").trim().replace(/\/+$/, "");
  if (!base) {
    throw new Error("Partner API base URL missing. 请配置 PARTNER_API_BASE / VITE_PARTNER_API_BASE。");
  }
  return base.endsWith("/v1/chat/completions") ? base : `${base}/v1/chat/completions`;
};

export const generatePartnerText = async (
  config: TextServiceConfig,
  messages: Array<{ role: string; content: string }>,
  modelFallback = "partner-text-pro"
): Promise<{ text: string; usage: TokenUsage }> => {
  const apiKey = resolvePartnerApiKey(config);
  const apiBase = resolvePartnerBase(config);
  const model = config.model || modelFallback;

  const response = await fetch(apiBase, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Partner-Integration": "Qalam-NodeLab",
      "X-Client-App": "Script2Video",
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Partner API Error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";

  return {
    text: content,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      responseTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
  };
};

export const fetchPartnerModels = async (config: TextServiceConfig): Promise<string[]> => {
  const apiKey = resolvePartnerApiKey(config);
  let apiBase = resolvePartnerBase(config).replace("/chat/completions", "");
  if (!apiBase.endsWith("/v1")) {
    apiBase = apiBase.replace(/\/v1$/, "") + "/v1";
  }
  try {
    const res = await fetch(`${apiBase}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Partner-Integration": "Qalam-NodeLab",
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data?.map((m: any) => m.id) || [];
  } catch (e) {
    console.error("Partner models fetch error", e);
    return [];
  }
};
