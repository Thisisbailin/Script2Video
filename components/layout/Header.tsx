import React, { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Video,
  Download,
  Sparkles,
  ChevronDown,
  ChevronUp,
  User,
  Shield,
  Sun,
  Moon,
  Settings,
  Trash2,
  LogOut,
  Upload,
  FolderOpen,
  FileText,
  BrainCircuit,
  List,
  Palette,
  MonitorPlay,
  BarChart2,
  Layers,
  Film,
} from "lucide-react";
import { ActiveTab, AnalysisSubStep, Episode, WorkflowStep } from "../../types";
import { isEpisodeSoraComplete } from "../../utils/episodes";

type TabOption = {
  key: ActiveTab;
  label: string;
  icon: LucideIcon;
  hidden?: boolean;
};

type WorkflowProps = {
  step: WorkflowStep;
  analysisStep: AnalysisSubStep;
  analysisQueueLength: number;
  analysisTotal: number;
  isProcessing: boolean;
  currentEpIndex: number;
  episodes: Episode[];
  setCurrentEpIndex: (idx: number) => void;
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
};

type HeaderProps = {
  activeTab: ActiveTab;
  tabs: TabOption[];
  onTabChange: (tab: ActiveTab) => void;
  activeModelLabel: string;
  onTryMe: () => void;
  hasGeneratedShots: boolean;
  onExportCsv: () => void;
  onExportXls: () => void;
  onToggleExportMenu: () => void;
  isExportMenuOpen: boolean;
  onToggleTheme: () => void;
  isDarkMode: boolean;
  account: {
    isLoaded: boolean;
    isSignedIn: boolean;
    user?: any;
    onSignIn: () => void;
    onSignOut: () => void;
    onOpenSettings: () => void;
    onReset: () => void;
    isUserMenuOpen: boolean;
    setIsUserMenuOpen: (v: boolean) => void;
    onUploadAvatar?: () => void;
    avatarUrl?: string;
  };
  workflow: WorkflowProps;
};

const analysisProgressLabel = (analysisStep: AnalysisSubStep) => {
  switch (analysisStep) {
    case AnalysisSubStep.PROJECT_SUMMARY:
      return "1/6";
    case AnalysisSubStep.EPISODE_SUMMARIES:
      return "2/6";
    case AnalysisSubStep.CHAR_IDENTIFICATION:
      return "3/6";
    case AnalysisSubStep.CHAR_DEEP_DIVE:
      return "4/6";
    case AnalysisSubStep.LOC_IDENTIFICATION:
      return "5/6";
    case AnalysisSubStep.LOC_DEEP_DIVE:
      return "6/6";
    default:
      return "";
  }
};

const EpisodeList: React.FC<{
  episodes: Episode[];
  currentEpIndex: number;
  onSelect: (idx: number) => void;
}> = ({ episodes, currentEpIndex, onSelect }) => {
  if (!episodes.length) {
    return (
      <div className="px-3 py-4 text-xs text-[var(--text-secondary)]">
        暂无剧集，导入脚本后可生成。
      </div>
    );
  }

  return (
    <div className="max-h-72 overflow-auto p-2 space-y-1">
      {episodes.map((ep, idx) => (
        <button
          key={ep.id}
          onClick={() => onSelect(idx)}
          className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${
            currentEpIndex === idx
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200"
              : "bg-white/5 hover:bg-white/10 text-[var(--text-primary)]"
          }`}
        >
          <div className="font-semibold truncate">
            {ep.title || `Episode ${idx + 1}`}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-2">
            <span>Shots: {ep.shots.length}</span>
            <span className="inline-flex items-center gap-1">
              <Layers size={12} /> {ep.status}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
};

const WorkflowCard: React.FC<{ workflow: WorkflowProps }> = ({ workflow }) => {
  const {
    step,
    analysisStep,
    analysisQueueLength,
    analysisTotal,
    isProcessing,
    currentEpIndex,
    episodes,
    setCurrentEpIndex,
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
  } = workflow;

  const completedSora = useMemo(
    () => episodes.filter(isEpisodeSoraComplete).length,
    [episodes]
  );

  return (
    <div
      className="w-[360px] rounded-2xl border text-[var(--text-primary)] overflow-hidden"
      style={{
        borderColor: "var(--border-subtle)",
        background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
        backgroundColor: "var(--bg-elevated)",
        boxShadow: "var(--shadow-strong)",
        backdropFilter: "blur(18px) saturate(135%)",
        WebkitBackdropFilter: "blur(18px) saturate(135%)",
      }}
    >
      <div
        className="px-4 py-3 border-b flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--text-secondary)]"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <Layers size={14} /> Workflow Actions
      </div>
      <div className="p-4 space-y-3">
        {step === WorkflowStep.IDLE && episodes.length > 0 && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-black/5 p-3 space-y-2">
            <div className="text-sm font-semibold">Phase 1 · 剧本理解</div>
            <div className="text-xs text-[var(--text-secondary)]">
              自动进行剧情梳理、角色/场景总结。
            </div>
            <button
              onClick={onStartAnalysis}
              className="w-full mt-2 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold transition"
            >
              开始分析
            </button>
          </div>
        )}

        {step === WorkflowStep.SETUP_CONTEXT && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-white/5 p-3 space-y-3">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>Phase 1 · 进度</span>
              <span className="px-2 py-0.5 rounded-full bg-white/5 text-[11px]">
                {analysisProgressLabel(analysisStep)}
              </span>
            </div>
            {analysisStep === AnalysisSubStep.PROJECT_SUMMARY && (
              <>
                <div className="text-sm font-medium">概览项目剧情...</div>
                <button
                  onClick={onConfirmSummaryNext}
                  className="w-full py-2 rounded-lg bg-[var(--bg-panel)] hover:border-[var(--accent-blue)] border border-[var(--border-subtle)] text-sm font-semibold transition"
                  disabled={analysisQueueLength > 0 || isProcessing}
                >
                  确认并继续
                </button>
              </>
            )}

            {analysisStep === AnalysisSubStep.EPISODE_SUMMARIES && (
              <>
                <div className="text-sm font-medium">
                  总结 {analysisTotal} 集...
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-[var(--border-subtle)]/50">
                  <div
                    className="bg-blue-500 h-full transition-all"
                    style={{
                      width: `${
                        analysisTotal
                          ? ((analysisTotal - analysisQueueLength) /
                              analysisTotal) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <button
                  onClick={onConfirmEpSummariesNext}
                  className="w-full py-2 rounded-lg bg-[var(--bg-panel)] hover:border-[var(--accent-blue)] border border-[var(--border-subtle)] text-sm font-semibold transition"
                  disabled={analysisQueueLength > 0 || isProcessing}
                >
                  确认并继续
                </button>
              </>
            )}

            {analysisStep === AnalysisSubStep.CHAR_IDENTIFICATION && (
              <>
                <div className="text-sm font-medium">识别角色列表...</div>
                <button
                  onClick={onConfirmCharListNext}
                  className="w-full py-2 rounded-lg bg-[var(--bg-panel)] hover:border-[var(--accent-blue)] border border-[var(--border-subtle)] text-sm font-semibold transition"
                  disabled={analysisQueueLength > 0 || isProcessing}
                >
                  确认并继续
                </button>
              </>
            )}

            {analysisStep === AnalysisSubStep.CHAR_DEEP_DIVE && (
              <>
                <div className="text-sm font-medium">深描主要角色...</div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-[var(--border-subtle)]/50">
                  <div
                    className="bg-purple-500 h-full transition-all"
                    style={{
                      width: `${
                        analysisTotal
                          ? ((analysisTotal - analysisQueueLength) /
                              analysisTotal) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <button
                  onClick={onConfirmCharDepthNext}
                  className="w-full py-2 rounded-lg bg-[var(--bg-panel)] hover:border-[var(--accent-blue)] border border-[var(--border-subtle)] text-sm font-semibold transition"
                  disabled={analysisQueueLength > 0 || isProcessing}
                >
                  确认并继续
                </button>
              </>
            )}

            {analysisStep === AnalysisSubStep.LOC_IDENTIFICATION && (
              <>
                <div className="text-sm font-medium">定位场景...</div>
                <button
                  onClick={onConfirmLocListNext}
                  className="w-full py-2 rounded-lg bg-[var(--bg-panel)] hover:border-[var(--accent-blue)] border border-[var(--border-subtle)] text-sm font-semibold transition"
                  disabled={analysisQueueLength > 0 || isProcessing}
                >
                  确认并继续
                </button>
              </>
            )}

            {analysisStep === AnalysisSubStep.LOC_DEEP_DIVE && (
              <>
                <div className="text-sm font-medium">深化场景刻画...</div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-[var(--border-subtle)]/50">
                  <div
                    className="bg-orange-500 h-full transition-all"
                    style={{
                      width: `${
                        analysisTotal
                          ? ((analysisTotal - analysisQueueLength) /
                              analysisTotal) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <button
                  onClick={onFinishAnalysis}
                  className="w-full py-2 rounded-lg bg-[var(--bg-panel)] hover:border-[var(--accent-blue)] border border-[var(--border-subtle)] text-sm font-semibold transition"
                  disabled={analysisQueueLength > 0 || isProcessing}
                >
                  完成 Phase 1
                </button>
              </>
            )}
          </div>
        )}

        {analysisStep === AnalysisSubStep.COMPLETE && step === WorkflowStep.SETUP_CONTEXT && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-black/5 p-3 space-y-2">
            <div className="text-sm font-semibold">Phase 2 · Shot Lists</div>
            <div className="text-xs text-[var(--text-secondary)]">基于理解生成镜头表。</div>
            <button
              onClick={onStartPhase2}
              className="w-full mt-2 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition"
            >
              开始镜头生成
            </button>
          </div>
        )}

        {step === WorkflowStep.GENERATE_SHOTS && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-black/5 p-3 space-y-3">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>Phase 2 · 进度</span>
              <span>
                {currentEpIndex + 1} / {episodes.length || 1}
              </span>
            </div>
            <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all"
                style={{
                  width: `${
                    episodes.length ? (currentEpIndex / episodes.length) * 100 : 0
                  }%`,
                }}
              />
            </div>
            <div className="text-xs text-[var(--text-secondary)]">
              当前：{episodes[currentEpIndex]?.title || `Episode ${currentEpIndex + 1}`}
            </div>
            {isProcessing ? (
              <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-900/30 p-2 rounded">
                处理中...
              </div>
            ) : (
              <button
                onClick={onConfirmEpisodeShots}
                className="w-full py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-semibold transition"
              >
                确认并下一集
              </button>
            )}
          </div>
        )}

        {step === WorkflowStep.GENERATE_SORA && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-black/5 p-3 space-y-3">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>Phase 3 · 进度</span>
              <span>
                {episodes.length ? completedSora : 0} / {episodes.length || 1}
              </span>
            </div>
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-[var(--border-subtle)]/50">
              <div
                className="bg-indigo-500 h-full transition-all"
                style={{
                  width: `${
                    episodes.length ? (completedSora / episodes.length) * 100 : 0
                  }%`,
                }}
              />
            </div>
            <div className="text-xs text-[var(--text-secondary)]">
              当前：{episodes[currentEpIndex]?.title || `Episode ${currentEpIndex + 1}`}
            </div>
            <button
              onClick={onStartPhase3}
              className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition"
              disabled={isProcessing}
            >
              生成 / 恢复当前集
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onRetryEpisodeSora}
                className="py-2 rounded-lg bg-[var(--bg-panel)] hover:border-[var(--accent-blue)] border border-[var(--border-subtle)] text-[11px] font-semibold transition"
                disabled={isProcessing}
              >
                Retry 当前集
              </button>
              <button
                onClick={onContinueNextEpisodeSora}
                className="py-2 rounded-lg bg-indigo-900/30 hover:bg-indigo-900/50 text-[11px] font-semibold transition text-indigo-200"
                disabled={isProcessing}
              >
                Continue 下一集
              </button>
            </div>
          </div>
        )}

        {step === WorkflowStep.COMPLETED && (
          <div className="rounded-xl border border-green-900 bg-green-900/40 p-3 text-sm text-green-100">
            <div className="font-semibold flex items-center gap-2">
              <Layers size={14} /> 全流程完成
            </div>
            <div className="text-xs text-green-200/80">
              可在 Video Studio 或导出结果中查看。
            </div>
          </div>
        )}

        <div className="rounded-xl border border-[var(--border-subtle)] bg-black/5 p-3">
          <div className="text-xs text-[var(--text-secondary)] mb-2">剧集快速切换</div>
          <EpisodeList
            episodes={episodes}
            currentEpIndex={currentEpIndex}
            onSelect={(idx) => setCurrentEpIndex(idx)}
          />
        </div>
      </div>
    </div>
  );
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  tabs,
  onTabChange,
  activeModelLabel,
  onTryMe,
  hasGeneratedShots,
  onExportCsv,
  onExportXls,
  onToggleExportMenu,
  isExportMenuOpen,
  onToggleTheme,
  isDarkMode,
  account,
  workflow,
}) => {
  const {
    isLoaded,
    isSignedIn,
    user,
    onSignIn,
    onSignOut,
    onOpenSettings,
    onReset,
    isUserMenuOpen,
    setIsUserMenuOpen,
    onUploadAvatar,
    avatarUrl,
  } = account;

  const currentTab = useMemo(
    () => tabs.find((t) => t.key === activeTab) || tabs[0],
    [tabs, activeTab]
  );
  const [showTabs, setShowTabs] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);

  const closeAll = () => {
    setShowTabs(false);
    setShowWorkflow(false);
    if (isUserMenuOpen) setIsUserMenuOpen(false);
    if (isExportMenuOpen) onToggleExportMenu();
  };

  const cardShell = (title: string, content: React.ReactNode, align: "left" | "center" = "left") => (
    <div
      className={`absolute ${align === "center" ? "left-1/2 -translate-x-1/2" : "left-0"} top-full mt-2 w-[320px] rounded-2xl border backdrop-blur text-[var(--text-primary)] overflow-hidden z-30`}
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "var(--bg-elevated)",
        boxShadow: "var(--shadow-strong)",
      }}
    >
      <div
        className="px-4 py-3 border-b text-xs uppercase tracking-wide text-[var(--text-secondary)]"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        {title}
      </div>
      {content}
    </div>
  );

  const episodesMenu = cardShell(
    "剧集目录",
    <EpisodeList
      episodes={workflow.episodes}
      currentEpIndex={workflow.currentEpIndex}
      onSelect={(idx) => {
        workflow.setCurrentEpIndex(idx);
        setShowWorkflow(false);
      }}
    />,
    "center"
  );

  return (
    <>
      {(showTabs || showWorkflow || isUserMenuOpen || isExportMenuOpen) && (
        <div className="fixed inset-0 z-20" onClick={closeAll} />
      )}
      <header className="pointer-events-none fixed top-0 left-0 right-0 z-40 px-8 pt-3">
        <div className="flex items-start justify-between gap-2.5 w-full mx-auto">
          <div className="pointer-events-auto">
            <div className="relative">
              <button
                onClick={() => setShowTabs((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)]/95 text-[var(--text-primary)] text-sm font-semibold shadow-[var(--shadow-soft)] backdrop-blur hover:border-[var(--accent-blue)]"
              >
                <span className="text-lg">💊</span>
                <span className="hidden sm:inline">eSheep · {currentTab.label}</span>
                <span className="sm:hidden">eSheep</span>
                <ChevronDown size={14} />
              </button>
              {showTabs && (
                <div
                  className="absolute left-0 top-full mt-2 w-72 rounded-2xl border backdrop-blur text-[var(--text-primary)] overflow-hidden z-30"
                  style={{
                    borderColor: "var(--border-subtle)",
                    backgroundColor: "var(--bg-elevated)",
                    boxShadow: "var(--shadow-strong)",
                  }}
                >
                  <div className="px-4 py-3 border-b text-xs uppercase tracking-wide text-[var(--text-secondary)]" style={{ borderColor: "var(--border-subtle)" }}>
                    视图切换
                  </div>
                  <div className="max-h-80 overflow-auto p-2 space-y-1">
                    {tabs.filter((t) => !t.hidden).map(({ key, label, icon: Icon }) => {
                      const isActive = key === activeTab;
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            onTabChange(key);
                            setShowTabs(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition border ${
                            isActive
                              ? "bg-[var(--accent-blue)]/12 border-[var(--accent-blue)]/40 text-[var(--text-primary)]"
                              : "border-transparent hover:bg-black/5 text-[var(--text-primary)]"
                          }`}
                        >
                          <span
                            className="h-8 w-8 rounded-lg flex items-center justify-center shadow-inner shadow-black/20"
                            style={{ backgroundColor: "var(--bg-muted)" }}
                          >
                            <Icon size={16} />
                          </span>
                          <div className="text-left">
                            <div className="font-semibold">eSheep · {label}</div>
                            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                              <span>Pill workspace</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pointer-events-auto">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)]/95 shadow-[var(--shadow-soft)] backdrop-blur max-w-6xl">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setShowWorkflow((v) => !v);
                  }}
                  className="relative h-9 w-9 flex items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] hover:border-[var(--accent-blue)] shadow-sm"
                  title="Workflow Actions"
                >
                  <Layers size={16} />
                  {showWorkflow && (
                    <div className="absolute left-0 top-full mt-2 z-30">
                      <WorkflowCard workflow={workflow} />
                    </div>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={onTryMe}
                  disabled={workflow.isProcessing}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#1c1c1f] to-[#121218] border border-[var(--border-subtle)] text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--accent-blue)] disabled:opacity-60"
                  title="Try a demo script"
                >
                  <Sparkles size={16} />
                  <span className="hidden sm:inline">Try Me</span>
                </button>

                {hasGeneratedShots && (
                  <div className="relative">
                    <button
                      onClick={onToggleExportMenu}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent-green)] hover:bg-emerald-500 text-sm font-semibold text-white shadow-sm"
                    >
                      <Download size={16} />
                      <span className="hidden sm:inline">Export</span>
                      <ChevronDown size={14} />
                    </button>
                    {isExportMenuOpen && (
                      <div
                        className="absolute right-0 mt-2 w-48 rounded-xl border backdrop-blur overflow-hidden z-30 text-[var(--text-primary)]"
                        style={{
                          borderColor: "var(--border-subtle)",
                          backgroundColor: "var(--bg-elevated)",
                          boxShadow: "var(--shadow-strong)",
                        }}
                      >
                        <button
                          onClick={onExportCsv}
                          className="w-full text-left px-4 py-3 hover:bg-black/5 text-sm border-b"
                          style={{ borderColor: "var(--border-subtle)" }}
                        >
                          Export CSV
                        </button>
                        <button
                          onClick={onExportXls}
                          className="w-full text-left px-4 py-3 hover:bg-black/5 text-sm"
                        >
                          Export XLS
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="relative min-w-[36px] min-h-[36px] flex items-center justify-center">
                  {!isLoaded ? (
                    <div className="w-9 h-9 rounded-full bg-gray-700 animate-pulse ring-2 ring-white/10" />
                  ) : (
                    <>
                      {!isSignedIn && (
                        <button
                          onClick={onSignIn}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] hover:border-[var(--accent-blue)] text-sm font-medium text-[var(--text-primary)] transition-colors"
                        >
                          <User size={16} /> <span className="hidden sm:inline">Sign In</span>
                        </button>
                      )}

                      {isSignedIn && user && (
                        <>
                          <button
                            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                            className="flex items-center justify-center rounded-full hover:ring-2 ring-indigo-500 transition-all relative z-30"
                          >
                            <img
                              src={avatarUrl || user.imageUrl}
                              alt="Profile"
                              className="w-9 h-9 rounded-full object-cover border border-[var(--border-subtle)] bg-[var(--bg-panel)]"
                            />
                          </button>

                          {isUserMenuOpen && (
                            <div
                              className="absolute right-0 top-full mt-2 w-72 rounded-2xl border backdrop-blur overflow-hidden z-30"
                              style={{
                                borderColor: "var(--border-subtle)",
                                backgroundColor: "var(--bg-elevated)",
                                boxShadow: "var(--shadow-strong)",
                              }}
                            >
                              <div
                                className="p-4 border-b"
                                style={{ borderColor: "var(--border-subtle)" }}
                              >
                                <div className="flex items-center gap-3 mb-3">
                                  <img
                                    src={user.imageUrl}
                                    alt="Profile"
                                    className="w-10 h-10 rounded-full object-cover border border-[var(--border-subtle)] shadow-sm"
                                  />
                                  <div className="overflow-hidden text-[var(--text-primary)]">
                                    <div className="font-bold truncate">
                                      {user.fullName || user.username}
                                    </div>
                                    <div className="text-xs text-[var(--text-secondary)] truncate">
                                      {user.primaryEmailAddress?.emailAddress}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 text-xs bg-indigo-900/30 text-indigo-200 px-3 py-1.5 rounded-lg border border-indigo-800">
                                  <Shield size={12} />
                                  <span>User Verified</span>
                                </div>
                              </div>

                              <div className="p-2 space-y-1 text-[var(--text-primary)]">
                                {onUploadAvatar && (
                                  <button
                                    onClick={() => {
                                      onUploadAvatar();
                                      setIsUserMenuOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 hover:bg-black/5 transition-colors"
                                  >
                                    <Upload size={16} />
                                    <span>Upload Avatar (Supabase)</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    onTabChange("stats");
                                    setIsUserMenuOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 hover:bg-black/5 transition-colors"
                                >
                                  <BarChart2 size={16} />
                                  <span>项目追踪仪表</span>
                                </button>

                                <button
                                  onClick={() => {
                                    onToggleTheme();
                                    setIsUserMenuOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 hover:bg-black/5 transition-colors"
                                >
                                  {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                                  <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
                                </button>

                                <button
                                  onClick={() => {
                                    onOpenSettings();
                                    setIsUserMenuOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 hover:bg-black/5 transition-colors"
                                >
                                  <Settings size={16} />
                                  <span>System Settings</span>
                                </button>

                                <div className="h-px my-1 mx-2" style={{ backgroundColor: "var(--border-subtle)" }} />

                                <button
                                  onClick={() => {
                                    onReset();
                                    setIsUserMenuOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 text-red-400 hover:bg-red-900/30 transition-colors"
                                >
                                  <Trash2 size={16} />
                                  <span>Clear Project Data</span>
                                </button>

                                <button
                                  onClick={() => {
                                    onSignOut();
                                    setIsUserMenuOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 text-[var(--text-secondary)] hover:bg-black/5 transition-colors"
                                >
                                  <LogOut size={16} />
                                  <span>Sign Out</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

    </>
  );
};
