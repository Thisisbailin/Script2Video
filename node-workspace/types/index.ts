import { Node, Edge } from "@xyflow/react";

export type HandleType = "image" | "text";

export type NodeType =
  | "imageInput"
  | "annotation"
  | "text"
  | "imageGen"
  | "videoGen"
  | "llmGenerate"
  | "output";

export type NodeStatus = "idle" | "loading" | "complete" | "error";

export interface BaseNodeData extends Record<string, unknown> {
  label?: string;
}

export interface ImageInputNodeData extends BaseNodeData {
  image: string | null;
  filename: string | null;
  dimensions: { width: number; height: number } | null;
}

export type ShapeType = "rectangle" | "circle" | "arrow" | "freehand" | "text";

export interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

export interface RectangleShape extends BaseShape {
  type: "rectangle";
  width: number;
  height: number;
  fill: string | null;
}

export interface CircleShape extends BaseShape {
  type: "circle";
  radiusX: number;
  radiusY: number;
  fill: string | null;
}

export interface ArrowShape extends BaseShape {
  type: "arrow";
  points: number[];
}

export interface FreehandShape extends BaseShape {
  type: "freehand";
  points: number[];
}

export interface TextShape extends BaseShape {
  type: "text";
  text: string;
  fontSize: number;
  fill: string;
}

export type AnnotationShape =
  | RectangleShape
  | CircleShape
  | ArrowShape
  | FreehandShape
  | TextShape;

export interface AnnotationNodeData extends BaseNodeData {
  sourceImage: string | null;
  annotations: AnnotationShape[];
  outputImage: string | null;
}

export interface TextNodeData extends BaseNodeData {
  title: string;
  text: string;
  category?: 'project' | 'episode' | 'character' | 'location' | 'form' | 'zone';
  refId?: string;
}

export interface ImageGenNodeData extends BaseNodeData {
  inputImages: string[];
  inputPrompt: string | null;
  outputImage: string | null;
  status: NodeStatus;
  error: string | null;
  model?: string;
}

export interface VideoGenNodeData extends BaseNodeData {
  inputImages: string[];
  inputPrompt: string | null;
  videoId?: string;
  videoUrl?: string;
  status: NodeStatus;
  error: string | null;
  aspectRatio?: string;
}

export interface LLMGenerateNodeData extends BaseNodeData {
  inputPrompt: string | null;
  outputText: string | null;
  model?: string;
  temperature: number;
  maxTokens: number;
  status: NodeStatus;
  error: string | null;
}

export interface OutputNodeData extends BaseNodeData {
  image: string | null;
  text?: string | null;
}

export type WorkflowNodeData =
  | ImageInputNodeData
  | AnnotationNodeData
  | TextNodeData
  | ImageGenNodeData
  | VideoGenNodeData
  | LLMGenerateNodeData
  | OutputNodeData;

export type WorkflowNode = Node<WorkflowNodeData, NodeType>;

export interface WorkflowEdgeData extends Record<string, unknown> {
  hasPause?: boolean;
}

export type WorkflowEdge = Edge<WorkflowEdgeData>;

export interface WorkflowFile {
  version: 1;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  edgeStyle?: "angular" | "curved";
}
