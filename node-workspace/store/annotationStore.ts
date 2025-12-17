import { create } from "zustand";
import { AnnotationShape } from "../types";

export type ToolType = "rectangle" | "circle" | "arrow" | "freehand" | "text";

export interface ToolOptions {
  strokeColor: string;
  strokeWidth: number;
  fillColor: string | null;
  fontSize: number;
  opacity: number;
}

interface AnnotationStore {
  isModalOpen: boolean;
  sourceNodeId: string | null;
  sourceImage: string | null;
  annotations: AnnotationShape[];
  selectedShapeId: string | null;
  history: AnnotationShape[][];
  historyIndex: number;
  currentTool: ToolType;
  toolOptions: ToolOptions;
  openModal: (nodeId: string, image: string, existing?: AnnotationShape[]) => void;
  closeModal: () => void;
  addAnnotation: (shape: AnnotationShape) => void;
  updateAnnotation: (id: string, updates: Partial<AnnotationShape>) => void;
  deleteAnnotation: (id: string) => void;
  clearAnnotations: () => void;
  selectShape: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  setCurrentTool: (tool: ToolType) => void;
  setToolOptions: (options: Partial<ToolOptions>) => void;
}

const defaultToolOptions: ToolOptions = {
  strokeColor: "#ef4444",
  strokeWidth: 3,
  fillColor: null,
  fontSize: 24,
  opacity: 1,
};

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  isModalOpen: false,
  sourceNodeId: null,
  sourceImage: null,
  annotations: [],
  selectedShapeId: null,
  history: [[]],
  historyIndex: 0,
  currentTool: "rectangle",
  toolOptions: defaultToolOptions,

  openModal: (nodeId, image, existing = []) => {
    set({
      isModalOpen: true,
      sourceNodeId: nodeId,
      sourceImage: image,
      annotations: existing,
      selectedShapeId: null,
      history: [existing],
      historyIndex: 0,
    });
  },

  closeModal: () => {
    set({
      isModalOpen: false,
      sourceNodeId: null,
      sourceImage: null,
      annotations: [],
      selectedShapeId: null,
      history: [[]],
      historyIndex: 0,
    });
  },

  addAnnotation: (shape) => {
    const { pushHistory } = get();
    pushHistory();
    set((state) => ({
      annotations: [...state.annotations, shape],
    }));
  },

  updateAnnotation: (id, updates) => {
    set((state) => ({
      annotations: state.annotations.map((shape) => (shape.id === id ? { ...shape, ...updates } as AnnotationShape : shape)),
    }));
  },

  deleteAnnotation: (id) => {
    const { pushHistory } = get();
    pushHistory();
    set((state) => ({
      annotations: state.annotations.filter((shape) => shape.id !== id),
      selectedShapeId: state.selectedShapeId === id ? null : state.selectedShapeId,
    }));
  },

  clearAnnotations: () => {
    const { pushHistory } = get();
    pushHistory();
    set({ annotations: [], selectedShapeId: null });
  },

  selectShape: (id) => set({ selectedShapeId: id }),

  pushHistory: () => {
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push([...state.annotations]);
      return { history: newHistory, historyIndex: newHistory.length - 1 };
    });
  },

  undo: () => {
    set((state) => {
      if (state.historyIndex > 0) {
        const newIndex = state.historyIndex - 1;
        return {
          historyIndex: newIndex,
          annotations: [...state.history[newIndex]],
          selectedShapeId: null,
        };
      }
      return state;
    });
  },

  redo: () => {
    set((state) => {
      if (state.historyIndex < state.history.length - 1) {
        const newIndex = state.historyIndex + 1;
        return {
          historyIndex: newIndex,
          annotations: [...state.history[newIndex]],
          selectedShapeId: null,
        };
      }
      return state;
    });
  },

  setCurrentTool: (tool) => set({ currentTool: tool }),
  setToolOptions: (options) =>
    set((state) => ({
      toolOptions: { ...state.toolOptions, ...options },
    })),
}));
