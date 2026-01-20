import { MultimodalConfig, VideoServiceConfig } from "../types";
import { wrapWithProxy } from "../utils/api";
import { QWEN_WAN_IMAGE_ENDPOINT, QWEN_WAN_VIDEO_ENDPOINT } from "../constants";

export interface WanTaskSubmissionResult {
  id?: string;
  url?: string;
}

export interface WanTaskStatusResult {
  id: string;
  status: "queued" | "processing" | "succeeded" | "failed";
  url?: string;
  errorMsg?: string;
}

const TASK_STATUS_ENDPOINT = "https://dashscope.aliyuncs.com/api/v1/tasks";

const resolveQwenApiKey = () => {
  const envKey =
    (typeof import.meta !== "undefined"
      ? (import.meta.env.QWEN_API_KEY || import.meta.env.VITE_QWEN_API_KEY)
      : undefined) ||
    (typeof process !== "undefined"
      ? (process.env?.QWEN_API_KEY || process.env?.VITE_QWEN_API_KEY)
      : undefined);
  return (envKey || "").trim();
};

const resolveSize = (aspectRatio?: string) => {
  const normalized = (aspectRatio || "1:1").trim();
  const predefined: Record<string, [number, number]> = {
    "1:1": [1024, 1024],
    "16:9": [1280, 720],
    "9:16": [720, 1280],
    "4:3": [1024, 768],
    "3:4": [768, 1024],
    "21:9": [1536, 640],
  };
  const mapped = predefined[normalized];
  if (mapped) return `${mapped[0]}*${mapped[1]}`;
  if (/^\d+\s*[*x]\s*\d+$/i.test(normalized)) {
    return normalized.replace("x", "*").replace(/\s+/g, "");
  }
  return "1024*1024";
};

const mapStatus = (status?: string) => {
  const value = (status || "").toLowerCase();
  if (["succeeded", "success", "completed", "finished"].includes(value)) return "succeeded";
  if (["failed", "error", "canceled", "cancelled"].includes(value)) return "failed";
  if (["pending", "queued"].includes(value)) return "queued";
  return "processing";
};

const extractUrl = (payload: any) => {
  const output = payload?.output || payload?.data || payload?.result || payload;
  const result = output?.results?.[0] || output?.result?.[0] || output?.result || output?.results;
  return (
    result?.url ||
    result?.image_url ||
    result?.video_url ||
    output?.video_url ||
    output?.image_url ||
    output?.url ||
    payload?.url
  );
};

const requestWanTask = async (
  endpoint: string,
  apiKey: string,
  payload: Record<string, any>,
  options?: { async?: boolean }
) => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (options?.async) {
    headers["X-DashScope-Async"] = "enable";
  }

  const response = await fetch(wrapWithProxy(endpoint), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Wan API Error ${response.status}: ${text}`);
  }

  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  const taskId =
    data?.output?.task_id ||
    data?.output?.taskId ||
    data?.task_id ||
    data?.taskId ||
    data?.id;
  const url = extractUrl(data);
  return { id: taskId, url };
};

export const submitWanImageTask = async (
  prompt: string,
  config: MultimodalConfig,
  options?: { aspectRatio?: string; inputImageUrl?: string; inputImages?: string[] }
): Promise<WanTaskSubmissionResult> => {
  const apiKey = resolveQwenApiKey();
  if (!apiKey) {
    throw new Error("Missing Qwen API key. 请在环境变量 QWEN_API_KEY/VITE_QWEN_API_KEY 配置。");
  }
  if (!config.model) {
    throw new Error("Missing Wan image model. 请先选择模型。");
  }

  const endpoint = config.baseUrl || QWEN_WAN_IMAGE_ENDPOINT;
  const images = options?.inputImages || (options?.inputImageUrl ? [options.inputImageUrl] : []);
  const content: Array<{ text?: string; image?: string }> = [];
  if (prompt) {
    content.push({ text: prompt });
  }
  images.forEach((image) => {
    if (image) content.push({ image });
  });

  const payload: Record<string, any> = {
    model: config.model,
    input: {
      messages: [
        {
          role: "user",
          content,
        },
      ],
    },
    parameters: {
      prompt_extend: true,
      watermark: false,
      n: 1,
      enable_interleave: false,
      size: resolveSize(options?.aspectRatio),
    },
  };

  return requestWanTask(endpoint, apiKey, payload, { async: false });
};

export const submitWanVideoTask = async (
  prompt: string,
  config: VideoServiceConfig,
  options?: { aspectRatio?: string; duration?: string; inputImageUrl?: string; resolution?: string }
): Promise<WanTaskSubmissionResult> => {
  const apiKey = resolveQwenApiKey();
  if (!apiKey) {
    throw new Error("Missing Qwen API key. 请在环境变量 QWEN_API_KEY/VITE_QWEN_API_KEY 配置。");
  }
  if (!config.model) {
    throw new Error("Missing Wan video model. 请先选择模型。");
  }

  const endpoint = config.baseUrl || QWEN_WAN_VIDEO_ENDPOINT;
  const duration = options?.duration ? Number.parseInt(options.duration.replace("s", ""), 10) : undefined;
  const resolution = options?.resolution || "720P";
  const payload: Record<string, any> = {
    model: config.model,
    input: {
      prompt,
    },
    parameters: {
      resolution,
      prompt_extend: true,
      shot_type: "multi",
      ...(Number.isFinite(duration) ? { duration } : {}),
    },
  };

  if (options?.inputImageUrl) {
    payload.input.img_url = options.inputImageUrl;
  }

  return requestWanTask(endpoint, apiKey, payload, { async: true });
};

export const checkWanTaskStatus = async (taskId: string): Promise<WanTaskStatusResult> => {
  const apiKey = resolveQwenApiKey();
  if (!apiKey) {
    return { id: taskId, status: "failed", errorMsg: "Missing Qwen API key." };
  }

  const endpoint = `${TASK_STATUS_ENDPOINT}/${taskId}`;
  try {
    const response = await fetch(wrapWithProxy(endpoint), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!response.ok) {
      if (response.status === 404) return { id: taskId, status: "processing" };
      const err = await response.text();
      return { id: taskId, status: "failed", errorMsg: err || `Status Error ${response.status}` };
    }
    const data = await response.json();
    const output = data?.output || data;
    const statusRaw = output?.task_status || output?.status || data?.status;
    const status = mapStatus(statusRaw);
    const url = extractUrl(data);
    const errorMsg = output?.message || output?.error || data?.message;
    return { id: taskId, status, url, errorMsg };
  } catch (e: any) {
    return { id: taskId, status: "processing", errorMsg: e.message };
  }
};
