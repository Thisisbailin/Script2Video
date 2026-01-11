import React, { useMemo } from "react";
import { AlertCircle, CloudOff, Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { SyncState, SyncStatus } from "../types";

type Props = {
  syncState: SyncState;
  isOnline: boolean;
  isSignedIn: boolean;
  syncRollout?: { enabled: boolean; percent: number; allowlisted?: boolean };
  onOpenDetails?: () => void;
  onForceSync?: () => void;
};

const formatTime = (ts?: number) => (ts ? new Date(ts).toLocaleTimeString() : "—");

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
    case "syncing":
    case "loading":
      return { label: statusLabel(status), tone: "sky", icon: Loader2 };
    case "conflict":
      return { label: "同步冲突", tone: "amber", icon: AlertCircle };
    case "error":
      return { label: "同步失败", tone: "rose", icon: AlertCircle };
    case "offline":
      return { label: "离线", tone: "slate", icon: CloudOff };
    case "disabled":
      return { label: "仅本地", tone: "slate", icon: ShieldAlert };
    case "synced":
      return { label: "已同步", tone: "emerald", icon: CheckCircle2 };
    case "idle":
    default:
      return { label: "就绪", tone: "slate", icon: CheckCircle2 };
  }
};

const toneClasses = (tone: string) => {
  switch (tone) {
    case "sky":
      return "border-sky-400/60 bg-sky-900/10";
    case "amber":
      return "border-amber-400/60 bg-amber-900/10";
    case "rose":
      return "border-rose-400/60 bg-rose-900/10";
    case "emerald":
      return "border-emerald-400/60 bg-emerald-900/10";
    case "slate":
    default:
      return "border-slate-400/60 bg-slate-900/10";
  }
};

export const SyncStatusBanner: React.FC<Props> = ({
  syncState,
  isOnline,
  isSignedIn,
  syncRollout,
  onOpenDetails,
  onForceSync
}) => {
  const project = syncState.project;
  const secrets = syncState.secrets;
  const pendingOps = (project.pendingOps ?? 0) + (secrets.pendingOps ?? 0);
  const retryCount = (project.retryCount ?? 0) + (secrets.retryCount ?? 0);
  const lastAttemptAt = Math.max(project.lastAttemptAt ?? 0, secrets.lastAttemptAt ?? 0) || undefined;
  const lastSyncAt = Math.max(project.lastSyncAt ?? 0, secrets.lastSyncAt ?? 0) || undefined;
  const lastError = project.lastError || secrets.lastError;
  const rolloutDisabled = !!syncRollout && !syncRollout.enabled;
  const canForceSync = isOnline && !rolloutDisabled;

  const aggregateStatus = useMemo<SyncStatus>(() => {
    if (!isOnline) return "offline";
    const statuses = [project.status, secrets.status].filter((s) => s !== "disabled");
    if (statuses.length === 0) return "disabled";
    if (statuses.includes("error")) return "error";
    if (statuses.includes("conflict")) return "conflict";
    if (statuses.includes("syncing")) return "syncing";
    if (statuses.includes("loading")) return "loading";
    if (statuses.includes("idle")) return "idle";
    return "synced";
  }, [isOnline, project.status, secrets.status]);

  const shouldShow = useMemo(() => {
    if (!isSignedIn) return false;
    if (rolloutDisabled) return true;
    if (!isOnline) return true;
    if (["syncing", "loading", "conflict", "error"].includes(aggregateStatus)) return true;
    if (pendingOps > 0 || retryCount > 0) return true;
    return false;
  }, [aggregateStatus, isOnline, isSignedIn, pendingOps, retryCount, rolloutDisabled]);

  if (!shouldShow) return null;

  const effectiveStatus: SyncStatus = rolloutDisabled ? "disabled" : aggregateStatus;
  const meta = statusMeta(effectiveStatus);
  const Icon = meta.icon;

  const detailParts: string[] = [];
  if (rolloutDisabled && syncRollout) {
    detailParts.push(`灰度发布 ${syncRollout.percent}% · 当前账号未启用`);
  }
  detailParts.push(`项目: ${statusLabel(project.status)}`);
  detailParts.push(`密钥: ${statusLabel(secrets.status)}`);
  if (pendingOps > 0) detailParts.push(`待发送: ${pendingOps}`);
  if (retryCount > 0) detailParts.push(`重试: ${retryCount}`);
  if (lastSyncAt) detailParts.push(`上次成功: ${formatTime(lastSyncAt)}`);
  if (lastAttemptAt) detailParts.push(`最近尝试: ${formatTime(lastAttemptAt)}`);
  if (lastError) detailParts.push(`错误: ${lastError}`);

  const accent =
    meta.tone === "emerald"
      ? "text-emerald-300"
      : meta.tone === "sky"
      ? "text-sky-300"
      : meta.tone === "amber"
      ? "text-amber-300"
      : meta.tone === "rose"
      ? "text-rose-300"
      : "text-white/70";

  return (
    <div className="pointer-events-none fixed bottom-24 right-6 z-50">
      <div className="pointer-events-auto max-w-lg rounded-3xl border border-white/12 bg-[#0d0f12]/92 px-4 py-3 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full border border-white/10 bg-white/6 flex items-center justify-center">
            <Icon className={`h-4 w-4 ${["同步中", "加载中"].includes(meta.label) ? "animate-spin" : ""} ${accent}`} />
          </div>
          <div className="flex-1 space-y-2">
            <div className="text-sm font-semibold text-white">{meta.label}</div>
            <div className="text-xs text-white/65 leading-relaxed">
              {detailParts.join(" · ")}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {onForceSync && canForceSync && (
                <button
                  onClick={onForceSync}
                  className="px-3 py-1.5 rounded-full text-[12px] border border-white/12 bg-white/6 text-white/85 hover:border-emerald-300 hover:bg-emerald-500/10 hover:text-white transition"
                >
                  立即同步
                </button>
              )}
              {onOpenDetails && (
                <button
                  onClick={onOpenDetails}
                  className="px-3 py-1.5 rounded-full text-[12px] bg-[var(--accent-blue)] text-white hover:bg-sky-500 transition shadow-[0_10px_30px_rgba(56,189,248,0.25)]"
                >
                  查看详情
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
