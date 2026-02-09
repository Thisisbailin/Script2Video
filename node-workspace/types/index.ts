import { Node, Edge } from "@xyflow/react";
import { ProjectContext, ViduReferenceMode } from "../../types";

export type HandleType = "image" | "text";

export type NodeType =
  | "imageInput"
  | "annotation"
  | "text"
  | "imageGen"
  | "wanImageGen"
  | "soraVideoGen"
  | "wanVideoGen"
  | "viduVideoGen"
  | "group"
  | "shot";

export type NodeStatus = "idle" | "loading" | "complete" | "error";

export interface BaseNodeData extends Record<string, unknown> {
  label?: string;
  title?: string;
}

export interface ImageInputNodeData extends BaseNodeData {
  image: string | null;
  filename: string | null;
  dimensions: { width: number; height: number } | null;
  formTag?: string;
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
  category?: 'project' | 'episode' | 'script' | 'guide' | 'character' | 'scene' | 'location' | 'form' | 'zone';
  tags?: string[];
  refId?: string;
  atMentions?: {
    name: string;
    status: 'match' | 'missing';
    characterId?: string;
    formName?: string;
    summary?: string;
    image?: string;
  }[];
}

export interface ImageGenNodeData extends BaseNodeData {
  inputImages: string[];
  inputPrompt: string | null;
  outputImage: string | null;
  status: 'idle' | 'loading' | 'complete' | 'error';
  error: string | null;
  model?: string;
  aspectRatio: string;
  quality?: string;
  negativePrompt?: string;
  enableInterleave?: boolean;
  outputCount?: number;
  maxImages?: number;
  seed?: number;
  promptExtend?: boolean;
  watermark?: boolean;
  size?: string;
  designCategory?: "form" | "zone";
  designRefId?: string;
  formTag?: string;
}

export interface VideoGenNodeData extends BaseNodeData {
  inputImages: string[];
  inputPrompt: string | null;
  videoId?: string;
  videoUrl?: string; // For polling result
  status: 'idle' | 'loading' | 'complete' | 'error';
  error: string | null;
  aspectRatio: string;
  duration?: string;
  model?: string;
  quality?: string;
  resolution?: string;
  size?: string;
  negativePrompt?: string;
  seed?: number;
  watermark?: boolean;
  promptExtend?: boolean;
  shotType?: "single" | "multi";
  audioEnabled?: boolean;
  audioUrl?: string;
}

export interface ViduVideoGenNodeData extends BaseNodeData {
  inputImages: string[];
  inputPrompt?: string | null;
  videoId?: string;
  videoUrl?: string;
  status: 'idle' | 'loading' | 'complete' | 'error';
  error: string | null;
  mode: ViduReferenceMode;
  useCharacters?: boolean;
  subjects?: { id?: string; images: string[]; voiceId?: string }[];
  voiceId?: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  movementAmplitude?: string;
  offPeak?: boolean;
  model?: string;
  seed?: number;
}

export interface LLMGenerateNodeData extends BaseNodeData {
  inputPrompt: string | null;
  outputText: string | null;
  model?: string;
  contextSelection?: {
    script?: boolean;
    globalStyleGuide?: boolean;
    shotGuide?: boolean;
    soraGuide?: boolean;
    storyboardGuide?: boolean;
    dramaGuide?: boolean;
    projectSummary?: boolean;
    episodeSummaries?: boolean;
    characters?: boolean;
    locations?: boolean;
  };
  temperature: number;
  maxTokens: number;
  status: NodeStatus;
  error: string | null;
}

export interface OutputNodeData extends BaseNodeData {
  image: string | null;
  text?: string | null;
}

export interface GroupNodeData extends BaseNodeData {
  title: string;
  description?: string;
  isExpanded?: boolean;
}

export interface NoteNodeData extends BaseNodeData {
  title?: string;
  text: string;
  color?: string;
}

export interface ShotNodeData extends BaseNodeData {
  shotId: string;
  description: string;
  duration: string;
  shotType: string;
  focalLength?: string;
  movement: string;
  composition?: string;
  blocking?: string;
  difficulty?: number;
  dialogue?: string;
  sound?: string;
  lightingVfx?: string;
  editingNotes?: string;
  notes?: string;
  soraPrompt?: string;
  storyboardPrompt?: string;
  viewMode?: "card" | "table";
}

export type WorkflowNodeData =
  | ImageInputNodeData
  | AnnotationNodeData
  | TextNodeData
  | ImageGenNodeData
  | VideoGenNodeData
  | ViduVideoGenNodeData
  | GroupNodeData
  | ShotNodeData;

export type WorkflowNode = Node<WorkflowNodeData, NodeType>;

export interface WorkflowEdgeData extends Record<string, unknown> {
  hasPause?: boolean;
}

export type WorkflowEdge = Edge<WorkflowEdgeData>;

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

export type LabContextSnapshot = {
  rawScript: string;
  globalStyleGuide: string;
  shotGuide: string;
  soraGuide: string;
  storyboardGuide: string;
  dramaGuide: string;
  context: ProjectContext;
};

export type WorkflowViewport = {
  x: number;
  y: number;
  zoom: number;
};

export interface WorkflowFile {
  version: number;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  edgeStyle?: "angular" | "curved";
  globalAssetHistory?: GlobalAssetHistoryItem[];
  labContext?: LabContextSnapshot;
  viewport?: WorkflowViewport;
  activeView?: string | null;
}

export type WorkflowTemplate = {
  id: string;
  name: string;
  createdAt: number;
  workflow: WorkflowFile;
};
