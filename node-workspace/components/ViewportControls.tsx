import React from "react";
import { LockKeyhole, Map, Minus, Palette, Plus, UnlockKeyhole } from "lucide-react";

type Props = {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onZoomChange: (value: number) => void;
  isLocked: boolean;
  onToggleLock: () => void;
  showMiniMap: boolean;
  onToggleMiniMap: () => void;
  syncIndicator?: { label: string; color: string } | null;
  onOpenTheme?: () => void;
};

export const ViewportControls: React.FC<Props> = ({
  zoom,
  minZoom,
  maxZoom,
  onZoomChange,
  isLocked,
  onToggleLock,
  showMiniMap,
  onToggleMiniMap,
  syncIndicator,
  onOpenTheme,
}) => {
  const zoomPercent = Math.round(zoom * 100);
  const step = 0.25;

  const clamp = (value: number) => Math.min(maxZoom, Math.max(minZoom, value));
  const handleMinus = () => onZoomChange(clamp(zoom - step));
  const handlePlus = () => onZoomChange(clamp(zoom + step));

  return (
    <div className="inline-flex items-center gap-2 rounded-[22px] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(18,22,27,0.88),rgba(11,14,18,0.94))] p-2 shadow-[0_16px_32px_-24px_rgba(0,0,0,0.82)] backdrop-blur-xl">
      <div className="flex items-center gap-1 rounded-[16px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.03)] p-1">
        {syncIndicator && (
          <button
            type="button"
            onClick={onOpenTheme}
            className="group flex h-9 items-center gap-2 rounded-[12px] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-text-secondary)] transition hover:bg-[var(--app-panel-muted)] hover:text-[var(--app-text-primary)] active:translate-y-px"
            title={syncIndicator.label}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-[10px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] text-[var(--app-text-primary)]">
              <Palette size={13} />
            </span>
            <span
              className="h-2.5 w-2.5 rounded-full block"
              style={{ backgroundColor: syncIndicator.color }}
            />
            <span className="leading-none">Theme</span>
          </button>
        )}
        <button
          type="button"
          onClick={onToggleLock}
          className="flex h-9 w-9 items-center justify-center rounded-[12px] transition hover:bg-[var(--app-panel-muted)] active:translate-y-px"
          title={isLocked ? "解锁画布" : "锁定画布"}
        >
          {isLocked ? (
            <LockKeyhole size={14} className="text-amber-300" />
          ) : (
            <UnlockKeyhole size={14} className="text-amber-300" />
          )}
        </button>
        <button
          type="button"
          onClick={onToggleMiniMap}
          className="flex h-9 w-9 items-center justify-center rounded-[12px] transition hover:bg-[var(--app-panel-muted)] active:translate-y-px"
          title={showMiniMap ? "隐藏地图" : "显示地图"}
        >
          <Map size={14} className={showMiniMap ? "text-sky-300" : "text-sky-300/70"} />
        </button>
      </div>
      <div className="flex items-center gap-1 rounded-[16px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.03)] p-1">
        <button
          type="button"
          onClick={handleMinus}
          className="flex h-9 w-9 items-center justify-center rounded-[12px] transition hover:bg-[var(--app-panel-muted)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
          title="缩小"
          disabled={isLocked}
        >
          <Minus size={14} className="text-[var(--app-text-secondary)]" />
        </button>
        <div className="min-w-[68px] px-2 text-center">
          <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-muted)]">Zoom</div>
          <div className="mt-0.5 text-[12px] font-semibold leading-none text-[var(--app-text-primary)] tabular-nums">{zoomPercent}%</div>
        </div>
        <button
          type="button"
          onClick={handlePlus}
          className="flex h-9 w-9 items-center justify-center rounded-[12px] transition hover:bg-[var(--app-panel-muted)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
          title="放大"
          disabled={isLocked}
        >
          <Plus size={14} className="text-[var(--app-text-secondary)]" />
        </button>
      </div>
    </div>
  );
};
