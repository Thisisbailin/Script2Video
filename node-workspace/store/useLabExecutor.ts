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
    const manualPrompt = (node.data as any).inputPrompt;
    const text = connectedText || manualPrompt;

    if (!text) {
      store.updateNodeData(nodeId, { status: "error", error: "Missing text input (prompt required)" });
      return;
    }

    store.updateNodeData(nodeId, { status: "loading", error: null });
    try {
      // Construction: text + optional image references + aspect ratio
      const aspectRatio = (node.data as any).aspectRatio || "1:1";
      let promptContent: any = text;

      // Append aspect ratio instruction for the model
      promptContent = `${text}\n\n[Aspect Ratio]: ${aspectRatio}`;

      // Append Global Style Guide if available
      if (store.globalStyleGuide) {
        promptContent = `${promptContent}\n\n【Global Style Guide】\n${store.globalStyleGuide}`;
      }

      if (images.length > 0) {
        const refs = images.map((img, i) => `![ref ${i}](${img})`).join('\n');
        promptContent = `${promptContent}\n\n${refs}`;
      }

      const res = await MultimodalService.sendMessage(
        [{ role: "user", content: promptContent }],
        config.multimodalConfig
      );

      const url = extractImageUrl(res.content) || res.content.trim();

      // Basic validation if it's a URL or base64
      if (!url || (!url.startsWith('http') && !url.startsWith('data:image'))) {
        throw new Error("No image URL could be extracted from response. Response was: " + res.content.substring(0, 100));
      }

      store.updateNodeData(nodeId, {
        status: "complete",
        outputImage: url,
        error: null,
        model: config.multimodalConfig.model
      });

      // Add to global history for reuse
      store.addToGlobalHistory({
        image: url,
        prompt: text,
        model: config.multimodalConfig.model
      });

    } catch (e: any) {
      store.updateNodeData(nodeId, { status: "error", error: e.message || "Image gen failed" });
    }
  }, [config.multimodalConfig, store]);

  const runVideoGen = useCallback(async (nodeId: string) => {
    const node = store.getNodeById(nodeId);
    if (!node) return;
    const { images, text } = store.getConnectedInputs(nodeId);
    if (images.length === 0 || !text) {
      store.updateNodeData(nodeId, { status: "error", error: "Missing image or text input" });
      return;
    }
    store.updateNodeData(nodeId, { status: "loading", error: null });
    try {
      const params: any = { aspectRatio: (node.data as any).aspectRatio || "16:9" };
      const { id } = await VideoService.submitVideoTask(text, config.videoConfig, params);
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
