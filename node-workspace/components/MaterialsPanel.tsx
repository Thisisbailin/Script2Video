import React, { useMemo, useState } from "react";
import { Film, Image, Sparkles, Trash2, X } from "lucide-react";
import { useWorkflowStore, GlobalAssetHistoryItem } from "../store/workflowStore";

type SectionKey = "images" | "videos";

const SectionCard = ({
  active,
  title,
  subtitle,
  icon: Icon,
  tone,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  icon: any;
  tone: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full text-left rounded-2xl border px-3 py-3 transition bg-[var(--app-panel-muted)] ${
      active
        ? "border-blue-400/60 bg-blue-500/10"
        : "border-[var(--app-border)] hover:border-[var(--app-border-strong)]"
    }`}
  >
    <div className="flex items-center gap-2 text-[12px] font-semibold">
      <Icon size={14} className={tone} />
      {title}
    </div>
    <div className="text-[11px] text-[var(--app-text-secondary)] mt-1">{subtitle}</div>
  </button>
);

export const MaterialsPanel: React.FC = () => {
  const { globalAssetHistory, removeGlobalHistoryItem, clearGlobalHistory } = useWorkflowStore();
  const [active, setActive] = useState<SectionKey>("images");

  const imageAssets = useMemo(
    () => globalAssetHistory.filter((item) => item.type === "image"),
    [globalAssetHistory]
  );
  const videoAssets = useMemo(
    () => globalAssetHistory.filter((item) => item.type === "video"),
    [globalAssetHistory]
  );

  const activeItems = active === "images" ? imageAssets : videoAssets;
  const activeLabel = active === "images" ? "Images" : "Videos";

  const PreviewGrid = ({ items }: { items: GlobalAssetHistoryItem[] }) => {
    if (!items.length) {
      return (
        <div className="rounded-2xl border border-dashed border-[var(--app-border)] p-6 text-[12px] text-[var(--app-text-secondary)]">
          No generated {active} yet.
        </div>
      );
    }

    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--app-border)] bg-black/30"
            >
              {item.type === "image" ? (
                <img src={item.src} alt={item.prompt} className="h-full w-full object-cover" />
              ) : (
                <video className="h-full w-full object-cover" muted preload="metadata" playsInline>
                  <source src={item.src} />
                </video>
              )}
              <button
                type="button"
                onClick={() => removeGlobalHistoryItem(item.id)}
                className="absolute right-2 top-2 h-7 w-7 rounded-full border border-white/20 bg-black/50 text-white/70 opacity-0 transition group-hover:opacity-100 hover:text-white"
                title="Remove"
              >
                <X size={12} className="mx-auto" />
              </button>
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="space-y-4 text-[var(--app-text-primary)]">
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <div className="space-y-3">
          <SectionCard
            active={active === "images"}
            title="Images"
            subtitle={`${imageAssets.length} generated`}
            icon={Image}
            tone="text-sky-300"
            onClick={() => setActive("images")}
          />
          <SectionCard
            active={active === "videos"}
            title="Videos"
            subtitle={`${videoAssets.length} generated`}
            icon={Film}
            tone="text-emerald-300"
            onClick={() => setActive("videos")}
          />
        </div>

        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <Sparkles size={16} className="text-blue-200" />
              {activeLabel} Library
            </div>
            {activeItems.length > 0 && (
              <button
                type="button"
                onClick={() => clearGlobalHistory(active === "images" ? "image" : "video")}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] px-3 py-1 text-[11px] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:border-[var(--app-border-strong)] transition"
              >
                <Trash2 size={12} />
                Clear
              </button>
            )}
          </div>
          <PreviewGrid items={activeItems} />
        </div>
      </div>
    </div>
  );
};
