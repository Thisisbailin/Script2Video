import { AnalysisSubStep, WorkflowStep, ActiveTab } from "../types";

export type WorkflowState = {
  step: WorkflowStep;
  analysisStep: AnalysisSubStep;
  currentEpIndex: number;
  activeTab: ActiveTab;
  isProcessing: boolean;
  processingStatus: string;
  analysisQueue: any[];
  analysisTotal: number;
};

export type WorkflowAction =
  | { type: 'SET_STEP'; step: WorkflowStep }
  | { type: 'SET_ANALYSIS_STEP'; analysisStep: AnalysisSubStep }
  | { type: 'SET_CURRENT_EP_INDEX'; index: number }
  | { type: 'SET_ACTIVE_TAB'; tab: ActiveTab }
  | { type: 'SET_PROCESSING'; value: boolean; status?: string }
  | { type: 'SET_STATUS'; status: string }
  | { type: 'SET_QUEUE'; queue: any[]; total: number }
  | { type: 'SHIFT_QUEUE' }
  | { type: 'RESET' };

export const INITIAL_WORKFLOW_STATE: WorkflowState = {
  step: WorkflowStep.IDLE,
  analysisStep: AnalysisSubStep.IDLE,
  currentEpIndex: 0,
  activeTab: 'assets',
  isProcessing: false,
  processingStatus: '',
  analysisQueue: [],
  analysisTotal: 0
};

export function workflowReducer(state: WorkflowState, action: WorkflowAction): WorkflowState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step };
    case 'SET_ANALYSIS_STEP':
      return { ...state, analysisStep: action.analysisStep };
    case 'SET_CURRENT_EP_INDEX':
      return { ...state, currentEpIndex: action.index };
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.tab };
    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.value, processingStatus: action.status ?? state.processingStatus };
    case 'SET_STATUS':
      return { ...state, processingStatus: action.status };
    case 'SET_QUEUE':
      return { ...state, analysisQueue: action.queue, analysisTotal: action.total };
    case 'SHIFT_QUEUE':
      return { ...state, analysisQueue: state.analysisQueue.slice(1) };
    case 'RESET':
      return { ...INITIAL_WORKFLOW_STATE, activeTab: state.activeTab };
    default:
      return state;
  }
}
