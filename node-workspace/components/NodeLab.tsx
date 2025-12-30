import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Connection,
  Edge,
  NodeTypes,
  EdgeTypes,
  useReactFlow,
  OnConnectEnd,
  ReactFlowProvider,
  ControlButton,
  ConnectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "../styles/nodelab.css";
import { useWorkflowStore } from "../store/workflowStore";
import { getNodeHandles, isValidConnection } from "../utils/handles";
import { WorkflowFile, WorkflowNodeData, NodeType, WorkflowNode, WorkflowEdge, TextNodeData, GroupNodeData, ShotNodeData } from "../types";
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
import { Database, Library, Settings, MapPinned, MapPinOff, SquareStack, StickyNote, BoxSelect, Clapperboard, X, ChevronRight } from "lucide-react";
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
  const { nodes, edges, addNode, addNodesAndEdges, onNodesChange, onEdgesChange, onConnect, saveWorkflow, loadWorkflow } = useWorkflowStore();
  const [isUnderstandingActive, setIsUnderstandingActive] = useState(false);
  const [showEpisodeSelector, setShowEpisodeSelector] = useState(false);
  const { setViewport } = useReactFlow();
  const { runLLM, runImageGen, runVideoGen } = useLabExecutor();

  const { screenToFlowPosition } = useReactFlow();
  const [, setIsDragOver] = useState(false);
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

  const handleConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (connectionState.isValid || !connectionState.fromNode) return;
      const { clientX, clientY } = event as MouseEvent;
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

  const handleDropCreate = (type: NodeType) => {
    if (!connectionDrop) return;
    const newId = addNode(type, connectionDrop.flowPosition);
    // auto connect
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

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);

      if (!event.dataTransfer) return;
      const json = event.dataTransfer.getData("application/json");
      if (json) {
        try {
          const workflow = JSON.parse(json) as WorkflowFile;
          if (workflow?.nodes && workflow?.edges) {
            loadWorkflow(workflow);
            return;
          }
        } catch {
          // ignore
        }
      }
    },
    [loadWorkflow]
  );

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
    // simple topo-like: just run generators that have inputs
    for (const n of nodes) {
      if (n.type === "llmGenerate") await runLLM(n.id);
      if (n.type === "imageGen") await runImageGen(n.id);
      if (n.type === "videoGen") await runVideoGen(n.id);
    }
    alert("Run triggered (sequential, demo mode)");
  };

  const handleImportUnderstanding = useCallback(() => {
    const context = projectData.context;
    const newNodes: WorkflowNode[] = [];
    const newEdges: WorkflowEdge[] = [];
    let yOffset = 100;

    // 1. Project Summary
    const summaryId = `text-understanding-summary-${Date.now()}`;
    newNodes.push({
      id: summaryId,
      type: 'text',
      position: { x: 400, y: yOffset },
      data: {
        title: "Project Summary",
        text: context.projectSummary,
        category: 'project',
        refId: 'projectSummary'
      } as TextNodeData,
      style: { width: 320 }
    });
    yOffset += 300;

    // 2. Characters
    let charX = 50;
    context.characters.forEach((char, charIdx) => {
      const charId = `text-char-${char.id}-${Date.now()}`;
      const charGroupId = `group-char-${char.id}-${Date.now()}`;

      // Calculate group height based on forms
      const groupHeight = 350 + (char.forms.length * 260);

      newNodes.push({
        id: charGroupId,
        type: 'group',
        position: { x: charX - 25, y: yOffset - 80 },
        data: {
          title: `CHARACTER: ${char.name.toUpperCase()}`,
        } as GroupNodeData,
        style: { width: 370, height: groupHeight },
      });

      newNodes.push({
        id: charId,
        type: 'text',
        position: { x: 25, y: 80 }, // Relative to group
        parentId: charGroupId,
        extent: 'parent',
        data: {
          title: `Bio`,
          text: char.bio,
          category: 'character',
          refId: char.id
        } as TextNodeData,
        style: { width: 320 }
      });

      // Character Forms
      char.forms.forEach((form, formIdx) => {
        const formId = `text-form-${char.id}-${formIdx}-${Date.now()}`;
        newNodes.push({
          id: formId,
          type: 'text',
          position: { x: 25, y: 320 + (formIdx * 250) }, // Relative to group
          parentId: charGroupId,
          extent: 'parent',
          data: {
            title: `Form: ${form.formName}`,
            text: form.description,
            category: 'form',
            refId: `${char.id}|${form.formName}`
          } as TextNodeData,
          style: { width: 320 }
        });

        newEdges.push({
          id: `edge-${charId}-${formId}`,
          source: charId,
          target: formId,
          sourceHandle: 'text',
          targetHandle: 'text'
        });
      });

      charX += 450;
    });

    // 3. Locations
    let locX = charX + 200;
    const locYStart = 400;
    context.locations.forEach((loc, locIdx) => {
      const locId = `text-loc-${loc.id}-${Date.now()}`;
      const locGroupId = `group-loc-${loc.id}-${Date.now()}`;
      const groupHeight = 350 + ((loc.zones?.length || 0) * 260);

      newNodes.push({
        id: locGroupId,
        type: 'group',
        position: { x: locX - 25, y: locYStart - 80 },
        data: {
          title: `LOCATION: ${loc.name.toUpperCase()}`,
        } as GroupNodeData,
        style: { width: 370, height: groupHeight },
      });

      newNodes.push({
        id: locId,
        type: 'text',
        position: { x: 25, y: 80 }, // Relative
        parentId: locGroupId,
        extent: 'parent',
        data: {
          title: `Description`,
          text: loc.description,
          category: 'location',
          refId: loc.id
        } as TextNodeData,
        style: { width: 320 }
      });

      // Location Zones
      (loc.zones || []).forEach((zone, zoneIdx) => {
        const zoneId = `text-zone-${loc.id}-${zoneIdx}-${Date.now()}`;
        newNodes.push({
          id: zoneId,
          type: 'text',
          position: { x: 25, y: 320 + (zoneIdx * 250) }, // Relative
          parentId: locGroupId,
          extent: 'parent',
          data: {
            title: `Zone: ${zone.name}`,
            text: zone.layoutNotes,
            category: 'zone',
            refId: `${loc.id}|${zone.name}`
          } as TextNodeData,
          style: { width: 320 }
        });

        newEdges.push({
          id: `edge-${locId}-${zoneId}`,
          source: locId,
          target: zoneId,
          sourceHandle: 'text',
          targetHandle: 'text'
        });
      });

      locX += 450;
    });

    addNodesAndEdges(newNodes, newEdges);
    setIsUnderstandingActive(true);
  }, [projectData, addNodesAndEdges]);

  // Handle Episode Import
  const handleImportEpisode = useCallback((episodeId: number) => {
    const episode = projectData.episodes.find(e => e.id === episodeId);
    if (!episode) return;

    const newNodes: WorkflowNode[] = [];
    const newEdges: WorkflowEdge[] = [];
    const groupId = `group-episode-${episodeId}-${Date.now()}`;

    // Calculate layout
    const shotsCount = episode.shots.length;
    const groupWidth = 840;
    const groupHeight = 120 + (shotsCount * 300);

    // 1. Episode Group
    newNodes.push({
      id: groupId,
      type: 'group',
      position: { x: 50, y: 50 }, // Default position, can be improved
      data: {
        title: `EPISODE ${episode.id}: ${episode.title.toUpperCase()}`,
      } as GroupNodeData,
      style: { width: groupWidth, height: groupHeight },
    });

    // 2. Shot Nodes and Prompt Nodes
    episode.shots.forEach((shot, idx) => {
      const shotNodeId = `shot-${episodeId}-${shot.id}-${Date.now()}`;
      const promptNodeId = `text-prompt-${episodeId}-${shot.id}-${Date.now()}`;
      const yPos = 80 + (idx * 300);

      // Shot Data Node
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

      // Sora Prompt Node
      newNodes.push({
        id: promptNodeId,
        type: 'text',
        position: { x: 440, y: yPos + 20 },
        parentId: groupId,
        extent: 'parent',
        data: {
          title: `Prompt: ${shot.id}`,
          text: shot.soraPrompt || "",
          category: 'episode',
          refId: `${episodeId}|${shot.id}`
        } as TextNodeData,
        style: { width: 340 }
      });

      // Connect Shot -> Prompt
      newEdges.push({
        id: `edge-shot-prompt-${shot.id}`,
        source: shotNodeId,
        target: promptNodeId,
        sourceHandle: 'text',
        targetHandle: 'text'
      });
    });

    addNodesAndEdges(newNodes, newEdges);
    setShowEpisodeSelector(false);

    // Focus view
    setViewport({ x: 0, y: 0, zoom: 0.6 }, { duration: 1000 });
  }, [projectData, addNodesAndEdges, setViewport]);

  // Handle Understanding Toggle
  const handleToggleUnderstanding = useCallback(() => {
    setIsUnderstandingActive(prev => !prev);

    // Zoom to understanding nodes if turning on
    if (!isUnderstandingActive) {
      const understandingNodes = nodes.filter(n => (n.data as any).category || n.type === 'group');
      if (understandingNodes.length > 0) {
        setViewport({ x: 0, y: 0, zoom: 0.8 }, { duration: 800 });
      }
    }
  }, [isUnderstandingActive, nodes, setViewport]);

  // Filter nodes based on active mode
  const displayNodes = useMemo(() => {
    if (isUnderstandingActive) {
      // Show understanding nodes + groups + their children
      return nodes.filter(n =>
        (n.data as any).category ||
        n.type === 'group' ||
        n.parentId ||
        (n.data as any).shotId // Explicitly show shot cards in understanding groups if they exist
      );
    } else {
      // Show functional nodes (NOT understanding/episode)
      return nodes.filter(n => {
        const isUnderstanding = (n.data as any).category || n.type === 'group' || n.parentId;
        return !isUnderstanding;
      });
    }
  }, [nodes, isUnderstandingActive]);

  // Filter edges - only show if both source and target are visible
  const displayEdges = useMemo(() => {
    const visibleIds = new Set(displayNodes.map(n => n.id));
    return edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));
  }, [edges, displayNodes]);

  // Data Synchronization back to ProjectData
  React.useEffect(() => {
    const textNodes = nodes.filter(n => n.type === 'text' && (n.data as TextNodeData).refId);
    if (textNodes.length === 0) return;

    setProjectData(prev => {
      let changed = false;
      const newContext = { ...prev.context };

      textNodes.forEach(node => {
        const data = node.data as TextNodeData;
        if (!data.refId) return;

        // 1. Project Summary
        if (data.category === 'project' && data.refId === 'projectSummary') {
          if (newContext.projectSummary !== data.text) {
            newContext.projectSummary = data.text;
            changed = true;
          }
        }
        // 2. Character Bio
        else if (data.category === 'character') {
          const char = newContext.characters.find(c => c.id === data.refId);
          if (char && char.bio !== data.text) {
            char.bio = data.text;
            changed = true;
          }
        }
        // 3. Character Form
        else if (data.category === 'form') {
          const [charId, formName] = data.refId.split('|');
          const char = newContext.characters.find(c => c.id === charId);
          const form = char?.forms.find(f => f.formName === formName);
          if (form && form.description !== data.text) {
            form.description = data.text;
            changed = true;
          }
        }
        // 4. Location Description
        else if (data.category === 'location') {
          const loc = newContext.locations.find(l => l.id === data.refId);
          if (loc && loc.description !== data.text) {
            loc.description = data.text;
            changed = true;
          }
        }
        // 5. Location Zone
        else if (data.category === 'zone') {
          const [locId, zoneName] = data.refId.split('|');
          const loc = newContext.locations.find(l => l.id === locId);
          const zone = loc?.zones?.find(z => z.name === zoneName);
          if (zone && zone.layoutNotes !== data.text) {
            zone.layoutNotes = data.text;
            changed = true;
          }
        }
      });

      if (!changed) return prev;
      return { ...prev, context: newContext };
    });
  }, [nodes, setProjectData]);

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
          onDragOver={onDragOver}
          onDrop={onDrop}
          proOptions={{ hideAttribution: true }}
          data-active-mode={isUnderstandingActive ? "understanding" : "functional"}
        >
          <Background />
          {showMiniMap && (
            <div className="nodelab-minimap-drawer" data-open={showMiniMap}>
              <MiniMap
                className="nodelab-minimap"
                style={{
                  height: 130,
                  width: 180,
                  background: "#0f0f0f",
                  borderRadius: 14,
                  border: "1px solid #1f2937",
                  boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
                }}
                maskColor="rgba(255,255,255,0.04)"
                nodeStrokeColor="#38bdf8"
                nodeColor="#0ea5e9"
              />
            </div>
          )}
          <Controls className="nodelab-controls" position="bottom-left">
            <ControlButton
              onClick={() => setShowMiniMap((v) => !v)}
              title="切换小地图"
              className="!rounded-lg"
            >
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
        onAddText={() => addNode("text", { x: 100, y: 100 })}
        onAddImage={() => addNode("imageInput", { x: 200, y: 100 })}
        onAddLLM={() => addNode("llmGenerate", { x: 300, y: 100 })}
        onAddImageGen={() => addNode("imageGen", { x: 400, y: 100 })}
        onAddVideoGen={() => addNode("videoGen", { x: 500, y: 100 })}
        onAddOutput={() => addNode("output", { x: 600, y: 100 })}
        onAddGroup={() => addNode("group", { x: 100, y: 100 })}
        onAddNote={() => addNode("note", { x: 100, y: 100 })}
        onImportUnderstanding={handleImportUnderstanding}
        onImportEpisode={() => setShowEpisodeSelector(true)}
        isUnderstandingActive={isUnderstandingActive}
        onToggleUnderstanding={handleToggleUnderstanding}
        onImport={() => fileInputRef.current?.click()}
        onExport={() => saveWorkflow()}
        onRun={runAll}
      />

      {/* Episode Selector Modal */}
      {showEpisodeSelector && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 backdrop-blur-md bg-black/40 animate-in fade-in duration-300">
          <div
            className="w-full max-w-lg rounded-[32px] border border-white/10 bg-[#121212]/95 shadow-[0_40px_100px_rgba(0,0,0,0.6)] overflow-hidden"
          >
            <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-white">Import Episode</h3>
                <p className="text-sm text-white/40 mt-1">Select an episode to generate storyboard nodes</p>
              </div>
              <button
                onClick={() => setShowEpisodeSelector(false)}
                className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors"
              >
                <X size={20} className="text-white/40" />
              </button>
            </div>

            <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
              <div className="space-y-2">
                {projectData.episodes.map((ep) => (
                  <button
                    key={ep.id}
                    onClick={() => handleImportEpisode(ep.id)}
                    className="w-full flex items-center justify-between px-6 py-4 rounded-2xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group"
                  >
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">EPISODE {ep.id}</span>
                        <div className={`h-1.5 w-1.5 rounded-full ${ep.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      </div>
                      <div className="text-base font-bold text-white/90 mt-0.5 group-hover:text-blue-400 transition-colors uppercase tracking-tight">
                        {ep.title}
                      </div>
                      <div className="text-xs text-white/30 font-medium mt-1">
                        {ep.shots.length} Storyboard Shots · {ep.status.replace('_', ' ')}
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-white/20 group-hover:text-white/60 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}

                {projectData.episodes.length === 0 && (
                  <div className="py-12 text-center">
                    <div className="text-white/20 text-sm font-medium">No episodes found in script</div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-white/[0.02] border-t border-white/5">
              <p className="text-[11px] text-center text-white/30 leading-relaxed font-medium">
                This will create a dedicated Group node for the episode and populate it with connected Shot and Prompt nodes.
              </p>
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
