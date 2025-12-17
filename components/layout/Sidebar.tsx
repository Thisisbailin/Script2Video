import React from "react";
import { PanelLeftOpen, FolderOpen, FileText, BrainCircuit, List, Palette, MonitorPlay, BarChart2, Layers, Film, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { WorkflowStep, AnalysisSubStep, Episode } from "../../types";
import { isEpisodeSoraComplete } from "../../utils/episodes";

type SidebarProps = {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  step: WorkflowStep;
  analysisStep: AnalysisSubStep;
  analysisQueueLength: number;
  analysisTotal: number;
  isProcessing: boolean;
  currentEpIndex: number;
  setCurrentEpIndex: (idx: number) => void;
  episodes: Episode[];
  onStartAnalysis: () => void;
  onConfirmSummaryNext: () => void;
  onConfirmEpSummariesNext: () => void;
  onConfirmCharListNext: () => void;
  onConfirmCharDepthNext: () => void;
  onConfirmLocListNext: () => void;
  onFinishAnalysis: () => void;
  onStartPhase2: () => void;
  onConfirmEpisodeShots: () => void;
  onStartPhase3: () => void;
  onRetryEpisodeSora: () => void;
  onContinueNextEpisodeSora: () => void;
  isEpListExpanded: boolean;
  setIsEpListExpanded: (v: boolean) => void;
};

export const Sidebar: React.FC<SidebarProps> = ({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  activeTab,
  setActiveTab,
  step,
  analysisStep,
  analysisQueueLength,
  analysisTotal,
  isProcessing,
  currentEpIndex,
  setCurrentEpIndex,
  episodes,
  onStartAnalysis,
  onConfirmSummaryNext,
  onConfirmEpSummariesNext,
  onConfirmCharListNext,
  onConfirmCharDepthNext,
  onConfirmLocListNext,
  onFinishAnalysis,
  onStartPhase2,
  onConfirmEpisodeShots,
  onStartPhase3,
  onRetryEpisodeSora,
  onContinueNextEpisodeSora,
  isEpListExpanded,
  setIsEpListExpanded
}) => {
  const progressLabel = () => {
    switch (analysisStep) {
      case AnalysisSubStep.PROJECT_SUMMARY:
        return '1/6';
      case AnalysisSubStep.EPISODE_SUMMARIES:
        return '2/6';
      case AnalysisSubStep.CHAR_IDENTIFICATION:
        return '3/6';
      case AnalysisSubStep.CHAR_DEEP_DIVE:
        return '4/6';
      case AnalysisSubStep.LOC_IDENTIFICATION:
        return '5/6';
      case AnalysisSubStep.LOC_DEEP_DIVE:
        return '6/6';
      default:
        return '';
    }
  };

  const completedSora = episodes.filter(isEpisodeSoraComplete).length;

  if (isSidebarCollapsed) {
    return (
      <aside className="w-16 flex flex-col items-center py-4 gap-4 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
        <button onClick={() => setIsSidebarCollapsed(false)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors">
          <PanelLeftOpen size={20} />
        </button>
        <div className="w-8 h-px bg-gray-200 dark:bg-gray-700"></div>
        <button onClick={() => setActiveTab('assets')} className={`p-2 rounded-lg transition-colors ${activeTab === 'assets' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`} title="Assets"><FolderOpen size={20} /></button>
        <button onClick={() => setActiveTab('script')} className={`p-2 rounded-lg transition-colors ${activeTab === 'script' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`} title="Script"><FileText size={20} /></button>
        <button onClick={() => setActiveTab('understanding')} className={`p-2 rounded-lg transition-colors ${activeTab === 'understanding' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`} title="Analysis"><BrainCircuit size={20} /></button>
        <button onClick={() => setActiveTab('table')} className={`p-2 rounded-lg transition-colors ${activeTab === 'table' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`} title="Table"><List size={20} /></button>
        <button onClick={() => setActiveTab('visuals')} className={`p-2 rounded-lg transition-colors ${activeTab === 'visuals' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400' : 'text-gray-400 hover:text-pink-500'}`} title="Visuals"><Palette size={20} /></button>
        <button onClick={() => setActiveTab('video')} className={`p-2 rounded-lg transition-colors ${activeTab === 'video' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-indigo-500'}`} title="Video Studio"><MonitorPlay size={20} /></button>
        <button onClick={() => setActiveTab('stats')} className={`p-2 rounded-lg transition-colors ${activeTab === 'stats' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`} title="Dashboard"><BarChart2 size={20} /></button>
      </aside>
    );
  }

  return (
    <aside className="w-72 transition-all duration-300 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col shrink-0 z-10 relative">
      <div className="p-4 shrink-0 space-y-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Layers size={12} /> Workflow Actions
          </div>
          <button
            onClick={() => setIsSidebarCollapsed(true)}
            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            title="Collapse Sidebar"
          >
            <PanelLeftOpen size={14} className="rotate-180" />
          </button>
        </div>

        {step === WorkflowStep.IDLE && episodes.length > 0 && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">Phase 1: Analysis</h3>
            <button onClick={onStartAnalysis} className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50" disabled={isProcessing}>
              {isProcessing ? <Loader2 className="animate-spin" size={14} /> : <BrainCircuit size={14} />} Start Analysis
            </button>
          </div>
        )}

        {step === WorkflowStep.SETUP_CONTEXT && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-xs text-gray-900 dark:text-white">Phase 1 in Progress</h3>
              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                {progressLabel()}
              </span>
            </div>

            {analysisStep === AnalysisSubStep.PROJECT_SUMMARY && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <p className="mb-2">Reviewing Global Project Arc...</p>
                <button onClick={onConfirmSummaryNext} className="w-full py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-green-500 hover:text-white rounded text-xs transition-colors" disabled={analysisQueueLength > 0 || isProcessing}>
                  Confirm & Next
                </button>
              </div>
            )}

            {analysisStep === AnalysisSubStep.EPISODE_SUMMARIES && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <p className="mb-2">Summarizing {analysisTotal} Episodes...</p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mb-2 overflow-hidden">
                  <div className="bg-blue-500 h-full transition-all" style={{ width: `${analysisTotal ? ((analysisTotal - analysisQueueLength) / analysisTotal) * 100 : 0}%` }}></div>
                </div>
                <button onClick={onConfirmEpSummariesNext} className="w-full py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-green-500 hover:text-white rounded text-xs transition-colors" disabled={analysisQueueLength > 0 || isProcessing}>
                  Confirm & Next
                </button>
              </div>
            )}

            {analysisStep === AnalysisSubStep.CHAR_IDENTIFICATION && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <p className="mb-2">Identifying Characters...</p>
                <button onClick={onConfirmCharListNext} className="w-full py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-green-500 hover:text-white rounded text-xs transition-colors" disabled={analysisQueueLength > 0 || isProcessing}>
                  Confirm & Next
                </button>
              </div>
            )}

            {analysisStep === AnalysisSubStep.CHAR_DEEP_DIVE && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <p className="mb-2">Analyzing Character Depth...</p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mb-2 overflow-hidden">
                  <div className="bg-purple-500 h-full transition-all" style={{ width: `${analysisTotal ? ((analysisTotal - analysisQueueLength) / analysisTotal) * 100 : 0}%` }}></div>
                </div>
                <button onClick={onConfirmCharDepthNext} className="w-full py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-green-500 hover:text-white rounded text-xs transition-colors" disabled={analysisQueueLength > 0 || isProcessing}>
                  Confirm & Next
                </button>
              </div>
            )}

            {analysisStep === AnalysisSubStep.LOC_IDENTIFICATION && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <p className="mb-2">Mapping Locations...</p>
                <button onClick={onConfirmLocListNext} className="w-full py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-green-500 hover:text-white rounded text-xs transition-colors" disabled={analysisQueueLength > 0 || isProcessing}>
                  Confirm & Next
                </button>
              </div>
            )}

            {analysisStep === AnalysisSubStep.LOC_DEEP_DIVE && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <p className="mb-2">Visualizing Locations...</p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mb-2 overflow-hidden">
                  <div className="bg-orange-500 h-full transition-all" style={{ width: `${analysisTotal ? ((analysisTotal - analysisQueueLength) / analysisTotal) * 100 : 0}%` }}></div>
                </div>
                <button onClick={onFinishAnalysis} className="w-full py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-green-500 hover:text-white rounded text-xs transition-colors" disabled={analysisQueueLength > 0 || isProcessing}>
                  Finish Phase 1
                </button>
              </div>
            )}
          </div>
        )}

        {(analysisStep === AnalysisSubStep.COMPLETE || step === WorkflowStep.GENERATE_SHOTS) && step !== WorkflowStep.GENERATE_SORA && step !== WorkflowStep.COMPLETED && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">Phase 2: Shot Lists</h3>
            {step !== WorkflowStep.GENERATE_SHOTS ? (
              <button onClick={onStartPhase2} className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors">
                <Film size={14} /> Start Shot Gen
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>Progress</span>
                  <span>{currentEpIndex + 1} / {episodes.length}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${(episodes.length ? (currentEpIndex) / episodes.length : 0) * 100}%` }}></div>
                </div>
                {isProcessing ? (
                  <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                    <Loader2 className="animate-spin" size={12} /> Processing Ep {currentEpIndex + 1}...
                  </div>
                ) : (
                  <button onClick={onConfirmEpisodeShots} className="w-full py-2 bg-green-600 hover:bg-green-500 rounded text-xs font-bold text-white transition-colors">
                    Confirm & Next Episode
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {(step === WorkflowStep.GENERATE_SORA) && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">Phase 3: Sora Prompts</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>Progress</span>
                <span>{episodes.length ? completedSora : 0} / {episodes.length}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${episodes.length ? (completedSora / episodes.length) * 100 : 0}%` }}></div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                当前集：{episodes[currentEpIndex]?.title || `Episode ${currentEpIndex + 1}`}
              </div>
              {isProcessing ? (
                <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded">
                  <Loader2 className="animate-spin" size={12} /> Writing Prompts...
                </div>
              ) : (
                <div className="space-y-2">
                  <button onClick={onStartPhase3} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold text-white transition-colors">
                    Generate / Resume Current Episode
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={onRetryEpisodeSora}
                      className="w-full py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-[11px] font-semibold text-gray-700 dark:text-gray-200 transition-colors"
                    >
                      Retry This Episode
                    </button>
                    <button
                      onClick={onContinueNextEpisodeSora}
                      className="w-full py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:hover:bg-indigo-800/60 dark:text-indigo-200 rounded text-[11px] font-semibold transition-colors"
                    >
                      Continue Next Episode
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === WorkflowStep.COMPLETED && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-900/50">
            <h3 className="font-semibold text-green-800 dark:text-green-300 mb-1 text-sm flex items-center gap-2">
              <Layers size={14} /> Workflow Complete
            </h3>
            <p className="text-xs text-green-700 dark:text-green-400">
              You can now use the Video Studio or export your assets.
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <nav className="p-2 space-y-1">
          <button
            onClick={() => setActiveTab('assets')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'assets' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            <FolderOpen size={16} /> Assets & Guides
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'script' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            <FileText size={16} /> Script Viewer
          </button>
          <button
            onClick={() => setActiveTab('understanding')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'understanding' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            <BrainCircuit size={16} /> Deep Understanding
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'table' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            <List size={16} /> Shot List Table
          </button>
          <button
            onClick={() => setActiveTab('visuals')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'visuals' ? 'bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            <Palette size={16} /> Visual Assets
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'video' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            <MonitorPlay size={16} /> Video Studio
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'stats' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            <BarChart2 size={16} /> Dashboard
          </button>
        </nav>

        {episodes.length > 0 && (
          <div className="mt-4 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={() => setIsEpListExpanded(!isEpListExpanded)}
              className="w-full p-3 flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <span>Episodes ({episodes.length})</span>
              {isEpListExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>

            {isEpListExpanded && (
              <div className="px-2 pb-4 space-y-1">
                {episodes.map((ep, idx) => (
                  <button
                    key={ep.id}
                    onClick={() => {
                      setCurrentEpIndex(idx);
                      if (ep.shots.length > 0) setActiveTab('table');
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-xs truncate transition-colors ${currentEpIndex === idx ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                  >
                    {ep.id}. {ep.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
