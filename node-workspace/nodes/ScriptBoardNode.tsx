import React, { useMemo } from "react";
import { BookOpen, Clapperboard, FileText } from "lucide-react";
import { BaseNode } from "./BaseNode";
import { ScriptBoardNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";

type Props = {
  id: string;
  data: ScriptBoardNodeData;
};

const shorten = (value: string, limit = 220) => {
  const safe = value.trim();
  if (safe.length <= limit) return safe;
  return `${safe.slice(0, limit)}...`;
};

export const ScriptBoardNode: React.FC<Props & { selected?: boolean }> = ({ id, data, selected }) => {
  const { updateNodeData, labContext } = useWorkflowStore();
  const episodes = labContext.episodes || [];
  const episodeSummaries = labContext.context.episodeSummaries || [];

  const episode = useMemo(() => {
    return episodes.find((item) => item.id === data.episodeId) ?? episodes[0] ?? null;
  }, [data.episodeId, episodes]);

  const activeScene = useMemo(() => {
    if (!episode) return null;
    return episode.scenes.find((item) => item.id === data.sceneId) ?? episode.scenes[0] ?? null;
  }, [data.sceneId, episode]);

  const summary = useMemo(() => {
    if (!episode) return "";
    return episodeSummaries.find((item) => item.episodeId === episode.id)?.summary || episode.summary || "";
  }, [episode, episodeSummaries]);

  const handleEpisodeSelect = (episodeId: number) => {
    const nextEpisode = episodes.find((item) => item.id === episodeId);
    updateNodeData(id, {
      episodeId,
      sceneId: nextEpisode?.scenes[0]?.id,
    });
  };

  return (
    <BaseNode title={data.title || "剧本面板节点"} outputs={["text"]} selected={selected}>
      <div className="flex h-full min-h-0 flex-col">
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
            <span className="rounded-full border border-[var(--node-border)] px-2.5 py-1">
              {episode ? `${episode.scenes.length} 场` : "No script"}
            </span>
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
          <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[188px_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col rounded-[24px] border border-[var(--node-border)] bg-[var(--node-surface)]/70">
              <div className="flex items-center justify-between border-b border-[var(--node-border)] px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--node-text-secondary)]">
                  Scene Index
                </div>
                <Clapperboard size={14} className="text-[var(--node-text-secondary)]" />
              </div>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                {(episode.scenes || []).map((scene, index) => {
                  const isActive = scene.id === activeScene?.id;
                  return (
                    <button
                      key={scene.id}
                      type="button"
                      onClick={() => updateNodeData(id, { episodeId: episode.id, sceneId: scene.id })}
                      className={`w-full rounded-[18px] border px-3 py-2 text-left transition ${
                        isActive
                          ? "border-[var(--node-accent)] bg-[var(--node-surface-strong)] text-[var(--node-text-primary)]"
                          : "border-transparent text-[var(--node-text-secondary)] hover:border-[var(--node-border)] hover:bg-[var(--node-surface)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase tracking-[0.18em] opacity-70">#{index + 1}</span>
                        <span className="text-[10px] uppercase tracking-[0.16em] opacity-60">{scene.id}</span>
                      </div>
                      <div className="mt-1 line-clamp-2 text-[12px] font-medium leading-5">
                        {scene.title || "未命名场景"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--node-border)] bg-[var(--node-surface)]/70">
              <div className="grid gap-3 border-b border-[var(--node-border)] px-4 py-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--node-text-secondary)]">
                    <FileText size={12} />
                    Active Scene
                  </div>
                  <div className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-[var(--node-text-primary)]">
                    {activeScene?.title || episode.title}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em] text-[var(--node-text-secondary)]">
                    {activeScene?.id ? <span className="rounded-full border border-[var(--node-border)] px-2.5 py-1">{activeScene.id}</span> : null}
                    {activeScene?.location ? <span className="rounded-full border border-[var(--node-border)] px-2.5 py-1">{activeScene.location}</span> : null}
                    {activeScene?.timeOfDay ? <span className="rounded-full border border-[var(--node-border)] px-2.5 py-1">{activeScene.timeOfDay}</span> : null}
                    {activeScene?.partition ? <span className="rounded-full border border-[var(--node-border)] px-2.5 py-1">{activeScene.partition}</span> : null}
                  </div>
                </div>
                <div className="rounded-[20px] border border-[var(--node-border)] bg-[var(--node-surface-strong)] px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--node-text-secondary)]">Episode Note</div>
                  <div className="mt-2 text-[12px] leading-6 text-[var(--node-text-primary)]">
                    {summary ? shorten(summary) : "这一集还没有生成摘要。"}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <div className="rounded-[22px] border border-[var(--node-border)] bg-[var(--app-panel-muted)]/40 px-5 py-4">
                  <pre className="whitespace-pre-wrap break-words font-sans text-[12px] leading-7 text-[var(--node-text-primary)]">
                    {activeScene?.content || episode.content || "当前项目还没有可展示的剧本内容。"}
                  </pre>
                </div>
              </div>
            </section>
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
