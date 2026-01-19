import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ProjectContext, Shot, TokenUsage, Character, Location, CharacterForm, LocationZone, TextServiceConfig } from "../types";
import { generatePartnerText } from "./partnerService";
import * as DeyunAIService from "./deyunaiService";
import * as QwenService from "./qwenService";
import { QWEN_BASE_URL, QWEN_DEFAULT_MODEL } from "../constants";

// --- HELPERS ---

// Helper to init Gemini client
const getGeminiClient = (apiKey: string) => new GoogleGenAI({ apiKey });

// Resolve API key from user config first, then fall back to env
const resolveGeminiApiKey = (config: TextServiceConfig): string => {
  const configKey = config.apiKey?.trim();
  const envKey = (typeof import.meta !== 'undefined'
    ? (import.meta.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY)
    : undefined)
    || (typeof process !== 'undefined' ? (process.env?.GEMINI_API_KEY || process.env?.API_KEY) : undefined);

  const apiKey = configKey || envKey;
  if (!apiKey) {
    throw new Error("Gemini API key missing. Please add it in Settings or set GEMINI_API_KEY/VITE_GEMINI_API_KEY in your env.");
  }
  return apiKey;
};

const resolveDeyunApiKey = (config: TextServiceConfig): string => {
  const envKey =
    (typeof import.meta !== "undefined"
      ? (import.meta.env.DEYUNAI_API_KEY || import.meta.env.VITE_DEYUNAI_API_KEY)
      : undefined) ||
    (typeof process !== "undefined"
      ? (process.env?.DEYUNAI_API_KEY || process.env?.VITE_DEYUNAI_API_KEY)
      : undefined);
  const configKey = config.apiKey?.trim();
  const apiKey = configKey || envKey;
  if (!apiKey) throw new Error("DeyunAI API key missing. 请配置 DEYUNAI_API_KEY 或在设置中填写。");
  return apiKey;
};

const resolveQwenApiKey = (config: TextServiceConfig): string => {
  const configKey = config.apiKey?.trim();
  const envKey =
    (typeof import.meta !== "undefined"
      ? (import.meta.env.QWEN_API_KEY || import.meta.env.VITE_QWEN_API_KEY)
      : undefined) ||
    (typeof process !== "undefined"
      ? (process.env?.QWEN_API_KEY || process.env?.VITE_QWEN_API_KEY)
      : undefined);

  const apiKey = configKey || envKey;
  if (!apiKey) {
    throw new Error("Qwen API key missing. 请在环境变量 QWEN_API_KEY/VITE_QWEN_API_KEY 或设置中填写。");
  }
  return apiKey;
};

// Helper to map Google Schema to JSON Schema (Simplified for OpenRouter)
const googleSchemaToJsonSchema = (schema: Schema): any => {
  const convertType = (t: Type | undefined): string => {
    if (!t) return 'string';
    switch (t) {
      case Type.STRING: return 'string';
      case Type.NUMBER: return 'number';
      case Type.INTEGER: return 'integer';
      case Type.BOOLEAN: return 'boolean';
      case Type.ARRAY: return 'array';
      case Type.OBJECT: return 'object';
      default: return 'string';
    }
  };

  const res: any = { type: convertType(schema.type) };
  if (schema.description) res.description = schema.description;

  if (schema.type === Type.ARRAY && schema.items) {
    res.items = googleSchemaToJsonSchema(schema.items);
  }

  if (schema.type === Type.OBJECT && schema.properties) {
    res.properties = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      res.properties[key] = googleSchemaToJsonSchema(prop);
    }
    if (schema.required) {
      res.required = schema.required;
    }
    res.additionalProperties = false; // Strict JSON
  }

  return res;
};

// Unified Text Generation Caller
const generateText = async (
  config: TextServiceConfig,
  prompt: string,
  schema: Schema,
  systemInstruction?: string
): Promise<{ text: string; usage: TokenUsage }> => {

  // 1. GEMINI PROVIDER
  if (config.provider === 'gemini') {
    const apiKey = resolveGeminiApiKey(config);
    const ai = getGeminiClient(apiKey);
    const modelName = config.model || 'gemini-2.5-flash';

    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          systemInstruction: systemInstruction
        },
      });
      return {
        text: response.text || "{}",
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
          responseTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
          totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
        }
      };
    } catch (e: any) {
      console.error("Gemini API Error:", e);
      throw new Error(`Gemini Error: ${e.message}`);
    }
  }

  // 2. OPENROUTER / OPENAI PROVIDER
  else if (config.provider === 'openrouter') {
    if (!config.baseUrl || !config.apiKey) throw new Error("OpenRouter configuration missing (URL or Key).");

    const jsonSchema = googleSchemaToJsonSchema(schema);

    // Construct the messages
    const messages = [];
    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }
    // Append schema instruction to prompt for robustness
    const refinedPrompt = `${prompt}\n\nIMPORTANT: Return the output as a valid JSON object matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}`;
    messages.push({ role: "user", content: refinedPrompt });

    let apiBase = config.baseUrl.trim().replace(/\/+$/, '');
    // Ensure /v1/chat/completions structure if not present but base implies it
    // If user provided "https://openrouter.ai/api/v1", we append "/chat/completions"
    if (!apiBase.endsWith('/chat/completions')) {
      // Check if it ends in /v1
      if (apiBase.endsWith('/v1')) {
        apiBase = `${apiBase}/chat/completions`;
      } else {
        // Assume it might need v1
        apiBase = `${apiBase}/v1/chat/completions`;
      }
    }

    try {
      const response = await fetch(apiBase, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`,
          // OpenRouter specific headers
          "HTTP-Referer": window.location.origin,
          "X-Title": "eSheep"
        },
        body: JSON.stringify({
          model: config.model || "google/gemini-2.0-flash-exp:free", // Fallback
          messages: messages,
          response_format: { type: "json_object" }, // Enforce JSON mode if supported
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenRouter Error ${response.status}: ${err}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "{}";

      return {
        text: content,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          responseTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0
        }
      };

    } catch (e: any) {
      console.error("OpenRouter API Error:", e);
      throw new Error(`OpenRouter Error: ${e.message}`);
    }
  }

  // 3. QWEN (Aliyun DashScope)
  else if (config.provider === 'qwen') {
    const apiKey = resolveQwenApiKey(config);
    const jsonSchema = googleSchemaToJsonSchema(schema);
    const refinedPrompt = `${prompt}\n\nIMPORTANT: 返回满足此 JSON Schema 的对象：\n${JSON.stringify(jsonSchema, null, 2)}\n请仅输出 JSON。`;
    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (systemInstruction) messages.push({ role: "system", content: systemInstruction });
    messages.push({ role: "user", content: refinedPrompt });

    const baseUrl = config.baseUrl?.trim() || QWEN_BASE_URL;
    const model = config.model || QWEN_DEFAULT_MODEL;

    try {
      const { text, usage } = await QwenService.chatCompletion(messages, {
        apiKey,
        baseUrl,
        model,
        responseFormat: "json_object",
      });
      return {
        text: text || "{}",
        usage: usage || { promptTokens: 0, responseTokens: 0, totalTokens: 0 },
      };
    } catch (e: any) {
      console.error("Qwen API Error:", e);
      throw new Error(`Qwen Error: ${e.message}`);
    }
  }

  // 3. PARTNER PROVIDER
  else if (config.provider === 'partner') {
    const jsonSchema = googleSchemaToJsonSchema(schema);
    const messages: Array<{ role: string; content: string }> = [];
    if (systemInstruction) messages.push({ role: "system", content: systemInstruction });
    const refinedPrompt = `${prompt}\n\nIMPORTANT: Return JSON matching schema:\n${JSON.stringify(jsonSchema, null, 2)}`;
    messages.push({ role: "user", content: refinedPrompt });

    try {
      const { text, usage } = await generatePartnerText(config, messages);
      return { text, usage };
    } catch (e: any) {
      console.error("Partner API Error:", e);
      throw new Error(`Partner Error: ${e.message}`);
    }
  }

  // 4. DEYUNAI PROVIDER
  else if (config.provider === 'deyunai') {
    const apiKey = resolveDeyunApiKey(config);
    const refinedPrompt = `${prompt}\n\nIMPORTANT: 返回一个满足此 JSON Schema 的对象：\n${JSON.stringify(
      googleSchemaToJsonSchema(schema),
      null,
      2
    )}\n请只输出 JSON。`;
    const useStore = config.store ?? false;
    const baseUrl =
      config.baseUrl?.trim() ||
      (typeof import.meta !== "undefined" ? import.meta.env.DEYUNAI_API_BASE : undefined) ||
      (typeof process !== "undefined" ? process.env?.DEYUNAI_API_BASE : undefined) ||
      "https://api.deyunai.com/v1";

    try {
      const { text, usage } = await DeyunAIService.createModelResponse(
        refinedPrompt,
        { apiKey, baseUrl },
        {
          model: config.model || "gpt-5.1",
          temperature: 0.2,
          store: useStore,
          tools: config.tools,
        }
      );
      return {
        text: text || "{}",
        usage: usage || { promptTokens: 0, responseTokens: 0, totalTokens: 0 },
      };
    } catch (e: any) {
      console.error("DeyunAI API Error:", e);
      throw new Error(`DeyunAI Error: ${e.message}`);
    }
  }

  throw new Error(`Unknown provider: ${config.provider}`);
};

// Helper to sum usage from batches
export const addUsage = (u1: TokenUsage, u2: TokenUsage): TokenUsage => ({
  promptTokens: u1.promptTokens + u2.promptTokens,
  responseTokens: u1.responseTokens + u2.responseTokens,
  totalTokens: u1.totalTokens + u2.totalTokens
});

// Helper to format character list for prompts
const formatCharContext = (context: ProjectContext): string => {
  return context.characters.map(c =>
    `- ${c.name} (${c.role}): ${c.bio}. Forms: ${c.forms.map(f => f.formName).join(', ')}`
  ).join('\n');
};

// Fetch Models for OpenRouter
export const fetchTextModels = async (baseUrl: string, apiKey: string): Promise<string[]> => {
  let apiBase = baseUrl.trim().replace(/\/+$/, '');
  // Remove /chat/completions if present to get to root
  apiBase = apiBase.replace('/chat/completions', '');

  // Ensure /v1/models
  if (!apiBase.endsWith('/v1')) {
    if (!apiBase.includes('/v1/')) apiBase = `${apiBase}/v1`;
  }

  try {
    const response = await fetch(`${apiBase}/models`, {
      method: 'GET',
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.data?.map((m: any) => m.id) || [];
  } catch (e) {
    console.error("Fetch Text Models Error", e);
    return [];
  }
};

// --- FEATURE: EASTER EGG (DEMO SCRIPT) ---
export const generateDemoScript = async (
  config: TextServiceConfig,
  dramaGuide?: string
): Promise<{ script: string; styleGuide: string; usage: TokenUsage }> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      script: { type: Type.STRING, description: "完整的剧本内容 (Plain Text)，必须严格换行" },
      styleGuide: { type: Type.STRING, description: "与该剧本完美匹配的视觉风格概览 (Visual Style Guide)" }
    },
    required: ["script", "styleGuide"]
  };

  const systemInstruction = "Role: Award-winning comedy screenwriter & Art Director. Task: Write a short, hilarious animal script AND its visual style. STRICT FORMATTING REQUIRED.";
  const prompt = `
        写一个关于动物的超短篇爆笑剧本（时长约1分钟），并附带一个独特的视觉风格定义。
        如果提供了创作指南，必须严格遵循其中的戏剧性和专业度要求：
        ${dramaGuide ? dramaGuide.substring(0, 2200) : '（无额外指南，按上面规则写）'}
        
        【CRITICAL FORMATTING RULES - 格式重中之重】
        剧本结构必须严格遵守“**换行**”规则。标题、场景号、正文绝对不能连在同一行！
        
        正确示例：
        第一集
        1-1 森林空地
        一只兔子坐在树桩上。
        
        错误示例（绝对禁止）：
        第一集 1-1 森林空地 一只兔子坐在树桩上...
        
        【任务一：剧本 (Script)】
        1. 剧本第一行必须是：第一集（或者 第1集）
        2. 每一场戏的标题必须单独占一行，格式：1-X [场景名] （例如：1-1 森林空地）
        3. 场景标题下方必须换行，再写具体的动作描述或对话。
        4. 内容：主角是动物，梗要新颖，反转要好笑。中文。
        5. 只能有1集，包含2-3个场景。
        
        【任务二：视觉风格 (Visual Style Guide)】
        为这个故事设计一个极具辨识度的视觉风格。
        不要只写“写实”，要具体。比如：“定格动画风格，类似《了不起的狐狸爸爸》”，“8K超写实BBC纪录片质感，但动物表情夸张”，“赛博朋克霓虹风格的流浪猫故事”等。
        
        请描述：
        1. 整体基调 (Atmosphere)
        2. 色彩倾向 (Color Palette)
        3. 摄影风格 (Camera Language)
        
        【输出示例结构】：
        {
          "script": "第1集\n\n1-1 森林空地\n\n阳光洒在...",
          "styleGuide": "## 视觉风格定义\n**核心基调**：粘土定格动画（Claymation）..."
        }
    `;

  const { text, usage } = await generateText(config, prompt, schema, systemInstruction);
  const result = JSON.parse(text);
  return {
    script: result.script,
    styleGuide: result.styleGuide,
    usage
  };
};

// --- PHASE 1: DEEP UNDERSTANDING SERVICES ---

// 1.1 Project Summary (Global Arc)
export const generateProjectSummary = async (
  config: TextServiceConfig,
  fullScript: string,
  styleGuide?: string
): Promise<{ projectSummary: string; usage: TokenUsage }> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      projectSummary: { type: Type.STRING, description: "Detailed story arc and core conflict (Chinese)" }
    },
    required: ["projectSummary"]
  };

  const systemInstruction = "Role: Senior Script Doctor & Creative Director. Task: Analyze the screenplay.";
  const prompt = `
    Materials:
    ${styleGuide ? `[Style/Tone Guide]:\n${styleGuide}\n` : ''}
    [Script]:
    ${fullScript.slice(0, 100000)}... (truncated if too long)

    Requirements:
    1. **Project Summary**: A comprehensive overview of the entire story arc, themes, and emotional tone.
    2. Focus on the "Big Picture" - the central conflict and resolution.
    3. Language: Chinese.
  `;

  const { text, usage } = await generateText(config, prompt, schema, systemInstruction);
  return {
    projectSummary: JSON.parse(text).projectSummary,
    usage
  };
};

export const generateFreeformText = async (
  config: TextServiceConfig,
  prompt: string,
  systemInstruction = "Role: Creative Assistant.",
  options?: { onStream?: (delta: string) => void }
): Promise<{ outputText: string; usage: TokenUsage }> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      outputText: { type: Type.STRING, description: "Generated text response in Chinese" }
    },
    required: ["outputText"]
  };

  // DeyunAI 流式：直接文本输出，避免 JSON 解析失败
  if (config.provider === "deyunai") {
    const apiKey = resolveDeyunApiKey(config);
    const baseUrl =
      config.baseUrl?.trim() ||
      (typeof import.meta !== "undefined" ? import.meta.env.DEYUNAI_API_BASE : undefined) ||
      (typeof process !== "undefined" ? process.env?.DEYUNAI_API_BASE : undefined) ||
      "https://api.deyunai.com/v1/responses";

    const modelFromList = (config as any).deyunModels?.[0]?.id;
    const model = config.model || modelFromList || "gpt-5.1";

    const { text, usage, raw } = await DeyunAIService.createModelResponse(
        prompt,
        { apiKey, baseUrl },
        { model, temperature: 0.7, store: false, tools: [] }
      );
    try {
      console.log("[DeyunAI] Response raw", raw);
    } catch {}
    if ((raw as any)?.error?.message) {
      throw new Error((raw as any).error.message);
    }
    return {
      outputText: text,
      usage: usage || { promptTokens: 0, responseTokens: 0, totalTokens: 0 },
    };
  }

  const { text, usage } = await generateText(config, prompt, schema, systemInstruction);
  const parsed = JSON.parse(text || "{}");
  return {
    outputText: parsed.outputText || "",
    usage
  };
};

// 1.2 Single Episode Summary
export const generateEpisodeSummary = async (
  config: TextServiceConfig,
  episodeTitle: string,
  episodeContent: string,
  context: ProjectContext,
  currentEpisodeId: number
): Promise<{ summary: string; usage: TokenUsage }> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: "Detailed plot summary for this specific episode" }
    },
    required: ["summary"]
  };

  const recentSummaries = context.episodeSummaries
    ? context.episodeSummaries
      .filter((s) => s.episodeId < currentEpisodeId)
      .sort((a, b) => b.episodeId - a.episodeId)
      .slice(0, 10)
    : [];
  const recentSummaryText = recentSummaries.length
    ? recentSummaries.map((s) => `- Ep ${s.episodeId}: ${s.summary}`).join('\n')
    : '无';

  const systemInstruction = "Role: Script Supervisor.";
  const prompt = `
    Context: 
    - Global Project Summary: ${context.projectSummary}
    - Recent Episode Summaries (latest first, up to 10):
${recentSummaryText}

    Task: Summarize the plot for the specific episode: "${episodeTitle}".

    [Episode Content]:
    ${episodeContent.slice(0, 30000)}

    Requirements:
    1. Focus on key plot points, character development, and cliffhangers within this episode.
    2. Be concise but comprehensive (approx 150-300 words).
    3. Language: Chinese.
  `;

  const { text, usage } = await generateText(config, prompt, schema, systemInstruction);
  return {
    summary: JSON.parse(text).summary,
    usage
  };
};

// 1.3 Character Identification
export const identifyCharacters = async (
  config: TextServiceConfig,
  script: string,
  projectSummary: string
): Promise<{ characters: Character[]; usage: TokenUsage }> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      characters: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            role: { type: Type.STRING, description: "e.g. Protagonist, Villain, Supporting" },
            isMain: { type: Type.BOOLEAN, description: "True for core characters requiring deep analysis" },
            bio: { type: Type.STRING, description: "Brief initial overview" },
            assetPriority: { type: Type.STRING, enum: ["high", "medium", "low"] },
            episodeUsage: { type: Type.STRING, description: "Episodes/scenes where this character appears" },
            archetype: { type: Type.STRING, description: "简要人设/类型标签" },
            forms: {
              type: Type.ARRAY,
              description: "Rough forms that likely need independent assets",
              items: {
                type: Type.OBJECT,
                properties: {
                  formName: { type: Type.STRING },
                  episodeRange: { type: Type.STRING },
                  identityOrState: { type: Type.STRING, description: "Age, disguise, rank, status" }
                },
                required: ["formName", "episodeRange"]
              }
            }
          },
          required: ["name", "role", "isMain", "bio", "assetPriority", "episodeUsage"]
        }
      }
    },
    required: ["characters"]
  };

  const systemInstruction = "Role: Casting Director & Asset Producer.";
  const prompt = `
    Context (Project Summary): ${projectSummary}
    Task: Identify all characters from the script, and produce an initial AIGC资产/定模清单草稿。

    对每个角色，输出：
    - 角色分级: assetPriority = high/medium/low（优先定模）
    - 出现范围: episodeUsage（用集数/桥段简写，例如 "Ep1-4, Ep7 祭典"）
    - archetype: 人设/职业/类型标签
    - forms: 需要独立定模的形态（年龄/身份/状态差异），先给初步占位，后续深描补全。
    - isMain: 仅标记核心 3-6 人为 true。

    [Script Snippet]:
    ${script.slice(0, 50000)}...

    用中文 JSON 输出。`;

  const { text, usage } = await generateText(config, prompt, schema, systemInstruction);
  const rawChars = JSON.parse(text).characters;

  const chars: Character[] = rawChars.map((c: any) => ({
    ...c,
    id: c.name,
    forms: c.forms ?? []
  }));

  return { characters: chars, usage };
};

// 1.3.1 Character Briefs (for minor / cameo roles)
export const generateCharacterBriefs = async (
  config: TextServiceConfig,
  characterNames: string[],
  script: string,
  projectSummary: string
): Promise<{ characters: Character[]; usage: TokenUsage }> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      characters: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            role: { type: Type.STRING, description: "一句话身份/功能" },
            bio: { type: Type.STRING, description: "1-2 句简短概述，用中文" },
            archetype: { type: Type.STRING, description: "类型标签/职业标签" },
            assetPriority: { type: Type.STRING },
            episodeUsage: { type: Type.STRING, description: "出现集数标记" },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["name", "bio"]
        }
      }
    },
    required: ["characters"]
  };

  const systemInstruction = "Role: Casting Director. 给次要/路人角色生成极简角色卡。";
  const prompt = `
    这些角色仅出现 1 次，视为路人/次要：${characterNames.join("，")}
    任务：基于项目摘要/脚本文本，给每人生成 1-2 句角色概述（bio），可补充身份 role、archetype 标签，episodeUsage（若可推断），并给 assetPriority=low。
    请保持名字一致，不要改写。

    项目摘要：
    ${projectSummary}

    脚本片段：
    ${script.slice(0, 40000)}

    用中文 JSON 输出，遵循 schema。
  `;

  const { text, usage } = await generateText(config, prompt, schema, systemInstruction);
  const raw = JSON.parse(text).characters || [];
  const characters: Character[] = raw.map((c: any) => ({
    id: c.name,
    name: c.name,
    role: c.role || "",
    isMain: false,
    bio: c.bio || "",
    forms: [],
    assetPriority: c.assetPriority || "low",
    archetype: c.archetype,
    episodeUsage: c.episodeUsage,
    tags: c.tags
  }));

  return { characters, usage };
};

// 1.4 Character Deep Dive
export const analyzeCharacterDepth = async (
  config: TextServiceConfig,
  characterName: string,
  script: string,
  projectSummary: string,
  styleGuide?: string
): Promise<{ forms: CharacterForm[]; bio?: string; archetype?: string; episodeUsage?: string; tags?: string[]; usage: TokenUsage }> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      bio: { type: Type.STRING, description: "核心角色概述，2-3 句中文" },
      archetype: { type: Type.STRING, description: "身份/标签" },
      episodeUsage: { type: Type.STRING, description: "出现集数/桥段" },
      tags: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      },
      forms: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            formName: { type: Type.STRING, description: "e.g. 'Childhood', 'Awakened State', 'Standard'" },
            episodeRange: { type: Type.STRING, description: "e.g. 'Ep 1-4' or 'Whole Series'" },
            description: { type: Type.STRING, description: "Personality and state of mind in this form" },
            visualTags: { type: Type.STRING, description: "Comma-separated visual keywords" },
            identityOrState: { type: Type.STRING, description: "Age / identity / disguise / rank /状态" },
            hair: { type: Type.STRING },
            face: { type: Type.STRING },
            body: { type: Type.STRING },
            costume: { type: Type.STRING },
            accessories: { type: Type.STRING },
            props: { type: Type.STRING },
            materialPalette: { type: Type.STRING },
            poses: { type: Type.STRING },
            expressions: { type: Type.STRING },
            lightingOrPalette: { type: Type.STRING },
            turnaroundNeeded: { type: Type.BOOLEAN },
            deliverables: { type: Type.STRING, description: "e.g. 三视图/表情集/全身+半身" },
            designRationale: { type: Type.STRING, description: "Why this design fits the story & style guide" },
            styleRef: { type: Type.STRING },
            genPrompts: { type: Type.STRING }
          },
          required: ["formName", "episodeRange", "description", "visualTags"]
        }
      }
    },
    required: ["forms"]
  };

  const systemInstruction = "Role: Character Designer & Asset Supervisor.";
  const prompt = `
    目标角色: ${characterName}
    项目摘要: ${projectSummary}
    风格指导: ${styleGuide || "Standard Cinematic"}

    任务: 深描该角色，生成：
      - 核心角色概述（bio，2-3 句中文）
      - archetype/标签
      - episodeUsage（出现集数）
      - 角色定模美术资产清单，覆盖该角色所有形态/阶段（年龄/身份/状态）。
    每个形态需要提供：
      - identityOrState: 年龄/身份/状态
      - appearance 分层: hair, face, body, costume, accessories, props, materialPalette, lightingOrPalette
      - poses / expressions: 代表性的姿态与表情包
      - turnaroundNeeded (bool) & deliverables: 需要的交付（如三视图/全身+半身/表情集）
      - designRationale: 说明为何这样设计（剧情节点、身份变化、风格指南依据）
      - genPrompts: 便于 AIGC 生成的提示（中文）

    注意：
    - 如果角色外观变化很少，至少产出 1 个 form（Standard）。
    - episodeRange 请明确形态出现的集数/桥段。

    [Script Context]:
    ${script.slice(0, 80000)}...

    用中文 JSON 输出。`;

  const { text, usage } = await generateText(config, prompt, schema, systemInstruction);
  const parsed = JSON.parse(text);
  return {
    forms: parsed.forms,
    bio: parsed.bio,
    archetype: parsed.archetype,
    episodeUsage: parsed.episodeUsage,
    tags: parsed.tags,
    usage
  };
};

// 1.5 Location Identification
export const identifyLocations = async (
  config: TextServiceConfig,
  script: string,
  projectSummary: string
): Promise<{ locations: Location[]; usage: TokenUsage }> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      locations: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Name of the set/location" },
            type: { type: Type.STRING, enum: ["core", "secondary"], description: "Core = Recurring main set" },
            description: { type: Type.STRING, description: "Brief basic description" },
            assetPriority: { type: Type.STRING, enum: ["high", "medium", "low"] },
            episodeUsage: { type: Type.STRING, description: "Episodes/bridges where used" },
            zones: {
              type: Type.ARRAY,
              description: "Key sub-areas that may need separate assets",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  kind: { type: Type.STRING, enum: ["interior", "exterior", "transition", "unspecified"] },
                  episodeRange: { type: Type.STRING }
                },
                required: ["name", "episodeRange"]
              }
            }
          },
          required: ["name", "type", "description", "assetPriority", "episodeUsage"]
        }
      }
    },
    required: ["locations"]
  };

  const systemInstruction = "Role: Production Designer / Location Manager.";
  const prompt = `
    项目摘要: ${projectSummary}
    任务: 罗列所有场景/场地，并为定模生成初步资产清单框架。

    对每个场景输出：
    - type: core/secondary
    - assetPriority: high/medium/low（优先度）
    - episodeUsage: 覆盖集数/桥段（如 "Ep1-2 庭院"）
    - description: 基本描述
    - zones: 需要独立资产的子区域（内景/外景/过渡/未定），列出名称+episodeRange。

    [Script Snippet]:
    ${script.slice(0, 50000)}...

    用中文 JSON 输出。`;

  const { text, usage } = await generateText(config, prompt, schema, systemInstruction);
  const rawLocs = JSON.parse(text).locations;
  const locations: Location[] = rawLocs.map((l: any) => ({
    ...l,
    id: l.name,
    visuals: '',
    zones: l.zones ?? []
  }));

  return { locations, usage };
};

// 1.6 Location Deep Dive
export const analyzeLocationDepth = async (
  config: TextServiceConfig,
  locationName: string,
  script: string,
  styleGuide?: string
): Promise<{ visuals: string; zones?: LocationZone[]; usage: TokenUsage }> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      visuals: { type: Type.STRING, description: "Detailed atmospheric, lighting, and texture description" },
      zones: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            kind: { type: Type.STRING, enum: ["interior", "exterior", "transition", "unspecified"] },
            episodeRange: { type: Type.STRING },
            layoutNotes: { type: Type.STRING, description: "空间布局/动线/分区" },
            keyProps: { type: Type.STRING, description: "Set dressing / hero props" },
            lightingWeather: { type: Type.STRING, description: "时间/天气/光线" },
            materialPalette: { type: Type.STRING },
            designRationale: { type: Type.STRING },
            deliverables: { type: Type.STRING, description: "顶视/侧视/关键区域/材质板/道具包" },
            genPrompts: { type: Type.STRING }
          },
          required: ["name", "episodeRange", "layoutNotes", "keyProps", "lightingWeather", "materialPalette"]
        }
      }
    },
    required: ["visuals"]
  };

  const systemInstruction = "Role: Art Director / Concept Artist.";
  const prompt = `
    目标场景: ${locationName}
    风格指导: ${styleGuide || "Standard"}

    任务: 生成场景定模美术资产清单（含子区域/内外景）。
    输出内容：
      - visuals: 整体氛围描述（光线/色调/材质/气味/声音）
      - zones[]: 每个子区域包含
          * name, kind (interior/exterior/transition/unspecified), episodeRange
          * layoutNotes: 空间布局/动线/分区
          * keyProps: 关键道具/布景
          * lightingWeather: 时间/天气/光线
          * materialPalette
          * deliverables: 顶视/侧视/关键区域透视/材质板/道具包 等需求
          * designRationale: 设计理由（剧情/情绪/风格依据）
          * genPrompts: AIGC 生成提示（中文）

    [Script Context]:
    ${script.slice(0, 60000)}...
    
    用中文 JSON 输出。`;

  const { text, usage } = await generateText(config, prompt, schema, systemInstruction);
  const parsed = JSON.parse(text);
  return {
    visuals: parsed.visuals,
    zones: parsed.zones ?? [],
    usage
  };
};

// 2. Generate Episode Shot List
export const generateEpisodeShots = async (
  config: TextServiceConfig,
  episodeTitle: string,
  episodeContent: string,
  previousEpisodes: { id: number; title: string; summary: string }[],
  context: ProjectContext,
  guide: string,
  episodeIndex: number,
  styleGuide?: string
): Promise<{ shots: Shot[]; usage: TokenUsage }> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      shots: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "镜号，严格格式: 场景号-镜号 (如 1-1-01)" },
            duration: { type: Type.STRING, description: "预估时长，例如 3s" },
            shotType: { type: Type.STRING, description: "景别，例如 特写" },
            movement: { type: Type.STRING, description: "运镜，例如 推镜头" },
            difficulty: { type: Type.INTEGER, description: "难度评分，1-10 分整数，10 为最难" },
            description: { type: Type.STRING, description: "详细的画面视觉描述 (中文)" },
            dialogue: { type: Type.STRING, description: "台词或OS，无台词留空" },
            soraPrompt: { type: Type.STRING, description: "留空字符串" },
          },
          required: ["id", "duration", "shotType", "movement", "difficulty", "description", "dialogue", "soraPrompt"],
        },
      },
    },
    required: ["shots"],
  };

  const charContextStr = formatCharContext(context);
  const locContextStr = context.locations
    ? context.locations.filter(l => l.type === 'core').map(l => `- ${l.name}: ${l.visuals}`).join('\n')
    : '';

  const previousContextStr = previousEpisodes.length > 0
    ? previousEpisodes.map(ep => `Episode ${ep.id} (${ep.title}): ${ep.summary}`).join('\n')
    : '无（本集为起始章节）';

  const systemInstruction = `角色设定：你是一位好莱坞顶级的分镜师（Storyboard Artist）和摄影指导（DP）。
  核心职责：将剧本文字转化为极具画面感、电影感和镜头张力的专业分镜脚本。
  最重要的规则：拒绝平庸。你的每一个分镜描述都必须包含具体的【摄影运镜】、【光影氛围】和【构图细节】。`;

  const prompt = `
    任务：
    依据项目整体背景、前序章节剧情，严格遵循【分镜制作指导文档】，将当前待处理章节《${episodeTitle}》的剧本正文转换为一份大师级的分镜脚本。
    
    【项目全局背景】：
    - 项目简介：${context.projectSummary}
    - 角色设定及视觉特征：
    ${charContextStr}
    - 核心场景及视觉氛围：
    ${locContextStr}
    
    【前序章节剧情回顾 (最近5集)】：
    ${previousContextStr}

    【分镜制作指导文档 (必须严格执行)】：
    ${guide}

    ${styleGuide ? `
    【项目特定美术风格定义】：
    ${styleGuide}
    ` : ''}
    
    【当前待处理剧本正文 - ${episodeTitle}】：
    ${episodeContent}
    
    【输出要求 (CRITICAL)】：
    1. **语言**：除专有名词（如 Dutch Angle, Rim Light）外，全流程使用**中文**。
    2. **格式**：分镜号格式必须为：**场景号-本场镜号**。例如：第12集第2场的第1个镜头，ID应为 **"12-2-01"**。
    3. **Description 字段标准**：
       -  必须包含至少一处摄影/光影术语 (如 "侧光", "浅景深", "仰视")。
       -  必须描述画面中的物理细节/材质/氛围。
       -  ❌ 禁止: "拍他在说话"
       -  ✅ 允许: "特写。侧逆光勾勒出他脸部的轮廓，他在阴影中低语，背景是虚化的雨夜街道。"
    4. **Difficulty**: 为每个镜头给出 1-10 的制作难度整数评分（10 最难，1 最易），综合考虑拍摄/动画复杂度、人数、景别与运动、特效等。
    5. **soraPrompt**：字段请务必保持为空字符串。
  `;

  const { text, usage } = await generateText(config, prompt, schema, systemInstruction);
  const parsed = JSON.parse(text) as { shots?: Shot[] };
  const shots = Array.isArray(parsed?.shots)
    ? parsed.shots.map((shot) => ({
      ...shot,
      soraPrompt: typeof shot.soraPrompt === "string" ? shot.soraPrompt : ""
    }))
    : [];
  return {
    shots,
    usage
  };
};

// 3. Generate Sora Prompts
export const generateSoraPrompts = async (
  config: TextServiceConfig,
  shots: Shot[],
  context: ProjectContext,
  soraGuide: string,
  styleGuide?: string
): Promise<{ partialShots: { id: string; soraPrompt: string }[]; usage: TokenUsage }> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      prompts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            soraPrompt: { type: Type.STRING, description: "Sora视频生成提示词(中文)" },
          },
          required: ["id", "soraPrompt"],
        },
      }
    }
  };

  const charContextStr = formatCharContext(context);
  const locContextStr = context.locations
    ? context.locations.filter(l => l.type === 'core').map(l => `- ${l.name}: ${l.visuals}`).join('\n')
    : '';

  const batchContext = shots.map(s => ({
    id: s.id,
    type: s.shotType,
    move: s.movement,
    desc: s.description
  }));

  const systemInstruction = "角色设定：你是一位精通Sora文生图模型的提示词专家。";
  const prompt = `
    任务：
    请依据【Sora提示词撰写规范】，为以下 **${shots.length}** 个分镜撰写高质量的视频生成提示词。
    
    【项目上下文】：
    - 项目简介：${context.projectSummary}
    - 角色设定：${charContextStr}
    - 核心场景设定：${locContextStr}
    
    【Sora提示词撰写规范】：
    ${soraGuide}

    ${styleGuide ? `【项目特定美术风格定义】：${styleGuide}` : ''}
    
    【当前批次分镜数据】：
    ${JSON.stringify(batchContext)}
    
    【输出要求 (CRITICAL)】：
    1. 语言：中文。
    2. 格式：返回一个 JSON 对象，包含 "prompts" 数组。
    3. Sora Prompt内容：包含主体、动作、环境、光影、摄影风格。
  `;

  const { text, usage } = await generateText(config, prompt, schema, systemInstruction);
  const resultObj = JSON.parse(text) as { prompts: { id: string; soraPrompt: string }[] };

  if (!resultObj.prompts && Array.isArray(resultObj)) {
    return { partialShots: resultObj, usage };
  }

  return {
    partialShots: resultObj.prompts,
    usage
  };
};
