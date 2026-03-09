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
    <div className="qalam-surface inline-flex items-center gap-1.5 rounded-full p-1.5">
      <div className="qalam-subtle-surface flex items-center gap-1 rounded-full p-1">
        {syncIndicator && (
          <button
            type="button"
            onClick={onOpenTheme}
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-[var(--app-text-secondary)] transition hover:bg-[var(--app-panel-muted)] hover:text-[var(--app-text-primary)] active:translate-y-px"
            title={syncIndicator.label}
          >
            <Palette size={14} />
            <span
              className="absolute right-[8px] top-[8px] h-2 w-2 rounded-full block ring-2"
              style={{ backgroundColor: syncIndicator.color, boxShadow: "0 0 0 3px var(--app-panel)" }}
            />
          </button>
        )}
        <button
          type="button"
          onClick={onToggleLock}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--app-text-secondary)] transition hover:bg-[var(--app-panel-muted)] hover:text-[var(--app-text-primary)] active:translate-y-px"
          title={isLocked ? "解锁画布" : "锁定画布"}
        >
          {isLocked ? (
            <LockKeyhole size={14} className="text-[var(--app-accent-strong)]" />
          ) : (
            <UnlockKeyhole size={14} className="text-[var(--app-accent-strong)]" />
          )}
        </button>
        <button
          type="button"
          onClick={onToggleMiniMap}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--app-text-secondary)] transition hover:bg-[var(--app-panel-muted)] hover:text-[var(--app-text-primary)] active:translate-y-px"
          title={showMiniMap ? "隐藏地图" : "显示地图"}
        >
          <Map size={14} className={showMiniMap ? "text-[var(--app-accent-strong)]" : "text-[var(--app-text-secondary)]"} />
        </button>
      </div>
      <div className="qalam-subtle-surface flex items-center gap-1 rounded-full p-1">
        <button
          type="button"
          onClick={handleMinus}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--app-text-secondary)] transition hover:bg-[var(--app-panel-muted)] hover:text-[var(--app-text-primary)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
          title="缩小"
          disabled={isLocked}
        >
          <Minus size={14} className="text-[var(--app-text-secondary)]" />
        </button>
        <button
          type="button"
          disabled
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-panel)]"
          title={`当前缩放 ${zoomPercent}%`}
        >
          <span
            className="block rounded-full bg-[var(--app-text-primary)] transition-all"
            style={{
              width: `${Math.max(7, Math.min(15, 7 + ((zoomPercent - minZoom * 100) / ((maxZoom - minZoom) * 100 || 1)) * 8))}px`,
              height: `${Math.max(7, Math.min(15, 7 + ((zoomPercent - minZoom * 100) / ((maxZoom - minZoom) * 100 || 1)) * 8))}px`,
              opacity: 0.82,
            }}
          />
        </button>
        <button
          type="button"
          onClick={handlePlus}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--app-text-secondary)] transition hover:bg-[var(--app-panel-muted)] hover:text-[var(--app-text-primary)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
          title="放大"
          disabled={isLocked}
        >
          <Plus size={14} className="text-[var(--app-text-secondary)]" />
        </button>
      </div>
    </div>
  );
};
