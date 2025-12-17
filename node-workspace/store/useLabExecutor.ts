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
      store.updateNodeData(nodeId, { status: "complete", outputText: result.summary, error: null });
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
    const { images, text } = store.getConnectedInputs(nodeId);
    if (images.length === 0 || !text) {
      store.updateNodeData(nodeId, { status: "error", error: "Missing image or text input" });
      return;
    }
    store.updateNodeData(nodeId, { status: "loading", error: null });
    try {
      // use sendMessage: prepend image markdown to prompt
      const promptWithImage = `${text}\n\n![ref](${images[0]})`;
      const res = await MultimodalService.sendMessage([{ role: "user", content: promptWithImage }], config.multimodalConfig);
      const url = extractImageUrl(res.content) || res.content.trim();
      if (!url) throw new Error("No image URL returned");
      store.updateNodeData(nodeId, { status: "complete", outputImage: url, error: null });
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
