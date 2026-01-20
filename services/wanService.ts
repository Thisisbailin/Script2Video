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
  const choiceContent = output?.choices?.[0]?.message?.content || output?.choices?.[0]?.content;
  if (Array.isArray(choiceContent)) {
    const imagePart = choiceContent.find((part: any) => part?.type === "image" && part?.image);
    if (imagePart?.image) return imagePart.image;
  }
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
  options?: {
    aspectRatio?: string;
    inputImageUrl?: string;
    inputImages?: string[];
    negativePrompt?: string;
    enableInterleave?: boolean;
    outputCount?: number;
    maxImages?: number;
    seed?: number;
    promptExtend?: boolean;
    watermark?: boolean;
    size?: string;
  }
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
  const hasImages = images.length > 0;
  const enableInterleave =
    typeof options?.enableInterleave === "boolean" ? options.enableInterleave : !hasImages;
  let finalImages = images.slice();
  if (enableInterleave && finalImages.length > 1) {
    finalImages = finalImages.slice(0, 1);
  }
  if (!enableInterleave) {
    if (finalImages.length === 0) {
      throw new Error("Wan 图像编辑模式需要至少 1 张参考图。");
    }
    if (finalImages.length > 4) {
      finalImages = finalImages.slice(0, 4);
    }
  }
  const content: Array<{ text?: string; image?: string }> = [];
  if (prompt) {
    content.push({ text: prompt });
  }
  finalImages.forEach((image) => {
    if (image) content.push({ image });
  });

  const outputCount = Math.max(1, Math.min(4, options?.outputCount ?? 1));
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
      prompt_extend: options?.promptExtend ?? true,
      watermark: options?.watermark ?? false,
      n: outputCount,
      enable_interleave: enableInterleave,
      size: options?.size || resolveSize(options?.aspectRatio),
      ...(options?.negativePrompt ? { negative_prompt: options.negativePrompt } : {}),
      ...(options?.maxImages ? { max_images: options.maxImages } : {}),
      ...(Number.isFinite(options?.seed) ? { seed: options?.seed } : {}),
    },
  };

  return requestWanTask(endpoint, apiKey, payload, { async: false });
};

export const submitWanVideoTask = async (
  prompt: string,
  config: VideoServiceConfig,
  options?: {
    aspectRatio?: string;
    duration?: string;
    inputImageUrl?: string;
    size?: string;
    negativePrompt?: string;
    seed?: number;
    watermark?: boolean;
    promptExtend?: boolean;
    shotType?: "single" | "multi";
    audioUrl?: string;
  }
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
  const parameters: Record<string, any> = {
    prompt_extend: options?.promptExtend ?? true,
    shot_type: options?.shotType || "multi",
    watermark: options?.watermark ?? false,
    ...(options?.negativePrompt ? { negative_prompt: options.negativePrompt } : {}),
    ...(Number.isFinite(options?.seed) ? { seed: options?.seed } : {}),
    ...(Number.isFinite(duration) ? { duration } : {}),
  };
  if (options?.size) {
    parameters.size = options.size;
  }

  const payload: Record<string, any> = {
    model: config.model,
    input: {
      prompt,
    },
    parameters,
  };

  if (options?.inputImageUrl) {
    payload.input.img_url = options.inputImageUrl;
  }
  if (options?.audioUrl) {
    payload.input.audio_url = options.audioUrl;
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
