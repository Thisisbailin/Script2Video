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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "../styles/nodelab.css";
import { useWorkflowStore } from "../store/workflowStore";
import { getNodeHandles, isValidConnection } from "../utils/handles";
import { WorkflowFile, WorkflowNodeData, NodeType } from "../types";
import { EditableEdge } from "../edges/EditableEdge";
import { ImageInputNode, AnnotationNode, PromptNode, ImageGenNode, VideoGenNode, LLMGenerateNode, OutputNode } from "../nodes";
import { useLabExecutor } from "../store/useLabExecutor";
import { MultiSelectToolbar } from "./MultiSelectToolbar";
import { FloatingActionBar } from "./FloatingActionBar";
import { ConnectionDropMenu } from "./ConnectionDropMenu";
import { GlobalImageHistory } from "./GlobalImageHistory";
import { Toast } from "./Toast";
import { AnnotationModal } from "./AnnotationModal";
import { MapPinned, MapPinOff } from "lucide-react";

const nodeTypes: NodeTypes = {
  imageInput: ImageInputNode,
  annotation: AnnotationNode,
  prompt: PromptNode,
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

const NodeLabInner: React.FC = () => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
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
          connectionMode="loose"
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
        onAddPrompt={() => addNode("prompt", { x: 100, y: 100 })}
        onAddImage={() => addNode("imageInput", { x: 200, y: 100 })}
        onAddLLM={() => addNode("llmGenerate", { x: 300, y: 100 })}
        onAddImageGen={() => addNode("imageGen", { x: 400, y: 100 })}
        onAddVideoGen={() => addNode("videoGen", { x: 500, y: 100 })}
        onAddOutput={() => addNode("output", { x: 600, y: 100 })}
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

export const NodeLab: React.FC = () => {
  return (
    <ReactFlowProvider>
      <NodeLabInner />
    </ReactFlowProvider>
  );
};
