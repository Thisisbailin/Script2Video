import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
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
  NoteNode,
  GroupNode,
  ImageGenNode,
  VideoGenNode,
  ViduVideoGenNode,
  LLMGenerateNode,
  OutputNode,
  ShotNode,
} from "../nodes";
import { useLabExecutor } from "../store/useLabExecutor";
import { MultiSelectToolbar } from "./MultiSelectToolbar";
import { FloatingActionBar } from "./FloatingActionBar";
import { ConnectionDropMenu } from "./ConnectionDropMenu";
import { AssetsPanel } from "./AssetsPanel";
import { QalamAgent } from "./QalamAgent";
import { ViewportControls } from "./ViewportControls";
import { Toast, useToast } from "./Toast";
import { AnnotationModal } from "./AnnotationModal";
import { DesignAssetItem, ProjectData } from "../../types";

const nodeTypes: NodeTypes = {
  imageInput: ImageInputNode,
  annotation: AnnotationNode,
  text: TextNode,
  note: NoteNode,
  group: GroupNode,
  imageGen: ImageGenNode,
  videoGen: VideoGenNode,
  viduVideoGen: ViduVideoGenNode,
  llmGenerate: LLMGenerateNode,
  shot: ShotNode,
  output: OutputNode,
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
}

const NodeLabInner: React.FC<NodeLabProps> = ({ projectData, setProjectData }) => {
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
  const { setViewport, screenToFlowPosition, getViewport } = useReactFlow();
  const { show: showToast } = useToast();
  const { runLLM, runImageGen, runVideoGen } = useLabExecutor();

  const minZoom = 0.25;
  const maxZoom = 4;
  const [connectionDrop, setConnectionDrop] = useState<ConnectionDropState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [zoomValue, setZoomValue] = useState(() => getViewport().zoom ?? 1);
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
      dramaGuide: projectData.dramaGuide || "",
      context: projectData.context,
    });
  }, [projectData, setLabContext]);

  useEffect(() => {
    setViewportState(getViewport());
  }, [getViewport, setViewportState]);

  const lastViewportRef = useRef<string>("");
  useEffect(() => {
    if (!viewport) return;
    const key = `${viewport.x}:${viewport.y}:${viewport.zoom}`;
    if (lastViewportRef.current === key) return;
    lastViewportRef.current = key;
    setViewport(viewport, { duration: 0 });
  }, [setViewport, viewport]);

  useEffect(() => {
    if (!viewport) return;
    setZoomValue(viewport.zoom);
  }, [viewport]);

  useEffect(() => {
    const videoNodes = nodes.filter((node) => node.type === "videoGen");
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
      if (source.type !== "text" || target.type !== "imageGen") return;
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
      if (source.type !== "text" || target.type !== "imageGen") return;
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
      if (n.type === "llmGenerate") await runLLM(n.id);
      if (n.type === "imageGen") await runImageGen(n.id);
      if (n.type === "videoGen" || n.type === "viduVideoGen") await runVideoGen(n.id);
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

    newNodes.push({
      id: groupId,
      type: 'group',
      position: { x: origin.x, y: origin.y },
      data: { title: `EPISODE ${episode.id}: ${episode.title.toUpperCase()}` } as GroupNodeData,
      style: { width: 1000, height: 200 + (episode.shots.length * 400) },
    });

    episode.shots.forEach((shot, idx) => {
      const shotNodeId = `shot-${episodeId}-${shot.id}-${Date.now()}`;
      const promptNodeId = `text-prompt-${episodeId}-${shot.id}-${Date.now()}`;
      const yPos = 120 + (idx * 400);

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
          movement: shot.movement,
          difficulty: shot.difficulty,
          dialogue: shot.dialogue,
        } as ShotNodeData,
      });

      newNodes.push({
        id: promptNodeId,
        type: 'text',
        position: { x: 520, y: yPos + 20 },
        parentId: groupId,
        extent: 'parent',
        data: {
          title: `Prompt: ${shot.id}`,
          text: shot.soraPrompt || "",
          category: 'episode',
          refId: `${episodeId}|${shot.id}`
        } as TextNodeData,
      });

      newEdges.push({ id: `edge-shot-prompt-${shot.id}`, source: shotNodeId, target: promptNodeId, sourceHandle: 'text', targetHandle: 'text' });
    });

    addNodesAndEdges(newNodes, newEdges);
    focusTemplate(origin, 0.7);
  }, [projectData, addNodesAndEdges, getTemplateOrigin, focusTemplate]);

  const displayNodes = nodes;
  const displayEdges = edges;
  const selectedGroup = getSelectedGroup();

  return (
    <div className="h-full w-full flex flex-col bg-[#0a0a0a] text-white">
      <div className="flex-1 relative node-lab-canvas">
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onConnectEnd={handleConnectEnd}
          onMoveEnd={(_, vp) => setViewportState(vp)}
          minZoom={minZoom}
          maxZoom={maxZoom}
          nodesDraggable={!isLocked}
          nodesConnectable={!isLocked}
          elementsSelectable={!isLocked}
          panOnDrag={!isLocked}
          zoomOnScroll={!isLocked}
          zoomOnPinch={!isLocked}
          zoomOnDoubleClick={!isLocked}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          connectionMode={ConnectionMode.Loose}
          proOptions={{ hideAttribution: true }}
          data-active-mode="default"
        >
          <Background />
          {showMiniMap && (
            <div className="nodelab-minimap-drawer" data-open={showMiniMap}>
              <MiniMap
                className="nodelab-minimap"
                style={{ height: 130, width: 180, background: "#0f0f0f", borderRadius: 14, border: "1px solid #1f2937", boxShadow: "0 12px 30px rgba(0,0,0,0.35)" }}
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
      <div className="fixed bottom-4 left-4 right-4 z-30 flex items-end justify-between gap-4 pointer-events-none">
        <div className="flex items-end gap-3 pointer-events-auto">
          <QalamAgent projectData={projectData} />
          <FloatingActionBar
            onAddText={() => handleAddNode("text", { x: 100, y: 100 })}
            onAddImage={() => handleAddNode("imageInput", { x: 200, y: 100 })}
            onAddLLM={() => handleAddNode("llmGenerate", { x: 300, y: 100 })}
            onAddImageGen={() => handleAddNode("imageGen", { x: 400, y: 100 })}
            onAddVideoGen={() => handleAddNode("videoGen", { x: 500, y: 100 })}
            onAddOutput={() => handleAddNode("output", { x: 600, y: 100 })}
            onAddGroup={() => handleAddNode("group", { x: 100, y: 100 })}
            onAddNote={() => handleAddNode("note", { x: 100, y: 100 })}
            onImport={() => fileInputRef.current?.click()}
            onExport={() => saveWorkflow()}
            onRun={runAll}
            templates={groupTemplates}
            canCreateTemplate={!!selectedGroup}
            onCreateTemplate={handleCreateTemplate}
            onLoadTemplate={handleLoadTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            floating={false}
          />
        </div>
        <div className="flex items-end gap-3 pointer-events-auto">
          <ViewportControls
            zoom={zoomValue}
            minZoom={minZoom}
            maxZoom={maxZoom}
            onZoomChange={handleZoomChange}
            isLocked={isLocked}
            onToggleLock={handleToggleLock}
            showMiniMap={showMiniMap}
            onToggleMiniMap={() => setShowMiniMap((prev) => !prev)}
          />
          <AssetsPanel
            projectData={projectData}
            onInsertTextNode={handleInsertTextNode}
            onImportEpisodeShots={handleImportEpisode}
            floating={false}
          />
        </div>
      </div>
      <Toast />
      <AnnotationModal />
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
