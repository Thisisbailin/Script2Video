import { MultimodalConfig, TokenUsage } from "../types";
import { wrapWithProxy } from "../utils/api";

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
        inputImageUrl?: string;
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
    if (options?.inputImageUrl) {
        formBody.append('url', options.inputImageUrl);
    }

    try {
        console.log("--- [Phase 4] Submit Image Task (Wuyinkeji) ---");
        const response = await fetch(wrapWithProxy(urlObj.toString()), {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset:utf-8;",
                "Authorization": apiKey
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
    // Wuyinkeji often has model-specific detail endpoints.
    // Instead of stripping the model, we only strip '/submit' if present.
    let rootBase = baseUrl || "https://api.wuyinkeji.com/api/img/nanoBanana-pro";
    rootBase = rootBase.replace(/\/submit\/?$/, '').replace(/\/+$/, '');

    // Fallback: If it's the generic img base, it might need /detail. 
    // If it's a specific model base, it might already be the detail root.
    const pollPath = rootBase.endsWith('/detail') ? rootBase : `${rootBase}/detail`;
    const detailUrl = new URL(pollPath);

    detailUrl.searchParams.set('id', taskId);
    if (!detailUrl.searchParams.get('key')) {
        detailUrl.searchParams.set('key', apiKey);
    }

    try {
        console.log(`[Wuyinkeji] Polling: ${detailUrl.toString()}`);
        let response = await fetch(wrapWithProxy(detailUrl.toString()), {
            method: "GET",
            headers: {
                "Authorization": apiKey,
                "Content-Type": "application/x-www-form-urlencoded;charset:utf-8;"
            }
        });

        // 404 Fallback: try removing model specifics if special track fails
        if (response.status === 404 && pollPath.includes('nanoBanana-pro')) {
            const fallbackBase = rootBase.replace('/nanoBanana-pro', '');
            const fallbackUrl = new URL(`${fallbackBase}/detail`);
            fallbackUrl.searchParams.set('id', taskId);
            fallbackUrl.searchParams.set('key', apiKey);
            console.log(`[Wuyinkeji] 404 fallback: ${fallbackUrl.toString()}`);
            response = await fetch(wrapWithProxy(fallbackUrl.toString()), {
                method: "GET",
                headers: {
                    "Authorization": apiKey,
                    "Content-Type": "application/x-www-form-urlencoded;charset:utf-8;"
                }
            });
        }

        if (!response.ok) {
            // If still failed, check status code for better error reporting
            if (response.status === 404) return { id: taskId, status: 'processing' }; // Treat as not ready
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
