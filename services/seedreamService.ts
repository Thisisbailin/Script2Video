
import { MultimodalConfig, TokenUsage } from "../types";
import { wrapWithProxy } from "../utils/api";

export interface SeedreamTaskSubmissionResult {
    id: string;
}

export interface SeedreamTaskStatusResult {
    id: string;
    status: 'queued' | 'processing' | 'succeeded' | 'failed';
    url?: string;
    errorMsg?: string;
}

/**
 * SUBMIT SEEDREAM IMAGE TASK
 * Sends the generation request to Doubao-Seedream via Aggregation API.
 */
export const submitSeedreamTask = async (
    prompt: string,
    config: MultimodalConfig,
    options?: {
        aspectRatio?: string;
        inputImageUrl?: string;
    }
): Promise<SeedreamTaskSubmissionResult> => {
    const { baseUrl, apiKey, model } = config;

    if (!apiKey) {
        throw new Error("Missing Seedream API Key.");
    }

    // Default to Wuyinkeji-style path if baseUrl is empty or generic
    const targetBase = baseUrl || "https://api.wuyinkeji.com/api/img/seedream";
    const urlObj = new URL(targetBase);

    // Attach key to query if not present
    if (!urlObj.searchParams.get('key')) {
        urlObj.searchParams.set('key', apiKey);
    }

    const formBody = new URLSearchParams();
    formBody.append('prompt', prompt);
    // Map ratio: '1:1' -> '1:1', etc.
    formBody.append('aspectRatio', options?.aspectRatio || '1:1');
    if (options?.inputImageUrl) {
        formBody.append('url', options.inputImageUrl);
    }
    // Most aggregation APIs use the path for model differentiation, but some use a param
    if (model) {
        formBody.append('model', model);
    }

    try {
        console.log("--- [Seedream] Submit Image Task ---");
        const response = await fetch(wrapWithProxy(urlObj.toString()), {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset:utf-8;",
                "Authorization": apiKey
            },
            body: formBody
        });

        const text = await response.text();
        if (!response.ok) throw new Error(`Seedream API Error ${response.status}: ${text}`);

        let data;
        try { data = JSON.parse(text); } catch (e) { throw new Error("Failed to parse Seedream API response."); }

        // Provider Error Check (Standard Aggregation Format)
        if (data.code !== undefined && data.code !== 200) {
            throw new Error(`Seedream Provider Error (${data.code}): ${data.msg}`);
        }

        const taskId = data.data?.id || data.id;
        if (!taskId) throw new Error("No Task ID returned by Seedream.");

        return { id: taskId };

    } catch (error: any) {
        console.error("Seedream Submission Failed:", error);
        throw error;
    }
};

/**
 * CHECK SEEDREAM TASK STATUS
 */
export const checkSeedreamTaskStatus = async (
    taskId: string,
    config: MultimodalConfig
): Promise<SeedreamTaskStatusResult> => {
    const { baseUrl, apiKey } = config;

    // Construct Poll URL: Usually .../detail
    let rootBase = baseUrl || "https://api.wuyinkeji.com/api/img/seedream";
    rootBase = rootBase.replace(/\/submit\/?$/, '').replace(/\/+$/, '');

    // Fallback logic similar to Wuyinkeji to handle different path structures
    const pollPath = rootBase.endsWith('/detail') ? rootBase : `${rootBase}/detail`;
    const detailUrl = new URL(pollPath);

    detailUrl.searchParams.set('id', taskId);
    if (!detailUrl.searchParams.get('key')) {
        detailUrl.searchParams.set('key', apiKey);
    }

    try {
        console.log(`[Seedream] Polling: ${detailUrl.toString()}`);
        const response = await fetch(wrapWithProxy(detailUrl.toString()), {
            method: "GET",
            headers: {
                "Authorization": apiKey,
                "Content-Type": "application/x-www-form-urlencoded;charset:utf-8;"
            }
        });

        if (!response.ok) {
            if (response.status === 404) return { id: taskId, status: 'processing' };
            throw new Error(`Seedream Poll Error ${response.status}`);
        }

        const data = await response.json();

        if (data.code !== undefined) {
            // Mapping Aggregation Status (0: Queued, 1: Success, 2: Failed, 3: Processing)
            const d = data.data;
            if (!d) return { id: taskId, status: 'processing' };

            const s = d.status;
            if (s === 1) {
                const finalUrl = d.remote_url || d.img_url || d.url;
                if (finalUrl) return { id: taskId, status: 'succeeded', url: finalUrl };
            }
            if (s === 2) {
                return { id: taskId, status: 'failed', errorMsg: d.fail_reason || "Seedream generation failed." };
            }
            if (s === 0) return { id: taskId, status: 'queued' };
            return { id: taskId, status: 'processing' };
        }

        return { id: taskId, status: 'processing' };

    } catch (e: any) {
        console.warn("Seedream check status warning:", e);
        return { id: taskId, status: 'processing' };
    }
};
