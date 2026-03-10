import React, { useMemo } from "react";
import { BookOpen, Clapperboard } from "lucide-react";
import { BaseNode } from "./BaseNode";
import { ScriptBoardNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";

type Props = {
  id: string;
  data: ScriptBoardNodeData;
};

export const ScriptBoardNode: React.FC<Props & { selected?: boolean }> = ({ id, data, selected }) => {
  const { updateNodeData, labContext } = useWorkflowStore();
  const episodes = labContext.episodes || [];

  const episode = useMemo(() => {
    return episodes.find((item) => item.id === data.episodeId) ?? episodes[0] ?? null;
  }, [data.episodeId, episodes]);

  const sceneBlocks = useMemo(() => {
    if (!episode) return [];
    if (episode.scenes?.length) return episode.scenes;
    return [
      {
        id: `episode-${episode.id}`,
        title: episode.title || `第 ${episode.id} 集`,
        content: episode.content || "",
        partition: "",
        timeOfDay: "",
        location: "",
      },
    ];
  }, [episode]);

  const handleEpisodeSelect = (episodeId: number) => {
    updateNodeData(id, {
      episodeId,
      sceneId: undefined,
    });
  };

  return (
    <BaseNode title={data.title || "剧本面板节点"} outputs={["text"]} selected={selected}>
      <div className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--node-border)] pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--node-border)] bg-[var(--node-surface-strong)] text-[var(--node-accent)]">
              <BookOpen size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold tracking-[-0.02em] text-[var(--node-text-primary)]">
                {data.title || "剧本面板节点"}
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--node-text-secondary)]">
                Episode / Scene Reader
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--node-text-secondary)]">
            <span className="rounded-full border border-[var(--node-border)] px-2.5 py-1">{episode ? `${sceneBlocks.length} scene blocks` : "No script"}</span>
            {episode ? (
              <span className="rounded-full border border-[var(--node-border)] px-2.5 py-1">{episode.shots.length} shots</span>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {episodes.map((item) => {
            const active = item.id === episode?.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleEpisodeSelect(item.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                  active
                    ? "border-[var(--node-accent)] bg-[var(--node-surface-strong)] text-[var(--node-text-primary)]"
                    : "border-[var(--node-border)] text-[var(--node-text-secondary)] hover:border-[var(--node-border-strong)]"
                }`}
              >
                第 {item.id} 集
              </button>
            );
          })}
        </div>

        {episode ? (
          <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-[var(--node-border)] bg-[var(--node-surface)]/70">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--node-border)] px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <Clapperboard size={14} className="text-[var(--node-text-secondary)]" />
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--node-text-secondary)]">
                  Episode Script Blocks
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--node-text-secondary)]">
                {episode.title || `第 ${episode.id} 集`}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {sceneBlocks.map((scene, index) => {
                const isFocused = data.sceneId ? data.sceneId === scene.id : false;
                return (
                  <section
                    key={scene.id}
                    className={`rounded-[22px] border px-4 py-4 transition ${
                      isFocused
                        ? "border-[var(--node-accent)] bg-[var(--node-surface-strong)]/90"
                        : "border-[var(--node-border)] bg-[var(--app-panel-muted)]/30"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => updateNodeData(id, { episodeId: episode.id, sceneId: scene.id })}
                      className="flex w-full items-start justify-between gap-3 text-left"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--node-text-secondary)]">
                          <span>Scene {index + 1}</span>
                          <span>{scene.id}</span>
                        </div>
                        <div className="mt-2 text-[16px] font-semibold tracking-[-0.02em] text-[var(--node-text-primary)]">
                          {scene.title || "未命名场景"}
                        </div>
                      </div>
                      <div className="shrink-0 rounded-full border border-[var(--node-border)] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--node-text-secondary)]">
                        {isFocused ? "Focused" : "Focus"}
                      </div>
                    </button>

                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em] text-[var(--node-text-secondary)]">
                      {scene.location ? <span className="rounded-full border border-[var(--node-border)] px-2.5 py-1">{scene.location}</span> : null}
                      {scene.timeOfDay ? <span className="rounded-full border border-[var(--node-border)] px-2.5 py-1">{scene.timeOfDay}</span> : null}
                      {scene.partition ? <span className="rounded-full border border-[var(--node-border)] px-2.5 py-1">{scene.partition}</span> : null}
                    </div>

                    <div className="mt-4 rounded-[18px] border border-[var(--node-border)] bg-[var(--node-surface)]/80 px-4 py-4">
                      <pre className="whitespace-pre-wrap break-words font-sans text-[12px] leading-7 text-[var(--node-text-primary)]">
                        {scene.content || "当前场景还没有正文内容。"}
                      </pre>
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-1 items-center justify-center rounded-[24px] border border-dashed border-[var(--node-border)] text-[12px] text-[var(--node-text-secondary)]">
            当前项目还没有可展示的剧本内容。
          </div>
        )}
      </div>
    </BaseNode>
  );
};
