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
  PanelLeft,
} from "lucide-react";
import { ActiveTab, AnalysisSubStep, Episode, WorkflowStep, SyncState, SyncStatus } from "../../types";
import { isEpisodeSoraComplete } from "../../utils/episodes";

const PixelSheepIcon: React.FC<{ size?: number }> = ({ size = 32 }) => {
  const outline = "#1a1a1a";
  const wool = "#f5e6d4";
  const woolShade = "#e4cdb2";
  const hoof = "#2d2d2d";
  const ground = "#3f9a3f";
  const flower = "#e54b8c";

  const px = (fill: string, coords: Array<[number, number, number?, number?]>) =>
    coords.map(([x, y, w = 1, h = 1], i) => (
      <rect key={`${fill}-${i}-${x}-${y}`} x={x} y={y} width={w} height={h} fill={fill} />
    ));

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden
      className="shrink-0"
      shapeRendering="crispEdges"
    >
      {/* Wool fill */}
      {px(wool, [
        [19, 3, 2, 2],
        [18, 5, 4, 2],
        [17, 7, 5, 3],
        [16, 10, 6, 3],
        [15, 13, 7, 3],
        [14, 16, 8, 4],
        [13, 20, 8, 3],
        [12, 23, 8, 3],
        [11, 26, 9, 2],
        [11, 28, 4, 6],
        [16, 28, 3, 6],
        [20, 27, 3, 7],
        [24, 26, 3, 8],
        [10, 22, 2, 3], // tail root
        [9, 21, 1, 2],
      ])}

      {/* Wool shading */}
      {px(woolShade, [
        [20, 7, 2, 2],
        [19, 10, 3, 2],
        [18, 13, 4, 2],
        [17, 17, 4, 2],
        [16, 20, 4, 2],
        [15, 24, 3, 1],
        [21, 24, 3, 1],
        [12, 28, 2, 2],
        [21, 28, 2, 2],
      ])}

      {/* Hooves */}
      {px(hoof, [
        [11, 34, 3, 1],
        [16, 34, 3, 1],
        [20, 34, 3, 1],
        [24, 34, 3, 1],
      ])}

      {/* Face features */}
      {px(outline, [
        [21, 9, 1, 2], // eye
        [23, 9, 1, 2], // eye
        [22, 12, 1, 1], // nose
        [22, 13, 1, 1],
      ])}

      {/* Outline path */}
      <path
        d="M18 2h3v1h2v2h2v2h1v3h1v3h1v3h1v3h-1v2h-1v2h-2v3h-2v3h-2v3h-3v2h-3v-2h-2v-3h-2v-3h-2v-3h-1v-3h-1v-3l1-2h1v-2h1v-3h1v-3h2v-3h2v-2h2v-2h2Z"
        fill="none"
        stroke={outline}
        strokeWidth={1}
        shapeRendering="crispEdges"
      />

      {/* Tail outline */}
      <path
        d="M9 21h1v2h1v2h-2v-1H8v-2h1Z"
        fill="none"
        stroke={outline}
        strokeWidth={1}
        shapeRendering="crispEdges"
      />

      {/* Ground + small flower */}
      {px(ground, [[8, 35, 22, 2]])}
      {px(flower, [
        [10, 34, 1, 1],
        [26, 34, 1, 1],
      ])}
    </svg>
  );
};

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
  sync: {
    state: SyncState;
    isOnline: boolean;
  };
  splitView: {
    currentSplitTab: ActiveTab | null;
    isOpen: boolean;
    onToggle: () => void;
    onSelect: (tab: ActiveTab | null) => void;
    onClose: () => void;
  };
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
  sync,
  splitView,
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
  const [showTryInfo, setShowTryInfo] = useState(false);
  const formatSyncTime = (ts?: number) => (ts ? new Date(ts).toLocaleTimeString() : "—");
  const statusLabel = (status: SyncStatus) => {
    switch (status) {
      case "synced":
        return "已同步";
      case "syncing":
        return "同步中";
      case "loading":
        return "加载中";
      case "conflict":
        return "冲突";
      case "error":
        return "错误";
      case "offline":
        return "离线";
      case "disabled":
        return "仅本地";
      case "idle":
      default:
        return "就绪";
    }
  };
  const statusMeta = (status: SyncStatus) => {
    switch (status) {
      case "synced":
        return { label: statusLabel(status), dot: "bg-emerald-400" };
      case "syncing":
      case "loading":
        return { label: statusLabel(status), dot: "bg-sky-400", pulse: true };
      case "conflict":
        return { label: statusLabel(status), dot: "bg-amber-400" };
      case "error":
        return { label: statusLabel(status), dot: "bg-rose-400" };
      case "offline":
        return { label: statusLabel(status), dot: "bg-slate-400" };
      case "disabled":
        return { label: statusLabel(status), dot: "bg-slate-400" };
      case "idle":
      default:
        return { label: statusLabel(status), dot: "bg-slate-300" };
    }
  };
  const aggregateStatus = useMemo(() => {
    if (!sync.isOnline) return "offline";
    const statuses = [sync.state.project.status, sync.state.secrets.status].filter((s) => s !== "disabled");
    if (statuses.length === 0) return "disabled";
    if (statuses.includes("error")) return "error";
    if (statuses.includes("conflict")) return "conflict";
    if (statuses.includes("syncing")) return "syncing";
    if (statuses.includes("loading")) return "loading";
    if (statuses.includes("idle")) return "idle";
    return "synced";
  }, [sync]);
  const syncTooltip = useMemo(() => {
    const projectInfo = `项目: ${statusLabel(sync.state.project.status)}${sync.state.project.lastSyncAt ? ` @ ${formatSyncTime(sync.state.project.lastSyncAt)}` : ""}`;
    const secretsInfo = `密钥: ${statusLabel(sync.state.secrets.status)}${sync.state.secrets.lastSyncAt ? ` @ ${formatSyncTime(sync.state.secrets.lastSyncAt)}` : ""}`;
    const networkInfo = sync.isOnline ? "" : "网络: 离线";
    return [networkInfo, projectInfo, secretsInfo].filter(Boolean).join(" · ");
  }, [sync]);
  const syncDisplay = statusMeta(aggregateStatus);

  const pillTriggerClasses = (isActive = false) =>
    `flex h-12 items-center gap-2 px-4 rounded-full bg-[var(--bg-panel)]/95 text-[var(--text-primary)] text-sm font-semibold shadow-[0_6px_16px_rgba(0,0,0,0.08)] transition-transform duration-150 hover:scale-105 hover:shadow-[0_8px_20px_rgba(0,0,0,0.1)] ${
      isActive ? "scale-105 shadow-[0_8px_20px_rgba(0,0,0,0.12)]" : ""
    }`;

  const iconButtonClasses = (isActive = false) =>
    `relative h-10 w-10 flex items-center justify-center rounded-full text-[var(--text-primary)] transition-transform duration-150 hover:scale-105 ${
      isActive ? "scale-105" : ""
    }`;

  const closeAll = () => {
    setShowTabs(false);
    setShowWorkflow(false);
    setShowTryInfo(false);
    splitView.onClose();
    if (isUserMenuOpen) setIsUserMenuOpen(false);
    if (isExportMenuOpen) onToggleExportMenu();
  };

  const toggleTabs = () => {
    setShowWorkflow(false);
    setShowTryInfo(false);
    splitView.onClose();
    if (isUserMenuOpen) setIsUserMenuOpen(false);
    if (isExportMenuOpen) onToggleExportMenu();
    setShowTabs((v) => !v);
  };

  const toggleWorkflow = () => {
    setShowTabs(false);
    setShowTryInfo(false);
    splitView.onClose();
    if (isUserMenuOpen) setIsUserMenuOpen(false);
    if (isExportMenuOpen) onToggleExportMenu();
    setShowWorkflow((v) => !v);
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
      {(showTabs || showWorkflow || isUserMenuOpen || isExportMenuOpen || showTryInfo || splitView.isOpen) && (
        <div className="fixed inset-0 z-20" onClick={closeAll} />
      )}
      <header className="pointer-events-none fixed top-0 left-0 right-0 z-40 px-4 sm:px-6 pt-3">
        <div className="flex items-start justify-between gap-2.5 w-full max-w-6xl mx-auto">
          <div className="pointer-events-auto">
            <div className="relative">
              <button
                onClick={toggleTabs}
                className={`${pillTriggerClasses(showTabs)} backdrop-blur`}
                aria-pressed={showTabs}
                style={{ boxShadow: "0 6px 16px rgba(0,0,0,0.08)" }}
              >
                <PixelSheepIcon size={20} />
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
                            className="h-8 w-8 rounded-lg flex items-center justify-center"
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
            <div
              className="flex h-12 items-center gap-1.5 px-4 rounded-full bg-[var(--bg-panel)]/95 backdrop-blur max-w-6xl"
              style={{ boxShadow: "0 6px 16px rgba(0,0,0,0.08)" }}
            >
              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleWorkflow}
                  className={iconButtonClasses(showWorkflow)}
                  aria-pressed={showWorkflow}
                  title="Workflow Actions"
                >
                  <Layers size={18} />
                  {showWorkflow && (
                    <div className="absolute right-0 top-full mt-2 z-30 w-[360px] max-w-[calc(100vw-24px)]">
                      <WorkflowCard workflow={workflow} />
                    </div>
                  )}
                </button>
              </div>

              <div
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-muted)]/70 text-xs text-[var(--text-secondary)]"
                title={syncTooltip}
              >
                <span className={`h-2 w-2 rounded-full ${syncDisplay.dot} ${syncDisplay.pulse ? "animate-pulse" : ""}`} />
                <span className="text-[var(--text-primary)] font-semibold">云端同步 · {syncDisplay.label}</span>
              </div>

              <div className="relative">
                <button
                  onClick={() => {
                    setShowTabs(false);
                    setShowWorkflow(false);
                    setShowTryInfo(false);
                    if (isExportMenuOpen) onToggleExportMenu();
                    if (isUserMenuOpen) setIsUserMenuOpen(false);
                    splitView.onToggle();
                  }}
                  className={iconButtonClasses(splitView.isOpen)}
                  aria-pressed={splitView.isOpen}
                  title="分屏查看"
                >
                  <PanelLeft size={18} />
                </button>
                {splitView.isOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-72 rounded-2xl border backdrop-blur text-[var(--text-primary)] overflow-hidden z-30"
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
                      选择并列标签页
                    </div>
                    <div className="p-2 space-y-1">
                      {splitView.currentSplitTab && (
                        <button
                          onClick={() => splitView.onSelect(null)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-red-300 hover:bg-red-900/30 transition"
                        >
                          关闭分屏
                        </button>
                      )}
                      {tabs
                        .filter((t) => !t.hidden && t.key !== activeTab)
                        .map(({ key, label, icon: Icon }) => {
                          const isActiveSplit = splitView.currentSplitTab === key;
                          return (
                            <button
                              key={key}
                              onClick={() => splitView.onSelect(key)}
                              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition border ${
                                isActiveSplit
                                  ? "bg-[var(--accent-blue)]/12 border-[var(--accent-blue)]/40 text-[var(--text-primary)]"
                                  : "border-transparent hover:bg-black/5 text-[var(--text-primary)]"
                              }`}
                            >
                              <span
                                className="h-8 w-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: "var(--bg-muted)" }}
                              >
                                <Icon size={16} />
                              </span>
                              <div className="text-left">
                                <div className="font-semibold">与当前并列：{label}</div>
                                <div className="text-[11px] text-[var(--text-secondary)]">
                                  左右分屏查看
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      {!tabs.filter((t) => !t.hidden && t.key !== activeTab).length && (
                        <div className="text-xs text-[var(--text-secondary)] px-2 py-3">
                          没有可分屏的标签页
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowTryInfo((v) => !v);
                      setShowWorkflow(false);
                      setShowTabs(false);
                      splitView.onClose();
                      if (isExportMenuOpen) onToggleExportMenu();
                      if (isUserMenuOpen) setIsUserMenuOpen(false);
                    }}
                    disabled={workflow.isProcessing}
                    className={iconButtonClasses(showTryInfo)}
                    aria-pressed={showTryInfo}
                    title="Try a demo script"
                  >
                    <Sparkles size={20} />
                  </button>
                  {showTryInfo && (
                    <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-[var(--shadow-strong)] backdrop-blur text-[var(--text-primary)] z-30 p-4 space-y-3">
                      <div className="text-sm font-semibold">尝试示例</div>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        载入内置示例项目并自动填充脚本、镜头与 Node Lab 节点，方便快速体验整体流程。
                      </p>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setShowTryInfo(false)}
                          className="px-3 py-1.5 rounded-lg text-xs border border-[var(--border-subtle)] hover:bg-black/5"
                        >
                          关闭
                        </button>
                        <button
                          onClick={() => {
                            setShowTryInfo(false);
                            onTryMe();
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs bg-[var(--accent-blue)] text-white hover:bg-sky-500"
                        >
                          载入示例
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {hasGeneratedShots && (
                  <div className="relative">
                    <button
                      onClick={onToggleExportMenu}
                      className={iconButtonClasses(isExportMenuOpen)}
                      aria-pressed={isExportMenuOpen}
                      title="导出"
                    >
                      <Download size={20} />
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
