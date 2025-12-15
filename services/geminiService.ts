import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ProjectContext, Shot, TokenUsage, Character, Location, CharacterForm, TextServiceConfig } from "../types";

// --- HELPERS ---

// Helper to init Gemini client
const getGeminiClient = (apiKey: string) => new GoogleGenAI({ apiKey });

// Resolve API key from user config first, then fall back to env
const resolveGeminiApiKey = (config: TextServiceConfig): string => {
    const configKey = config.apiKey?.trim();
    const envKey = (typeof import.meta !== 'undefined' ? import.meta.env.VITE_GEMINI_API_KEY : undefined)
        || (typeof process !== 'undefined' ? (process.env?.GEMINI_API_KEY || process.env?.API_KEY) : undefined);
    
    const apiKey = configKey || envKey;
    if (!apiKey) {
        throw new Error("Gemini API key missing. Please add it in Settings or set VITE_GEMINI_API_KEY in your env.");
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
                    "X-Title": "Script2Video App"
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
         if(!apiBase.includes('/v1/')) apiBase = `${apiBase}/v1`;
    }
    
    try {
        const response = await fetch(`${apiBase}/models`, {
            method: 'GET',
            headers: { "Authorization": `Bearer ${apiKey}` }
        });
        if(!response.ok) return [];
        const data = await response.json();
        return data.data?.map((m: any) => m.id) || [];
    } catch(e) {
        console.error("Fetch Text Models Error", e);
        return [];
    }
};

// --- FEATURE: EASTER EGG (DEMO SCRIPT) ---
export const generateDemoScript = async (
    config: TextServiceConfig
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

// 1.2 Single Episode Summary
export const generateEpisodeSummary = async (
  config: TextServiceConfig,
  episodeTitle: string,
  episodeContent: string,
  projectSummary: string
): Promise<{ summary: string; usage: TokenUsage }> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: "Detailed plot summary for this specific episode" }
    },
    required: ["summary"]
  };

  const systemInstruction = "Role: Script Supervisor.";
  const prompt = `
    Context: Global Project Summary: ${projectSummary}
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
            bio: { type: Type.STRING, description: "Brief initial overview" }
          },
          required: ["name", "role", "isMain", "bio"]
        }
      }
    },
    required: ["characters"]
  };

  const systemInstruction = "Role: Casting Director.";
  const prompt = `
    Context: ${projectSummary}
    Task: Identify all characters from the script. Distinguish between 'Main' characters and 'Supporting' characters.
    
    [Script Snippet]:
    ${script.slice(0, 50000)}...

    Output JSON with a list of characters. Set 'isMain' to true ONLY for the top 3-6 core characters.
  `;

  const { text, usage } = await generateText(config, prompt, schema, systemInstruction);
  const rawChars = JSON.parse(text).characters;
  
  const chars: Character[] = rawChars.map((c: any) => ({
    ...c,
    id: c.name,
    forms: []
  }));

  return { characters: chars, usage };
};

// 1.4 Character Deep Dive
export const analyzeCharacterDepth = async (
  config: TextServiceConfig,
  characterName: string,
  script: string,
  projectSummary: string,
  styleGuide?: string
): Promise<{ forms: CharacterForm[]; usage: TokenUsage }> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      forms: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            formName: { type: Type.STRING, description: "e.g. 'Childhood', 'Awakened State', 'Standard'" },
            episodeRange: { type: Type.STRING, description: "e.g. 'Ep 1-4' or 'Whole Series'" },
            description: { type: Type.STRING, description: "Personality and state of mind in this form" },
            visualTags: { type: Type.STRING, description: "Comma-separated visual keywords" }
          },
          required: ["formName", "episodeRange", "description", "visualTags"]
        }
      }
    },
    required: ["forms"]
  };

  const systemInstruction = "Role: Character Designer & Psychologist.";
  const prompt = `
    Target Character: ${characterName}
    Context: ${projectSummary}
    Style Bible: ${styleGuide || "Standard Cinematic"}

    Task: Analyze the script to define the different "Forms" or "Stages" of ${characterName}.
    Does this character change appearance, age, or mental state significantly across episodes?
    If the character stays mostly the same, provide one form named "Standard".
    
    [Script Context]:
    ${script.slice(0, 80000)}...

    Response must be in Chinese.
  `;

  const { text, usage } = await generateText(config, prompt, schema, systemInstruction);
  return {
    forms: JSON.parse(text).forms,
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
            description: { type: Type.STRING, description: "Brief basic description" }
          },
          required: ["name", "type", "description"]
        }
      }
    },
    required: ["locations"]
  };

  const systemInstruction = "Role: Production Designer / Location Manager.";
  const prompt = `
    Context: ${projectSummary}
    Task: List all unique locations/sets found in the script. Identify "core" locations vs "secondary".

    [Script Snippet]:
    ${script.slice(0, 50000)}...

    Output JSON in Chinese.
  `;

  const { text, usage } = await generateText(config, prompt, schema, systemInstruction);
  const rawLocs = JSON.parse(text).locations;
  const locations: Location[] = rawLocs.map((l: any) => ({
    ...l,
    id: l.name,
    visuals: ''
  }));

  return { locations, usage };
};

// 1.6 Location Deep Dive
export const analyzeLocationDepth = async (
  config: TextServiceConfig,
  locationName: string,
  script: string,
  styleGuide?: string
): Promise<{ visuals: string; usage: TokenUsage }> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      visuals: { type: Type.STRING, description: "Detailed atmospheric, lighting, and texture description" }
    },
    required: ["visuals"]
  };

  const systemInstruction = "Role: Art Director / Concept Artist.";
  const prompt = `
    Target Location: ${locationName}
    Style Bible: ${styleGuide || "Standard"}

    Task: Create a detailed visual definition for this location.
    Focus on: Lighting, Color Palette, Texture, Atmosphere, and Key Props.

    [Script Context]:
    ${script.slice(0, 60000)}...
    
    Response in Chinese.
  `;

  const { text, usage } = await generateText(config, prompt, schema, systemInstruction);
  return {
    visuals: JSON.parse(text).visuals,
    usage
  };
};

// 2. Generate Episode Shot List
export const generateEpisodeShots = async (
  config: TextServiceConfig,
  episodeTitle: string,
  episodeContent: string,
  episodeSummary: string | undefined,
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
            description: { type: Type.STRING, description: "详细的画面视觉描述 (中文)" },
            dialogue: { type: Type.STRING, description: "台词或OS，无台词留空" },
            soraPrompt: { type: Type.STRING, description: "留空字符串" },
          },
          required: ["id", "duration", "shotType", "movement", "description", "dialogue"],
        },
      },
    },
    required: ["shots"],
  };

  const charContextStr = formatCharContext(context);
  const locContextStr = context.locations 
    ? context.locations.filter(l => l.type === 'core').map(l => `- ${l.name}: ${l.visuals}`).join('\n')
    : '';

  const systemInstruction = "角色设定：你是一位拥有10年经验的资深专业分镜师。";
  const prompt = `
    任务：
    依据项目背景、上文剧情，严格遵循【分镜制作指导文档】，将《${episodeTitle}》的剧本正文转换为一份专业的分镜脚本（Shooting Script）。
    
    【项目上下文】：
    - 项目简介：${context.projectSummary}
    ${episodeSummary ? `- **本集剧情梗概**：${episodeSummary}` : ''}
    - 角色设定：
    ${charContextStr}
    - 核心场景设定：
    ${locContextStr}
    
    【分镜制作指导文档】：
    ${guide}

    ${styleGuide ? `
    【项目特定美术风格定义】：
    ${styleGuide}
    ` : ''}
    
    【当前待处理剧本 - ${episodeTitle}】：
    ${episodeContent}
    
    【输出要求】：
    1. 语言要求：除专有名词外，全流程使用**中文**工作。
    2. 镜号格式 (CRITICAL)：分镜号格式必须为：**场景号-本场镜号**。例如：第12集第2场的第1个镜头，ID应为 **"12-2-01"**。
    3. 画面描述 (Description)：必须具有极强的画面感。
    4. soraPrompt 字段请务必保持为空字符串。
  `;

  const { text, usage } = await generateText(config, prompt, schema, systemInstruction);
  return {
      ...JSON.parse(text) as { shots: Shot[] },
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
