import { useWorkflowStore } from "./workflowStore";
import { useConfig } from "../../hooks/useConfig";
import * as GeminiService from "../../services/geminiService";
import * as MultimodalService from "../../services/multimodalService";
import * as VideoService from "../../services/videoService";
import { useCallback } from "react";

export const useLabExecutor = () => {
  const store = useWorkflowStore();
  const { config } = useConfig("script2video_config_v1"); // reuse existing config hook

  const runLLM = useCallback(async (nodeId: string) => {
    const node = store.getNodeById(nodeId);
    if (!node) return;
    const data: any = node.data;
    const { text } = store.getConnectedInputs(nodeId);
    if (!text) {
      store.updateNodeData(nodeId, { status: "error", error: "Missing text input" });
      return;
    }
    store.updateNodeData(nodeId, { status: "loading", error: null });
    try {
      const result = await GeminiService.generateProjectSummary(config.textConfig, text);
      store.updateNodeData(nodeId, { status: "complete", outputText: result.projectSummary, error: null });
    } catch (e: any) {
      store.updateNodeData(nodeId, { status: "error", error: e.message || "LLM failed" });
    }
  }, [config.textConfig, store]);

  const extractImageUrl = (content: string): string | null => {
    const match = content.match(/!\[[^\]]*\]\(([^)]+)\)/);
    return match ? match[1] : null;
  };

  const runImageGen = useCallback(async (nodeId: string) => {
    const node = store.getNodeById(nodeId);
    if (!node) return;
    const { images, text: connectedText } = store.getConnectedInputs(nodeId);
    const data = node.data as any; // Cast for easier access to new fields
    const manualPrompt = data.inputPrompt;
    const text = connectedText || manualPrompt;

    if (!text && images.length === 0) {
      store.updateNodeData(nodeId, { status: "error", error: "Missing text input (prompt required)" });
      return;
    }

    store.updateNodeData(nodeId, { status: "loading", error: null });
    try {
      const aspectRatio = data.aspectRatio || "1:1";
      const modelOverride = data.model;

      let promptContent = text || "Generate an image based on the input";

      // --- Prompt Engineering ---
      // Removed Style Preset injection as per user request for clean multimodal prompts

      promptContent = `${promptContent}\n\n[Aspect Ratio]: ${aspectRatio}`;

      // Removed Negative Prompt injection

      // Removed Global Style Guide injection to prevent unwanted context leakage

      if (images.length > 0) {
        const refs = images.map((img: string, i: number) => `![ref ${i}](${img})`).join('\n');
        promptContent = `${promptContent}\n\n${refs}`;
      }

      // Use node-specific model or fallback to config
      const configToUse = {
        ...config.multimodalConfig,
        model: modelOverride || config.multimodalConfig.model
      };

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
  }, [config.multimodalConfig, store]);

  const runVideoGen = useCallback(async (nodeId: string) => {
    const node = store.getNodeById(nodeId);
    if (!node) return;
    const { images, text } = store.getConnectedInputs(nodeId);
    if (images.length === 0 && !text) { // Allow text-only video gen
      store.updateNodeData(nodeId, { status: "error", error: "Missing text input" });
      return;
    }
    store.updateNodeData(nodeId, { status: "loading", error: null });

    try {
      const data = node.data as any;
      const params: any = {
        aspectRatio: data.aspectRatio || "16:9",
        duration: data.duration || "5s",
        quality: data.quality || "standard"
      };

      // Use node-specific model or fallback to config
      const configToUse = {
        ...config.videoConfig,
        model: data.model || config.videoConfig.model
      };

      // If we have strict model requirements or endpoints that need model in body, VideoService handles it via config/params usually, 
      // but let's make sure we pass it if needed. For now, VideoService uses config.apiKey/baseUrl. 
      // If the service allows passing model explicitly in submitVideoTask, we should updated VideoService or rely on it using config.

      // We need to modify submitVideoTask signature if we want to pass explicit model override cleanly, 
      // OR we just create a temp config object which we did above.

      const { id } = await VideoService.submitVideoTask(text || "Animate this", configToUse, params);

      store.updateNodeData(nodeId, { status: "complete", videoId: id, videoUrl: undefined, error: null });
    } catch (e: any) {
      store.updateNodeData(nodeId, { status: "error", error: e.message || "Video submit failed" });
    }
  }, [config.videoConfig, store]);

  return {
    runLLM,
    runImageGen,
    runVideoGen,
  };
};
