import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  ReactFlow,
  MiniMap,
  Connection,
  NodeTypes,
  EdgeTypes,
  useReactFlow,
  OnConnectEnd,
  ReactFlowProvider,
  ConnectionMode,
  XYPosition,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "../styles/nodelab.css";
import { useWorkflowStore } from "../store/workflowStore";
import { isValidConnection } from "../utils/handles";
import { WorkflowFile, NodeType, WorkflowNode, WorkflowEdge, TextNodeData, GroupNodeData, ShotNodeData, VideoGenNodeData, ImageGenNodeData } from "../types";
import { EditableEdge } from "../edges/EditableEdge";
import {
  ImageInputNode, AnnotationNode, TextNode,
  GroupNode,
  ImageGenNode,
  WanImageGenNode,
  SoraVideoGenNode,
  WanVideoGenNode,
  ViduVideoGenNode,
  ShotNode,
} from "../nodes";
import { useLabExecutor } from "../store/useLabExecutor";
import { MultiSelectToolbar } from "./MultiSelectToolbar";
import { FloatingActionBar } from "./FloatingActionBar";
import { ConnectionDropMenu } from "./ConnectionDropMenu";
import { AssetsPanel } from "./AssetsPanel";
import { AgentSettingsPanel } from "./AgentSettingsPanel";
import { QalamAgent } from "./QalamAgent";
import { ViewportControls } from "./ViewportControls";
import { Toast, useToast } from "./Toast";
import { AnnotationModal } from "./AnnotationModal";
import { DesignAssetItem, ProjectData } from "../../types";
import type { ModuleKey } from "./ModuleBar";
import { FolderOpen, FileText, List } from "lucide-react";

const nodeTypes: NodeTypes = {
  imageInput: ImageInputNode,
  annotation: AnnotationNode,
  text: TextNode,
  group: GroupNode,
  imageGen: ImageGenNode,
  wanImageGen: WanImageGenNode,
  soraVideoGen: SoraVideoGenNode,
  wanVideoGen: WanVideoGenNode,
  viduVideoGen: ViduVideoGenNode,
  shot: ShotNode,
};

const edgeTypes: EdgeTypes = {
  editable: EditableEdge,
};

interface ConnectionDropState {
  position: { x: number; y: number };
  flowPosition: { x: number; y: number };
  handleType: "image" | "text" | null;
  connectionType: "source" | "target";
  sourceNodeId: string | null;
  sourceHandleId: string | null;
}

interface NodeLabProps {
  projectData: ProjectData;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;
  onAssetLoad?: (
    type:
      | "script"
      | "globalStyleGuide"
      | "shotGuide"
      | "soraGuide"
      | "storyboardGuide"
      | "dramaGuide"
      | "csvShots"
      | "understandingJson",
    content: string,
    fileName?: string
  ) => void;
  onOpenModule?: (key: ModuleKey) => void;
  syncIndicator?: { label: string; color: string } | null;
  onExportCsv?: () => void;
  onExportXls?: () => void;
  onExportUnderstandingJson?: () => void;
  onOpenStats?: () => void;
  onToggleTheme?: () => void;
  isDarkMode?: boolean;
  onOpenSyncPanel?: () => void;
  onOpenInfoPanel?: () => void;
  onResetProject?: () => void;
  onSignOut?: () => void;
  accountInfo?: {
    isLoaded: boolean;
    isSignedIn: boolean;
    name?: string;
    email?: string;
    avatarUrl?: string;
    onSignIn?: () => void;
    onSignOut?: () => void;
    onUploadAvatar?: () => void;
  };
  onToggleWorkflow?: (anchorRect?: DOMRect) => void;
  onTryMe?: () => void;
}

type ThemeKey = "dark" | "light" | "sand" | "creative" | "calm" | "lively";

type ThemePreset = {
  label: string;
  bg: string;
  panel: string;
  panelStrong: string;
  panelMuted: string;
  panelSoft: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  panelShadow: string;
  panelShadowStrong: string;
  nodeShadow: string;
  nodeShadowStrong: string;
  pattern: string;
  patternSoft: string;
  nodeBgGradient: string;
  nodeHeaderBg: string;
  groupBg: string;
  groupBgSelected: string;
  groupBorder: string;
  groupBorderStrong: string;
  groupHighlight: string;
  groupShadow: string;
  scheme: "light" | "dark";
};

const THEME_PRESETS: Record<ThemeKey, ThemePreset> = {
  dark: {
    label: "Dark",
    bg: "#0a0a0a",
    panel: "rgba(11, 13, 16, 0.95)",
    panelStrong: "rgba(15, 19, 24, 0.98)",
    panelMuted: "rgba(255, 255, 255, 0.04)",
    panelSoft: "rgba(255, 255, 255, 0.08)",
    border: "rgba(255, 255, 255, 0.12)",
    borderStrong: "rgba(255, 255, 255, 0.26)",
    textPrimary: "#f8fafc",
    textSecondary: "rgba(255, 255, 255, 0.68)",
    textMuted: "rgba(255, 255, 255, 0.45)",
    accent: "#3b82f6",
    accentStrong: "#60a5fa",
    accentSoft: "rgba(59, 130, 246, 0.18)",
    panelShadow: "0 12px 28px rgba(0, 0, 0, 0.28)",
    panelShadowStrong: "0 16px 36px rgba(0, 0, 0, 0.32)",
    nodeShadow: "0 24px 60px rgba(0, 0, 0, 0.55)",
    nodeShadowStrong: "0 32px 70px rgba(0, 0, 0, 0.7)",
    pattern: "rgba(255, 255, 255, 0.08)",
    patternSoft: "rgba(255, 255, 255, 0.04)",
    nodeBgGradient: "linear-gradient(160deg, rgba(20, 26, 36, 0.95), rgba(10, 12, 16, 0.98))",
    nodeHeaderBg: "rgba(255, 255, 255, 0.02)",
    groupBg: "rgba(13, 17, 24, 0.62)",
    groupBgSelected: "rgba(18, 24, 34, 0.78)",
    groupBorder: "rgba(255, 255, 255, 0.12)",
    groupBorderStrong: "rgba(255, 255, 255, 0.22)",
    groupHighlight: "rgba(255, 255, 255, 0.08)",
    groupShadow: "0 30px 80px rgba(0, 0, 0, 0.45)",
    scheme: "dark",
  },
  light: {
    label: "Light",
    bg: "#f5f5f7",
    panel: "rgba(255, 255, 255, 0.95)",
    panelStrong: "#ffffff",
    panelMuted: "rgba(15, 23, 42, 0.04)",
    panelSoft: "rgba(15, 23, 42, 0.08)",
    border: "rgba(15, 23, 42, 0.12)",
    borderStrong: "rgba(15, 23, 42, 0.24)",
    textPrimary: "#0f172a",
    textSecondary: "rgba(15, 23, 42, 0.7)",
    textMuted: "rgba(15, 23, 42, 0.45)",
    accent: "#2563eb",
    accentStrong: "#1d4ed8",
    accentSoft: "rgba(37, 99, 235, 0.16)",
    panelShadow: "0 12px 28px rgba(15, 23, 42, 0.12)",
    panelShadowStrong: "0 16px 36px rgba(15, 23, 42, 0.16)",
    nodeShadow: "0 18px 40px rgba(15, 23, 42, 0.14)",
    nodeShadowStrong: "0 24px 60px rgba(15, 23, 42, 0.18)",
    pattern: "rgba(15, 23, 42, 0.08)",
    patternSoft: "rgba(15, 23, 42, 0.04)",
    nodeBgGradient: "linear-gradient(160deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96))",
    nodeHeaderBg: "rgba(15, 23, 42, 0.03)",
    groupBg: "rgba(15, 23, 42, 0.06)",
    groupBgSelected: "rgba(15, 23, 42, 0.1)",
    groupBorder: "rgba(15, 23, 42, 0.14)",
    groupBorderStrong: "rgba(15, 23, 42, 0.24)",
    groupHighlight: "rgba(255, 255, 255, 0.8)",
    groupShadow: "0 24px 60px rgba(15, 23, 42, 0.12)",
    scheme: "light",
  },
  sand: {
    label: "Sand",
    bg: "#dcd3b9",
    panel: "rgba(236, 227, 206, 0.92)",
    panelStrong: "rgba(246, 238, 222, 0.98)",
    panelMuted: "rgba(90, 74, 46, 0.08)",
    panelSoft: "rgba(90, 74, 46, 0.14)",
    border: "rgba(90, 74, 46, 0.18)",
    borderStrong: "rgba(90, 74, 46, 0.3)",
    textPrimary: "#2b2214",
    textSecondary: "rgba(43, 34, 20, 0.65)",
    textMuted: "rgba(43, 34, 20, 0.45)",
    accent: "#b45309",
    accentStrong: "#d97706",
    accentSoft: "rgba(180, 83, 9, 0.18)",
    panelShadow: "0 12px 28px rgba(90, 74, 46, 0.2)",
    panelShadowStrong: "0 16px 36px rgba(90, 74, 46, 0.26)",
    nodeShadow: "0 22px 50px rgba(90, 74, 46, 0.3)",
    nodeShadowStrong: "0 30px 70px rgba(90, 74, 46, 0.34)",
    pattern: "rgba(90, 74, 46, 0.18)",
    patternSoft: "rgba(90, 74, 46, 0.1)",
    nodeBgGradient: "linear-gradient(160deg, rgba(250, 243, 227, 0.96), rgba(236, 227, 206, 0.94))",
    nodeHeaderBg: "rgba(90, 74, 46, 0.05)",
    groupBg: "rgba(90, 74, 46, 0.12)",
    groupBgSelected: "rgba(90, 74, 46, 0.18)",
    groupBorder: "rgba(90, 74, 46, 0.2)",
    groupBorderStrong: "rgba(90, 74, 46, 0.32)",
    groupHighlight: "rgba(255, 255, 255, 0.5)",
    groupShadow: "0 26px 60px rgba(90, 74, 46, 0.3)",
    scheme: "light",
  },
  creative: {
    label: "Creative",
    bg: "#0f2f2a",
    panel: "rgba(10, 26, 24, 0.92)",
    panelStrong: "rgba(14, 35, 31, 0.98)",
    panelMuted: "rgba(138, 220, 196, 0.08)",
    panelSoft: "rgba(138, 220, 196, 0.14)",
    border: "rgba(138, 220, 196, 0.2)",
    borderStrong: "rgba(138, 220, 196, 0.34)",
    textPrimary: "#e6fff7",
    textSecondary: "rgba(230, 255, 247, 0.7)",
    textMuted: "rgba(230, 255, 247, 0.45)",
    accent: "#10b981",
    accentStrong: "#34d399",
    accentSoft: "rgba(16, 185, 129, 0.22)",
    panelShadow: "0 12px 28px rgba(4, 20, 18, 0.32)",
    panelShadowStrong: "0 16px 36px rgba(4, 20, 18, 0.38)",
    nodeShadow: "0 24px 60px rgba(4, 20, 18, 0.6)",
    nodeShadowStrong: "0 30px 80px rgba(4, 20, 18, 0.75)",
    pattern: "rgba(138, 220, 196, 0.18)",
    patternSoft: "rgba(138, 220, 196, 0.08)",
    nodeBgGradient: "linear-gradient(160deg, rgba(16, 40, 34, 0.98), rgba(8, 22, 20, 0.96))",
    nodeHeaderBg: "rgba(138, 220, 196, 0.08)",
    groupBg: "rgba(16, 40, 34, 0.55)",
    groupBgSelected: "rgba(22, 48, 42, 0.72)",
    groupBorder: "rgba(138, 220, 196, 0.2)",
    groupBorderStrong: "rgba(138, 220, 196, 0.32)",
    groupHighlight: "rgba(138, 220, 196, 0.14)",
    groupShadow: "0 28px 70px rgba(4, 20, 18, 0.6)",
    scheme: "dark",
  },
  calm: {
    label: "Calm",
    bg: "#1f2f3f",
    panel: "rgba(16, 26, 36, 0.9)",
    panelStrong: "rgba(21, 33, 45, 0.98)",
    panelMuted: "rgba(135, 190, 255, 0.08)",
    panelSoft: "rgba(135, 190, 255, 0.14)",
    border: "rgba(135, 190, 255, 0.2)",
    borderStrong: "rgba(135, 190, 255, 0.36)",
    textPrimary: "#e6f2ff",
    textSecondary: "rgba(230, 242, 255, 0.7)",
    textMuted: "rgba(230, 242, 255, 0.45)",
    accent: "#38bdf8",
    accentStrong: "#7dd3fc",
    accentSoft: "rgba(56, 189, 248, 0.22)",
    panelShadow: "0 12px 28px rgba(5, 10, 15, 0.3)",
    panelShadowStrong: "0 16px 36px rgba(5, 10, 15, 0.36)",
    nodeShadow: "0 24px 60px rgba(5, 10, 15, 0.6)",
    nodeShadowStrong: "0 30px 80px rgba(5, 10, 15, 0.75)",
    pattern: "rgba(135, 190, 255, 0.18)",
    patternSoft: "rgba(135, 190, 255, 0.08)",
    nodeBgGradient: "linear-gradient(160deg, rgba(24, 36, 48, 0.98), rgba(16, 26, 36, 0.96))",
    nodeHeaderBg: "rgba(135, 190, 255, 0.08)",
    groupBg: "rgba(18, 30, 42, 0.6)",
    groupBgSelected: "rgba(24, 38, 52, 0.78)",
    groupBorder: "rgba(135, 190, 255, 0.2)",
    groupBorderStrong: "rgba(135, 190, 255, 0.32)",
    groupHighlight: "rgba(135, 190, 255, 0.14)",
    groupShadow: "0 28px 70px rgba(5, 10, 15, 0.6)",
    scheme: "dark",
  },
  lively: {
    label: "Lively",
    bg: "#2c1e2c",
    panel: "rgba(24, 16, 26, 0.92)",
    panelStrong: "rgba(30, 20, 34, 0.98)",
    panelMuted: "rgba(255, 175, 214, 0.08)",
    panelSoft: "rgba(255, 175, 214, 0.16)",
    border: "rgba(255, 175, 214, 0.2)",
    borderStrong: "rgba(255, 175, 214, 0.36)",
    textPrimary: "#ffe7f5",
    textSecondary: "rgba(255, 231, 245, 0.7)",
    textMuted: "rgba(255, 231, 245, 0.45)",
    accent: "#f472b6",
    accentStrong: "#f9a8d4",
    accentSoft: "rgba(244, 114, 182, 0.22)",
    panelShadow: "0 12px 28px rgba(10, 4, 12, 0.3)",
    panelShadowStrong: "0 16px 36px rgba(10, 4, 12, 0.36)",
    nodeShadow: "0 24px 60px rgba(10, 4, 12, 0.6)",
    nodeShadowStrong: "0 30px 80px rgba(10, 4, 12, 0.78)",
    pattern: "rgba(255, 175, 214, 0.18)",
    patternSoft: "rgba(255, 175, 214, 0.08)",
    nodeBgGradient: "linear-gradient(160deg, rgba(32, 22, 38, 0.98), rgba(20, 14, 26, 0.96))",
    nodeHeaderBg: "rgba(255, 175, 214, 0.08)",
    groupBg: "rgba(32, 20, 38, 0.62)",
    groupBgSelected: "rgba(40, 26, 46, 0.78)",
    groupBorder: "rgba(255, 175, 214, 0.22)",
    groupBorderStrong: "rgba(255, 175, 214, 0.36)",
    groupHighlight: "rgba(255, 175, 214, 0.14)",
    groupShadow: "0 28px 70px rgba(10, 4, 12, 0.6)",
    scheme: "dark",
  },
};

const NodeLabInner: React.FC<NodeLabProps> = ({
  projectData,
  setProjectData,
  onAssetLoad,
  onOpenModule,
  syncIndicator,
  onExportCsv,
  onExportXls,
  onExportUnderstandingJson,
  onOpenStats,
  onToggleTheme,
  isDarkMode,
  onOpenSyncPanel,
  onOpenInfoPanel,
  onResetProject,
  onSignOut,
  accountInfo,
  onToggleWorkflow,
}) => {
  const [bgTheme, setBgTheme] = useState<ThemeKey>("creative");
  const [bgPattern, setBgPattern] = useState<"dots" | "grid" | "cross" | "lines" | "diagonal" | "none">("cross");
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showAgentSettings, setShowAgentSettings] = useState(false);
  const {
    nodes,
    edges,
    addNode,
    addNodesAndEdges,
    updateNodeData,
    onNodesChange,
    onEdgesChange,
    onConnect,
    saveWorkflow,
    loadWorkflow,
    setGlobalStyleGuide,
    setLabContext,
    setViewportState,
    saveGroupTemplate,
    applyGroupTemplate,
    deleteGroupTemplate,
    groupTemplates,
    viewport,
    addToGlobalHistory,
    globalAssetHistory,
  } = useWorkflowStore();
  const { setViewport, screenToFlowPosition, getViewport, fitView } = useReactFlow();
  const { show: showToast } = useToast();
  const { runImageGen, runVideoGen } = useLabExecutor();

  const minZoom = 0.25;
  const maxZoom = 4;
  const [connectionDrop, setConnectionDrop] = useState<ConnectionDropState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [zoomValue, setZoomValue] = useState(() => getViewport().zoom ?? 1);
  const [liveViewport, setLiveViewport] = useState(() => getViewport());
  const createDesignAssetId = useCallback(() => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }, []);
  const buildDesignAssetKey = useCallback(
    (asset: Pick<DesignAssetItem, "category" | "refId" | "url">) =>
      `${asset.category}|${asset.refId}|${asset.url}`,
    []
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection)) return;
      onConnect(connection);
    },
    [onConnect]
  );

  /* New: Sync global style guide to store so executors can use it */
  useEffect(() => {
    if (projectData.globalStyleGuide) {
      setGlobalStyleGuide(projectData.globalStyleGuide);
    }
  }, [projectData.globalStyleGuide, setGlobalStyleGuide]);

  useEffect(() => {
  setLabContext({
      rawScript: projectData.rawScript || "",
      globalStyleGuide: projectData.globalStyleGuide || "",
      shotGuide: projectData.shotGuide || "",
      soraGuide: projectData.soraGuide || "",
      storyboardGuide: projectData.storyboardGuide || "",
      dramaGuide: projectData.dramaGuide || "",
      context: projectData.context,
    });
  }, [projectData, setLabContext]);

  useEffect(() => {
    setViewportState(getViewport());
  }, [getViewport, setViewportState]);

  const lastViewportRef = useRef<string>("");
  const didInitFitRef = useRef(false);
  useEffect(() => {
    if (!viewport) return;
    const key = `${viewport.x}:${viewport.y}:${viewport.zoom}`;
    if (lastViewportRef.current === key) return;
    lastViewportRef.current = key;
    setViewport(viewport, { duration: 0 });
  }, [setViewport, viewport]);

  useEffect(() => {
    if (!viewport) return;
    setLiveViewport(viewport);
  }, [viewport]);

  useEffect(() => {
    if (!liveViewport) return;
    setZoomValue(liveViewport.zoom);
  }, [liveViewport]);

  useEffect(() => {
    if (didInitFitRef.current) return;
    if (viewport) return;
    if (!nodes.length) return;
    fitView({ padding: 0.2, duration: 0 });
    didInitFitRef.current = true;
  }, [fitView, nodes.length, viewport]);

  useEffect(() => {
    const videoNodes = nodes.filter((node) => node.type === "soraVideoGen" || node.type === "wanVideoGen");
    videoNodes.forEach((node) => {
      const data = node.data as VideoGenNodeData;
      if (!data?.videoUrl) return;
      const alreadyAdded = globalAssetHistory.some(
        (item) => item.type === "video" && (item.sourceId === node.id || item.src === data.videoUrl)
      );
      if (alreadyAdded) return;
      addToGlobalHistory({
        type: "video",
        src: data.videoUrl,
        prompt: data.inputPrompt || "Video Output",
        model: data.model,
        aspectRatio: data.aspectRatio,
        sourceId: node.id,
      });
    });
  }, [addToGlobalHistory, globalAssetHistory, nodes]);

  useEffect(() => {
    if (!edges.length || !nodes.length) return;
    const existingAssets = projectData.designAssets || [];
    const existingKeys = new Set(existingAssets.map(buildDesignAssetKey));
    const nextAssets = [...existingAssets];
    let changed = false;
    const nodeById = new Map(nodes.map((node) => [node.id, node]));

    edges.forEach((edge) => {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target) return;
      if (source.type !== "text" || (target.type !== "imageGen" && target.type !== "wanImageGen")) return;
      if (edge.sourceHandle && edge.sourceHandle !== "text") return;
      if (edge.targetHandle && edge.targetHandle !== "text") return;

      const textData = source.data as TextNodeData;
      if (textData.category !== "form" && textData.category !== "zone") return;
      if (!textData.refId) return;

      const imageData = target.data as ImageGenNodeData;
      if (!imageData.outputImage) return;

      const asset: DesignAssetItem = {
        id: createDesignAssetId(),
        category: textData.category,
        refId: textData.refId,
        url: imageData.outputImage,
        createdAt: Date.now(),
        label: textData.title,
      };
      const key = buildDesignAssetKey(asset);
      if (existingKeys.has(key)) return;

      existingKeys.add(key);
      nextAssets.push(asset);
      changed = true;
    });

    if (changed) {
      setProjectData((prev) => ({
        ...prev,
        designAssets: nextAssets,
      }));
    }
  }, [buildDesignAssetKey, createDesignAssetId, edges, nodes, projectData.designAssets, setProjectData]);

  useEffect(() => {
    if (!projectData.designAssets.length) return;
    if (!nodes.length) return;
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const textNodeByRef = new Map<string, typeof nodes[number]>();
    const connectedImagesByRef = new Map<string, typeof nodes[number][]>();

    nodes.forEach((node) => {
      if (node.type !== "text") return;
      const data = node.data as TextNodeData;
      if (data.category !== "form" && data.category !== "zone") return;
      if (!data.refId) return;
      textNodeByRef.set(`${data.category}|${data.refId}`, node);
    });

    edges.forEach((edge) => {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target) return;
      if (source.type !== "text" || (target.type !== "imageGen" && target.type !== "wanImageGen")) return;
      if (edge.sourceHandle && edge.sourceHandle !== "text") return;
      if (edge.targetHandle && edge.targetHandle !== "text") return;
      const data = source.data as TextNodeData;
      if (data.category !== "form" && data.category !== "zone") return;
      if (!data.refId) return;
      const key = `${data.category}|${data.refId}`;
      const list = connectedImagesByRef.get(key) || [];
      list.push(target);
      connectedImagesByRef.set(key, list);
    });

    projectData.designAssets.forEach((asset) => {
      const key = `${asset.category}|${asset.refId}`;
      const textNode = textNodeByRef.get(key);
      if (!textNode) return;
      const connectedImages = connectedImagesByRef.get(key) || [];
      if (connectedImages.some((node) => (node.data as ImageGenNodeData).outputImage === asset.url)) {
        return;
      }

      const emptyNode = connectedImages.find((node) => !(node.data as ImageGenNodeData).outputImage);
      if (emptyNode) {
        updateNodeData(emptyNode.id, {
          outputImage: asset.url,
          status: "complete",
          error: null,
          designCategory: asset.category,
          designRefId: asset.refId,
        });
        return;
      }

      const offsetIndex = connectedImages.length;
      const newId = addNode(
        "imageGen",
        {
          x: textNode.position.x + 360 + offsetIndex * 260,
          y: textNode.position.y,
        },
        textNode.parentId,
        {
          title: "Design Image",
          inputImages: [],
          inputPrompt: null,
          outputImage: asset.url,
          status: "complete",
          error: null,
          aspectRatio: "1:1",
          designCategory: asset.category,
          designRefId: asset.refId,
        }
      );

      onConnect({
        source: textNode.id,
        sourceHandle: "text",
        target: newId,
        targetHandle: "text",
      });
    });
  }, [addNode, nodes, edges, onConnect, projectData.designAssets, updateNodeData]);

  const handleConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (connectionState.isValid || !connectionState.fromNode) return;
      // Extract clientX/clientY from the event correctly (it can be MouseEvent or TouchEvent)
      const e = event as any;
      const clientX = e.clientX || e.touches?.[0]?.clientX;
      const clientY = e.clientY || e.touches?.[0]?.clientY;

      const fromHandleId = connectionState.fromHandle?.id || null;
      const fromHandleType = fromHandleId === "image" || fromHandleId === "text" ? fromHandleId : null;
      const isFromSource = connectionState.fromHandle?.type === "source";
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      setConnectionDrop({
        position: { x: clientX, y: clientY },
        flowPosition: flowPos,
        handleType: fromHandleType,
        connectionType: isFromSource ? "source" : "target",
        sourceNodeId: connectionState.fromNode.id,
        sourceHandleId: connectionState.fromHandle?.id || null,
      });
    },
    [screenToFlowPosition]
  );

  const handleAddNode = useCallback((type: NodeType, position: XYPosition) => {
    return addNode(type, position);
  }, [addNode]);

  const handleDropCreate = (type: NodeType) => {
    if (!connectionDrop) return;

    let position = connectionDrop.flowPosition;

    const newId = handleAddNode(type, position);

    if (connectionDrop.handleType) {
      if (connectionDrop.connectionType === "source") {
        onConnect({
          source: connectionDrop.sourceNodeId!,
          sourceHandle: connectionDrop.sourceHandleId!,
          target: newId,
          targetHandle: connectionDrop.handleType,
        });
      } else {
        onConnect({
          source: newId,
          sourceHandle: connectionDrop.handleType,
          target: connectionDrop.sourceNodeId!,
          targetHandle: connectionDrop.sourceHandleId!,
        });
      }
    }
    setConnectionDrop(null);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string) as WorkflowFile;
        loadWorkflow(data);
      } catch (err) {
        alert("Failed to import workflow JSON");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const getSelectedGroup = useCallback(
    () => nodes.find((node) => node.selected && node.type === "group"),
    [nodes]
  );

  const handleCreateTemplate = useCallback(() => {
    const selectedGroup = getSelectedGroup();
    if (!selectedGroup) {
      showToast("请先选中一个 Group", "warning");
      return;
    }
    const defaultName = (selectedGroup.data as GroupNodeData).title || "Group Template";
    const name = window.prompt("模板名称", defaultName);
    if (!name || !name.trim()) return;
    const result = saveGroupTemplate(selectedGroup.id, name.trim());
    if (!result.ok) {
      showToast(result.error || "创建模板失败", "error");
      return;
    }
    showToast("已保存为模板", "success");
  }, [getSelectedGroup, saveGroupTemplate, showToast]);

  const handleLoadTemplate = useCallback(
    (templateId: string) => {
      const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      const flowPos = screenToFlowPosition(center);
      const result = applyGroupTemplate(templateId, flowPos);
      if (!result.ok) {
        showToast(result.error || "加载模板失败", "error");
        return;
      }
      showToast("模板已加载", "success");
    },
    [applyGroupTemplate, screenToFlowPosition, showToast]
  );

  const handleDeleteTemplate = useCallback(
    (templateId: string) => {
      const confirmed = window.confirm("确认删除该模板？");
      if (!confirmed) return;
      deleteGroupTemplate(templateId);
      showToast("模板已删除", "success");
    },
    [deleteGroupTemplate, showToast]
  );

  const runAll = async () => {
    for (const n of nodes) {
      if (n.type === "imageGen" || n.type === "wanImageGen") await runImageGen(n.id);
      if (n.type === "soraVideoGen" || n.type === "wanVideoGen" || n.type === "viduVideoGen") await runVideoGen(n.id);
    }
    alert("Run triggered");
  };

  const getTemplateOrigin = useCallback(() => {
    const topLevelNodes = nodes.filter((node) => !node.parentId);
    if (topLevelNodes.length === 0) return { x: 50, y: 60 };
    const maxY = Math.max(
      ...topLevelNodes.map((node) => {
        const height = typeof node.style?.height === "number" ? node.style.height : 320;
        return node.position.y + height;
      })
    );
    return { x: 50, y: maxY + 160 };
  }, [nodes]);

  const focusTemplate = useCallback((origin: XYPosition, zoom = 0.7) => {
    setViewport({ x: -origin.x + 80, y: -origin.y + 80, zoom }, { duration: 800 });
  }, [setViewport]);

  const handleZoomChange = useCallback(
    (value: number) => {
      const nextZoom = Math.min(maxZoom, Math.max(minZoom, value));
      setZoomValue(nextZoom);
      const current = getViewport();
      const nextViewport = { ...current, zoom: nextZoom };
      setViewport(nextViewport, { duration: 120 });
      setViewportState(nextViewport);
    },
    [getViewport, maxZoom, minZoom, setViewport, setViewportState]
  );

  const handleToggleLock = useCallback(() => {
    setIsLocked((prev) => !prev);
  }, []);

  const handleInsertTextNode = useCallback(
    (payload: { title: string; text: string; category?: TextNodeData["category"]; refId?: string }) => {
      const origin = getTemplateOrigin();
      addNode("text", origin, undefined, {
        title: payload.title,
        text: payload.text,
        category: payload.category,
        refId: payload.refId,
      } as Partial<TextNodeData>);
      focusTemplate(origin, 0.7);
    },
    [addNode, getTemplateOrigin, focusTemplate]
  );

  const handleImportEpisode = useCallback((episodeId: number) => {
    const episode = projectData.episodes.find(e => e.id === episodeId);
    if (!episode) return;

    const newNodes: WorkflowNode[] = [];
    const newEdges: WorkflowEdge[] = [];
    const origin = getTemplateOrigin();
    const groupId = `group-episode-${episodeId}-${Date.now()}`;
    const topPadding = 120;
    const bottomPadding = 180;
    const shotGap = 160;
    const promptGap = 100;
    const groupWidth = 1720;

    const estimateTextNodeHeight = (text: string) => {
      const safe = (text || "").trim();
      // Heuristic: text nodes auto-grow, so we over-estimate to avoid overlap.
      const charsPerLine = 36;
      const lineHeight = 22;
      const baseHeight = 220;
      const lines = Math.max(3, Math.ceil(safe.length / charsPerLine));
      return baseHeight + lines * lineHeight;
    };

    const estimatedShotHeight = 340;
    const estimatedWanHeight = 560;

    let yCursor = topPadding;
    const layouts = episode.shots.map((shot) => {
      const soraHeight = estimateTextNodeHeight(shot.soraPrompt || shot.description || "");
      const storyboardHeight = estimateTextNodeHeight(shot.storyboardPrompt || shot.description || "");
      const promptBlockHeight = soraHeight + promptGap + storyboardHeight;
      const wanBlockHeight = estimatedWanHeight * 2 + promptGap;
      const blockHeight = Math.max(estimatedShotHeight, promptBlockHeight, wanBlockHeight);
      const layout = {
        y: yCursor,
        soraHeight,
        storyboardHeight,
        blockHeight,
      };
      yCursor += blockHeight + shotGap;
      return layout;
    });

    const groupHeight = yCursor + bottomPadding;

    newNodes.push({
      id: groupId,
      type: 'group',
      position: { x: origin.x, y: origin.y },
      data: { title: `EPISODE ${episode.id}: ${episode.title.toUpperCase()}` } as GroupNodeData,
      style: { width: groupWidth, height: groupHeight },
    });

    episode.shots.forEach((shot, idx) => {
      const layout = layouts[idx];
      const shotNodeId = `shot-${episodeId}-${shot.id}-${Date.now()}`;
      const soraPromptNodeId = `text-sora-${episodeId}-${shot.id}-${Date.now()}`;
      const storyboardPromptNodeId = `text-storyboard-${episodeId}-${shot.id}-${Date.now()}`;
      const wanVideoNodeId = `wan-video-${episodeId}-${shot.id}-${Date.now()}`;
      const wanImageNodeId = `wan-image-${episodeId}-${shot.id}-${Date.now()}`;
      const yPos = layout?.y ?? (topPadding + idx * (estimatedShotHeight + shotGap));
      const soraY = yPos;
      const storyboardY = yPos + (layout?.soraHeight ?? estimateTextNodeHeight(shot.soraPrompt || "")) + promptGap;

      newNodes.push({
        id: shotNodeId,
        type: 'shot',
        position: { x: 40, y: yPos },
        parentId: groupId,
        extent: 'parent',
        data: {
          shotId: shot.id,
          description: shot.description,
          duration: shot.duration,
          shotType: shot.shotType,
          focalLength: shot.focalLength,
          movement: shot.movement,
          composition: shot.composition,
          blocking: shot.blocking,
          difficulty: shot.difficulty,
          dialogue: shot.dialogue,
          sound: shot.sound,
          lightingVfx: shot.lightingVfx,
          editingNotes: shot.editingNotes,
          notes: shot.notes,
          soraPrompt: shot.soraPrompt,
          storyboardPrompt: shot.storyboardPrompt,
          viewMode: "card",
        } as ShotNodeData,
      });

      newNodes.push({
        id: soraPromptNodeId,
        type: 'text',
        position: { x: 420, y: soraY },
        parentId: groupId,
        extent: 'parent',
        data: {
          title: `Sora Prompt: ${shot.id}`,
          text: shot.soraPrompt || "",
          category: 'episode',
          refId: `${episodeId}|${shot.id}`
        } as TextNodeData,
      });

      newNodes.push({
        id: storyboardPromptNodeId,
        type: 'text',
        position: { x: 420, y: storyboardY },
        parentId: groupId,
        extent: 'parent',
        data: {
          title: `Storyboard Prompt: ${shot.id}`,
          text: shot.storyboardPrompt || "",
          category: 'episode',
          refId: `${episodeId}|${shot.id}`
        } as TextNodeData,
      });

      newNodes.push({
        id: wanVideoNodeId,
        type: 'wanVideoGen',
        position: { x: 940, y: soraY },
        parentId: groupId,
        extent: 'parent',
        data: {
          title: `WAN Vid: ${shot.id}`,
          inputImages: [],
          inputPrompt: shot.soraPrompt || null,
          status: 'idle',
          error: null,
          aspectRatio: '16:9',
          promptExtend: false,
        } as VideoGenNodeData,
      });

      newNodes.push({
        id: wanImageNodeId,
        type: 'wanImageGen',
        position: { x: 940, y: storyboardY },
        parentId: groupId,
        extent: 'parent',
        data: {
          title: `WAN Img: ${shot.id}`,
          inputImages: [],
          inputPrompt: shot.storyboardPrompt || null,
          outputImage: null,
          status: 'idle',
          error: null,
          aspectRatio: '16:9',
          promptExtend: false,
        } as ImageGenNodeData,
      });

      newEdges.push(
        { id: `edge-shot-sora-${shot.id}`, source: shotNodeId, target: soraPromptNodeId, sourceHandle: 'text', targetHandle: 'text' },
        { id: `edge-shot-storyboard-${shot.id}`, source: shotNodeId, target: storyboardPromptNodeId, sourceHandle: 'text', targetHandle: 'text' },
        { id: `edge-sora-wanvid-${shot.id}`, source: soraPromptNodeId, target: wanVideoNodeId, sourceHandle: 'text', targetHandle: 'text' },
        { id: `edge-storyboard-wanimg-${shot.id}`, source: storyboardPromptNodeId, target: wanImageNodeId, sourceHandle: 'text', targetHandle: 'text' },
      );
    });

    addNodesAndEdges(newNodes, newEdges);
    focusTemplate(origin, 0.7);
  }, [projectData, addNodesAndEdges, getTemplateOrigin, focusTemplate]);

  const displayNodes = nodes;
  const displayEdges = edges;
  const selectedGroup = getSelectedGroup();

  const activeTheme = useMemo(() => THEME_PRESETS[bgTheme], [bgTheme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const mapping: Record<string, string> = {
      "bg-base": activeTheme.bg,
      "bg-panel": activeTheme.panel,
      "bg-elevated": activeTheme.panelStrong,
      "bg-overlay": activeTheme.panelMuted,
      "bg-muted": activeTheme.panelSoft,
      "border-subtle": activeTheme.border,
      "border-strong": activeTheme.borderStrong,
      "text-primary": activeTheme.textPrimary,
      "text-secondary": activeTheme.textSecondary,
      "accent-blue": activeTheme.accent,
      "accent-green": "#10b981",
      "shadow-soft": activeTheme.panelShadow,
      "shadow-strong": activeTheme.panelShadowStrong,
      "dot-weak": activeTheme.patternSoft,
      "dot-strong": activeTheme.pattern,
      "app-bg": activeTheme.bg,
      "app-panel": activeTheme.panel,
      "app-panel-strong": activeTheme.panelStrong,
      "app-panel-muted": activeTheme.panelMuted,
      "app-panel-soft": activeTheme.panelSoft,
      "app-border": activeTheme.border,
      "app-border-strong": activeTheme.borderStrong,
      "app-text-primary": activeTheme.textPrimary,
      "app-text-secondary": activeTheme.textSecondary,
      "app-text-muted": activeTheme.textMuted,
      "app-accent": activeTheme.accent,
      "app-accent-strong": activeTheme.accentStrong,
      "app-accent-soft": activeTheme.accentSoft,
      "app-shadow": activeTheme.panelShadow,
      "app-shadow-strong": activeTheme.panelShadowStrong,
      "app-pattern": activeTheme.pattern,
      "node-bg": activeTheme.panel,
      "node-bg-selected": activeTheme.panelStrong,
      "node-bg-gradient": activeTheme.nodeBgGradient,
      "node-accent": activeTheme.accent,
      "node-text-primary": activeTheme.textPrimary,
      "node-text-secondary": activeTheme.textSecondary,
      "node-textarea-bg": activeTheme.panelMuted,
      "node-border": activeTheme.border,
      "node-border-strong": activeTheme.borderStrong,
      "node-surface": activeTheme.panelMuted,
      "node-surface-strong": activeTheme.panelSoft,
      "node-shadow": activeTheme.nodeShadow,
      "node-shadow-strong": activeTheme.nodeShadowStrong,
      "node-header-bg": activeTheme.nodeHeaderBg,
      "group-bg": activeTheme.groupBg,
      "group-bg-selected": activeTheme.groupBgSelected,
      "group-border": activeTheme.groupBorder,
      "group-border-strong": activeTheme.groupBorderStrong,
      "group-highlight": activeTheme.groupHighlight,
      "group-shadow": activeTheme.groupShadow,
    };
    Object.entries(mapping).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
    root.style.colorScheme = activeTheme.scheme;
  }, [activeTheme]);

  const backgroundStyle = useMemo(() => {
    const base = activeTheme.bg;
    const currentViewport = liveViewport ?? { x: 0, y: 0, zoom: 1 };
    const scale = currentViewport.zoom > 0 ? currentViewport.zoom : 1;
    const offsetX = currentViewport.x ?? 0;
    const offsetY = currentViewport.y ?? 0;
    const applyOffset = (token: string, offset: number) => {
      const trimmed = token.trim();
      const value = Number.parseFloat(trimmed);
      if (Number.isNaN(value)) return trimmed;
      const unit = trimmed.replace(String(value), "") || "px";
      return `${value + offset}${unit}`;
    };
    const buildPosition = (position: string | undefined) => {
      const basePosition = position ?? "0 0";
      return basePosition
        .split(",")
        .map((chunk) => {
          const parts = chunk.trim().split(/\s+/);
          const x = parts[0] ?? "0";
          const y = parts[1] ?? "0";
          return `${applyOffset(x, offsetX)} ${applyOffset(y, offsetY)}`;
        })
        .join(", ");
    };
    if (bgPattern === "none") {
      return {
        background: base,
        backgroundImage: "none",
        backgroundSize: "auto",
        backgroundPosition: "0 0",
        baseColor: base,
      };
    }
    const patterns: Record<string, { image: string; size: (s: number) => string; position?: string }> = {
      dots: {
        image:
          `radial-gradient(circle at 1px 1px, ${activeTheme.pattern} 1px, transparent 0), radial-gradient(circle at 1px 1px, ${activeTheme.patternSoft} 1px, transparent 0)`,
        size: (k) => `${22 * k}px ${22 * k}px, ${22 * k}px ${22 * k}px`,
        position: "0 0, 11px 11px",
      },
      grid: {
        image: `linear-gradient(${activeTheme.patternSoft} 1px, transparent 1px), linear-gradient(90deg, ${activeTheme.patternSoft} 1px, transparent 1px)`,
        size: (k) => `${28 * k}px ${28 * k}px`,
      },
      cross: {
        image:
          `linear-gradient(${activeTheme.patternSoft} 1px, transparent 1px), linear-gradient(90deg, ${activeTheme.patternSoft} 1px, transparent 1px), radial-gradient(circle, ${activeTheme.patternSoft} 1px, transparent 1px)`,
        size: (k) => `${26 * k}px ${26 * k}px, ${26 * k}px ${26 * k}px, ${26 * k}px ${26 * k}px`,
        position: "0 0, 0 0, 13px 13px",
      },
      lines: {
        image: `linear-gradient(0deg, ${activeTheme.patternSoft} 1px, transparent 1px)`,
        size: (k) => `${26 * k}px ${26 * k}px`,
      },
      diagonal: {
        image:
          `linear-gradient(135deg, ${activeTheme.patternSoft} 12.5%, transparent 12.5%, transparent 50%, ${activeTheme.patternSoft} 50%, ${activeTheme.patternSoft} 62.5%, transparent 62.5%, transparent)`,
        size: (k) => `${24 * k}px ${24 * k}px`,
      },
    };
    const pat = patterns[bgPattern] || patterns.dots;
    return {
      background: base,
      backgroundImage: pat.image,
      backgroundSize: pat.size(scale),
      backgroundPosition: buildPosition(pat.position),
      baseColor: base,
    };
  }, [activeTheme, bgPattern, liveViewport]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const base = (backgroundStyle as any).baseColor || activeTheme.bg;
      document.body.style.background = base;
      document.documentElement.style.background = base;
    }
  }, [activeTheme.bg, backgroundStyle]);

  return (
    <div className="h-full w-full flex flex-col app-text-primary" style={backgroundStyle}>
      <div
        className="flex-1 relative node-lab-canvas"
        data-zoomed={zoomValue > 1}
        style={backgroundStyle}
      >
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onConnectEnd={handleConnectEnd}
          onMove={(_, vp) => setLiveViewport(vp)}
          onMoveEnd={(_, vp) => {
            setLiveViewport(vp);
            setViewportState(vp);
          }}
          minZoom={minZoom}
          maxZoom={maxZoom}
          nodesDraggable={!isLocked}
          nodesConnectable={!isLocked}
          elementsSelectable={!isLocked}
          panOnDrag={!isLocked}
          panOnScroll={!isLocked}
          panOnScrollMode="free"
          zoomOnScroll={false}
          zoomOnPinch={!isLocked}
          zoomOnDoubleClick={!isLocked}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          proOptions={{ hideAttribution: true }}
          data-active-mode="default"
        >
          {showMiniMap && (
            <div
              className="nodelab-minimap-drawer"
              data-open={showMiniMap}
              style={{ position: "absolute", right: 24, bottom: 76, pointerEvents: "auto" }}
            >
              <MiniMap
                className="nodelab-minimap"
                style={{ height: 130, width: 180, background: "#0b0d10", borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 18px 40px rgba(0,0,0,0.35)" }}
                maskColor="rgba(255,255,255,0.04)"
                nodeStrokeColor="#38bdf8"
                nodeColor="#0ea5e9"
              />
            </div>
          )}
        </ReactFlow>

        {connectionDrop && (
          <ConnectionDropMenu
            position={connectionDrop.position}
            onCreate={(t) => handleDropCreate(t)}
            onClose={() => setConnectionDrop(null)}
          />
        )}
      </div>

      <MultiSelectToolbar />
      <AgentSettingsPanel isOpen={showAgentSettings} onClose={() => setShowAgentSettings(false)} />
      <div className="fixed bottom-4 left-4 right-4 z-30 flex items-end justify-between gap-4 pointer-events-none qalam-bottom-bar">
        <div className="flex items-end gap-3 pointer-events-auto qalam-bottom-left">
          <QalamAgent
            projectData={projectData}
            setProjectData={setProjectData}
            onOpenStats={onOpenStats}
            onToggleAgentSettings={() => setShowAgentSettings((prev) => !prev)}
          />
          <FloatingActionBar
            onAddText={() => handleAddNode("text", { x: 100, y: 100 })}
            onAddImage={() => handleAddNode("imageInput", { x: 200, y: 100 })}
            onAddImageGen={() => handleAddNode("imageGen", { x: 400, y: 100 })}
            onAddWanImageGen={() => handleAddNode("wanImageGen", { x: 420, y: 120 })}
            onAddVideoGen={() => handleAddNode("soraVideoGen", { x: 500, y: 100 })}
            onAddWanVideoGen={() => handleAddNode("wanVideoGen", { x: 520, y: 120 })}
            onAddGroup={() => handleAddNode("group", { x: 100, y: 100 })}
            onImport={() => fileInputRef.current?.click()}
            onExport={() => saveWorkflow()}
            onRun={runAll}
            templates={groupTemplates}
            canCreateTemplate={!!selectedGroup}
            onCreateTemplate={handleCreateTemplate}
            onLoadTemplate={handleLoadTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            floating={false}
            onOpenModule={onOpenModule}
            onExportCsv={onExportCsv}
            onExportXls={onExportXls}
            onExportUnderstandingJson={onExportUnderstandingJson}
            onOpenStats={onOpenStats}
            onToggleTheme={onToggleTheme}
            isDarkMode={isDarkMode}
            onOpenSyncPanel={onOpenSyncPanel}
            onOpenInfoPanel={onOpenInfoPanel}
            onResetProject={onResetProject}
            onSignOut={onSignOut}
            onAssetLoad={onAssetLoad}
            accountInfo={accountInfo}
            onToggleWorkflow={onToggleWorkflow}
          />
        </div>
        <div className="flex items-center gap-3 pointer-events-auto qalam-bottom-right">
          <ViewportControls
            zoom={zoomValue}
            minZoom={minZoom}
            maxZoom={maxZoom}
            onZoomChange={handleZoomChange}
            isLocked={isLocked}
            onToggleLock={handleToggleLock}
            showMiniMap={showMiniMap}
            onToggleMiniMap={() => setShowMiniMap((prev) => !prev)}
            syncIndicator={syncIndicator}
            onOpenTheme={() => setShowThemeModal(true)}
          />
          <div className="h-12 flex items-center">
            <AssetsPanel
              projectData={projectData}
              onInsertTextNode={handleInsertTextNode}
              onImportEpisodeShots={handleImportEpisode}
              floating={false}
              inlineAnchor
            />
          </div>
        </div>
      </div>
      <Toast />
      <AnnotationModal />
      {showThemeModal && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setShowThemeModal(false)} />
          <div className="fixed bottom-20 right-6 z-50 w-[440px] rounded-2xl app-panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">主题与样式</div>
              <button
                type="button"
                onClick={() => setShowThemeModal(false)}
                className="h-8 w-8 rounded-full border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-muted)] transition"
              >
                ×
              </button>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest app-text-muted mb-2">颜色主题</div>
              <div className="grid grid-cols-2 gap-2 pb-1">
                {(Object.keys(THEME_PRESETS) as ThemeKey[]).map((key) => {
                  const theme = THEME_PRESETS[key];
                  const isActive = bgTheme === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setBgTheme(key)}
                      className={`rounded-xl border px-3 py-2 text-left transition ${isActive ? "border-[var(--app-border-strong)] bg-[var(--app-panel-muted)]" : "border-[var(--app-border)] hover:border-[var(--app-border-strong)]"
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-semibold">{theme.label}</span>
                        {isActive && <span className="text-[10px] app-text-secondary">Active</span>}
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-1">
                        <span className="h-6 rounded-md" style={{ background: theme.bg }} />
                        <span className="h-6 rounded-md" style={{ background: theme.panel }} />
                        <span className="h-6 rounded-md" style={{ background: theme.accent }} />
                      </div>
                      <div className="mt-1 text-[10px] app-text-muted">Base / Surface / Accent</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest app-text-muted mb-2">图案</div>
              <div className="grid grid-cols-3 gap-2 pb-1">
                {[
                  { key: "dots", label: "Dots" },
                  { key: "grid", label: "Grid" },
                  { key: "cross", label: "Cross" },
                  { key: "lines", label: "Lines" },
                  { key: "diagonal", label: "Diagonal" },
                  { key: "none", label: "None" },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setBgPattern(item.key as any)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm transition ${bgPattern === item.key ? "border-[var(--app-border-strong)] bg-[var(--app-panel-muted)]" : "border-[var(--app-border)] hover:border-[var(--app-border-strong)]"
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileImport} />
    </div>
  );
};

export const NodeLab: React.FC<NodeLabProps> = (props) => {
  return (
    <ReactFlowProvider>
      <NodeLabInner {...props} />
    </ReactFlowProvider>
  );
};
