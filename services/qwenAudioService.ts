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
export const generateSpeech = async (
    text: string,
    options?: QwenAudioOptions
): Promise<{ audioUrl: string; duration?: number; raw: any }> => {
    const apiKey = resolveApiKey();

    // If using a custom voice ID (starting with vd-), we MUST use the target_model identified during design
    // As per official docs: "此步骤指定的语音合成模型必须和上一步的target_model一致"
    let model = options?.model;
    if (!model) {
        if (options?.voice?.startsWith('vd-')) {
            model = "qwen3-tts-vd-realtime-2025-12-16";
        } else if (options?.voicePrompt) {
            model = "qwen3-tts-vd-flash";
        } else {
            model = "qwen3-tts-flash";
        }
    }

    const body: any = {
        model,
        input: {
            text,
        },
        parameters: {
            format: options?.format || "wav",
            sample_rate: options?.sampleRate || 24000,
            volume: options?.volume ?? 50,
            speech_rate: options?.speechRate ?? 1.0, // 0.5 to 2.0 multiplier
            pitch: options?.pitch ?? 1.0,           // 0.5 to 2.0 multiplier
        },
    };

    // 1. UNIQUE PERSONA (Voice Design)
    if (options?.voice) {
        body.parameters.voice = options.voice;
    } else if (options?.voicePrompt) {
        // One-shot voice design
        body.input.voice_prompt = options.voicePrompt;
    }

    // 2. ATMOSPHERIC DUBBING (Instruction-based expressive prosody)
    if (options?.instruction) {
        body.parameters.instruction = options.instruction;
    }

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
