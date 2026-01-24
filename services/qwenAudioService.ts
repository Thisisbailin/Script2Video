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

const DEFAULT_BASE = "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/generation";

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

/**
 * Qwen3-TTS Service
 * Refined for "Smart Persona Design" and "Atmospheric Dubbing".
 */
export const generateSpeech = async (
    text: string,
    options?: QwenAudioOptions
): Promise<{ audioUrl: string; duration?: number; raw: any }> => {
    const apiKey = resolveApiKey();

    // Use vd-flash if a voicePrompt is provided for Voice Design
    const model = options?.model || (options?.voicePrompt ? "qwen3-tts-vd-flash" : "qwen3-tts-flash");

    const body: any = {
        model,
        input: {
            text,
        },
        parameters: {
            format: options?.format || "wav",
            sample_rate: options?.sampleRate || 24000,
            volume: options?.volume || 50,
            speech_rate: options?.speechRate || 0,
            pitch: options?.pitch || 0,
        },
    };

    // 1. UNIQUE PERSONA (Voice Design)
    if (options?.voicePrompt) {
        body.input.voice_prompt = options.voicePrompt;
    } else if (options?.voice) {
        body.parameters.voice = options.voice;
    }

    // 2. ATMOSPHERIC DUBBING (Instruction-based expressive prosody)
    if (options?.instruction) {
        // In Qwen3-TTS, emotional/style instructions can be passed via specialized parameters
        // or as part of the voice_prompt / instruction field depending on the specific model sub-task.
        body.parameters.instruction = options.instruction;
    }

    const res = await fetch(wrapWithProxy(DEFAULT_BASE), {
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
    // Mocking voice list for now based on Qwen3-TTS docs
    return [
        { id: "gentle_girl", label: "温柔少女" },
        { id: "mature_male", label: "成熟男声" },
        { id: "sichuanese_grandpa", label: "四川话爷爷" },
        { id: "cantonese_lady", label: "粤语女士" },
        // ... 49+ voices available in Qwen3-TTS
    ];
};
