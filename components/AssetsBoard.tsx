import React, { useMemo } from "react";
import { BookOpen, Film, Image, ListChecks, Sparkles, Trash2, X } from "lucide-react";
import { ProjectData } from "../types";
import { useWorkflowStore, GlobalAssetHistoryItem } from "../node-workspace/store/workflowStore";

interface Props {
  data: ProjectData;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;
}

export const AssetsBoard: React.FC<Props> = ({ data }) => {
  const { globalAssetHistory, removeGlobalHistoryItem, clearGlobalHistory } = useWorkflowStore();
  const imageAssets = useMemo(
    () => globalAssetHistory.filter((item) => item.type === "image"),
    [globalAssetHistory]
  );
  const videoAssets = useMemo(
    () => globalAssetHistory.filter((item) => item.type === "video"),
    [globalAssetHistory]
  );

  const GeneratedLibraryCard = ({
    title,
    desc,
    icon: Icon,
    items,
    toneClass,
    type,
  }: {
    title: string;
    desc: string;
    icon: any;
    items: GlobalAssetHistoryItem[];
    toneClass: string;
    type: "image" | "video";
  }) => (
    <div className="p-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)]/90 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[var(--bg-muted)]/60">
            <Icon size={22} className={toneClass} />
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--text-primary)]">{title}</div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              {items.length ? `${items.length} items · linked to history` : desc}
            </div>
          </div>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => clearGlobalHistory(type)}
            className="h-8 w-8 rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)] transition"
            title="Clear library"
          >
            <Trash2 size={14} className="mx-auto" />
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-[var(--border-subtle)]/70 bg-[var(--bg-panel)]/50 p-3 text-xs text-[var(--text-secondary)]">
          No generated {type === "image" ? "images" : "videos"} yet.
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {items.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-black/30"
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
                  className="absolute right-1 top-1 h-6 w-6 rounded-full border border-white/20 bg-black/50 text-white/70 opacity-0 transition group-hover:opacity-100 hover:text-white"
                  title="Remove"
                >
                  <X size={12} className="mx-auto" />
                </button>
              </div>
            ))}
          </div>
          {items.length > 4 && (
            <div className="mt-2 text-[10px] text-[var(--text-secondary)]">
              + {items.length - 4} more assets
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto px-8 pt-20 pb-12 bg-transparent text-[var(--text-primary)] transition-colors">
      <div className="max-w-6xl mx-auto space-y-12">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              <BookOpen size={16} /> Understanding Snapshot
            </div>
            <div className="text-xs text-[var(--text-secondary)]">Phase 1 结果预览</div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)] shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                <BookOpen size={16} /> 项目概览
              </div>
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed min-h-[64px]">
                {data.context.projectSummary || "尚未生成项目概览"}
              </p>
            </div>
            <div className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)] shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                <ListChecks size={16} /> 集梗概（横向滚动，避免超长）
              </div>
              {data.context.episodeSummaries?.length ? (
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
                  {data.context.episodeSummaries.map((s, idx) => (
                    <div
                      key={idx}
                      className="min-w-[220px] max-w-[260px] snap-start border border-[var(--border-subtle)] rounded-xl p-3 bg-[var(--bg-panel)]/70 shadow-[var(--shadow-soft)] text-sm text-[var(--text-secondary)] flex flex-col gap-2"
                    >
                      <div className="text-[var(--text-primary)] font-semibold">Ep {s.episodeId}</div>
                      <div className="text-xs leading-5 max-h-40 overflow-y-auto pr-1">
                        {s.summary}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">尚未生成集梗概</p>
              )}
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
              Generated Libraries
            </h3>
            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
              <Sparkles size={14} /> Linked to Node Lab history
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GeneratedLibraryCard
              title="Image Library"
              desc="Generated stills, references and concept frames."
              icon={Image}
              items={imageAssets}
              toneClass="text-blue-300"
              type="image"
            />
            <GeneratedLibraryCard
              title="Video Library"
              desc="Project videos and previews from generation."
              icon={Film}
              items={videoAssets}
              toneClass="text-green-300"
              type="video"
            />
          </div>
        </section>
      </div>
    </div>
  );
};
