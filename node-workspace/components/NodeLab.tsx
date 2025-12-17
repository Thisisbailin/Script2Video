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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useWorkflowStore } from "../store/workflowStore";
import { getNodeHandles, isValidConnection } from "../utils/handles";
import { WorkflowFile, WorkflowNodeData, NodeType } from "../types";
import { EditableEdge } from "../edges/EditableEdge";
import { ImageInputNode, AnnotationNode, PromptNode, ImageGenNode, VideoGenNode, LLMGenerateNode, OutputNode } from "../nodes";
import { useLabExecutor } from "../store/useLabExecutor";

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
    validateWorkflow,
  } = useWorkflowStore();
  const { runLLM, runImageGen, runVideoGen } = useLabExecutor();

  const { screenToFlowPosition } = useReactFlow();
  const [isDragOver, setIsDragOver] = useState(false);
  const [connectionDrop, setConnectionDrop] = useState<ConnectionDropState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const warnValidation = () => {
    const { valid, errors } = validateWorkflow();
    if (!valid) {
      alert(errors.join("\n"));
    } else {
      alert("Workflow looks valid (basic checks)");
    }
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
    <div className="h-full w-full flex flex-col bg-gray-50 dark:bg-gray-950">
      <div className="flex items-center gap-3 p-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <button
          onClick={() => addNode("prompt", { x: 100, y: 100 })}
          className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm"
        >
          + Prompt
        </button>
        <button
          onClick={() => addNode("imageInput", { x: 200, y: 100 })}
          className="px-3 py-1.5 rounded bg-green-600 text-white text-sm"
        >
          + Image Input
        </button>
        <button
          onClick={() => addNode("imageGen", { x: 300, y: 100 })}
          className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm"
        >
          + Image Gen
        </button>
        <button
          onClick={() => addNode("videoGen", { x: 400, y: 100 })}
          className="px-3 py-1.5 rounded bg-purple-600 text-white text-sm"
        >
          + Video Gen
        </button>
        <button
          onClick={() => addNode("llmGenerate", { x: 500, y: 100 })}
          className="px-3 py-1.5 rounded bg-amber-600 text-white text-sm"
        >
          + LLM
        </button>
        <button
          onClick={() => addNode("output", { x: 600, y: 100 })}
          className="px-3 py-1.5 rounded bg-gray-700 text-white text-sm"
        >
          + Output
        </button>

        <div className="flex-1" />
        <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 rounded bg-gray-200 text-sm">
          Import
        </button>
        <button onClick={() => saveWorkflow()} className="px-3 py-1.5 rounded bg-gray-200 text-sm">
          Export
        </button>
        <button onClick={warnValidation} className="px-3 py-1.5 rounded bg-gray-200 text-sm">
          Validate
        </button>
        <button onClick={runAll} className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm">
          Run
        </button>
      </div>

      <div className="flex-1 relative">
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
        >
          <Background />
          <MiniMap />
          <Controls />
        </ReactFlow>

        {connectionDrop && (
          <div
            className="absolute z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg"
            style={{ left: connectionDrop.position.x, top: connectionDrop.position.y }}
          >
            <div className="p-2 text-xs text-gray-500">Create node to complete connection</div>
            <div className="grid grid-cols-2 gap-1 p-2">
              <button className="px-2 py-1 text-xs bg-gray-100 rounded" onClick={() => handleDropCreate("prompt")}>
                Prompt
              </button>
              <button className="px-2 py-1 text-xs bg-gray-100 rounded" onClick={() => handleDropCreate("imageInput")}>
                Image Input
              </button>
              <button className="px-2 py-1 text-xs bg-gray-100 rounded" onClick={() => handleDropCreate("imageGen")}>
                Image Gen
              </button>
              <button className="px-2 py-1 text-xs bg-gray-100 rounded" onClick={() => handleDropCreate("videoGen")}>
                Video Gen
              </button>
              <button className="px-2 py-1 text-xs bg-gray-100 rounded" onClick={() => handleDropCreate("llmGenerate")}>
                LLM
              </button>
              <button className="px-2 py-1 text-xs bg-gray-100 rounded" onClick={() => handleDropCreate("output")}>
                Output
              </button>
            </div>
          </div>
        )}
      </div>

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
