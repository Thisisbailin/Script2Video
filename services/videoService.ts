import { VideoServiceConfig, VideoParams } from "../types";
import { wrapWithProxy } from "../utils/api";

// Standard OpenAI/Sora 2 response structures
interface ModelListResponse {
    data: {
        id: string;
        object: string;
    }[];
}

// Return type for our service functions
interface TaskSubmissionResult {
    id: string;
}

export interface TaskStatusResult {
    id: string;
    status: 'queued' | 'processing' | 'succeeded' | 'failed';
    url?: string;
    progress?: number;
    errorMsg?: string;
}

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

const resolveVideoApiKey = (baseUrl: string, apiKey: string) => {
    if (apiKey) return apiKey;
    if (baseUrl.includes("dashscope.aliyuncs.com")) {
        return resolveQwenApiKey();
    }
    return "";
};

export const fetchModels = async (baseUrl: string, apiKey: string): Promise<string[]> => {
    if (!baseUrl) return [];

    const resolvedApiKey = resolveVideoApiKey(baseUrl, apiKey);
    if (!resolvedApiKey) return [];

    let apiBase = baseUrl.trim().replace(/\/+$/, '');

    // Submit-only endpoints cannot fetch models
    if (apiBase.match(/(submit|generations|videos)$/)) {
        throw new Error("Cannot fetch models from a submission endpoint. Please use the root API URL.");
    }

    if (!apiBase.endsWith('/v1')) {
        apiBase = `${apiBase}/v1`;
    }

    try {
        const response = await fetch(wrapWithProxy(`${apiBase}/models`), {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${resolvedApiKey}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Failed to fetch models: ${response.status} ${err}`);
        }

        const data: ModelListResponse = await response.json();
        if (data.data && Array.isArray(data.data)) {
            return data.data.map(m => m.id);
        }
        return [];
    } catch (e) {
        console.error("Error fetching models", e);
        throw e; // Re-throw to UI
    }
};

/**
 * SUBMIT TASK
 * Sends the generation request and returns the Task ID immediately.
 */
export const submitVideoTask = async (
    prompt: string,
    config: VideoServiceConfig,
    params?: VideoParams
): Promise<TaskSubmissionResult> => {
    const { baseUrl, apiKey } = config;
    const resolvedApiKey = resolveVideoApiKey(baseUrl, apiKey);

    if (!baseUrl || !resolvedApiKey) {
        throw new Error("Missing Video API Configuration.");
    }

    // --- MODEL DETECTION LOGIC ---
    // Detect if URL is Sora 2 Pro or Standard based on URL pattern
    const isSora2Pro = baseUrl.includes('/sora2pro');
    const isWuyinSora2 = baseUrl.includes('wuyinkeji.com') || baseUrl.includes('/api/sora2');

    console.log(`--- [Phase 5] Submit Task ---`);
    console.log(`URL: ${baseUrl}, Detected Model: ${isSora2Pro ? 'Sora 2 Pro' : 'Sora 2 (Standard)'}`);

    // Construct Endpoint
    const urlObj = new URL(baseUrl.trim());
    if (isWuyinSora2 && !urlObj.searchParams.get('key')) {
        urlObj.searchParams.set('key', resolvedApiKey);
    }

    // Map Body Params
    const formBody = new URLSearchParams();
    formBody.append('prompt', prompt);
    formBody.append('aspectRatio', params?.aspectRatio || '16:9');

    const durationInt = params?.duration ? parseInt(params.duration.replace('s', ''), 10) : 10;
    formBody.append('duration', durationInt.toString());

    // Only append 'size' if NOT Pro model
    if (!isSora2Pro) {
        const sizeVal = params?.quality === 'high' ? 'large' : 'small';
        formBody.append('size', sizeVal);
    }

    if (params?.inputImageUrl && !params.inputImageUrl.startsWith('data:')) {
        formBody.append(isWuyinSora2 ? 'url' : 'imageUrl', params.inputImageUrl);
    }

    // Input Image (If supported by endpoint - standard OpenAI video doesn't usually take form data like this, 
    // but Wuyin/Sora adapters might. Assuming text-to-video for now mostly, 
    // but if inputImage exists we might need multipart/form-data. 
    // For this specific API (Wuyin), it usually takes 'imageUrl' string or base64. 
    // Since we are using x-www-form-urlencoded, we can't easily upload file directly here without logic change.
    // For now, we skip image upload in this specific implementation unless we add an image upload service first.

    try {
        const response = await fetch(wrapWithProxy(urlObj.toString()), {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset:utf-8;",
                "Authorization": isWuyinSora2 ? resolvedApiKey : `Bearer ${resolvedApiKey}`
            },
            body: formBody
        });

        const text = await response.text();
        if (!response.ok) throw new Error(`API Error ${response.status}: ${text}`);

        let data;
        try { data = JSON.parse(text); } catch (e) { throw new Error("Failed to parse API response."); }

        // Provider Error Check
        if (data.code !== undefined && data.code !== 200) {
            throw new Error(`Provider Error (${data.code}): ${data.msg}`);
        }

        const videoId = data.data?.id || data.id;
        if (!videoId) throw new Error("No Video ID returned.");

        return { id: videoId };

    } catch (error: any) {
        console.error("Video Submission Failed:", error);
        throw error;
    }
};

/**
 * CHECK STATUS
 * Single poll to check status of a task.
 */
export const checkTaskStatus = async (
    taskId: string,
    config: VideoServiceConfig
): Promise<TaskStatusResult> => {
    const { baseUrl, apiKey } = config;
    const resolvedApiKey = resolveVideoApiKey(baseUrl, apiKey);
    if (!baseUrl || !resolvedApiKey) {
        return { id: taskId, status: 'failed', errorMsg: 'Missing Video API Configuration.' };
    }

    // Construct Poll URL
    let pollUrl = '';
    const isWuyinSora2 = baseUrl.includes('wuyinkeji.com') || baseUrl.includes('/api/sora2');
    // Detect Wuyinkeji pattern for Polling
    if (isWuyinSora2 || baseUrl.includes('/sora2')) {
        const rootBase = baseUrl.replace(/\/submit\/?$/, '');
        const detailUrl = new URL(`${rootBase}/detail`);
        detailUrl.searchParams.set('id', taskId);
        if (isWuyinSora2 && !detailUrl.searchParams.get('key')) {
            detailUrl.searchParams.set('key', resolvedApiKey);
        }
        pollUrl = detailUrl.toString();
    } else {
        // Standard OpenAI
        const apiBase = baseUrl.replace(/\/submit\/?$/, '').replace(/\/+$/, '');
        pollUrl = `${apiBase}/videos/${taskId}`;
    }

    try {
        const headers: any = {
            "Content-Type": isWuyinSora2 ? "application/x-www-form-urlencoded;charset:utf-8;" : "application/json",
            "Authorization": isWuyinSora2 ? resolvedApiKey : `Bearer ${resolvedApiKey}`
        };

        const response = await fetch(wrapWithProxy(pollUrl), { method: "GET", headers });

        if (!response.ok) {
            if (response.status === 404) {
                // 404 in standard OpenAI often means "processing, not ready"
                return { id: taskId, status: 'processing' };
            }
            throw new Error(`Poll Error ${response.status}`);
        }

        const data = await response.json();

        // --- WUYIN KEJI / SORA 2 ADAPTER PARSING ---
        if (data.code !== undefined) {
            // data.data.status: 
            // 0: 排队中 (Queued)
            // 1: 成功 (Success)
            // 2: 失败 (Failed)
            // 3: 生成中 (Processing)

            const d = data.data;
            if (!d) return { id: taskId, status: 'processing' }; // No data usually means initializing

            const s = d.status;

            if (s === 1) {
                const finalUrl = d.remote_url || d.video_url || d.url;
                if (finalUrl) return { id: taskId, status: 'succeeded', url: finalUrl };
            }

            if (s === 2) {
                return { id: taskId, status: 'failed', errorMsg: d.fail_reason || "Unknown failure" };
            }

            if (s === 0) {
                return { id: taskId, status: 'queued' };
            }

            if (s === 3) {
                return { id: taskId, status: 'processing', progress: d.progress }; // Some APIs return progress
            }

            // Fallback if status is unknown integer
            return { id: taskId, status: 'processing' };
        }

        // --- STANDARD OPENAI PARSING ---
        const status = data.status || data.data?.status;
        if (status === 'succeeded' || status === 'success') {
            const url = data.data?.video_url || data.video_url || '';
            return { id: taskId, status: 'succeeded', url };
        }
        if (status === 'failed') {
            return { id: taskId, status: 'failed', errorMsg: data.error?.message };
        }

        return { id: taskId, status: 'processing' };

    } catch (e: any) {
        // If network glitch, treat as processing to keep retrying
        console.warn("Check status warning:", e);
        return { id: taskId, status: 'processing' };
    }
};

// Legacy single-call (not used in new flow but kept for compatibility)
export const generateVideo = async (
    prompt: string,
    config: VideoServiceConfig,
    params?: VideoParams
): Promise<{ id: string, url: string }> => {
    throw new Error("Please use submitVideoTask for async generation.");
};

export const remixVideo = async (
    originalVideoId: string,
    prompt: string,
    config: VideoServiceConfig
): Promise<TaskSubmissionResult> => {
    // Remix logic is identical to submit usually, just different params
    // For this specific API adapter, remix might need a different endpoint or param
    // Assuming standard flow isn't fully supported by the adapter based on docs provided, 
    // but we will treat it as a task submission.
    // If the API supports remix via a specific parameter (like `remixTargetId`), add it here.

    // Placeholder: Treating remix as a new submission for now as per limited doc.
    // In a real scenario, we'd add `parent_video_id` to body.
    return submitVideoTask(prompt, config);
};
