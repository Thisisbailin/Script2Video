import React, { useCallback, useRef, useState } from "react";
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
import { WorkflowFile, WorkflowNodeData, NodeType, WorkflowNode, WorkflowEdge, TextNodeData } from "../types";
import { EditableEdge } from "../edges/EditableEdge";
import { ImageInputNode, AnnotationNode, TextNode, ImageGenNode, VideoGenNode, LLMGenerateNode, OutputNode } from "../nodes";
import { useLabExecutor } from "../store/useLabExecutor";
import { MultiSelectToolbar } from "./MultiSelectToolbar";
import { FloatingActionBar } from "./FloatingActionBar";
import { ConnectionDropMenu } from "./ConnectionDropMenu";
import { GlobalImageHistory } from "./GlobalImageHistory";
import { Toast } from "./Toast";
import { AnnotationModal } from "./AnnotationModal";
import { MapPinned, MapPinOff } from "lucide-react";
import { ProjectData } from "../../types";

const nodeTypes: NodeTypes = {
  imageInput: ImageInputNode,
  annotation: AnnotationNode,
  text: TextNode,
  imageGen: ImageGenNode,
  videoGen: VideoGenNode,
  llmGenerate: LLMGenerateNode,
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
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    addNodesAndEdges,
    updateNodeData,
    loadWorkflow,
    saveWorkflow,
  } = useWorkflowStore();
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
      style: { width: 320, height: 220 }
    });
    yOffset += 300;

    // 2. Characters
    let charX = 50;
    context.characters.forEach((char, charIdx) => {
      const charId = `text-char-${char.id}-${Date.now()}`;
      newNodes.push({
        id: charId,
        type: 'text',
        position: { x: charX, y: yOffset },
        data: {
          title: `Character: ${char.name}`,
          text: char.bio,
          category: 'character',
          refId: char.id
        } as TextNodeData,
        style: { width: 320, height: 220 }
      });

      // Character Forms
      char.forms.forEach((form, formIdx) => {
        const formId = `text-form-${char.id}-${formIdx}-${Date.now()}`;
        newNodes.push({
          id: formId,
          type: 'text',
          position: { x: charX, y: yOffset + 300 + (formIdx * 250) },
          data: {
            title: `Form: ${form.formName}`,
            text: form.description,
            category: 'form',
            refId: `${char.id}|${form.formName}`
          } as TextNodeData,
          style: { width: 320, height: 220 }
        });

        newEdges.push({
          id: `edge-${charId}-${formId}`,
          source: charId,
          target: formId,
          sourceHandle: 'text',
          targetHandle: 'text'
        });
      });

      charX += 350;
    });

    // 3. Locations
    let locX = charX + 100; // Offset from last character
    const locYStart = 400;
    context.locations.forEach((loc, locIdx) => {
      const locId = `text-loc-${loc.id}-${Date.now()}`;
      newNodes.push({
        id: locId,
        type: 'text',
        position: { x: locX, y: locYStart },
        data: {
          title: `Location: ${loc.name}`,
          text: loc.description,
          category: 'location',
          refId: loc.id
        } as TextNodeData,
        style: { width: 320, height: 220 }
      });

      // Location Zones
      (loc.zones || []).forEach((zone, zoneIdx) => {
        const zoneId = `text-zone-${loc.id}-${zoneIdx}-${Date.now()}`;
        newNodes.push({
          id: zoneId,
          type: 'text',
          position: { x: locX, y: locYStart + 300 + (zoneIdx * 250) },
          data: {
            title: `Zone: ${zone.name}`,
            text: zone.layoutNotes,
            category: 'zone',
            refId: `${loc.id}|${zone.name}`
          } as TextNodeData,
          style: { width: 320, height: 220 }
        });

        newEdges.push({
          id: `edge-${locId}-${zoneId}`,
          source: locId,
          target: zoneId,
          sourceHandle: 'text',
          targetHandle: 'text'
        });
      });

      locX += 350;
    });

    addNodesAndEdges(newNodes, newEdges);
  }, [projectData, addNodesAndEdges]);

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
          nodes={nodes}
          edges={edges}
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
        onAddUnderstanding={handleImportUnderstanding}
        onImport={() => fileInputRef.current?.click()}
        onExport={() => saveWorkflow()}
        onRun={runAll}
      />
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
