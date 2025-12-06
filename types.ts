
export interface TokenUsage {
  promptTokens: number;
  responseTokens: number;
  totalTokens: number;
}

export interface Shot {
  id: string; // e.g., "1-1-01" (SceneID-ShotNumber)
  duration: string;
  shotType: string; // e.g., Close-up, Wide
  movement: string; // e.g., Pan, Tilt, Static
  description: string;
  dialogue: string;
  soraPrompt: string;
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

export interface Character {
  name: string;
  role: string; // e.g. Protagonist, Antagonist
  bio: string;
  visualTags: string; // e.g. "Tall, wears red coat"
}

export interface ProjectContext {
  projectSummary: string;
  characters: Character[];
}

export interface RequestStats {
  total: number;
  success: number;
  error: number;
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
  contextUsage?: TokenUsage;
  
  // Standard Operating Procedures (SOPs) - Loaded from files
  shotGuide: string;
  soraGuide: string;
  
  // Project-Specific Assets (User Uploaded)
  globalStyleGuide?: string; // Unified Style Bible for the project
  
  stats: PerformanceMetrics;
}

export interface AppConfig {
  model: string;
}

export enum WorkflowStep {
  IDLE,
  SETUP_CONTEXT, // Phase 1
  GENERATE_SHOTS, // Phase 2
  GENERATE_SORA, // Phase 3
  COMPLETED
}
