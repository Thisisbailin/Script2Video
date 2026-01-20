import { useWorkflowStore } from "./workflowStore";
import * as GeminiService from "../../services/geminiService";
import * as MultimodalService from "../../services/multimodalService";
import * as VideoService from "../../services/videoService";
import * as ViduService from "../../services/viduService";
import * as WuyinkejiService from "../../services/wuyinkejiService";
import * as SeedreamService from "../../services/seedreamService";
import * as WanService from "../../services/wanService";
import {
  INITIAL_VIDU_CONFIG,
  QWEN_WAN_IMAGE_ENDPOINT,
  QWEN_WAN_IMAGE_MODEL,
  QWEN_WAN_VIDEO_ENDPOINT,
  QWEN_WAN_VIDEO_MODEL,
} from "../../constants";
import { useCallback } from "react";
import { Character, CharacterForm } from "../../types";
import { buildApiUrl } from "../../utils/api";

const parseAtMentions = (text: string): string[] => {
  const matches = text.match(/@([\w\u4e00-\u9fa5-]+)/g) || [];
  const names = matches.map((m) => m.slice(1));
  const unique: string[] = [];
  names.forEach((n) => {
    if (!unique.includes(n)) unique.push(n);
  });
  return unique;
};

const escapeRegex = (str: string) => str.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

const uploadReferenceFile = async (source: string, options?: { bucket?: string; prefix?: string }) => {
  const response = await fetch(source);
  const blob = await response.blob();
  const contentType = blob.type || "image/png";
  const ext = contentType.split("/")[1] || "png";
  const fileName = `${options?.prefix || "wan-inputs/"}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const bucket = options?.bucket || "assets";

  const signedRes = await fetch(buildApiUrl("/api/upload-url"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, bucket, contentType }),
  });
  if (!signedRes.ok) {
    const err = await signedRes.text();
    throw new Error(`Reference upload URL error (${signedRes.status}): ${err}`);
  }
  const signedData = await signedRes.json();
  if (!signedData?.signedUrl) {
    throw new Error("Reference upload failed: missing signedUrl.");
  }

  const uploadRes = await fetch(signedData.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Reference upload failed (${uploadRes.status}): ${err}`);
  }

  if (signedData.publicUrl) return signedData.publicUrl as string;
  if (signedData.path) {
    const downloadRes = await fetch(buildApiUrl("/api/download-url"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: signedData.path, bucket: signedData.bucket || bucket }),
    });
    if (!downloadRes.ok) {
      const err = await downloadRes.text();
      throw new Error(`Reference download URL error (${downloadRes.status}): ${err}`);
    }
    const downloadData = await downloadRes.json();
    if (downloadData?.signedUrl) return downloadData.signedUrl as string;
  }

  throw new Error("Reference upload failed: no accessible URL returned.");
};

const normalizeWanImages = async (sources: string[]) => {
  const results: string[] = [];
  for (const src of sources) {
    if (!src) continue;
    if (src.startsWith("http://") || src.startsWith("https://")) {
      results.push(src);
      continue;
    }
    if (src.startsWith("data:") || src.startsWith("blob:")) {
      const uploaded = await uploadReferenceFile(src, { bucket: "assets", prefix: "wan-inputs/" });
      results.push(uploaded);
      continue;
    }
    results.push(src);
  }
  return results;
};

const normalizeWanAudio = async (source?: string) => {
  if (!source) return undefined;
  if (source.startsWith("http://") || source.startsWith("https://")) return source;
  if (source.startsWith("data:") || source.startsWith("blob:")) {
    return uploadReferenceFile(source, { bucket: "assets", prefix: "wan-audio/" });
  }
  try {
    const downloadRes = await fetch(buildApiUrl("/api/download-url"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: source, bucket: "assets" }),
    });
    if (!downloadRes.ok) {
      const err = await downloadRes.text();
      throw new Error(err);
    }
    const data = await downloadRes.json();
    if (data?.signedUrl) return data.signedUrl as string;
  } catch (e) {
    console.warn("Failed to resolve audio URL", e);
  }
  return source;
};

const mapWanVideoSize = (aspectRatio?: string, resolution?: string) => {
  const ratio = (aspectRatio || "16:9").trim();
  const res = (resolution || "720P").toUpperCase();
  const sizeMap: Record<string, Record<string, string>> = {
    "480P": {
      "16:9": "832*480",
      "9:16": "480*832",
      "1:1": "624*624",
    },
    "720P": {
      "16:9": "1280*720",
      "9:16": "720*1280",
      "1:1": "960*960",
      "4:3": "1088*832",
      "3:4": "832*1088",
    },
    "1080P": {
      "16:9": "1920*1080",
      "9:16": "1080*1920",
      "1:1": "1440*1440",
      "4:3": "1632*1248",
      "3:4": "1248*1632",
    },
  };
  const normalizedRatio = ["16:9", "9:16", "1:1", "4:3", "3:4"].includes(ratio) ? ratio : "16:9";
  return sizeMap[res]?.[normalizedRatio] || "1280*720";
};

export const useLabExecutor = () => {
  const store = useWorkflowStore();
  const config = store.appConfig;

  const runLLM = useCallback(async (nodeId: string) => {
    const node = store.getNodeById(nodeId);
    if (!node || !config) return;
    const data: any = node.data;
    const { text } = store.getConnectedInputs(nodeId);
    if (!text) {
      store.updateNodeData(nodeId, { status: "error", error: "Missing text input" });
      return;
    }

    const selection = data.contextSelection || {};
    const labContext = store.labContext;
    const contextParts: string[] = [];

    if (selection.script && labContext.rawScript) {
      contextParts.push(`[Script]\n${labContext.rawScript}`);
    }
    if (selection.globalStyleGuide && labContext.globalStyleGuide) {
      contextParts.push(`[Global Style Guide]\n${labContext.globalStyleGuide.slice(0, 6000)}`);
    }
    if (selection.shotGuide && labContext.shotGuide) {
      contextParts.push(`[Shot Guide]\n${labContext.shotGuide.slice(0, 6000)}`);
    }
    if (selection.soraGuide && labContext.soraGuide) {
      contextParts.push(`[Sora Guide]\n${labContext.soraGuide.slice(0, 6000)}`);
    }
    if (selection.dramaGuide && labContext.dramaGuide) {
      contextParts.push(`[Drama Guide]\n${labContext.dramaGuide.slice(0, 6000)}`);
    }
    if (selection.projectSummary && labContext.context.projectSummary) {
      contextParts.push(`[Project Summary]\n${labContext.context.projectSummary.slice(0, 6000)}`);
    }
    if (selection.episodeSummaries && labContext.context.episodeSummaries.length) {
      const summaries = labContext.context.episodeSummaries
        .slice(0, 10)
        .map((s) => `- Ep ${s.episodeId}: ${s.summary}`)
        .join("\n");
      contextParts.push(`[Episode Summaries]\n${summaries}`);
    }
    if (selection.characters && labContext.context.characters.length) {
      const characters = labContext.context.characters
        .slice(0, 12)
        .map((c) => {
          const forms = c.forms?.slice(0, 4).map((f) => f.formName).join(", ");
          return `- ${c.name} (${c.role})${forms ? ` | Forms: ${forms}` : ""}`;
        })
        .join("\n");
      contextParts.push(`[Characters]\n${characters}`);
    }
    if (selection.locations && labContext.context.locations.length) {
      const locations = labContext.context.locations
        .slice(0, 12)
        .map((l) => `- ${l.name} (${l.type})`)
        .join("\n");
      contextParts.push(`[Locations]\n${locations}`);
    }

    const contextBlock = contextParts.length ? `\n\nContext:\n${contextParts.join("\n\n")}` : "";
    const prompt = `${text}${contextBlock}\n\n请直接输出结果内容，不要回复“好的/明白”等礼貌性文字。`;
    const configToUse = {
      ...config.textConfig,
      model: data.model || config.textConfig.model,
    };

    store.updateNodeData(nodeId, { status: "loading", error: null });
    try {
      const result = await GeminiService.generateFreeformText(
        configToUse,
        prompt,
        "Role: Creative Assistant. Output only the requested content with no pleasantries or confirmations."
      );
      store.updateNodeData(nodeId, { status: "complete", outputText: result.outputText, error: null });
    } catch (e: any) {
      store.updateNodeData(nodeId, { status: "error", error: e.message || "LLM failed" });
    }
  }, [config?.textConfig, store]);

  const extractImageUrl = (content: string): string | null => {
    const match = content.match(/!\[[^\]]*\]\(([^)]+)\)/);
    return match ? match[1] : null;
  };

  const runImageGen = useCallback(async (nodeId: string) => {
    const node = store.getNodeById(nodeId);
    if (!node) return;
    const { images, text: connectedText, atMentions, imageRefs } = store.getConnectedInputs(nodeId);
    const data = node.data as any; // Cast for easier access to new fields
    const manualPrompt = data.inputPrompt;
    const text = connectedText || manualPrompt;
    const isWanImageNode = node.type === "wanImageGen";

    if (!text && images.length === 0) {
      store.updateNodeData(nodeId, { status: "error", error: "Missing text input (prompt required)" });
      return;
    }

    if (!config) {
      store.updateNodeData(nodeId, { status: "error", error: "Configuration not loaded." });
      return;
    }

    store.updateNodeData(nodeId, { status: "loading", error: null });
    try {
      const aspectRatio = data.aspectRatio || "1:1";
      const modelOverride = isWanImageNode ? QWEN_WAN_IMAGE_MODEL : data.model;

      // Use node-specific model or fallback to config
      const configToUse = {
        ...config.multimodalConfig,
        model: modelOverride || config.multimodalConfig.model
      };
      if (isWanImageNode) {
        configToUse.provider = "wan";
        configToUse.baseUrl = QWEN_WAN_IMAGE_ENDPOINT;
        configToUse.apiKey = "";
      }

      if (configToUse.provider === 'wuyinkeji') {
        // --- Asynchronous Flow (NanoBanana-pro) ---
        const refImage = images.find((src) => src.startsWith("http")) || undefined;
        const { id } = await WuyinkejiService.submitImageTask(text || "Generate an image", configToUse, {
          aspectRatio,
          inputImageUrl: refImage
        });

        store.updateNodeData(nodeId, { status: "loading", taskId: id, error: null });

        const maxAttempts = 60;
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          const result = await WuyinkejiService.checkImageTaskStatus(id, configToUse);
          if (result.status === "succeeded") {
            store.updateNodeData(nodeId, {
              status: "complete",
              outputImage: result.url,
              error: null,
              model: configToUse.model // store used model for reference
            });

            // Add to global history for reuse
            store.addToGlobalHistory({
              type: "image",
              src: result.url!,
              prompt: text || "Image Input",
              model: configToUse.model,
              aspectRatio
            });
            return;
          }
          if (result.status === "failed") {
            store.updateNodeData(nodeId, { status: "error", error: result.errorMsg || "Image generation failed." });
            return;
          }
          // Wait 5 seconds between polls
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        store.updateNodeData(nodeId, { status: "error", error: "Image generation timed out." });
        return;
      }

      if (configToUse.provider === 'seedream') {
        const refImage = images.find((src) => src.startsWith("http")) || undefined;
        store.updateNodeData(nodeId, { status: "loading", error: null });

        try {
          const url = await SeedreamService.generateSeedreamImage(text || "Generate an image", configToUse, {
            aspectRatio,
            inputImageUrl: refImage
          });

          store.updateNodeData(nodeId, {
            status: "complete",
            outputImage: url,
            error: null,
            model: configToUse.model
          });

          store.addToGlobalHistory({
            type: "image",
            src: url,
            prompt: text || "Image Input",
            model: configToUse.model,
            aspectRatio
          });
        } catch (e: any) {
          store.updateNodeData(nodeId, { status: "error", error: e.message || "Seedream generation failed." });
        }
        return;
      }

      if (configToUse.provider === 'wan') {
        if (!text) {
          store.updateNodeData(nodeId, { status: "error", error: "Wan 图片需要提示词。" });
          return;
        }
        const normalizedImages = await normalizeWanImages(images);
        const { id, url } = await WanService.submitWanImageTask(text || "Generate an image", configToUse, {
          aspectRatio,
          inputImages: normalizedImages,
          enableInterleave: data.enableInterleave,
          negativePrompt: data.negativePrompt,
          outputCount: data.outputCount,
          maxImages: data.maxImages,
          seed: data.seed,
          promptExtend: data.promptExtend,
          watermark: data.watermark,
          size: data.size,
        });

        if (url) {
          store.updateNodeData(nodeId, {
            status: "complete",
            outputImage: url,
            error: null,
            model: configToUse.model,
          });
          store.addToGlobalHistory({
            type: "image",
            src: url,
            prompt: text || "Image Input",
            model: configToUse.model,
            aspectRatio,
          });
          return;
        }

        if (!id) {
          store.updateNodeData(nodeId, { status: "error", error: "Wan 任务创建失败。" });
          return;
        }

        store.updateNodeData(nodeId, { status: "loading", taskId: id, error: null });

        const maxAttempts = 60;
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          const result = await WanService.checkWanTaskStatus(id);
          if (result.status === "succeeded") {
            store.updateNodeData(nodeId, {
              status: "complete",
              outputImage: result.url,
              error: null,
              model: configToUse.model,
            });
            if (result.url) {
              store.addToGlobalHistory({
                type: "image",
                src: result.url,
                prompt: text || "Image Input",
                model: configToUse.model,
                aspectRatio,
              });
            }
            return;
          }
          if (result.status === "failed") {
            store.updateNodeData(nodeId, { status: "error", error: result.errorMsg || "Wan 图像生成失败。" });
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        store.updateNodeData(nodeId, { status: "error", error: "Wan 图像生成超时。" });
        return;
      }

      // --- Standard Flow (OpenAI compatible) ---
      let promptContent = text || "Generate an image based on the input";

      // Removed Style Preset injection as per user request for clean multimodal prompts
      promptContent = `${promptContent}\n\n[Aspect Ratio]: ${aspectRatio}`;

      if (images.length > 0) {
        const refs = images.map((img: string, i: number) => `![ref ${i}](${img})`).join('\n');
        promptContent = `${promptContent}\n\n${refs}`;
      }

      const res = await MultimodalService.sendMessage(
        [{ role: "user", content: promptContent }],
        configToUse
      );

      console.log('--- AI Full Response ---');
      console.log(res);
      console.log('------------------------');

      const url = extractImageUrl(res.content) || res.content.trim();

      // Basic validation if it's a URL or base64
      if (!url || (!url.startsWith('http') && !url.startsWith('data:image'))) {
        throw new Error("No image URL could be extracted from response. Response was: " + res.content.substring(0, 100));
      }

      store.updateNodeData(nodeId, {
        status: "complete",
        outputImage: url,
        error: null,
        model: configToUse.model // store used model for reference
      });

      // Add to global history for reuse
      store.addToGlobalHistory({
        type: "image",
        src: url,
        prompt: text || "Image Input",
        model: configToUse.model,
        aspectRatio
      });

    } catch (e: any) {
      store.updateNodeData(nodeId, { status: "error", error: e.message || "Image gen failed" });
    }
  }, [config?.multimodalConfig, store]);

  const runViduVideoGen = useCallback(async (nodeId: string) => {
    const node = store.getNodeById(nodeId);
    if (!node || !config) return;
    const { images, text: connectedText, atMentions, imageRefs } = store.getConnectedInputs(nodeId);
    const data = node.data as any;
    const prompt = (connectedText || data.inputPrompt || "").trim() || "The astronaut waved and the camera moved up.";

    const viduConfig = {
      baseUrl: INITIAL_VIDU_CONFIG.baseUrl,
      defaultModel: INITIAL_VIDU_CONFIG.defaultModel || "viduq2-pro",
    };
    const fixedModel = viduConfig.defaultModel;

    const mode = data.mode || "audioVideo";
    const useCharacters = data.useCharacters !== false;

    const labContext = store.labContext;
    const allForms: { form: CharacterForm; characterId: string }[] =
      (labContext?.context?.characters || []).flatMap((c: Character) =>
        (c.forms || []).map((f) => ({ form: f, characterId: c.id }))
      );

    const mentions = atMentions?.length ? atMentions.map(m => m.name) : parseAtMentions(prompt);

    const formImageMap = new Map<string, string[]>();
    (imageRefs || []).forEach((ref) => {
      if (ref.formTag) {
        const key = ref.formTag.toLowerCase();
        const arr = formImageMap.get(key) || [];
        arr.push(ref.src);
        formImageMap.set(key, arr);
      }
    });

    const chunkImagesForSubjects = (count: number) => {
      if (!images.length || count === 0) return Array.from({ length: count }, () => [] as string[]);
      const chunkSize = Math.max(1, Math.ceil(images.length / count));
      const buckets: string[][] = [];
      for (let i = 0; i < count; i++) {
        buckets.push(images.slice(i * chunkSize, (i + 1) * chunkSize));
      }
      return buckets;
    };

    const defaultSubjectImages = [
      "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/image2video.png",
      "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/reference2video-1.png",
      "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/reference2video-2.png",
    ];

    const resolvedSubjects =
      useCharacters && mentions.length > 0
        ? (() => {
          const buckets = chunkImagesForSubjects(mentions.length);
          return mentions.map((m, idx) => {
            const mapped = formImageMap.get(m.toLowerCase()) || [];
            const hit = allForms.find((entry) => entry.form.formName.toLowerCase() === m.toLowerCase());
            return {
              id: hit?.form.formName || m,
              images: (mapped.length ? mapped : buckets[idx]) || [],
              voiceId: data.voiceId || "professional_host",
            };
          });
        })()
        : (data.subjects && data.subjects.length > 0)
          ? data.subjects
          : (() => {
            const fallbackBuckets = chunkImagesForSubjects(3);
            const result: { id?: string; images: string[]; voiceId?: string }[] = [];
            for (let i = 0; i < fallbackBuckets.length; i++) {
              result.push({
                id: `subject${i + 1}`,
                images: fallbackBuckets[i],
                voiceId: data.voiceId || "professional_host",
              });
            }
            return result.length
              ? result
              : [
                {
                  id: "subject1",
                  images: [
                    "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/image2video.png",
                    "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/reference2video-1.png",
                    "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/reference2video-2.png",
                  ],
                  voiceId: data.voiceId || "professional_host",
                },
              ];
          })();

    // Guarantee each subject has at least one image (Vidu API rejects empty arrays)
    const hydratedSubjects = resolvedSubjects.map((s, idx) => {
      const imgs = (s.images || []).filter(Boolean);
      if (imgs.length) return s;
      const pool = images.length ? images : defaultSubjectImages;
      const fallbackImg = pool[idx % pool.length];
      return { ...s, images: fallbackImg ? [fallbackImg] : defaultSubjectImages };
    });

    const visualImages = images.length
      ? images
      : [
        "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/reference2video-1.png",
        "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/reference2video-2.png",
        "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/reference2video-3.png",
      ];

    if (mode === "videoOnly" && visualImages.length === 0) {
      store.updateNodeData(nodeId, { status: "error", error: "需要至少一张参考图" });
      return;
    }

    const promptForVidu =
      useCharacters && mentions.length > 0
        ? mentions.reduce((acc, name, idx) => {
          const reg = new RegExp(`@${escapeRegex(name)}`, "g");
          return acc.replace(reg, `@${idx + 1}`);
        }, prompt)
        : prompt;

    store.updateNodeData(nodeId, { status: "loading", error: null });

    try {
      const request = mode === "audioVideo"
        ? {
          mode: "audioVideo" as const,
          audioParams: {
            model: fixedModel,
            subjects: hydratedSubjects,
            prompt: promptForVidu,
            duration: data.duration ?? 10,
            audio: true,
            offPeak: data.offPeak !== false,
          },
        }
        : {
          mode: "videoOnly" as const,
          visualParams: {
            model: fixedModel,
            images: visualImages,
            prompt: promptForVidu,
            duration: data.duration ?? 10,
            aspectRatio: data.aspectRatio || "16:9",
            resolution: data.resolution || "1080p",
            movementAmplitude: data.movementAmplitude || "auto",
            seed: data.seed ?? 0,
            offPeak: data.offPeak !== false,
            audio: false,
          },
        };

      const { taskId } = await ViduService.createReferenceVideo(request as any, viduConfig);

      store.updateNodeData(nodeId, { status: "loading", videoId: taskId, videoUrl: undefined, error: null });

      const maxAttempts = 60;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const result = await ViduService.fetchTaskResult(taskId, viduConfig);
        if (result.state === "success") {
          const url = result.creations?.[0]?.url || result.creations?.[0]?.watermarked_url;
          store.updateNodeData(nodeId, { status: "complete", videoUrl: url, error: null });
          return;
        }
        if (result.state === "failed") {
          store.updateNodeData(nodeId, { status: "error", error: result.err_code || "Vidu 生成失败" });
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      store.updateNodeData(nodeId, { status: "error", error: "Vidu 生成超时" });
    } catch (e: any) {
      store.updateNodeData(nodeId, { status: "error", error: e.message || "Vidu 提交失败" });
    }
  }, [config, store]);

  const runVideoGen = useCallback(async (nodeId: string) => {
    const node = store.getNodeById(nodeId);
    if (!node || !config) return;
    if (node.type === "viduVideoGen") {
      return runViduVideoGen(nodeId);
    }
    const { images, text: connectedText } = store.getConnectedInputs(nodeId);
    const data = node.data as any;
    const prompt = (connectedText || data.inputPrompt || "").trim();

    if (images.length === 0 && !prompt) {
      store.updateNodeData(nodeId, { status: "error", error: "Missing text input (prompt required)." });
      return;
    }

    const isWanVideo = (config.videoConfig.baseUrl || "").includes("/api/v1/services/aigc/video-generation/");
    const isWanVideoNode = node.type === "wanVideoGen";
    if (!config.videoConfig.baseUrl || (!config.videoConfig.apiKey && !isWanVideo && !isWanVideoNode)) {
      store.updateNodeData(nodeId, { status: "error", error: "Missing video API configuration." });
      return;
    }

    if ((isWanVideo || isWanVideoNode) && images.length === 0) {
      store.updateNodeData(nodeId, { status: "error", error: "Wan 视频需要至少一张参考图。" });
      return;
    }
    if ((isWanVideo || isWanVideoNode) && !prompt) {
      store.updateNodeData(nodeId, { status: "error", error: "Wan 视频需要提示词。" });
      return;
    }

    store.updateNodeData(nodeId, { status: "loading", error: null });

    try {
      const normalizedImages = (isWanVideo || isWanVideoNode) ? await normalizeWanImages(images) : images;
      const refImage =
        normalizedImages.find((src) => src.startsWith("http")) ||
        ((isWanVideo || isWanVideoNode) ? normalizedImages[0] : undefined);
      const params: any = {
        aspectRatio: data.aspectRatio || "16:9",
        duration: data.duration || "5s",
        quality: data.quality || "standard",
        inputImageUrl: refImage,
      };
      if (isWanVideo || isWanVideoNode) {
        const fallbackResolution = data.quality === "high" ? "1080P" : "720P";
        const resolution = data.resolution || fallbackResolution;
        params.size = mapWanVideoSize(data.aspectRatio, resolution);
        params.promptExtend = data.promptExtend;
        if (data.promptExtend !== false) {
          params.shotType = data.shotType;
        }
        params.watermark = data.watermark;
        params.negativePrompt = data.negativePrompt;
        params.seed = data.seed;
        if (data.audioEnabled && data.audioUrl) {
          const audioUrl = data.audioUrl.trim();
          params.audioUrl = await normalizeWanAudio(audioUrl);
        }
      }

      // Use node-specific model or fallback to config
      const configToUse = {
        ...config.videoConfig,
        model: data.model || config.videoConfig.model
      };
      if (isWanVideoNode) {
        configToUse.baseUrl = QWEN_WAN_VIDEO_ENDPOINT;
        configToUse.model = QWEN_WAN_VIDEO_MODEL;
        configToUse.apiKey = "";
      }

      if (isWanVideo || isWanVideoNode) {
        const { id, url } = await WanService.submitWanVideoTask(prompt || "Animate this", configToUse, params);
        if (url) {
          store.updateNodeData(nodeId, { status: "complete", videoUrl: url, error: null });
          return;
        }
        if (!id) {
          store.updateNodeData(nodeId, { status: "error", error: "Wan 视频任务创建失败。" });
          return;
        }

        store.updateNodeData(nodeId, { status: "loading", videoId: id, videoUrl: undefined, error: null });

        const maxAttempts = 60;
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          const result = await WanService.checkWanTaskStatus(id);
          if (result.status === "succeeded") {
            store.updateNodeData(nodeId, { status: "complete", videoUrl: result.url, error: null });
            return;
          }
          if (result.status === "failed") {
            store.updateNodeData(nodeId, { status: "error", error: result.errorMsg || "Wan 视频生成失败。" });
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        store.updateNodeData(nodeId, { status: "error", error: "Wan 视频生成超时。" });
        return;
      }

      const { id } = await VideoService.submitVideoTask(prompt || "Animate this", configToUse, params);

      store.updateNodeData(nodeId, { status: "loading", videoId: id, videoUrl: undefined, error: null });

      const maxAttempts = 60;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const result = await VideoService.checkTaskStatus(id, configToUse);
        if (result.status === "succeeded") {
          store.updateNodeData(nodeId, { status: "complete", videoUrl: result.url, error: null });
          return;
        }
        if (result.status === "failed") {
          store.updateNodeData(nodeId, { status: "error", error: result.errorMsg || "Video generation failed." });
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      store.updateNodeData(nodeId, { status: "error", error: "Video generation timed out." });
    } catch (e: any) {
      store.updateNodeData(nodeId, { status: "error", error: e.message || "Video submit failed" });
    }
  }, [config?.videoConfig, runViduVideoGen, store]);

  return {
    runLLM,
    runImageGen,
    runVideoGen,
  };
};
