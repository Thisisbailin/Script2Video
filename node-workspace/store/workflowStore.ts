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
  GlobalAssetHistoryItem,
  GlobalAssetType,
  LabContextSnapshot,
  WorkflowViewport,
  WorkflowTemplate,
} from "../types";

export type { GlobalAssetHistoryItem, GlobalAssetType };

export type EdgeStyle = "angular" | "curved";

interface ClipboardData {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

const TEMPLATE_STORAGE_KEY = "script2video_group_templates_v1";

const loadTemplates = (): WorkflowTemplate[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item === "object");
  } catch {
    return [];
  }
};

const persistTemplates = (templates: WorkflowTemplate[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // Ignore persistence failures.
  }
};

const getNodeDimensions = (node: WorkflowNode) => {
  const styleWidth = typeof node.style?.width === "number" ? node.style.width : undefined;
  const styleHeight = typeof node.style?.height === "number" ? node.style.height : undefined;
  const measuredWidth = typeof node.measured?.width === "number" ? node.measured.width : undefined;
  const measuredHeight = typeof node.measured?.height === "number" ? node.measured.height : undefined;
  return {
    width: measuredWidth ?? styleWidth ?? 280,
    height: measuredHeight ?? styleHeight ?? 200,
  };
};

const getAbsolutePosition = (node: WorkflowNode, nodeMap: Map<string, WorkflowNode>) => {
  let x = node.position.x;
  let y = node.position.y;
  let parentId = node.parentId;
  while (parentId) {
    const parent = nodeMap.get(parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId;
  }
  return { x, y };
};

const normalizeGroupBindings = (nodes: WorkflowNode[], edges: WorkflowEdge[]) => {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, Set<string>>();
  edges.forEach((edge) => {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
    adjacency.get(edge.source)!.add(edge.target);
    adjacency.get(edge.target)!.add(edge.source);
  });

  const groupOrder = new Map<string, number>();
  nodes.forEach((node, index) => {
    if (node.type === "group") groupOrder.set(node.id, index);
  });
  const groupIdSet = new Set(Array.from(groupOrder.keys()));

  let changed = false;
  let nextNodes = nodes.slice();

  const updateNode = (nodeId: string, updates: Partial<WorkflowNode>) => {
    const index = nextNodes.findIndex((node) => node.id === nodeId);
    if (index === -1) return;
    const updated = { ...nextNodes[index], ...updates };
    nextNodes[index] = updated;
    nodeMap.set(nodeId, updated);
    changed = true;
  };

  const pickPrimaryGroup = (groupIds: Set<string>) => {
    const selectedGroups = Array.from(groupIds).filter((id) => nodeMap.get(id)?.selected);
    if (selectedGroups.length > 0) {
      return selectedGroups.reduce((winner, id) => {
        const winnerOrder = groupOrder.get(winner) ?? -1;
        const currentOrder = groupOrder.get(id) ?? -1;
        return currentOrder > winnerOrder ? id : winner;
      }, selectedGroups[0]);
    }

    let winner: string | null = null;
    let bestOrder = -1;
    groupIds.forEach((id) => {
      const order = groupOrder.get(id) ?? -1;
      if (order > bestOrder) {
        bestOrder = order;
        winner = id;
      }
    });
    return winner;
  };

  const visited = new Set<string>();
  const mergedGroupIds = new Set<string>();
  const nonGroupNodes = nodes.filter((node) => node.type !== "group");

  nonGroupNodes.forEach((node) => {
    if (visited.has(node.id)) return;
    const queue = [node.id];
    visited.add(node.id);
    const componentIds: string[] = [];
    const componentGroupIds = new Set<string>();

    while (queue.length) {
      const currentId = queue.shift()!;
      componentIds.push(currentId);
      const currentNode = nodeMap.get(currentId);
      if (currentNode?.parentId && groupIdSet.has(currentNode.parentId)) {
        componentGroupIds.add(currentNode.parentId);
      }
      const neighbors = adjacency.get(currentId);
      if (!neighbors) continue;
      neighbors.forEach((neighborId) => {
        if (visited.has(neighborId)) return;
        const neighbor = nodeMap.get(neighborId);
        if (!neighbor || neighbor.type === "group") return;
        visited.add(neighborId);
        queue.push(neighborId);
      });
    }

    if (componentGroupIds.size === 0) return;
    const primaryGroupId = pickPrimaryGroup(componentGroupIds);
    if (!primaryGroupId) return;
    const primaryGroup = nodeMap.get(primaryGroupId);
    if (!primaryGroup) return;

    const needsMerge = componentIds.some((id) => {
      const target = nodeMap.get(id);
      return !target || target.parentId !== primaryGroupId;
    });

    if (needsMerge) {
      const primaryChildren = nextNodes
        .filter((child) => child.parentId === primaryGroupId && child.type !== "group")
        .map((child) => child.id);
      const affectedIds = new Set([...primaryChildren, ...componentIds]);
      const absPositions = new Map<string, XYPosition>();

      affectedIds.forEach((id) => {
        const target = nodeMap.get(id);
        if (!target) return;
        absPositions.set(id, getAbsolutePosition(target, nodeMap));
      });

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      componentIds.forEach((id) => {
        const target = nodeMap.get(id);
        if (!target) return;
        const abs = absPositions.get(id) ?? getAbsolutePosition(target, nodeMap);
        const size = getNodeDimensions(target);
        minX = Math.min(minX, abs.x);
        minY = Math.min(minY, abs.y);
        maxX = Math.max(maxX, abs.x + size.width);
        maxY = Math.max(maxY, abs.y + size.height);
      });

      const paddingX = 80;
      const paddingY = 100;
      const componentBounds = {
        x: minX - paddingX,
        y: minY - paddingY,
        width: maxX - minX + paddingX * 2,
        height: maxY - minY + paddingY * 2,
      };
      const groupAbs = getAbsolutePosition(primaryGroup, nodeMap);
      const groupSize = getNodeDimensions(primaryGroup);
      const groupBounds = {
        x: groupAbs.x,
        y: groupAbs.y,
        width: groupSize.width,
        height: groupSize.height,
      };
      const nextX = Math.min(groupBounds.x, componentBounds.x);
      const nextY = Math.min(groupBounds.y, componentBounds.y);
      const nextMaxX = Math.max(groupBounds.x + groupBounds.width, componentBounds.x + componentBounds.width);
      const nextMaxY = Math.max(groupBounds.y + groupBounds.height, componentBounds.y + componentBounds.height);
      const nextBounds = {
        x: nextX,
        y: nextY,
        width: nextMaxX - nextX,
        height: nextMaxY - nextY,
      };
      const nextGroupPosition = { x: nextBounds.x, y: nextBounds.y };

      if (
        nextBounds.x !== groupBounds.x ||
        nextBounds.y !== groupBounds.y ||
        nextBounds.width !== groupBounds.width ||
        nextBounds.height !== groupBounds.height
      ) {
        updateNode(primaryGroupId, {
          position: nextGroupPosition,
          style: { ...(primaryGroup.style || {}), width: nextBounds.width, height: nextBounds.height },
        });
      }

      componentIds.forEach((id) => {
        const target = nodeMap.get(id);
        if (!target || target.parentId === primaryGroupId) return;
        updateNode(id, { parentId: primaryGroupId });
      });

      affectedIds.forEach((id) => {
        const abs = absPositions.get(id);
        if (!abs) return;
        updateNode(id, { position: { x: abs.x - nextGroupPosition.x, y: abs.y - nextGroupPosition.y } });
      });

      componentGroupIds.forEach((groupId) => {
        if (groupId !== primaryGroupId) mergedGroupIds.add(groupId);
      });
    }
  });

  const groupNodes = nextNodes.filter((node) => node.type === "group");
  groupNodes.forEach((groupNode) => {
    const groupId = groupNode.id;
    const groupChildren = nextNodes.filter((node) => node.parentId === groupId && node.type !== "group");
    const childSet = new Set(groupChildren.map((node) => node.id));
    if (childSet.size === 0) return;

    const groupAbs = getAbsolutePosition(groupNode, nodeMap);
    const groupSize = getNodeDimensions(groupNode);
    const groupBounds = {
      x: groupAbs.x,
      y: groupAbs.y,
      width: groupSize.width,
      height: groupSize.height,
    };
    const margin = 40;

    childSet.forEach((nodeId) => {
      const node = nodeMap.get(nodeId);
      if (!node || node.parentId !== groupId) return;
      const neighbors = adjacency.get(nodeId);
      const hasGroupLink = neighbors ? Array.from(neighbors).some((id) => childSet.has(id)) : false;
      const desiredExtent = hasGroupLink ? "parent" : undefined;
      if (node.extent !== desiredExtent) {
        updateNode(nodeId, { extent: desiredExtent });
      }

      if (hasGroupLink) return;
      const abs = getAbsolutePosition(node, nodeMap);
      const size = getNodeDimensions(node);
      const outside =
        abs.x + size.width < groupBounds.x - margin ||
        abs.x > groupBounds.x + groupBounds.width + margin ||
        abs.y + size.height < groupBounds.y - margin ||
        abs.y > groupBounds.y + groupBounds.height + margin;
      if (outside) {
        updateNode(nodeId, {
          parentId: undefined,
          extent: undefined,
          position: abs,
        });
      }
    });
  });

  if (mergedGroupIds.size > 0) {
    const childCount = new Map<string, number>();
    nextNodes.forEach((node) => {
      if (node.parentId) {
        childCount.set(node.parentId, (childCount.get(node.parentId) ?? 0) + 1);
      }
    });
    const removableIds = new Set<string>();
    mergedGroupIds.forEach((id) => {
      if ((childCount.get(id) ?? 0) === 0) removableIds.add(id);
    });
    if (removableIds.size > 0) {
      nextNodes = nextNodes.filter((node) => !(node.type === "group" && removableIds.has(node.id)));
      changed = true;
    }
  }

  const orderedNodes = nextNodes.slice().sort((a, b) => {
    const aGroup = a.type === "group";
    const bGroup = b.type === "group";
    if (aGroup !== bGroup) return aGroup ? -1 : 1;
    return 0;
  });

  const orderChanged =
    orderedNodes.length !== nodes.length ||
    orderedNodes.some((node, index) => nodes[index]?.id !== node.id);

  if (changed || orderChanged) {
    return orderedNodes;
  }

  return nodes;
};

interface WorkflowStore {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  edgeStyle: EdgeStyle;
  clipboard: ClipboardData | null;
  globalAssetHistory: GlobalAssetHistoryItem[];
  viewport: WorkflowViewport | null;
  groupTemplates: WorkflowTemplate[];
  globalStyleGuide?: string;
  availableImageModels: string[];
  availableVideoModels: string[];
  setAvailableImageModels: (models: string[]) => void;
  setAvailableVideoModels: (models: string[]) => void;
  labContext: LabContextSnapshot;
  setLabContext: (ctx: LabContextSnapshot) => void;
  setViewportState: (viewport: WorkflowViewport | null) => void;

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
  saveGroupTemplate: (groupId: string, name?: string) => { ok: boolean; error?: string };
  deleteGroupTemplate: (templateId: string) => void;
  applyGroupTemplate: (templateId: string, offset: XYPosition) => { ok: boolean; error?: string };
  createGroupFromSelection: () => { ok: boolean; error?: string };
  applyViduReferenceDemo: (offset?: XYPosition) => { ok: boolean; error?: string };

  // Helpers
  getNodeById: (id: string) => WorkflowNode | undefined;
  getConnectedInputs: (nodeId: string) => { images: string[]; text: string | null; atMentions?: TextNodeData['atMentions']; imageRefs?: { src: string; formTag?: string | null }[] };
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
        contextSelection: {
          script: false,
          globalStyleGuide: false,
          shotGuide: false,
          soraGuide: false,
          dramaGuide: false,
          projectSummary: false,
          episodeSummaries: false,
          characters: false,
          locations: false,
        },
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
    case "viduVideoGen":
      return {
        inputImages: [],
        inputPrompt: null,
        videoId: undefined,
        videoUrl: undefined,
        status: "idle",
        error: null,
        mode: "audioVideo",
        useCharacters: true,
        aspectRatio: "16:9",
        resolution: "1080p",
        duration: 10,
        movementAmplitude: "auto",
        offPeak: true,
      } as any;
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
  viewport: null,
  groupTemplates: loadTemplates(),
  activeView: null,
  globalStyleGuide: undefined,
  availableImageModels: [],
  availableVideoModels: [],
  labContext: {
    rawScript: "",
    globalStyleGuide: "",
    shotGuide: "",
    soraGuide: "",
    dramaGuide: "",
    context: {
      projectSummary: "",
      episodeSummaries: [],
      characters: [],
      locations: [],
    },
  },

  setAvailableImageModels: (models) => set({ availableImageModels: models }),
  setAvailableVideoModels: (models) => set({ availableVideoModels: models }),
  setLabContext: (ctx) => set({ labContext: ctx }),
  setViewportState: (viewport) => set({ viewport }),

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

    const defaultDimensions: Partial<Record<NodeType, { width: number; height?: number }>> = {
      group: { width: 1100, height: 900 },
    };

    const dim = defaultDimensions[type];
    const newNode: WorkflowNode = {
      id,
      type,
      position,
      parentId: effectiveParentId,
      extent: effectiveParentId ? 'parent' : undefined,
      data: { ...createDefaultNodeData(type), ...effectiveExtraData } as WorkflowNodeData,
      style: dim ? { width: dim.width, height: dim.height } : undefined,
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

  onNodesChange: (changes) =>
    set((state) => {
      const nextNodes = applyNodeChanges(changes, state.nodes);
      return { nodes: normalizeGroupBindings(nextNodes, state.edges) };
    }),

  onEdgesChange: (changes) =>
    set((state) => {
      const nextEdges = applyEdgeChanges(changes, state.edges);
      return {
        edges: nextEdges,
        nodes: normalizeGroupBindings(state.nodes, nextEdges),
      };
    }),

  onConnect: (connection) => {
    set((state) => {
      const nextEdges = addEdge(
        {
          ...connection,
          id: `edge-${connection.source}-${connection.target}-${connection.sourceHandle || "default"}-${connection.targetHandle || "default"}`,
        },
        state.edges
      );
      return {
        edges: nextEdges,
        nodes: normalizeGroupBindings(state.nodes, nextEdges),
      };
    });
  },

  removeEdge: (edgeId) =>
    set((state) => {
      const nextEdges = state.edges.filter((edge) => edge.id !== edgeId);
      return {
        edges: nextEdges,
        nodes: normalizeGroupBindings(state.nodes, nextEdges),
      };
    }),

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
    const mentions: TextNodeData['atMentions'] = [];
    const imageRefs: { src: string; formTag?: string | null }[] = [];
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
            if (src) imageRefs.push({ src, formTag: (sourceNode.data as ImageInputNodeData).formTag });
          } else if (sourceNode.type === "annotation") {
            const src = (sourceNode.data as AnnotationNodeData).outputImage;
            if (src) images.push(src);
            if (src) imageRefs.push({ src });
          } else if (sourceNode.type === "imageGen") {
            const src = (sourceNode.data as ImageGenNodeData).outputImage;
            if (src) images.push(src);
            if (src) imageRefs.push({ src, formTag: (sourceNode.data as ImageGenNodeData).formTag });
          }
        }
        if (handleId === "text") {
          if (sourceNode.type === "text") {
            const value = (sourceNode.data as TextNodeData).text;
            if (value && value.trim()) texts.push(value.trim());
            const ats = (sourceNode.data as TextNodeData).atMentions;
            if (ats && ats.length) {
              ats.forEach((m) => {
                if (!mentions.find((x) => x?.name === m.name)) mentions.push(m);
              });
            }
          } else if (sourceNode.type === "llmGenerate") {
            const value = (sourceNode.data as LLMGenerateNodeData).outputText;
            if (value && value.trim()) texts.push(value.trim());
          }
        }
      });
    const text = texts.length ? texts.join("\n\n") : null;
    return { images, text, atMentions: mentions.length ? mentions : undefined, imageRefs: imageRefs.length ? imageRefs : undefined };
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
    const { nodes, edges, edgeStyle, globalAssetHistory, labContext, viewport, activeView } = get();
    const workflow: WorkflowFile = {
      version: 2,
      name: name || `workflow-${new Date().toISOString().slice(0, 10)}`,
      nodes,
      edges,
      edgeStyle,
      globalAssetHistory,
      labContext,
      viewport: viewport || undefined,
      activeView,
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
    const current = get();
    set({
      nodes: workflow.nodes,
      edges: workflow.edges,
      edgeStyle: workflow.edgeStyle || "angular",
      activeView: workflow.activeView ?? null,
      globalAssetHistory: workflow.globalAssetHistory ?? [],
      labContext: workflow.labContext ?? current.labContext,
      viewport: workflow.viewport ?? null,
      isRunning: false,
      currentNodeId: null,
      pausedAtNodeId: null,
    });
  },

  saveGroupTemplate: (groupId, name) => {
    const { nodes, edges, edgeStyle, groupTemplates } = get();
    const groupNode = nodes.find((node) => node.id === groupId && node.type === "group");
    if (!groupNode) {
      return { ok: false, error: "未找到可保存的 Group 节点。" };
    }
    const childNodes = nodes.filter((node) => node.parentId === groupId);
    const templateNodes = [groupNode, ...childNodes].map((node) => ({
      ...node,
      position: node.id === groupId ? { x: 0, y: 0 } : node.position,
      selected: false,
    }));
    const nodeIds = new Set(templateNodes.map((node) => node.id));
    const templateEdges = edges
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map((edge) => ({ ...edge }));
    const workflow: WorkflowFile = {
      version: 2,
      name: name || groupNode.data?.title || "Group Template",
      nodes: templateNodes,
      edges: templateEdges,
      edgeStyle,
    };
    const template: WorkflowTemplate = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: workflow.name,
      createdAt: Date.now(),
      workflow,
    };
    const nextTemplates = [...groupTemplates, template];
    persistTemplates(nextTemplates);
    set({ groupTemplates: nextTemplates });
    return { ok: true };
  },

  deleteGroupTemplate: (templateId) => {
    const { groupTemplates } = get();
    const nextTemplates = groupTemplates.filter((tpl) => tpl.id !== templateId);
    persistTemplates(nextTemplates);
    set({ groupTemplates: nextTemplates });
  },

  applyGroupTemplate: (templateId, offset) => {
    const { groupTemplates, nodes, edges, activeView } = get();
    const template = groupTemplates.find((tpl) => tpl.id === templateId);
    if (!template) return { ok: false, error: "模板不存在或已被删除。" };
    if (!template.workflow.nodes.length) return { ok: false, error: "模板内容为空。" };

    const idMapping = new Map<string, string>();
    template.workflow.nodes.forEach((node) => {
      const newId = `${node.type}-${++nodeIdCounter}`;
      idMapping.set(node.id, newId);
    });

    const newNodes: WorkflowNode[] = template.workflow.nodes.map((node) => {
      const parentId = node.parentId ? idMapping.get(node.parentId) : undefined;
      const position = parentId
        ? node.position
        : { x: node.position.x + offset.x, y: node.position.y + offset.y };
      const newData = { ...node.data };
      if (activeView) {
        (newData as any).view = activeView;
      }
      return {
        ...node,
        id: idMapping.get(node.id)!,
        position,
        parentId,
        extent: parentId ? "parent" : undefined,
        selected: true,
        data: newData as WorkflowNodeData,
      };
    });

    const newEdges: WorkflowEdge[] = template.workflow.edges.map((edge) => ({
      ...edge,
      id: `edge-${idMapping.get(edge.source)}-${idMapping.get(edge.target)}-${edge.sourceHandle || "default"}-${edge.targetHandle || "default"}`,
      source: idMapping.get(edge.source)!,
      target: idMapping.get(edge.target)!,
    }));

    const updatedNodes = nodes.map((node) => ({ ...node, selected: false }));
    set({ nodes: [...updatedNodes, ...newNodes], edges: [...edges, ...newEdges] });
    return { ok: true };
  },

  applyViduReferenceDemo: (offset = { x: 120, y: 120 }) => {
    const { nodes, edges, activeView } = get();
    const deselected = nodes.map((n) => ({ ...n, selected: false }));

    const groupId = `group-${++nodeIdCounter}`;
    const groupNode: WorkflowNode = {
      id: groupId,
      type: "group",
      position: offset,
      data: {
        title: "Vidu 参考生视频演示",
        description: "音视频直出默认启用，1080p，错峰开启，示例含 3 主体与场景参考。",
        view: activeView || undefined,
      } as GroupNodeData,
      style: { width: 1100, height: 900 },
    };

    const promptText = "@Chef 和 @Guest 在一起吃火锅，并且旁白音说火锅大家都爱吃。";
    const textNode: WorkflowNode = {
      id: `text-${++nodeIdCounter}`,
      type: "text",
      position: { x: 80, y: 120 },
      parentId: groupId,
      extent: "parent",
      data: {
        title: "参考提示词",
        text: promptText,
        atMentions: [
          { name: "Chef", status: "match" },
          { name: "Guest", status: "match" },
          { name: "Narrator", status: "missing" },
        ],
        view: activeView || undefined,
      } as any,
    };

    const imageUrls = [
      { url: "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/reference2video-1.png", formTag: "Chef" },
      { url: "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/reference2video-2.png", formTag: "Chef" },
      { url: "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/reference2video-3.png", formTag: "Chef" },
      { url: "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/startend2video-1.jpeg", formTag: "Guest" },
      { url: "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/startend2video-2.jpeg", formTag: "Guest" },
      { url: "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/scene-template/hug.jpeg", formTag: "Narrator" },
      { url: "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/image2video.png", formTag: "Chef" },
    ];

    const imageNodes: WorkflowNode[] = imageUrls.map((img, idx) => ({
      id: `image-${++nodeIdCounter}`,
      type: "imageInput",
      position: { x: 80 + (idx % 3) * 180, y: 260 + Math.floor(idx / 3) * 180 },
      parentId: groupId,
      extent: "parent",
      data: { image: img.url, filename: `ref-${idx + 1}.png`, dimensions: null, formTag: img.formTag, view: activeView || undefined } as any,
    }));

    const viduNode: WorkflowNode = {
      id: `vidu-${++nodeIdCounter}`,
      type: "viduVideoGen",
      position: { x: 620, y: 260 },
      parentId: groupId,
      extent: "parent",
      data: {
        title: "Vidu 参考生视频",
        mode: "audioVideo",
        aspectRatio: "16:9",
        resolution: "1080p",
        duration: 10,
        movementAmplitude: "auto",
        offPeak: true,
        model: "viduq2-pro",
        subjects: [],
        inputPrompt: promptText,
        status: "idle",
        error: null,
        inputImages: imageUrls.map((i) => i.url),
        view: activeView || undefined,
      } as any,
      style: { width: 360 },
    };

    const newEdges: WorkflowEdge[] = [
      {
        id: `edge-${textNode.id}-${viduNode.id}-text`,
        source: textNode.id,
        target: viduNode.id,
        targetHandle: "text",
      },
      ...imageNodes.map((img) => ({
        id: `edge-${img.id}-${viduNode.id}-image`,
        source: img.id,
        target: viduNode.id,
        targetHandle: "image",
      })),
    ];

    set({
      nodes: [...deselected, groupNode, textNode, ...imageNodes, viduNode],
      edges: [...edges, ...newEdges],
    });
    return { ok: true };
  },

  createGroupFromSelection: () => {
    const { nodes, edges } = get();
    const selectedNodes = nodes.filter((node) => node.selected && node.type !== "group");
    if (selectedNodes.length === 0) {
      return { ok: false, error: "未选中可分组的节点。" };
    }

    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const bounds = selectedNodes.reduce(
      (acc, node) => {
        const abs = getAbsolutePosition(node, nodeMap);
        const size = getNodeDimensions(node);
        return {
          minX: Math.min(acc.minX, abs.x),
          minY: Math.min(acc.minY, abs.y),
          maxX: Math.max(acc.maxX, abs.x + size.width),
          maxY: Math.max(acc.maxY, abs.y + size.height),
        };
      },
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    );

    const paddingX = 80;
    const paddingY = 100;
    const groupPosition = { x: bounds.minX - paddingX, y: bounds.minY - paddingY };
    const groupSize = {
      width: bounds.maxX - bounds.minX + paddingX * 2,
      height: bounds.maxY - bounds.minY + paddingY * 2,
    };

    const groupId = `group-${++nodeIdCounter}`;
    const groupNode: WorkflowNode = {
      id: groupId,
      type: "group",
      position: groupPosition,
      data: { title: "New Group" } as GroupNodeData,
      style: { width: groupSize.width, height: groupSize.height },
      selected: true,
    };

    const selectedIds = new Set(selectedNodes.map((node) => node.id));
    const nextNodes = nodes.map((node) => {
      if (!selectedIds.has(node.id)) {
        return { ...node, selected: false };
      }
      const abs = getAbsolutePosition(node, nodeMap);
      return {
        ...node,
        parentId: groupId,
        extent: "parent",
        position: { x: abs.x - groupPosition.x, y: abs.y - groupPosition.y },
        selected: true,
      };
    });

    const mergedNodes = normalizeGroupBindings([...nextNodes, groupNode], edges);
    set({ nodes: mergedNodes });
    return { ok: true };
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
