
import { MultimodalConfig, TokenUsage } from "../types";

export interface ImageTaskSubmissionResult {
    id: string;
}

export interface ImageTaskStatusResult {
    id: string;
    status: 'queued' | 'processing' | 'succeeded' | 'failed';
    url?: string;
    errorMsg?: string;
}

/**
 * SUBMIT IMAGE TASK
 * Sends the generation request to NanoBanana-pro.
 */
export const submitImageTask = async (
    prompt: string,
    config: MultimodalConfig,
    options?: {
        aspectRatio?: string;
    }
): Promise<ImageTaskSubmissionResult> => {
    const { baseUrl, apiKey } = config;

    if (!apiKey) {
        throw new Error("Missing Wuyinkeji API Key.");
    }

    // Wuyinkeji image gen endpoint
    // Even if baseUrl is provided, we might want to default to the known endpoint if it's 'wuyinkeji' provider
    const endpoint = baseUrl || "https://api.wuyinkeji.com/api/img/nanoBanana-pro";
    const urlObj = new URL(endpoint);

    // Attach key if not present in URL (some adapters use query param)
    if (!urlObj.searchParams.get('key')) {
        urlObj.searchParams.set('key', apiKey);
    }

    const formBody = new URLSearchParams();
    formBody.append('prompt', prompt);
    formBody.append('aspectRatio', options?.aspectRatio || '1:1');

    try {
        console.log("--- [Phase 4] Submit Image Task (Wuyinkeji) ---");
        const response = await fetch(urlObj.toString(), {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset:utf-8;",
                "Authorization": apiKey // Some endpoints use only the key as auth
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

        const taskId = data.data?.id || data.id;
        if (!taskId) throw new Error("No Task ID returned.");

        return { id: taskId };

    } catch (error: any) {
        console.error("Image Submission Failed:", error);
        throw error;
    }
};

/**
 * CHECK IMAGE TASK STATUS
 * Single poll to check status of an image task.
 */
export const checkImageTaskStatus = async (
    taskId: string,
    config: MultimodalConfig
): Promise<ImageTaskStatusResult> => {
    const { baseUrl, apiKey } = config;

    // Construct Poll URL
    // Wuyinkeji usually uses /detail for polling, similar to video
    const rootBase = (baseUrl || "https://api.wuyinkeji.com/api/img/nanoBanana-pro").replace(/\/(nanoBanana-pro|submit)\/?$/, '');
    const detailUrl = new URL(`${rootBase}/detail`);
    detailUrl.searchParams.set('id', taskId);
    if (!detailUrl.searchParams.get('key')) {
        detailUrl.searchParams.set('key', apiKey);
    }

    try {
        const response = await fetch(detailUrl.toString(), {
            method: "GET",
            headers: {
                "Authorization": apiKey
            }
        });

        if (!response.ok) {
            throw new Error(`Poll Error ${response.status}`);
        }

        const data = await response.json();

        if (data.code !== undefined) {
            // Mapping Wuyinkeji internal status
            // 0: Queued, 1: Success, 2: Failed, 3: Processing
            const d = data.data;
            if (!d) return { id: taskId, status: 'processing' };

            const s = d.status;

            if (s === 1) {
                const finalUrl = d.remote_url || d.img_url || d.url;
                if (finalUrl) return { id: taskId, status: 'succeeded', url: finalUrl };
            }

            if (s === 2) {
                return { id: taskId, status: 'failed', errorMsg: d.fail_reason || "Unknown failure" };
            }

            if (s === 0) return { id: taskId, status: 'queued' };

            return { id: taskId, status: 'processing' };
        }

        return { id: taskId, status: 'processing' };

    } catch (e: any) {
        console.warn("Check status warning:", e);
        return { id: taskId, status: 'processing' };
    }
};
