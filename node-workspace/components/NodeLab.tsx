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
import { ProjectData } from "../../types";
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
type PatternKey = "dots" | "grid" | "cross" | "lines" | "diagonal" | "none";

type ThemePreset = {
  label: string;
  description: string;
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
    description: "Graphite workspace with a restrained steel accent.",
    bg: "#111416",
    panel: "rgba(18, 22, 26, 0.92)",
    panelStrong: "rgba(24, 29, 34, 0.97)",
    panelMuted: "rgba(142, 164, 184, 0.08)",
    panelSoft: "rgba(142, 164, 184, 0.13)",
    border: "rgba(210, 220, 228, 0.12)",
    borderStrong: "rgba(210, 220, 228, 0.22)",
    textPrimary: "#f2efe9",
    textSecondary: "rgba(242, 239, 233, 0.68)",
    textMuted: "rgba(242, 239, 233, 0.42)",
    accent: "#8ea4b8",
    accentStrong: "#b4c3cf",
    accentSoft: "rgba(142, 164, 184, 0.16)",
    panelShadow: "0 18px 40px rgba(6, 8, 10, 0.28)",
    panelShadowStrong: "0 24px 56px rgba(6, 8, 10, 0.34)",
    nodeShadow: "0 28px 72px rgba(4, 6, 8, 0.58)",
    nodeShadowStrong: "0 36px 88px rgba(4, 6, 8, 0.72)",
    pattern: "rgba(214, 223, 230, 0.055)",
    patternSoft: "rgba(214, 223, 230, 0.028)",
    nodeBgGradient: "linear-gradient(160deg, rgba(31, 37, 42, 0.97), rgba(16, 19, 23, 0.98))",
    nodeHeaderBg: "rgba(255, 255, 255, 0.02)",
    groupBg: "rgba(20, 26, 31, 0.64)",
    groupBgSelected: "rgba(26, 33, 39, 0.8)",
    groupBorder: "rgba(214, 223, 230, 0.12)",
    groupBorderStrong: "rgba(214, 223, 230, 0.24)",
    groupHighlight: "rgba(255, 255, 255, 0.06)",
    groupShadow: "0 34px 96px rgba(4, 6, 8, 0.48)",
    scheme: "dark",
  },
  light: {
    label: "Light",
    description: "Warm paper tones with quiet editorial contrast.",
    bg: "#f3efe8",
    panel: "rgba(255, 252, 246, 0.92)",
    panelStrong: "#fffdfa",
    panelMuted: "rgba(92, 117, 146, 0.05)",
    panelSoft: "rgba(92, 117, 146, 0.08)",
    border: "rgba(92, 117, 146, 0.12)",
    borderStrong: "rgba(92, 117, 146, 0.2)",
    textPrimary: "#1f2937",
    textSecondary: "rgba(31, 41, 55, 0.68)",
    textMuted: "rgba(31, 41, 55, 0.43)",
    accent: "#5c7592",
    accentStrong: "#48627f",
    accentSoft: "rgba(92, 117, 146, 0.14)",
    panelShadow: "0 18px 40px rgba(63, 70, 80, 0.08)",
    panelShadowStrong: "0 24px 56px rgba(63, 70, 80, 0.12)",
    nodeShadow: "0 20px 48px rgba(63, 70, 80, 0.12)",
    nodeShadowStrong: "0 28px 68px rgba(63, 70, 80, 0.16)",
    pattern: "rgba(92, 117, 146, 0.07)",
    patternSoft: "rgba(92, 117, 146, 0.034)",
    nodeBgGradient: "linear-gradient(160deg, rgba(255, 255, 252, 0.99), rgba(247, 243, 237, 0.96))",
    nodeHeaderBg: "rgba(92, 117, 146, 0.03)",
    groupBg: "rgba(92, 117, 146, 0.06)",
    groupBgSelected: "rgba(92, 117, 146, 0.1)",
    groupBorder: "rgba(92, 117, 146, 0.14)",
    groupBorderStrong: "rgba(92, 117, 146, 0.24)",
    groupHighlight: "rgba(255, 255, 255, 0.8)",
    groupShadow: "0 28px 64px rgba(63, 70, 80, 0.12)",
    scheme: "light",
  },
  sand: {
    label: "Sand",
    description: "Limestone and clay for a softer cinematic desk.",
    bg: "#d9cfbf",
    panel: "rgba(242, 235, 222, 0.92)",
    panelStrong: "rgba(248, 242, 232, 0.97)",
    panelMuted: "rgba(180, 111, 63, 0.07)",
    panelSoft: "rgba(180, 111, 63, 0.12)",
    border: "rgba(125, 97, 66, 0.14)",
    borderStrong: "rgba(125, 97, 66, 0.24)",
    textPrimary: "#32281d",
    textSecondary: "rgba(50, 40, 29, 0.66)",
    textMuted: "rgba(50, 40, 29, 0.42)",
    accent: "#b46f3f",
    accentStrong: "#cb8757",
    accentSoft: "rgba(180, 111, 63, 0.16)",
    panelShadow: "0 18px 40px rgba(88, 67, 43, 0.14)",
    panelShadowStrong: "0 24px 56px rgba(88, 67, 43, 0.18)",
    nodeShadow: "0 24px 60px rgba(88, 67, 43, 0.22)",
    nodeShadowStrong: "0 30px 78px rgba(88, 67, 43, 0.28)",
    pattern: "rgba(125, 97, 66, 0.09)",
    patternSoft: "rgba(125, 97, 66, 0.045)",
    nodeBgGradient: "linear-gradient(160deg, rgba(249, 243, 234, 0.98), rgba(238, 230, 216, 0.95))",
    nodeHeaderBg: "rgba(125, 97, 66, 0.04)",
    groupBg: "rgba(125, 97, 66, 0.1)",
    groupBgSelected: "rgba(125, 97, 66, 0.16)",
    groupBorder: "rgba(125, 97, 66, 0.16)",
    groupBorderStrong: "rgba(125, 97, 66, 0.28)",
    groupHighlight: "rgba(255, 255, 255, 0.44)",
    groupShadow: "0 28px 68px rgba(88, 67, 43, 0.24)",
    scheme: "light",
  },
  creative: {
    label: "Creative",
    description: "Deep pine with aged brass instead of neon green.",
    bg: "#0b1614",
    panel: "rgba(11, 22, 20, 0.92)",
    panelStrong: "rgba(16, 28, 25, 0.97)",
    panelMuted: "rgba(185, 142, 98, 0.07)",
    panelSoft: "rgba(185, 142, 98, 0.12)",
    border: "rgba(212, 181, 135, 0.16)",
    borderStrong: "rgba(212, 181, 135, 0.28)",
    textPrimary: "#f3eee5",
    textSecondary: "rgba(243, 238, 229, 0.68)",
    textMuted: "rgba(243, 238, 229, 0.42)",
    accent: "#b98e62",
    accentStrong: "#d3b08b",
    accentSoft: "rgba(185, 142, 98, 0.18)",
    panelShadow: "0 18px 40px rgba(6, 13, 12, 0.32)",
    panelShadowStrong: "0 24px 56px rgba(6, 13, 12, 0.4)",
    nodeShadow: "0 28px 72px rgba(5, 10, 9, 0.62)",
    nodeShadowStrong: "0 38px 96px rgba(5, 10, 9, 0.78)",
    pattern: "rgba(211, 176, 132, 0.06)",
    patternSoft: "rgba(211, 176, 132, 0.03)",
    nodeBgGradient: "linear-gradient(160deg, rgba(18, 32, 28, 0.98), rgba(10, 18, 16, 0.98))",
    nodeHeaderBg: "rgba(211, 176, 132, 0.06)",
    groupBg: "rgba(18, 32, 28, 0.58)",
    groupBgSelected: "rgba(24, 39, 35, 0.76)",
    groupBorder: "rgba(212, 181, 135, 0.18)",
    groupBorderStrong: "rgba(212, 181, 135, 0.3)",
    groupHighlight: "rgba(211, 176, 132, 0.1)",
    groupShadow: "0 30px 78px rgba(5, 10, 9, 0.62)",
    scheme: "dark",
  },
  calm: {
    label: "Calm",
    description: "Blue slate tuned for long-form focus work.",
    bg: "#151c22",
    panel: "rgba(20, 29, 35, 0.92)",
    panelStrong: "rgba(26, 36, 43, 0.97)",
    panelMuted: "rgba(110, 149, 173, 0.08)",
    panelSoft: "rgba(110, 149, 173, 0.12)",
    border: "rgba(154, 182, 198, 0.14)",
    borderStrong: "rgba(154, 182, 198, 0.24)",
    textPrimary: "#e8edf0",
    textSecondary: "rgba(232, 237, 240, 0.67)",
    textMuted: "rgba(232, 237, 240, 0.42)",
    accent: "#6e95ad",
    accentStrong: "#92b5ca",
    accentSoft: "rgba(110, 149, 173, 0.16)",
    panelShadow: "0 18px 40px rgba(6, 10, 13, 0.28)",
    panelShadowStrong: "0 24px 56px rgba(6, 10, 13, 0.34)",
    nodeShadow: "0 28px 72px rgba(4, 7, 10, 0.58)",
    nodeShadowStrong: "0 36px 92px rgba(4, 7, 10, 0.74)",
    pattern: "rgba(154, 182, 198, 0.06)",
    patternSoft: "rgba(154, 182, 198, 0.03)",
    nodeBgGradient: "linear-gradient(160deg, rgba(29, 40, 47, 0.98), rgba(18, 25, 31, 0.98))",
    nodeHeaderBg: "rgba(154, 182, 198, 0.05)",
    groupBg: "rgba(23, 33, 40, 0.6)",
    groupBgSelected: "rgba(29, 40, 48, 0.78)",
    groupBorder: "rgba(154, 182, 198, 0.16)",
    groupBorderStrong: "rgba(154, 182, 198, 0.28)",
    groupHighlight: "rgba(154, 182, 198, 0.08)",
    groupShadow: "0 30px 78px rgba(4, 7, 10, 0.6)",
    scheme: "dark",
  },
  lively: {
    label: "Lively",
    description: "Mulberry base with a clay rose accent, not candy pink.",
    bg: "#221918",
    panel: "rgba(33, 24, 24, 0.92)",
    panelStrong: "rgba(40, 29, 29, 0.97)",
    panelMuted: "rgba(196, 123, 100, 0.08)",
    panelSoft: "rgba(196, 123, 100, 0.13)",
    border: "rgba(214, 164, 148, 0.15)",
    borderStrong: "rgba(214, 164, 148, 0.26)",
    textPrimary: "#f4e9e4",
    textSecondary: "rgba(244, 233, 228, 0.67)",
    textMuted: "rgba(244, 233, 228, 0.42)",
    accent: "#c47b64",
    accentStrong: "#d99a84",
    accentSoft: "rgba(196, 123, 100, 0.16)",
    panelShadow: "0 18px 40px rgba(10, 6, 6, 0.3)",
    panelShadowStrong: "0 24px 56px rgba(10, 6, 6, 0.36)",
    nodeShadow: "0 28px 72px rgba(8, 4, 4, 0.6)",
    nodeShadowStrong: "0 36px 92px rgba(8, 4, 4, 0.74)",
    pattern: "rgba(214, 164, 148, 0.065)",
    patternSoft: "rgba(214, 164, 148, 0.032)",
    nodeBgGradient: "linear-gradient(160deg, rgba(41, 30, 30, 0.98), rgba(26, 19, 19, 0.98))",
    nodeHeaderBg: "rgba(214, 164, 148, 0.05)",
    groupBg: "rgba(37, 27, 27, 0.6)",
    groupBgSelected: "rgba(44, 32, 32, 0.78)",
    groupBorder: "rgba(214, 164, 148, 0.16)",
    groupBorderStrong: "rgba(214, 164, 148, 0.28)",
    groupHighlight: "rgba(214, 164, 148, 0.08)",
    groupShadow: "0 30px 78px rgba(8, 4, 4, 0.6)",
    scheme: "dark",
  },
};

const getPatternDefinitions = (theme: ThemePreset): Record<Exclude<PatternKey, "none">, { image: string; size: (scale: number) => string; position?: string }> => ({
  dots: {
    image:
      `radial-gradient(circle at 1px 1px, ${theme.pattern} 1px, transparent 0), radial-gradient(circle at 1px 1px, ${theme.patternSoft} 1px, transparent 0)`,
    size: (scale) => `${30 * scale}px ${30 * scale}px, ${30 * scale}px ${30 * scale}px`,
    position: "0 0, 15px 15px",
  },
  grid: {
    image: `linear-gradient(${theme.patternSoft} 1px, transparent 1px), linear-gradient(90deg, ${theme.patternSoft} 1px, transparent 1px)`,
    size: (scale) => `${38 * scale}px ${38 * scale}px`,
  },
  cross: {
    image:
      `linear-gradient(${theme.patternSoft} 1px, transparent 1px), linear-gradient(90deg, ${theme.patternSoft} 1px, transparent 1px), radial-gradient(circle, ${theme.patternSoft} 1px, transparent 1px)`,
    size: (scale) => `${36 * scale}px ${36 * scale}px, ${36 * scale}px ${36 * scale}px, ${36 * scale}px ${36 * scale}px`,
    position: "0 0, 0 0, 18px 18px",
  },
  lines: {
    image: `linear-gradient(0deg, ${theme.patternSoft} 1px, transparent 1px)`,
    size: (scale) => `${34 * scale}px ${34 * scale}px`,
  },
  diagonal: {
    image:
      `linear-gradient(135deg, ${theme.patternSoft} 12.5%, transparent 12.5%, transparent 50%, ${theme.patternSoft} 50%, ${theme.patternSoft} 62.5%, transparent 62.5%, transparent)`,
    size: (scale) => `${32 * scale}px ${32 * scale}px`,
  },
});

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
  const [bgPattern, setBgPattern] = useState<PatternKey>("grid");
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
        prompt: "Video Output",
        model: data.model,
        aspectRatio: data.aspectRatio,
        sourceId: node.id,
      });
    });
  }, [addToGlobalHistory, globalAssetHistory, nodes]);

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
    (payload: { title: string; text: string; refId?: string }) => {
      const origin = getTemplateOrigin();
      addNode("text", origin, undefined, {
        title: payload.title,
        text: payload.text,
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
          status: 'idle',
          error: null,
          aspectRatio: '16:9',
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
          outputImage: null,
          status: 'idle',
          error: null,
          aspectRatio: '16:9',
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
  const patternDefinitions = useMemo(() => getPatternDefinitions(activeTheme), [activeTheme]);
  const patternOptions: { key: PatternKey; label: string }[] = [
    { key: "dots", label: "Dots" },
    { key: "grid", label: "Grid" },
    { key: "cross", label: "Cross" },
    { key: "lines", label: "Lines" },
    { key: "diagonal", label: "Diagonal" },
    { key: "none", label: "None" },
  ];

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
        backgroundColor: base,
        backgroundImage: "none",
        backgroundSize: "auto",
        backgroundPosition: "0 0",
        baseColor: base,
      };
    }
    const pat = patternDefinitions[bgPattern as Exclude<PatternKey, "none">] || patternDefinitions.dots;
    return {
      backgroundColor: base,
      backgroundImage: pat.image,
      backgroundSize: pat.size(scale),
      backgroundPosition: buildPosition(pat.position),
      baseColor: base,
    };
  }, [activeTheme, bgPattern, liveViewport, patternDefinitions]);

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
          <div className="theme-modal-backdrop fixed inset-0 z-50" onClick={() => setShowThemeModal(false)} />
          <div className="theme-modal fixed bottom-20 right-6 z-50 w-[min(420px,calc(100vw-24px))] max-h-[min(72dvh,720px)] overflow-x-hidden overflow-y-auto rounded-[28px] p-4 sm:p-4.5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="theme-modal-eyebrow">Workspace Styling</div>
                <div className="mt-1.5 text-[22px] font-semibold tracking-[-0.03em] text-[var(--app-text-primary)]">主题与样式</div>
                <p className="mt-1.5 max-w-[30ch] text-[12px] leading-5 text-[var(--app-text-secondary)]">
                  调整底色、表面层次和背景纹理。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowThemeModal(false)}
                className="h-9 w-9 rounded-full border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-muted)] transition"
              >
                ×
              </button>
            </div>
            <div className="mt-5">
              <div className="mb-2.5 text-[10px] uppercase tracking-[0.26em] app-text-muted">颜色主题</div>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(THEME_PRESETS) as ThemeKey[]).map((key) => {
                  const theme = THEME_PRESETS[key];
                  const isActive = bgTheme === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setBgTheme(key)}
                      className="theme-preset-card rounded-[20px] border px-3 py-3 text-left transition"
                      data-active={isActive}
                      style={isActive ? {
                        borderColor: theme.accentStrong,
                        boxShadow: `0 14px 34px ${theme.accentSoft}`,
                        background: `linear-gradient(180deg, ${theme.panelSoft}, ${theme.panelMuted})`,
                      } : undefined}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[14px] font-semibold tracking-[-0.02em] text-[var(--app-text-primary)]">{theme.label}</div>
                          <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-[var(--app-text-muted)]">{theme.description}</div>
                        </div>
                        {isActive && (
                          <span
                            className="rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em]"
                            style={{ color: theme.accentStrong, background: theme.accentSoft }}
                          >
                            Active
                          </span>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-1.5">
                        <span className="h-8 rounded-[12px] border border-white/5" style={{ background: theme.bg }} />
                        <span className="h-8 rounded-[12px] border border-white/5" style={{ background: theme.panel }} />
                        <span className="h-8 rounded-[12px] border border-white/5" style={{ background: theme.accent }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[9px] uppercase tracking-[0.16em] app-text-muted">
                        <span>Base / Surface / Accent</span>
                        <span style={{ color: isActive ? theme.accentStrong : undefined }}>Tone</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-5">
              <div className="mb-2.5 text-[10px] uppercase tracking-[0.26em] app-text-muted">图案</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {patternOptions.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setBgPattern(item.key)}
                    className="theme-pattern-card flex flex-col gap-2 rounded-[18px] border px-3 py-2.5 text-left transition"
                    data-active={bgPattern === item.key}
                    style={bgPattern === item.key ? {
                      borderColor: activeTheme.accentStrong,
                      boxShadow: `0 12px 28px ${activeTheme.accentSoft}`,
                    } : undefined}
                  >
                    <span
                      className="theme-pattern-preview h-8 rounded-[12px] border border-white/5"
                      style={item.key === "none"
                        ? { background: activeTheme.panelMuted }
                        : {
                            backgroundColor: activeTheme.panelMuted,
                            backgroundImage: patternDefinitions[item.key as Exclude<PatternKey, "none">].image,
                            backgroundSize: patternDefinitions[item.key as Exclude<PatternKey, "none">].size(0.55),
                            backgroundPosition: patternDefinitions[item.key as Exclude<PatternKey, "none">].position ?? "0 0",
                          }}
                    />
                    <span className="text-[13px] font-medium text-[var(--app-text-primary)]">{item.label}</span>
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
