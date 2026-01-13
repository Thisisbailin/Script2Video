
import { MultimodalConfig } from "../types";
import { wrapWithProxy } from "../utils/api";

/**
 * GENERATE SEEDREAM IMAGE
 * Follows the ai.deyunai.com API spec (OpenAI-compatible /images/generations)
 */
export const generateSeedreamImage = async (
    prompt: string,
    config: MultimodalConfig,
    options?: {
        aspectRatio?: string;
        inputImageUrl?: string;
    }
): Promise<string> => {
    const { baseUrl, apiKey, model } = config;

    if (!apiKey) {
        throw new Error("Missing Seedream API Key.");
    }

    // Default endpoint based on document
    const targetUrl = baseUrl || "https://api.deyunai.com/v1/images/generations";

    // Map aspectRatio to 'size' or similar if needed, 
    // Document shows 'size' as string. Standard is '1024x1024'.
    // Mapping 1:1 -> 1024x1024, 16:9 -> 1280x720, etc.
    let size = "1024x1024";
    if (options?.aspectRatio === '16:9') size = "1280x720";
    if (options?.aspectRatio === '9:16') size = "720x1280";

    const payload = {
        model: model || "doubao-seedream-250828",
        prompt: prompt,
        image: options?.inputImageUrl || undefined,
        size: size,
        stream: false,
        response_format: "url",
        // Additional parameters from doc
        guidance_scale: 7.5,
        watermark: false,
        sequential_image_generation: "disabled",
        sequential_image_generation_options: {
            "num_images": 1
        }
    };

    try {
        console.log("--- [Seedream] Requesting Image Generation ---");
        const response = await fetch(wrapWithProxy(targetUrl), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Seedream API Error ${response.status}: ${errText}`);
        }

        const data = await response.json();

        // Standard OpenAI response structure: { data: [ { url: "..." } ] }
        const imageUrl = data.data?.[0]?.url || data.url;

        if (!imageUrl) {
            throw new Error("Seedream API returned no image URL.");
        }

        return imageUrl;

    } catch (error: any) {
        console.error("Seedream Generation Failed:", error);
        throw error;
    }
};
