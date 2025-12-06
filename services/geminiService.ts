
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ProjectContext, Shot, TokenUsage } from "../types";

// Helper to init client
const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to extract token usage
const mapUsage = (usage: any): TokenUsage => ({
  promptTokens: usage?.promptTokenCount ?? 0,
  responseTokens: usage?.candidatesTokenCount ?? 0,
  totalTokens: usage?.totalTokenCount ?? 0,
});

// Helper to sum usage from batches
export const addUsage = (u1: TokenUsage, u2: TokenUsage): TokenUsage => ({
  promptTokens: u1.promptTokens + u2.promptTokens,
  responseTokens: u1.responseTokens + u2.responseTokens,
  totalTokens: u1.totalTokens + u2.totalTokens
});

// Helper to format character list for prompts
const formatCharContext = (context: ProjectContext): string => {
  return context.characters.map(c => 
    `- ${c.name} (${c.role}): ${c.bio}. [Visuals: ${c.visualTags}]`
  ).join('\n');
};

// 1. Generate Context (Project & Character Cards)
export const generateProjectContext = async (
  modelName: string,
  fullScriptSnippet: string, 
  guide: string,
  styleGuide?: string // Added styleGuide for context understanding
): Promise<{ data: ProjectContext; usage: TokenUsage }> => {
  const ai = getClient();
  
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      projectSummary: { type: Type.STRING, description: "整个项目/剧集的故事梗概 (中文)" },
      characters: { 
        type: Type.ARRAY,
        description: "主要角色列表",
        items: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: "角色姓名" },
                role: { type: Type.STRING, description: "角色定位 (如: 男主角, 反派)" },
                bio: { type: Type.STRING, description: "简短的人物小传和性格描述" },
                visualTags: { type: Type.STRING, description: "外貌特征关键词 (如: 高大, 红衣, 刀疤)" }
            },
            required: ["name", "role", "bio", "visualTags"]
        }
      },
    },
    required: ["projectSummary", "characters"],
  };

  const prompt = `
    角色设定：你是一位专业的影视剧本统筹和资深分镜指导。
    
    任务：
    请阅读下方的剧本片段（通常为第一集或开头部分）以及【分镜制作指导文档】。
    你需要进行深度的“内容理解”，提取“项目背景简介”和“主要角色卡片”。
    
    这些资料将直接用于生成可视化的项目看板，帮助分镜师快速理解剧情。

    【分镜制作指导文档】：
    ${guide}

    ${styleGuide ? `
    【项目特定美术风格定义】（Project Visual Bible）：
    参考此风格文档来辅助理解剧本的视觉氛围（例如：如果是赛博朋克风格，角色的“Visual Tags”应体现相关科技元素）。
    ${styleGuide}
    ` : ''}

    【剧本片段】：
    ${fullScriptSnippet.slice(0, 30000)}... (内容过长已截断)

    要求：
    1. **必须使用中文**。
    2. 项目简介：简明扼要，概括故事核心冲突和基调。
    3. 角色卡片：请提取 3-6 位主要角色。Visual Tags 必须包含具体的视觉特征以便后续 AI 生成画面。
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return {
      data: JSON.parse(text) as ProjectContext,
      usage: mapUsage(response.usageMetadata)
    };
  } catch (error: any) {
    console.error("Context Generation Error", error);
    if (error.message?.includes("404") || error.status === 404) {
       throw new Error(`Model not found (${modelName}). Please check API settings.`);
    }
    throw error;
  }
};

// 2. Generate Episode Summary & Shot List
export const generateEpisodeShots = async (
  modelName: string,
  episodeTitle: string,
  episodeContent: string,
  context: ProjectContext,
  guide: string,
  episodeIndex: number,
  styleGuide?: string // Replaced specific style guide with global one
): Promise<{ summary: string; shots: Shot[]; usage: TokenUsage }> => {
  const ai = getClient();

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: "本集剧情梗概 (中文)" },
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
    required: ["summary", "shots"],
  };

  const charContextStr = formatCharContext(context);

  const prompt = `
    角色设定：你是一位拥有10年经验的资深专业分镜师。
    
    任务：
    依据项目背景、上文剧情，严格遵循【分镜制作指导文档】，将《${episodeTitle}》的剧本正文转换为一份专业的分镜脚本（Shooting Script）。
    
    【项目上下文】：
    - 项目简介：${context.projectSummary}
    - 角色设定：
    ${charContextStr}
    
    【分镜制作指导文档】（这是你必须严格遵守的**行业工作规范**）：
    ${guide}

    ${styleGuide ? `
    【项目特定美术风格定义】（Project Visual Bible）：
    这是本项目的最高视觉纲领。在撰写“画面描述 (Description)”时，请务必融合此文档定义的视觉特征、光影倾向和美术风格。
    ${styleGuide}
    ` : ''}
    
    【当前待处理剧本 - ${episodeTitle}】：
    ${episodeContent}
    
    【输出要求】：
    1. **语言要求**：除专有名词外，全流程使用**中文**工作。
    2. **镜号格式 (CRITICAL)**：
       - 必须精确到场景。剧本中包含 "1-1 场景名" 格式的场号。
       - 分镜号格式必须为：**场景号-本场镜号**。
       - 例如：第12集第2场的第1个镜头，ID应为 **"12-2-01"**。第3场的第5个镜头，ID应为 **"12-3-05"**。
       - **ID前缀**将用于后续流程的拆分，请务必准确。
    3. **画面描述 (Description)**：
       - 必须具有极强的画面感。包含：时间、环境光影、人物站位、具体动作、美术细节。
    4. **soraPrompt** 字段请务必保持为空字符串。
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return {
      ...JSON.parse(text) as { summary: string; shots: Shot[] },
      usage: mapUsage(response.usageMetadata)
    };
  } catch (error: any) {
    console.error("Shot Generation Error", error);
    if (error.message?.includes("404") || error.status === 404) {
       throw new Error(`Model not found (${modelName}). Please check API settings.`);
    }
    throw error;
  }
};

// 3. Generate Sora Prompts (Single Scene, Chinese Only)
export const generateSoraPrompts = async (
  modelName: string,
  shots: Shot[],
  context: ProjectContext,
  soraGuide: string,
  styleGuide?: string // Replaced specific style guide with global one
): Promise<{ partialShots: { id: string; soraPrompt: string }[]; usage: TokenUsage }> => {
  const ai = getClient();
  
  // OPTIMIZATION 1: Use an Object Wrapper for the Schema. 
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
  
  // Simplified context for prompt generation
  const batchContext = shots.map(s => ({
    id: s.id,
    type: s.shotType,
    move: s.movement,
    desc: s.description
  }));

  // OPTIMIZATION 2: Chinese-only instructions, simplified logic.
  const prompt = `
    角色设定：你是一位精通Sora文生图模型的提示词专家。
    
    任务：
    请依据【Sora提示词撰写规范】，为以下 **${shots.length}** 个分镜撰写高质量的视频生成提示词。
    
    【项目上下文】：
    - 项目简介：${context.projectSummary}
    - 角色设定：
    ${charContextStr}
    
    【Sora提示词撰写规范】（通用技术手册）：
    ${soraGuide}

    ${styleGuide ? `
    【项目特定美术风格定义】（Project Visual Bible）：
    这是本项目的核心美术指令。请确保生成的提示词（色彩、光影、材质、氛围）严格符合此文档的描述。
    ${styleGuide}
    ` : ''}
    
    【当前批次分镜数据】：
    ${JSON.stringify(batchContext)}
    
    【输出要求 (CRITICAL)】：
    1. **语言要求**：请直接使用**中文**撰写提示词。**严禁翻译成英文**。
    2. **格式要求**：返回一个 JSON 对象，包含 "prompts" 数组。
    3. **内容要求**：每个对象仅包含 "id" (保持不变) 和 "soraPrompt"。
    4. **Sora Prompt内容**：包含主体、动作、环境、光影、摄影风格。
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const text = response.text;
    if (!text) {
        throw new Error("Empty response");
    }

    // Parse the object wrapper
    const resultObj = JSON.parse(text) as { prompts: { id: string; soraPrompt: string }[] };
    
    if (!resultObj.prompts) {
       // Fallback in case AI ignores schema and returns array directly
       if (Array.isArray(resultObj)) {
         return { partialShots: resultObj, usage: mapUsage(response.usageMetadata) };
       }
       throw new Error("Invalid JSON structure: missing 'prompts' array");
    }

    return {
        partialShots: resultObj.prompts,
        usage: mapUsage(response.usageMetadata)
    };
  } catch (error: any) {
    console.error(`Sora Request Error`, error);
    if (error.message?.includes("404") || error.status === 404) {
      throw new Error(`Model not found (${modelName}). Please check API settings.`);
    }
    throw error;
  }
};
