import React, { useMemo, useState } from "react";
import { Film, Image as ImageIcon, ChevronDown, ChevronUp, Trash2, X, Sparkles } from "lucide-react";
import { useWorkflowStore } from "../store/workflowStore";

type FilterType = "all" | "image" | "video";

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export const GlobalImageHistory: React.FC = () => {
  const { globalAssetHistory, removeGlobalHistoryItem, clearGlobalHistory } = useWorkflowStore();
  const [collapsed, setCollapsed] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");

  const counts = useMemo(() => {
    const image = globalAssetHistory.filter((item) => item.type === "image").length;
    const video = globalAssetHistory.filter((item) => item.type === "video").length;
    return { image, video };
  }, [globalAssetHistory]);

  const filteredItems = useMemo(() => {
    if (filter === "all") return globalAssetHistory;
    return globalAssetHistory.filter((item) => item.type === filter);
  }, [filter, globalAssetHistory]);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 right-4 z-30 flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 bg-[#0d0f12]/90 text-white shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur"
      >
        <span className="flex items-center gap-1.5">
          <ImageIcon size={14} className="text-sky-300" />
          <Film size={14} className="text-emerald-300" />
        </span>
        <span className="text-xs font-semibold">
          {counts.image + counts.video} assets
        </span>
        <ChevronUp size={14} className="text-white/60" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-30 w-[360px] max-h-[70vh] overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d10]/95 text-white shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500/30 via-blue-500/10 to-transparent border border-white/10 flex items-center justify-center">
            <Sparkles size={16} className="text-sky-200" />
          </div>
          <div>
            <div className="text-sm font-semibold">Generated Assets</div>
            <div className="text-[11px] text-white/50">
              {counts.image} images · {counts.video} videos
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => clearGlobalHistory(filter === "all" ? undefined : filter)}
            className="h-8 w-8 rounded-full border border-white/10 hover:border-white/30 hover:bg-white/5 transition"
            title="Clear"
          >
            <Trash2 size={14} className="mx-auto text-white/60" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="h-8 w-8 rounded-full border border-white/10 hover:border-white/30 hover:bg-white/5 transition"
            title="Collapse"
          >
            <ChevronDown size={14} className="mx-auto text-white/70" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        {(["all", "image", "video"] as FilterType[]).map((key) => {
          const isActive = key === filter;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-full text-[11px] uppercase tracking-wide border transition ${isActive
                ? "bg-white/10 border-white/40 text-white"
                : "border-white/10 text-white/50 hover:border-white/30 hover:text-white"
                }`}
            >
              {key === "all" ? "All" : key === "image" ? "Images" : "Videos"}
            </button>
          );
        })}
      </div>

      <div className="px-3 pb-4 max-h-[50vh] overflow-y-auto space-y-2">
        {filteredItems.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-xs text-white/40">
            No assets in this view yet.
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="group flex gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30 transition"
            >
              <div className="relative w-20 h-16 rounded-lg overflow-hidden border border-white/10 bg-black/40 shrink-0">
                {item.type === "image" ? (
                  <img src={item.src} alt={item.prompt} className="w-full h-full object-cover" />
                ) : (
                  <video
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                    playsInline
                  >
                    <source src={item.src} />
                  </video>
                )}
                <div className="absolute left-1 top-1 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] uppercase tracking-widest">
                  {item.type === "image" ? <ImageIcon size={10} /> : <Film size={10} />}
                  {item.type}
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-xs font-semibold text-white truncate">
                  {item.prompt || "Untitled prompt"}
                </div>
                <div className="text-[10px] text-white/45 flex flex-wrap gap-2">
                  {item.model && <span>{item.model.split("/").pop()}</span>}
                  {item.aspectRatio && <span>{item.aspectRatio}</span>}
                  <span>{formatTime(item.timestamp)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeGlobalHistoryItem(item.id)}
                className="h-7 w-7 rounded-full border border-white/10 text-white/50 hover:text-white hover:border-white/30 hover:bg-white/10 transition opacity-0 group-hover:opacity-100"
                title="Remove"
              >
                <X size={12} className="mx-auto" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
