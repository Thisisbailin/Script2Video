import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Connection,
  NodeTypes,
  EdgeTypes,
  useReactFlow,
  OnConnectEnd,
  ReactFlowProvider,
  ControlButton,
  ConnectionMode,
  XYPosition,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "../styles/nodelab.css";
import { useWorkflowStore } from "../store/workflowStore";
import { isValidConnection } from "../utils/handles";
import { WorkflowFile, NodeType, WorkflowNode, WorkflowEdge, TextNodeData, GroupNodeData, ShotNodeData, VideoGenNodeData } from "../types";
import { EditableEdge } from "../edges/EditableEdge";
import {
  ImageInputNode, AnnotationNode, TextNode,
  NoteNode,
  GroupNode,
  ImageGenNode,
  VideoGenNode,
  LLMGenerateNode,
  OutputNode,
  ShotNode,
} from "../nodes";
import { useLabExecutor } from "../store/useLabExecutor";
import { MultiSelectToolbar } from "./MultiSelectToolbar";
import { FloatingActionBar } from "./FloatingActionBar";
import { ConnectionDropMenu } from "./ConnectionDropMenu";
import { GlobalImageHistory } from "./GlobalImageHistory";
import { Toast } from "./Toast";
import { AnnotationModal } from "./AnnotationModal";
import { MapPinned, MapPinOff, X, ChevronRight } from "lucide-react";
import { ProjectData } from "../../types";

const nodeTypes: NodeTypes = {
  imageInput: ImageInputNode,
  annotation: AnnotationNode,
  text: TextNode,
  note: NoteNode,
  group: GroupNode,
  imageGen: ImageGenNode,
  videoGen: VideoGenNode,
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
    onNodesChange,
    onEdgesChange,
    onConnect,
    saveWorkflow,
    loadWorkflow,
    setGlobalStyleGuide,
    addToGlobalHistory,
    globalAssetHistory,
  } = useWorkflowStore();
  const [showEpisodeSelector, setShowEpisodeSelector] = useState(false);
  const { setViewport, screenToFlowPosition } = useReactFlow();
  const { runLLM, runImageGen, runVideoGen } = useLabExecutor();

  const [connectionDrop, setConnectionDrop] = useState<ConnectionDropState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMiniMap, setShowMiniMap] = useState(false);

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

  const runAll = async () => {
    for (const n of nodes) {
      if (n.type === "llmGenerate") await runLLM(n.id);
      if (n.type === "imageGen") await runImageGen(n.id);
      if (n.type === "videoGen") await runVideoGen(n.id);
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

  const handleImportUnderstanding = useCallback(() => {

    const context = projectData.context;
    const newNodes: WorkflowNode[] = [];
    const newEdges: WorkflowEdge[] = [];
    const origin = getTemplateOrigin();
    let yOffset = 100;

    const summaryId = `text-understanding-summary-${Date.now()}`;
    newNodes.push({
      id: summaryId,
      type: 'text',
      position: { x: origin.x + 400, y: origin.y + yOffset },
      data: {
        title: "Project Summary",
        text: context.projectSummary,
        category: 'project',
        refId: 'projectSummary'
      } as TextNodeData,
    });
    yOffset += 450;

    let charX = 50;
    context.characters.forEach((char) => {
      const charId = `text-char-${char.id}-${Date.now()}`;
      const charGroupId = `group-char-${char.id}-${Date.now()}`;
      const groupHeight = 450 + (char.forms.length * 400);

      newNodes.push({
        id: charGroupId,
        type: 'group',
        position: { x: origin.x + charX - 25, y: origin.y + yOffset - 80 },
        data: {
          title: `CHARACTER: ${char.name.toUpperCase()}`,
        } as GroupNodeData,
        style: { width: 470, height: groupHeight },
      });

      newNodes.push({
        id: charId,
        type: 'text',
        position: { x: 25, y: 80 },
        parentId: charGroupId,
        extent: 'parent',
        data: {
          title: `Bio`,
          text: char.bio,
          category: 'character',
          refId: char.id
        } as TextNodeData,
      });

      char.forms.forEach((form, formIdx) => {
        const formId = `text-form-${char.id}-${formIdx}-${Date.now()}`;
        newNodes.push({
          id: formId,
          type: 'text',
          position: { x: 25, y: 350 + (formIdx * 350) },
          parentId: charGroupId,
          extent: 'parent',
          data: {
            title: `Form: ${form.formName}`,
            text: form.description,
            category: 'form',
            refId: `${char.id}|${form.formName}`
          } as TextNodeData,
        });
        newEdges.push({ id: `edge-${charId}-${formId}`, source: charId, target: formId, sourceHandle: 'text', targetHandle: 'text' });
      });
      charX += 550;
    });

    let locX = charX + 200;
    context.locations.forEach((loc) => {
      const locId = `text-loc-${loc.id}-${Date.now()}`;
      const locGroupId = `group-loc-${loc.id}-${Date.now()}`;
      const groupHeight = 450 + ((loc.zones?.length || 0) * 400);

      newNodes.push({
        id: locGroupId,
        type: 'group',
        position: { x: origin.x + locX - 25, y: origin.y + 400 - 80 },
        data: { title: `LOCATION: ${loc.name.toUpperCase()}` } as GroupNodeData,
        style: { width: 470, height: groupHeight },
      });

      newNodes.push({
        id: locId,
        type: 'text',
        position: { x: 25, y: 80 },
        parentId: locGroupId,
        extent: 'parent',
        data: {
          title: `Description`,
          text: loc.description,
          category: 'location',
          refId: loc.id
        } as TextNodeData,
      });

      (loc.zones || []).forEach((zone, zoneIdx) => {
        const zoneId = `text-zone-${loc.id}-${zoneIdx}-${Date.now()}`;
        newNodes.push({
          id: zoneId,
          type: 'text',
          position: { x: 25, y: 350 + (zoneIdx * 350) },
          parentId: locGroupId,
          extent: 'parent',
          data: {
            title: `Zone: ${zone.name}`,
            text: zone.layoutNotes,
            category: 'zone',
            refId: `${loc.id}|${zone.name}`
          } as TextNodeData,
        });
        newEdges.push({ id: `edge-${locId}-${zoneId}`, source: locId, target: zoneId, sourceHandle: 'text', targetHandle: 'text' });
      });
      locX += 550;
    });

    addNodesAndEdges(newNodes, newEdges);
    focusTemplate(origin, 0.7);
  }, [projectData, addNodesAndEdges, getTemplateOrigin, focusTemplate]);

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
    setShowEpisodeSelector(false);
    focusTemplate(origin, 0.7);
  }, [projectData, addNodesAndEdges, getTemplateOrigin, focusTemplate]);

  const displayNodes = nodes;
  const displayEdges = edges;

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
          <Controls position="bottom-left">
            <ControlButton onClick={() => setShowMiniMap((v) => !v)}>
              {showMiniMap ? <MapPinOff size={16} /> : <MapPinned size={16} />}
            </ControlButton>
          </Controls>
        </ReactFlow>

        {connectionDrop && (
          <ConnectionDropMenu
            position={connectionDrop.position}
            onCreate={(t) => handleDropCreate(t)}
            onClose={() => setConnectionDrop(null)}
          />
        )}
      </div>

      <FloatingActionBar
        onAddText={() => handleAddNode("text", { x: 100, y: 100 })}
        onAddImage={() => handleAddNode("imageInput", { x: 200, y: 100 })}
        onAddLLM={() => handleAddNode("llmGenerate", { x: 300, y: 100 })}
        onAddImageGen={() => handleAddNode("imageGen", { x: 400, y: 100 })}
        onAddVideoGen={() => handleAddNode("videoGen", { x: 500, y: 100 })}
        onAddOutput={() => handleAddNode("output", { x: 600, y: 100 })}
        onAddGroup={() => handleAddNode("group", { x: 100, y: 100 })}
        onAddNote={() => handleAddNode("note", { x: 100, y: 100 })}
        onImportUnderstanding={handleImportUnderstanding}
        onImportEpisode={() => setShowEpisodeSelector(true)}
        onImport={() => fileInputRef.current?.click()}
        onExport={() => saveWorkflow()}
        onRun={runAll}
      />

      {showEpisodeSelector && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 backdrop-blur-md bg-black/40 animate-in fade-in duration-300">
          <div className="w-full max-w-lg rounded-[32px] border border-white/10 bg-[#121212]/95 shadow-[0_40px_100px_rgba(0,0,0,0.6)] overflow-hidden">
            <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-white">Import Episode</h3>
                <p className="text-sm text-white/40 mt-1">Select an episode to generate storyboard nodes</p>
              </div>
              <button onClick={() => setShowEpisodeSelector(false)} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors">
                <X size={20} className="text-white/40" />
              </button>
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
              <div className="space-y-2">
                {projectData.episodes.map((ep) => (
                  <button key={ep.id} onClick={() => handleImportEpisode(ep.id)} className="w-full flex items-center justify-between px-6 py-4 rounded-2xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group">
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">EPISODE {ep.id}</span>
                        <div className={`h-1.5 w-1.5 rounded-full ${ep.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      </div>
                      <div className="text-base font-bold text-white/90 mt-0.5 group-hover:text-blue-400 transition-colors uppercase tracking-tight">{ep.title}</div>
                      <div className="text-xs text-white/30 font-medium mt-1">{ep.shots.length} Storyboard Shots</div>
                    </div>
                    <ChevronRight size={18} className="text-white/20 group-hover:text-white/60 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <MultiSelectToolbar />
      <GlobalImageHistory />
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
