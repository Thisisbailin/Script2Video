import React, { useMemo, useState } from "react";
import { BookOpen, ListChecks } from "lucide-react";
import type { ProjectData } from "../../types";

type Props = {
  projectData: ProjectData;
};

type SectionKey = "overview" | "episodes";

export const UnderstandingPanel: React.FC<Props> = ({ projectData }) => {
  const [active, setActive] = useState<SectionKey>("overview");
  const summary = projectData.context.projectSummary?.trim() || "";
  const episodeSummaries = projectData.context.episodeSummaries || [];
  const episodeCount = projectData.episodes.length;
  const characterCount = projectData.context.characters?.length || 0;
  const sceneCount = useMemo(
    () =>
      projectData.episodes.reduce(
        (sum, episode) => sum + (episode.scenes?.length || 0),
        0
      ),
    [projectData.episodes]
  );

  const overviewCardClass = (isActive: boolean) =>
    `rounded-2xl border px-3 py-3 transition bg-[var(--app-panel-muted)] ${
      isActive
        ? "border-yellow-400/60 bg-yellow-500/10"
        : "border-[var(--app-border)] hover:border-[var(--app-border-strong)]"
    }`;

  return (
    <div className="space-y-4 text-[var(--app-text-primary)]">
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <div className="space-y-3">
          <div className={overviewCardClass(active === "overview")}>
            <button
              type="button"
              onClick={() => setActive("overview")}
              className="w-full text-left"
            >
              <div className="flex items-center gap-2 text-[12px] font-semibold">
                <BookOpen size={14} className="text-yellow-300" />
                Overview
              </div>
              <div className="text-[11px] text-[var(--app-text-secondary)] mt-1">
                {summary ? "Summary ready" : "No summary yet"}
              </div>
            </button>
          </div>

          <div className={overviewCardClass(active === "episodes")}>
            <button
              type="button"
              onClick={() => setActive("episodes")}
              className="w-full text-left"
            >
              <div className="flex items-center gap-2 text-[12px] font-semibold">
                <ListChecks size={14} className="text-emerald-300" />
                Episodes
              </div>
              <div className="text-[11px] text-[var(--app-text-secondary)] mt-1">
                {episodeSummaries.length} summaries
              </div>
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4 space-y-4">
          {active === "overview" ? (
            <>
              <div className="text-lg font-semibold">Project Summary</div>
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4 text-[13px] text-[var(--app-text-secondary)] whitespace-pre-wrap min-h-[120px]">
                {summary || "No summary generated yet."}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { label: "Episodes", value: episodeCount },
                  { label: "Characters", value: characterCount },
                  { label: "Scenes", value: sceneCount },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3"
                  >
                    <div className="text-[11px] text-[var(--app-text-secondary)] uppercase tracking-widest">
                      {item.label}
                    </div>
                    <div className="text-xl font-semibold mt-1">{item.value}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="text-lg font-semibold">Episode Summaries</div>
              {episodeSummaries.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {episodeSummaries.map((summaryItem) => (
                    <div
                      key={summaryItem.episodeId}
                      className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4 space-y-2"
                    >
                      <div className="text-[12px] font-semibold">
                        Episode {summaryItem.episodeId}
                      </div>
                      <div className="text-[12px] text-[var(--app-text-secondary)] leading-relaxed line-clamp-6">
                        {summaryItem.summary}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[12px] text-[var(--app-text-secondary)]">
                  No episode summaries yet.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
