import React from "react";
import { LockKeyhole, Map, Minus, Plus, UnlockKeyhole } from "lucide-react";

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
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center gap-2 h-10 px-3 rounded-full app-panel">
        {syncIndicator && (
          <button
            type="button"
            onClick={onOpenTheme}
            className="h-7 w-7 flex items-center justify-center"
            title={syncIndicator.label}
          >
            <span
              className="h-2.5 w-2.5 rounded-full block"
              style={{ backgroundColor: syncIndicator.color }}
            />
          </button>
        )}
        <button
          type="button"
          onClick={onToggleLock}
          className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-[var(--app-panel-muted)] transition"
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
          className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-[var(--app-panel-muted)] transition"
          title={showMiniMap ? "隐藏地图" : "显示地图"}
        >
          <Map size={14} className={showMiniMap ? "text-sky-300" : "text-sky-300/70"} />
        </button>
      </div>
      <div className="inline-flex items-center gap-2 h-10 px-3 rounded-full app-panel">
        <button
          type="button"
          onClick={handleMinus}
          className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-[var(--app-panel-muted)] transition disabled:opacity-40 disabled:cursor-not-allowed"
          title="缩小"
          disabled={isLocked}
        >
          <Minus size={14} className="text-[var(--app-text-secondary)]" />
        </button>
        <span className="text-xs font-semibold leading-none text-[var(--app-text-secondary)] tabular-nums px-1">
          {zoomPercent}%
        </span>
        <button
          type="button"
          onClick={handlePlus}
          className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-[var(--app-panel-muted)] transition disabled:opacity-40 disabled:cursor-not-allowed"
          title="放大"
          disabled={isLocked}
        >
          <Plus size={14} className="text-[var(--app-text-secondary)]" />
        </button>
      </div>
    </div>
  );
};
