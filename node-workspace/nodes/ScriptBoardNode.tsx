import React, { useMemo } from "react";
import { BookOpen, Clapperboard } from "lucide-react";
import { BaseNode } from "./BaseNode";
import { ScriptBoardNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";

type Props = {
  id: string;
  data: ScriptBoardNodeData;
};

const shorten = (value: string, limit = 180) => {
  const safe = value.trim();
  if (safe.length <= limit) return safe;
  return `${safe.slice(0, limit)}...`;
};

export const ScriptBoardNode: React.FC<Props & { selected?: boolean }> = ({ id, data, selected }) => {
  const { updateNodeData, labContext } = useWorkflowStore();
  const episodes = labContext.episodes || [];

  const episode = useMemo(() => {
    return episodes.find((item) => item.id === data.episodeId) ?? episodes[0] ?? null;
  }, [data.episodeId, episodes]);

  return (
    <BaseNode
      title={data.title || "剧本卡片"}
      onTitleChange={(title) => updateNodeData(id, { title })}
      outputs={["text"]}
      selected={selected}
    >
      <div className="flex flex-col gap-4 h-full min-h-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--node-text-secondary)]">
            <BookOpen size={12} className="opacity-60" />
            Script Board
          </div>
          <div className="node-pill px-3 py-1 text-[10px] font-semibold text-[var(--node-text-secondary)]">
            {episode ? `${episode.scenes.length} 场` : "未加载剧本"}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {episodes.map((item) => {
            const active = item.id === episode?.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => updateNodeData(id, { episodeId: item.id })}
                className={`shrink-0 rounded-2xl border px-3 py-2 text-left transition ${
                  active
                    ? "border-[var(--node-accent)] bg-[var(--node-surface-strong)] text-[var(--node-text-primary)] shadow-[0_10px_24px_rgba(44,72,47,0.10)]"
                    : "border-[var(--node-border)] bg-[var(--node-surface)] text-[var(--node-text-secondary)] hover:border-[var(--node-border-strong)]"
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.18em]">第 {item.id} 集</div>
                <div className="mt-1 text-[11px] font-medium opacity-80">{item.scenes.length} 个场景</div>
              </button>
            );
          })}
        </div>

        {episode ? (
          <>
            <div className="node-surface rounded-[24px] p-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--node-text-secondary)]">Current Episode</div>
                <div className="mt-2 text-[18px] font-semibold text-[var(--node-text-primary)]">第 {episode.id} 集</div>
                <div className="mt-2 text-[12px] leading-relaxed text-[var(--node-text-secondary)]">
                  {episode.summary ? shorten(episode.summary, 220) : "这集暂时还没有摘要。"}
                </div>
              </div>
              <div className="node-pill node-pill--accent px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em]">
                {episode.shots.length} Shots
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
              {episode.scenes.map((scene, index) => (
                <section key={scene.id} className="node-surface rounded-[22px] p-4 border border-[var(--node-border)]/80">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--node-text-secondary)]">
                        Scene {index + 1}
                      </div>
                      <div className="mt-1 text-[14px] font-semibold text-[var(--node-text-primary)]">
                        {scene.title || scene.id}
                      </div>
                    </div>
                    <div className="node-pill px-3 py-1 text-[10px] font-semibold text-[var(--node-text-secondary)]">
                      {scene.id}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em] text-[var(--node-text-secondary)]">
                    {scene.location ? <span className="node-pill px-2 py-1">{scene.location}</span> : null}
                    {scene.timeOfDay ? <span className="node-pill px-2 py-1">{scene.timeOfDay}</span> : null}
                    {scene.partition ? <span className="node-pill px-2 py-1">{scene.partition}</span> : null}
                  </div>
                  <div className="mt-3 rounded-[18px] bg-[var(--node-surface-strong)] px-4 py-3 text-[12px] leading-6 text-[var(--node-text-primary)] whitespace-pre-wrap">
                    {scene.content || "暂无场景正文。"}
                  </div>
                </section>
              ))}
            </div>
          </>
        ) : (
          <div className="node-surface rounded-[24px] p-6 flex-1 flex flex-col items-center justify-center text-center text-[12px] text-[var(--node-text-secondary)] gap-3">
            <Clapperboard size={28} className="opacity-40" />
            <div>当前项目还没有可展示的剧本内容。</div>
          </div>
        )}
      </div>
    </BaseNode>
  );
};
