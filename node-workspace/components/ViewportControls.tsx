import React from "react";
import { Lock, MapPinned, MapPinOff, Unlock } from "lucide-react";

type Props = {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onZoomChange: (value: number) => void;
  isLocked: boolean;
  onToggleLock: () => void;
  showMiniMap: boolean;
  onToggleMiniMap: () => void;
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
}) => {
  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-full border border-white/10 bg-[#0d0f12]/90 text-white shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleLock}
          className="h-7 w-7 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition flex items-center justify-center"
          title={isLocked ? "解锁画布" : "锁定画布"}
        >
          {isLocked ? (
            <Lock size={14} className="text-amber-300" />
          ) : (
            <Unlock size={14} className="text-amber-300" />
          )}
        </button>
        <button
          type="button"
          onClick={onToggleMiniMap}
          className="h-7 w-7 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition flex items-center justify-center"
          title={showMiniMap ? "隐藏地图" : "显示地图"}
        >
          {showMiniMap ? (
            <MapPinned size={14} className="text-sky-300" />
          ) : (
            <MapPinOff size={14} className="text-sky-300" />
          )}
        </button>
      </div>
      <div className="h-6 w-px bg-white/10" />
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={minZoom}
          max={maxZoom}
          step={0.05}
          value={zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          className="viewport-slider"
          disabled={isLocked}
        />
        <span className="text-[10px] text-white/60 tabular-nums w-10 text-right">
          {zoomPercent}%
        </span>
      </div>
    </div>
  );
};
