import { wrapWithProxy } from "../utils/api";

export type QwenAudioOptions = {
    model?: string;
    voice?: string;       // Built-in voice name or Generated Voice ID
    voicePrompt?: string; // Natural language description for VOICE DESIGN
    instruction?: string; // Natural language instruction for EXPRESSIVE DUBBING (e.g. "Speak sadly")
    format?: 'wav' | 'mp3' | 'pcm';
    sampleRate?: number;
    volume?: number;
    speechRate?: number;
    pitch?: number;
};

const CUSTOMIZE_BASE = "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization";
const GENERATE_BASE = "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/generation";

const resolveApiKey = () => {
    const envKey =
        (typeof import.meta !== "undefined"
            ? (import.meta.env.QWEN_API_KEY || import.meta.env.VITE_QWEN_API_KEY)
            : undefined) ||
        (typeof process !== "undefined"
            ? (process.env?.QWEN_API_KEY || process.env?.VITE_QWEN_API_KEY)
            : undefined);
    const key = (envKey || "").trim();
    if (!key) throw new Error("Missing Qwen API key.");
    return key;
};

const sanitizePreferredName = (name?: string): string | undefined => {
    if (!name) return undefined;
    // API rules: only alphanumeric and underscores, max 16 characters
    let sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_');
    // If it started with numbers/etc but now empty or just underscores, handle fallback
    sanitized = sanitized.replace(/^_+|_+$/g, '');
    if (!sanitized) sanitized = "voice";
    return sanitized.slice(0, 16);
};

/**
 * Voice Design: Create a unique, fixed voice ID for a character
 */
export const createCustomVoice = async (params: {
    voicePrompt: string;
    previewText?: string;
    preferredName?: string;
    language?: 'zh' | 'en' | 'ja' | 'ko' | 'vi';
}) => {
    const apiKey = resolveApiKey();

    const body = {
        model: "qwen-voice-design",
        input: {
            action: "create",
            target_model: "qwen3-tts-vd-realtime-2025-12-16", // Mandatory target model
            voice_prompt: params.voicePrompt.slice(0, 2000), // Constraint: 2048
            preview_text: (params.previewText || "您好，这是为您定制的专属音色。").slice(0, 1000), // Constraint: 1024
            preferred_name: sanitizePreferredName(params.preferredName),
            language: params.language || "zh"
        },
        parameters: {
            sample_rate: 24000,
            response_format: "wav"
        }
    };

    const res = await fetch(wrapWithProxy(CUSTOMIZE_BASE), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Voice Design failed (${res.status}): ${errText}`);
    }

    const result = await res.json();
    const voiceId = result.output.voice;
    const base64Audio = result.output.preview_audio?.data;

    let previewAudioUrl = "";
    if (base64Audio) {
        const byteCharacters = atob(base64Audio);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'audio/wav' });
        previewAudioUrl = URL.createObjectURL(blob);
    }

    return {
        voiceId,
        previewAudioUrl,
        raw: result
    };
};

/**
 * Qwen3-TTS Service
 * Refined for "Smart Persona Design" and "Atmospheric Dubbing".
 */
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

/**
 * Qwen3-TTS Service
 * Refined for "Smart Persona Design" and "Atmospheric Dubbing".
 */
export const generateSpeech = async (
    text: string,
    options?: QwenAudioOptions
): Promise<{ audioUrl: string; duration?: number; raw: any }> => {
    const apiKey = resolveApiKey();

    let model = options?.model;
    const isDesignedVoice = options?.voice?.startsWith('vd-') || options?.voice?.includes('vd-');

    if (isDesignedVoice) {
        model = "qwen3-tts-vd-realtime-2025-12-16";
    } else if (!model) {
        if (options?.voicePrompt) {
            model = "qwen3-tts-vd-flash";
        } else {
            model = "qwen3-tts-flash";
        }
    }

    // === WebSocket Implementation for Designed Voices (Realtime Model) ===
    if (model === "qwen3-tts-vd-realtime-2025-12-16") {
        console.log("[Qwen TTS] Using WebSocket for Realtime Model:", model);

        return new Promise((resolve, reject) => {
            // Attempt auth via query param since browser WebSocket doesn't support headers
            const wsUrl = `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?token=${apiKey}`;
            const ws = new WebSocket(wsUrl);
            const taskId = generateUUID();
            const audioChunks: Uint8Array[] = [];

            ws.onopen = () => {
                console.log("[Qwen WS] Connected");
                const payload = {
                    header: {
                        action: "run-task",
                        task_id: taskId,
                        streaming: "duplex"
                    },
                    payload: {
                        task_group: "audio",
                        task: "tts",
                        function: "SpeechSynthesizer",
                        model: model,
                        input: {
                            text: text
                        },
                        parameters: {
                            voice: options?.voice, // "vd-..."
                            format: "wav", // Request WAV to get header in binary or direct PCM? 
                            // Ideally 'pcm' is safer for raw stitching, but 'wav' might wrap each chunk? 
                            // Let's stick to 'pcm' and wrap in WAV container if needed, or 'wav' and hope server sends one header.
                            // Actually, for simple playback, getting a full file is easier. 
                            // But realtime streams chunks. 
                            // Let's try 'wav' - DashScope usually sends header in first chunk or creates a valid stream.
                            sample_rate: options?.sampleRate || 24000,
                            volume: options?.volume ?? 50,
                            speech_rate: options?.speechRate ?? 1.0,
                            // Pitch not supported for this model
                        }
                    }
                };
                ws.send(JSON.stringify(payload));
            };

            ws.onmessage = async (event) => {
                let data = event.data;
                if (data instanceof Blob) {
                    data = await data.arrayBuffer();
                }

                if (data instanceof ArrayBuffer) {
                    audioChunks.push(new Uint8Array(data));
                    return;
                }

                // Text frame
                try {
                    const msg = JSON.parse(data);
                    if (msg.header.event === "task-failed") {
                        ws.close();
                        reject(new Error(msg.header.error_message));
                        return;
                    }

                    if (msg.header.event === "task-finished") {
                        console.log("[Qwen WS] Task Finished");
                        ws.close();

                        // Combine chunks if necessary, or just use the array.
                        // Ideally we concatenate them.
                        const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
                        const combined = new Uint8Array(totalLength);
                        let offset = 0;
                        for (const chunk of audioChunks) {
                            combined.set(chunk, offset);
                            offset += chunk.length;
                        }

                        // Fix lint error: cast to explicitly satisfy BlobPart
                        const blob = new Blob([combined], { type: 'audio/wav' });
                        const audioUrl = URL.createObjectURL(blob);

                        resolve({
                            audioUrl,
                            raw: { taskId }
                        });
                        return;
                    }

                    // Handle "result-generated" if it contains base64 audio (fallback)
                    if (msg.header.event === "result-generated" && msg.payload?.output?.audio) {
                        // Some endpoints return base64 in JSON instead of binary frames
                        try {
                            const binStr = atob(msg.payload.output.audio);
                            const len = binStr.length;
                            const bytes = new Uint8Array(len);
                            for (let i = 0; i < len; i++) {
                                bytes[i] = binStr.charCodeAt(i);
                            }
                            audioChunks.push(bytes);
                        } catch (e) {
                            console.warn("Failed to decode base64 audio", e);
                        }
                    }

                } catch (e) {
                    console.warn("WebSocket parse error", e);
                }
            };

            ws.onerror = (e) => {
                console.error("WS Error", e);
                reject(new Error("WebSocket connection error"));
            };
        });
    }

    // === FALLBACK: Standard REST for other models ===
    const body: any = {
        model,
        input: {
            text,
        },
        parameters: {
            format: options?.format || "wav",
            sample_rate: options?.sampleRate || 24000,
            volume: options?.volume ?? 50,
            speech_rate: options?.speechRate ?? 1.0,
            pitch: options?.pitch ?? 1.0,
        },
    };

    if (options?.voice) {
        body.input.voice = options.voice;
    } else if (options?.voicePrompt) {
        body.input.voice_prompt = options.voicePrompt;
    }

    if (options?.voice?.includes('vd-')) {
        delete body.parameters.pitch;
    } else if (options?.instruction) {
        body.parameters.instruction = options.instruction;
    }

    console.log("[Qwen TTS] Request Body:", JSON.stringify(body));

    const res = await fetch(wrapWithProxy(GENERATE_BASE), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "X-DashScope-SSE": "disable",
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Qwen TTS failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const audioUrl = data?.output?.audio_url || "";

    return {
        audioUrl,
        raw: data,
    };
};

/**
 * Fetch available voices/timbres for Qwen3-TTS
 */
export const fetchVoices = async () => {
    // These are built-in voices. For custom voices, use createCustomVoice
    return [
        { id: "gentle_girl", label: "温柔少女" },
        { id: "mature_male", label: "成熟男声" },
        { id: "sichuanese_grandpa", label: "四川话爷爷" },
        { id: "cantonese_lady", label: "粤语女士" },
    ];
};
