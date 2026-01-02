import { create } from "zustand";
import {
  Connection,
  EdgeChange,
  NodeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  XYPosition,
} from "@xyflow/react";
import {
  WorkflowNode,
  WorkflowEdge,
  NodeType,
  ImageInputNodeData,
  AnnotationNodeData,
  TextNodeData,
  ImageGenNodeData,
  LLMGenerateNodeData,
  OutputNodeData,
  WorkflowNodeData,
  WorkflowFile,
  VideoGenNodeData,
  GroupNodeData,
  NoteNodeData,
  ShotNodeData,
} from "../types";

export type EdgeStyle = "angular" | "curved";

interface ClipboardData {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export type GlobalAssetType = "image" | "video";

export type GlobalAssetHistoryItem = {
  id: string;
  type: GlobalAssetType;
  src: string;
  prompt: string;
  aspectRatio?: string;
  model?: string;
  timestamp: number;
  sourceId?: string;
};

interface WorkflowStore {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  edgeStyle: EdgeStyle;
  clipboard: ClipboardData | null;
  globalAssetHistory: GlobalAssetHistoryItem[];
  globalStyleGuide?: string;
  availableImageModels: string[];
  availableVideoModels: string[];
  setAvailableImageModels: (models: string[]) => void;
  setAvailableVideoModels: (models: string[]) => void;

  // Settings
  setEdgeStyle: (style: EdgeStyle) => void;
  setGlobalStyleGuide: (guide: string) => void;

  // Node operations
  addNode: (type: NodeType, position: XYPosition, parentId?: string, extraData?: Partial<WorkflowNodeData>) => string;
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  removeNode: (nodeId: string) => void;
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;

  // Edge operations
  onEdgesChange: (changes: EdgeChange<WorkflowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  removeEdge: (edgeId: string) => void;
  toggleEdgePause: (edgeId: string) => void;

  // Copy/Paste operations
  copySelectedNodes: () => void;
  pasteNodes: (offset?: XYPosition) => void;
  clearClipboard: () => void;

  // Execution (placeholder for future integration)
  isRunning: boolean;
  currentNodeId: string | null;
  pausedAtNodeId: string | null;
  setRunning: (running: boolean) => void;
  setCurrentNode: (nodeId: string | null) => void;
  setPausedNode: (nodeId: string | null) => void;

  // Save/Load
  saveWorkflow: (name?: string) => void;
  loadWorkflow: (workflow: WorkflowFile) => void;
  clearWorkflow: () => void;

  // Helpers
  getNodeById: (id: string) => WorkflowNode | undefined;
  getConnectedInputs: (nodeId: string) => { images: string[]; text: string | null };
  validateWorkflow: () => { valid: boolean; errors: string[] };
  addToGlobalHistory: (item: Omit<GlobalAssetHistoryItem, "id" | "timestamp">) => void;
  removeGlobalHistoryItem: (id: string) => void;
  clearGlobalHistory: (type?: GlobalAssetType) => void;

  // Batch operations
  addNodesAndEdges: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;

  // View management
  activeView: string | null;
  setActiveView: (view: string | null) => void;
}

const createDefaultNodeData = (type: NodeType): WorkflowNodeData => {
  switch (type) {
    case "imageInput":
      return {
        image: null,
        filename: null,
        dimensions: null,
      } as ImageInputNodeData;
    case "annotation":
      return {
        sourceImage: null,
        annotations: [],
        outputImage: null,
      } as AnnotationNodeData;
    case "text":
      return {
        title: "",
        text: "",
      } as TextNodeData;
    case "imageGen":
      return {
        inputImages: [],
        inputPrompt: null,
        outputImage: null,
        status: "idle",
        error: null,
        aspectRatio: "1:1",
      } as ImageGenNodeData;
    case "llmGenerate":
      return {
        inputPrompt: null,
        outputText: null,
        temperature: 0.7,
        maxTokens: 1024,
        status: "idle",
        error: null,
      } as LLMGenerateNodeData;
    case "videoGen":
      return {
        inputImages: [],
        inputPrompt: null,
        videoId: undefined,
        videoUrl: undefined,
        status: "idle",
        error: null,
        aspectRatio: "16:9",
      } as VideoGenNodeData;
    case "group":
      return {
        title: "Node Group",
        isExpanded: true,
      } as GroupNodeData;
    case "note":
      return {
        text: "",
      } as NoteNodeData;
    case "shot":
      return {
        shotId: "S-1",
        description: "",
        duration: "3s",
        shotType: "Medium Shot",
        movement: "Static",
      } as ShotNodeData;
    case "output":
      return {
        image: null,
        text: null,
      } as OutputNodeData;
  }
};

let nodeIdCounter = 0;

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  nodes: [],
  edges: [],
  edgeStyle: "curved" as EdgeStyle,
  clipboard: null,
  isRunning: false,
  currentNodeId: null,
  pausedAtNodeId: null,
  globalAssetHistory: [],
  activeView: null,
  globalStyleGuide: undefined,
  availableImageModels: [],
  availableVideoModels: [],

  setAvailableImageModels: (models) => set({ availableImageModels: models }),
  setAvailableVideoModels: (models) => set({ availableVideoModels: models }),

  setActiveView: (view) => set({ activeView: view }),

  setEdgeStyle: (style: EdgeStyle) => set({ edgeStyle: style }),
  setGlobalStyleGuide: (guide: string) => set({ globalStyleGuide: guide }),

  addNode: (type: NodeType, position: XYPosition, parentId?: string, extraData?: Partial<WorkflowNodeData>) => {
    const { activeView, nodes } = get();
    const id = `${type}-${++nodeIdCounter}`;

    // Automatically determine parent and view if not explicitly provided
    let effectiveParentId = parentId;
    let effectiveExtraData = { ...extraData };

    if (activeView) {
      effectiveExtraData.view = activeView;

      // If no parentId provided, try to find a suitable group node in this view
      if (!effectiveParentId) {
        const matchingGroup = nodes.find(n => n.type === 'group' && (n.data as any).view === activeView);
        if (matchingGroup) {
          effectiveParentId = matchingGroup.id;
        }
      }
    }

    const defaultDimensions: Record<NodeType, { width: number; height?: number }> = {
      imageInput: { width: 360, height: 300 },
      annotation: { width: 360, height: 320 },
      text: { width: 500 },
      note: { width: 380 },
      shot: { width: 520 },
      imageGen: { width: 420, height: 360 },
      videoGen: { width: 420, height: 360 },
      llmGenerate: { width: 520 },
      group: { width: 1100, height: 900 },
      output: { width: 460 },
    };

    const dim = defaultDimensions[type];
    const newNode: WorkflowNode = {
      id,
      type,
      position,
      parentId: effectiveParentId,
      extent: effectiveParentId ? 'parent' : undefined,
      data: { ...createDefaultNodeData(type), ...effectiveExtraData } as WorkflowNodeData,
      style: { width: dim.width, height: dim.height },
    };
    set((state) => ({ nodes: [...state.nodes, newNode] }));
    return id;
  },

  updateNodeData: (nodeId, data) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } as WorkflowNodeData }
          : node
      ),
    }));
  },

  removeNode: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    }));
  },

  onNodesChange: (changes) => set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) })),

  onEdgesChange: (changes) => set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),

  onConnect: (connection) => {
    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          id: `edge-${connection.source}-${connection.target}-${connection.sourceHandle || "default"}-${connection.targetHandle || "default"}`,
        },
        state.edges
      ),
    }));
  },

  removeEdge: (edgeId) => set((state) => ({ edges: state.edges.filter((edge) => edge.id !== edgeId) })),

  toggleEdgePause: (edgeId) => {
    set((state) => ({
      edges: state.edges.map((edge) =>
        edge.id === edgeId
          ? { ...edge, data: { ...edge.data, hasPause: !edge.data?.hasPause } }
          : edge
      ),
    }));
  },

  copySelectedNodes: () => {
    const { nodes, edges } = get();
    const selectedNodes = nodes.filter((node) => node.selected);
    if (selectedNodes.length === 0) return;
    const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));
    const connectedEdges = edges.filter(
      (edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
    );
    const clonedNodes = JSON.parse(JSON.stringify(selectedNodes)) as WorkflowNode[];
    const clonedEdges = JSON.parse(JSON.stringify(connectedEdges)) as WorkflowEdge[];
    set({ clipboard: { nodes: clonedNodes, edges: clonedEdges } });
  },

  pasteNodes: (offset: XYPosition = { x: 50, y: 50 }) => {
    const { clipboard, nodes, edges, activeView } = get();
    if (!clipboard || clipboard.nodes.length === 0) return;

    const idMapping = new Map<string, string>();
    clipboard.nodes.forEach((node) => {
      const newId = `${node.type}-${++nodeIdCounter}`;
      idMapping.set(node.id, newId);
    });

    const matchingGroup = activeView ? nodes.find(n => n.type === 'group' && (n.data as any).view === activeView) : null;

    const newNodes: WorkflowNode[] = clipboard.nodes.map((node) => {
      const newData = { ...node.data };
      if (activeView) {
        (newData as any).view = activeView;
      }

      return {
        ...node,
        id: idMapping.get(node.id)!,
        position: { x: node.position.x + offset.x, y: node.position.y + offset.y },
        selected: true,
        parentId: node.parentId || (matchingGroup?.id),
        extent: (node.parentId || matchingGroup?.id) ? 'parent' : undefined,
        data: newData as WorkflowNodeData,
      };
    });

    const newEdges: WorkflowEdge[] = clipboard.edges.map((edge) => ({
      ...edge,
      id: `edge-${idMapping.get(edge.source)}-${idMapping.get(edge.target)}-${edge.sourceHandle || "default"}-${edge.targetHandle || "default"}`,
      source: idMapping.get(edge.source)!,
      target: idMapping.get(edge.target)!,
    }));
    const updatedNodes = nodes.map((node) => ({ ...node, selected: false }));
    set({ nodes: [...updatedNodes, ...newNodes], edges: [...edges, ...newEdges] });
  },

  clearClipboard: () => set({ clipboard: null }),

  getNodeById: (id) => get().nodes.find((node) => node.id === id),

  getConnectedInputs: (nodeId) => {
    const { edges, nodes } = get();
    const images: string[] = [];
    const texts: string[] = [];
    edges
      .filter((edge) => edge.target === nodeId)
      .forEach((edge) => {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        if (!sourceNode) return;
        const handleId = edge.targetHandle;
        if (handleId === "image" || !handleId) {
          if (sourceNode.type === "imageInput") {
            const src = (sourceNode.data as ImageInputNodeData).image;
            if (src) images.push(src);
          } else if (sourceNode.type === "annotation") {
            const src = (sourceNode.data as AnnotationNodeData).outputImage;
            if (src) images.push(src);
          } else if (sourceNode.type === "imageGen") {
            const src = (sourceNode.data as ImageGenNodeData).outputImage;
            if (src) images.push(src);
          }
        }
        if (handleId === "text") {
          if (sourceNode.type === "text") {
            const value = (sourceNode.data as TextNodeData).text;
            if (value && value.trim()) texts.push(value.trim());
          } else if (sourceNode.type === "llmGenerate") {
            const value = (sourceNode.data as LLMGenerateNodeData).outputText;
            if (value && value.trim()) texts.push(value.trim());
          }
        }
      });
    const text = texts.length ? texts.join("\n\n") : null;
    return { images, text };
  },

  validateWorkflow: () => {
    const { nodes, edges } = get();
    const errors: string[] = [];
    if (nodes.length === 0) {
      errors.push("Workflow is empty");
      return { valid: false, errors };
    }
    nodes
      .filter((n) => n.type === "imageGen")
      .forEach((node) => {
        const imageConnected = edges.some((e) => e.target === node.id && e.targetHandle === "image");
        const textConnected = edges.some((e) => e.target === node.id && e.targetHandle === "text");
        if (!imageConnected) errors.push(`ImageGen node "${node.id}" missing image input`);
        if (!textConnected) errors.push(`ImageGen node "${node.id}" missing text input`);
      });
    nodes
      .filter((n) => n.type === "videoGen")
      .forEach((node) => {
        const imageConnected = edges.some((e) => e.target === node.id && e.targetHandle === "image");
        const textConnected = edges.some((e) => e.target === node.id && e.targetHandle === "text");
        if (!imageConnected) errors.push(`VideoGen node "${node.id}" missing image input`);
        if (!textConnected) errors.push(`VideoGen node "${node.id}" missing text input`);
      });
    nodes
      .filter((n) => n.type === "annotation")
      .forEach((node) => {
        const imageConnected = edges.some((e) => e.target === node.id);
        const hasManualImage = (node.data as AnnotationNodeData).sourceImage !== null;
        if (!imageConnected && !hasManualImage) {
          errors.push(`Annotation node "${node.id}" missing image input`);
        }
      });
    nodes
      .filter((n) => n.type === "output")
      .forEach((node) => {
        const imageConnected = edges.some((e) => e.target === node.id);
        if (!imageConnected) errors.push(`Output node "${node.id}" missing image input`);
      });
    return { valid: errors.length === 0, errors };
  },

  saveWorkflow: (name) => {
    const { nodes, edges, edgeStyle } = get();
    const workflow: WorkflowFile = {
      version: 1,
      name: name || `workflow-${new Date().toISOString().slice(0, 10)}`,
      nodes,
      edges,
      edgeStyle,
    };
    const json = JSON.stringify(workflow, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${workflow.name}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  loadWorkflow: (workflow) => {
    const maxId = workflow.nodes.reduce((max, node) => {
      const match = node.id.match(/-(\d+)$/);
      if (match) return Math.max(max, parseInt(match[1], 10));
      return max;
    }, 0);
    nodeIdCounter = maxId;
    set({
      nodes: workflow.nodes,
      edges: workflow.edges,
      edgeStyle: workflow.edgeStyle || "angular",
      isRunning: false,
      currentNodeId: null,
      pausedAtNodeId: null,
    });
  },

  clearWorkflow: () => set({ nodes: [], edges: [], isRunning: false, currentNodeId: null, pausedAtNodeId: null }),

  setRunning: (running) => set({ isRunning: running }),
  setCurrentNode: (nodeId) => set({ currentNodeId: nodeId }),
  setPausedNode: (nodeId) => set({ pausedAtNodeId: nodeId }),

  addToGlobalHistory: (item) => {
    const newItem = { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, timestamp: Date.now() };
    set((state) => {
      if (item.sourceId) {
        const existingIndex = state.globalAssetHistory.findIndex((entry) => entry.sourceId === item.sourceId && entry.type === item.type);
        if (existingIndex !== -1) {
          const updated = [...state.globalAssetHistory];
          updated[existingIndex] = { ...updated[existingIndex], ...newItem, id: updated[existingIndex].id };
          return { globalAssetHistory: updated };
        }
      }
      return { globalAssetHistory: [newItem, ...state.globalAssetHistory] };
    });
  },
  removeGlobalHistoryItem: (id) => set((state) => ({ globalAssetHistory: state.globalAssetHistory.filter((item) => item.id !== id) })),
  clearGlobalHistory: (type) =>
    set((state) => ({
      globalAssetHistory: type ? state.globalAssetHistory.filter((item) => item.type !== type) : [],
    })),

  addNodesAndEdges: (newNodes, newEdges) => {
    // Basic ID counter update logic
    const maxId = [...newNodes].reduce((max, node) => {
      const match = node.id.match(/-(\d+)$/);
      if (match) return Math.max(max, parseInt(match[1], 10));
      return max;
    }, nodeIdCounter);
    nodeIdCounter = maxId;

    set((state) => ({
      nodes: [...state.nodes, ...newNodes],
      edges: [...state.edges, ...newEdges],
    }));
  },
}));
