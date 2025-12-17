import { useReducer } from "react";
import { AnalysisSubStep, WorkflowStep } from "../types";
import { INITIAL_WORKFLOW_STATE, WorkflowAction, workflowReducer, WorkflowState } from "../reducers/workflowReducer";

export const useWorkflowEngine = (initial?: Partial<WorkflowState>) => {
  const mergedInitial = { ...INITIAL_WORKFLOW_STATE, ...(initial || {}) };
  const [state, dispatch] = useReducer(workflowReducer, mergedInitial);

  const setStep = (step: WorkflowStep) => dispatch({ type: "SET_STEP", step });
  const setAnalysisStep = (analysisStep: AnalysisSubStep) => dispatch({ type: "SET_ANALYSIS_STEP", analysisStep });
  const setCurrentEpIndex = (index: number) => dispatch({ type: "SET_CURRENT_EP_INDEX", index });
  const setActiveTab = (tab: WorkflowState["activeTab"]) => dispatch({ type: "SET_ACTIVE_TAB", tab });
  const setProcessing = (value: boolean, status?: string) => dispatch({ type: "SET_PROCESSING", value, status });
  const setStatus = (status: string) => dispatch({ type: "SET_STATUS", status });
  const setQueue = (queue: any[], total: number) => dispatch({ type: "SET_QUEUE", queue, total });
  const shiftQueue = () => dispatch({ type: "SHIFT_QUEUE" });
  const resetWorkflow = () => dispatch({ type: "RESET" });

  return {
    state,
    dispatch,
    setStep,
    setAnalysisStep,
    setCurrentEpIndex,
    setActiveTab,
    setProcessing,
    setStatus,
    setQueue,
    shiftQueue,
    resetWorkflow,
  };
};
