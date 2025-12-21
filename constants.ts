
import { ProjectData, TextServiceConfig, VideoServiceConfig, MultimodalConfig } from './types';

export const INITIAL_PROJECT_DATA: ProjectData = {
  fileName: '',
  rawScript: '',
  episodes: [],
  context: {
    projectSummary: '',
    episodeSummaries: [],
    characters: [],
    locations: []
  },
  shotGuide: '',
  soraGuide: '',
  dramaGuide: '',
  globalStyleGuide: '', // Initialize as empty
  
  contextUsage: { promptTokens: 0, responseTokens: 0, totalTokens: 0 },
  phase1Usage: {
    projectSummary: { promptTokens: 0, responseTokens: 0, totalTokens: 0 },
    episodeSummaries: { promptTokens: 0, responseTokens: 0, totalTokens: 0 },
    charList: { promptTokens: 0, responseTokens: 0, totalTokens: 0 },
    charDeepDive: { promptTokens: 0, responseTokens: 0, totalTokens: 0 },
    locList: { promptTokens: 0, responseTokens: 0, totalTokens: 0 },
    locDeepDive: { promptTokens: 0, responseTokens: 0, totalTokens: 0 },
  },
  phase4Usage: { promptTokens: 0, responseTokens: 0, totalTokens: 0 },
  phase5Usage: { promptTokens: 0, responseTokens: 0, totalTokens: 0 },

  stats: {
    context: { total: 0, success: 0, error: 0 },
    shotGen: { total: 0, success: 0, error: 0 },
    soraGen: { total: 0, success: 0, error: 0 }
  }
};

export const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fast)' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview (High Intelligence)' },
];

export const INITIAL_TEXT_CONFIG: TextServiceConfig = {
  provider: 'gemini',
  baseUrl: '', // Not used for Gemini SDK
  apiKey: '', // Uses process.env by default if empty
  model: 'gemini-2.5-flash'
};

export const INITIAL_VIDEO_CONFIG: VideoServiceConfig = {
  baseUrl: '', // Default empty to force user input
  apiKey: '',
  model: 'sora-2'
};

export const INITIAL_MULTIMODAL_CONFIG: MultimodalConfig = {
  baseUrl: 'https://openrouter.ai/api/v1',
  apiKey: '',
  model: 'gpt-4o' // Default to a strong multimodal model
};

export const INITIAL_REMEMBER_KEYS = false;
export const INITIAL_SYNC_KEYS = false;
