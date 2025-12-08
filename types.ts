
export interface TokenUsage {
  promptTokens: number;
  responseTokens: number;
  totalTokens: number;
}

export interface VideoParams {
  aspectRatio: string; // "16:9", "9:16"
  quality: 'standard' | 'high'; // New: Maps to specific resolutions
  resolution?: string; // "1280x720", "1792x1024", etc.
  duration?: string; // "4s", "8s", "12s"
  inputImage?: File | null; // New: For Sora input_reference
}

export interface Shot {
  id: string; // e.g., "1-1-01" (SceneID-ShotNumber)
  duration: string;
  shotType: string; // e.g., Close-up, Wide
  movement: string; // e.g., Pan, Tilt, Static
  description: string;
  dialogue: string;
  soraPrompt: string;
  
  // Phase 5: Video Gen Fields
  videoStatus?: 'idle' | 'generating' | 'completed' | 'error';
  videoUrl?: string;
  videoId?: string; // New: Store the API ID for Remixing
  videoTaskId?: string; // Legacy/Polling ID
  videoErrorMsg?: string;
  
  // User customizations for Video
  finalVideoPrompt?: string; // The actual prompt used (user edited)
  videoParams?: VideoParams;
  isApproved?: boolean; // User marked as satisfied
}

export interface Scene {
  id: string; // e.g., "1-1"
  title: string; // e.g., "Inside Cafe - Day"
  content: string;
}

export interface Episode {
  id: number;
  title: string;
  content: string; // Original text
  scenes: Scene[]; // Parsed scenes
  summary?: string; // Generated summary
  shots: Shot[];
  status: 'pending' | 'generating' | 'review_shots' | 'confirmed_shots' | 'generating_sora' | 'review_sora' | 'completed' | 'error';
  errorMsg?: string;
  shotGenUsage?: TokenUsage;
  soraGenUsage?: TokenUsage;
}

// --- NEW DEEP UNDERSTANDING TYPES ---

export interface CharacterForm {
  formName: string; // e.g. "Youth", "Blackened", "General"
  episodeRange: string; // e.g. "Ep 1-5"
  description: string;
  visualTags: string;
}

export interface Character {
  id: string;
  name: string;
  role: string; // e.g. Protagonist, Antagonist
  isMain: boolean; // Determines if we do deep analysis
  bio: string; // General bio
  forms: CharacterForm[]; // Specific visual/personality stages
}

export interface Location {
  id: string;
  name: string;
  type: 'core' | 'secondary';
  description: string; // General description
  visuals: string; // Lighting, atmosphere, texture details
}

export interface ProjectContext {
  projectSummary: string;
  episodeSummaries: { episodeId: number; summary: string }[];
  characters: Character[];
  locations: Location[];
}

export interface RequestStats {
  total: number;
  success: number;
  error: number;
}

export interface Phase1Usage {
  projectSummary: TokenUsage;
  episodeSummaries: TokenUsage;
  charList: TokenUsage;
  charDeepDive: TokenUsage;
  locList: TokenUsage;
  locDeepDive: TokenUsage;
}

export interface PerformanceMetrics {
  context: RequestStats;
  shotGen: RequestStats;
  soraGen: RequestStats;
}

export interface ProjectData {
  fileName: string;
  rawScript: string;
  episodes: Episode[];
  context: ProjectContext;
  contextUsage?: TokenUsage; // Total usage (Phase 1 + Easter Eggs)
  phase1Usage: Phase1Usage; // Detailed breakdown of Phase 1
  
  // New usage tracking fields
  phase4Usage?: TokenUsage; // Visual Assets (Multimodal)
  phase5Usage?: TokenUsage; // Video Studio (Reserved for Prompt Refinement or API cost mapping)

  // Standard Operating Procedures (SOPs) - Loaded from files
  shotGuide: string;
  soraGuide: string;
  
  // Project-Specific Assets (User Uploaded)
  globalStyleGuide?: string; // Unified Style Bible for the project
  
  stats: PerformanceMetrics;
}

export interface VideoServiceConfig {
  baseUrl: string;
  apiKey: string;
  model?: string; 
}

export type TextProvider = 'gemini' | 'openrouter';

export interface TextServiceConfig {
  provider: TextProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface MultimodalConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AppConfig {
  textConfig: TextServiceConfig;
  videoConfig: VideoServiceConfig;
  multimodalConfig: MultimodalConfig; // New Phase 4 Config
}

export enum WorkflowStep {
  IDLE,
  SETUP_CONTEXT, // Phase 1 (Now Multi-step)
  GENERATE_SHOTS, // Phase 2
  GENERATE_SORA, // Phase 3
  GENERATE_VIDEO, // Phase 5 (New)
  COMPLETED
}

export enum AnalysisSubStep {
  IDLE,
  PROJECT_SUMMARY,    // Step 1: Global Arc
  EPISODE_SUMMARIES,  // Step 2: Batch Episodes
  CHAR_IDENTIFICATION,// Step 3: List
  CHAR_DEEP_DIVE,     // Step 4: Batch Main Characters
  LOC_IDENTIFICATION, // Step 5: List
  LOC_DEEP_DIVE,      // Step 6: Batch Core Locations
  COMPLETE
}
