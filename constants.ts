
import { ProjectData } from './types';

export const INITIAL_PROJECT_DATA: ProjectData = {
  fileName: '',
  rawScript: '',
  episodes: [],
  context: {
    projectSummary: '',
    characters: []
  },
  shotGuide: '',
  soraGuide: '',
  globalStyleGuide: '', // Initialize as empty
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
