import React, { useMemo } from "react";
import { LayoutPanelTop } from "lucide-react";
import { BaseNode } from "./BaseNode";
import { StoryboardBoardNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";

type Props = {
  id: string;
  data: StoryboardBoardNodeData;
};

const shorten = (value: string, limit = 100) => {
  const safe = value.trim();
  if (safe.length <= limit) return safe;
  return `${safe.slice(0, limit)}...`;
};

export const StoryboardBoardNode: React.FC<Props & { selected?: boolean }> = ({ id, data, selected }) => {
  const { updateNodeData, labContext } = useWorkflowStore();
  const episodes = labContext.episodes || [];

  const episode = useMemo(() => {
    if (!episodes.length) return null;
    return episodes.find((item) => item.id === data.episodeId) ?? episodes[0];
  }, [data.episodeId, episodes]);

  const scene = useMemo(() => {
    if (!episode) return null;
    return episode.scenes.find((item) => item.id === data.sceneId) ?? episode.scenes[0] ?? null;
  }, [data.sceneId, episode]);

  const sceneShots = useMemo(() => {
    if (!episode || !scene) return [];
    return episode.shots.filter((shot) => shot.id.startsWith(`${scene.id}-`));
  }, [episode, scene]);

  return (
    <BaseNode
      title={data.title || "分镜表格卡片"}
      onTitleChange={(title) => updateNodeData(id, { title })}
      outputs={["text"]}
      selected={selected}
    >
      <div className="flex flex-col gap-4 h-full min-h-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--node-text-secondary)]">
            <LayoutPanelTop size={12} className="opacity-60" />
            Storyboard Board
          </div>
          <div className="node-pill node-pill--accent px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
            {sceneShots.length} Rows
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {episodes.map((item) => {
            const active = item.id === episode?.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => updateNodeData(id, { episodeId: item.id, sceneId: item.scenes[0]?.id })}
                className={`shrink-0 rounded-2xl border px-3 py-2 transition ${
                  active
                    ? "border-[var(--node-accent)] bg-[var(--node-surface-strong)] text-[var(--node-text-primary)]"
                    : "border-[var(--node-border)] bg-[var(--node-surface)] text-[var(--node-text-secondary)] hover:border-[var(--node-border-strong)]"
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.18em]">第 {item.id} 集</div>
                <div className="mt-1 text-[11px] font-medium opacity-80">{item.shots.length} 镜头</div>
              </button>
            );
          })}
        </div>

        {episode && scene ? (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {episode.scenes.map((item, index) => {
                const active = item.id === scene.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => updateNodeData(id, { episodeId: episode.id, sceneId: item.id })}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] transition ${
                      active
                        ? "border-[var(--node-accent)] bg-[var(--node-surface-strong)] text-[var(--node-text-primary)]"
                        : "border-[var(--node-border)] bg-transparent text-[var(--node-text-secondary)] hover:border-[var(--node-border-strong)]"
                    }`}
                  >
                    场 {index + 1}
                  </button>
                );
              })}
            </div>

            <div className="node-surface rounded-[22px] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--node-text-secondary)]">Current Scene</div>
                  <div className="mt-1 text-[15px] font-semibold text-[var(--node-text-primary)]">{scene.title || scene.id}</div>
                  <div className="mt-2 text-[12px] leading-relaxed text-[var(--node-text-secondary)]">{shorten(scene.content || "暂无场景正文。", 180)}</div>
                </div>
                <div className="text-right text-[10px] uppercase tracking-[0.16em] text-[var(--node-text-secondary)]">
                  <div>{scene.id}</div>
                  <div className="mt-1">{sceneShots.length} shots</div>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto rounded-[24px] border border-[var(--node-border)] bg-[var(--node-surface)]/55">
              <table className="w-full min-w-[880px] border-separate border-spacing-0 text-[11px] text-[var(--node-text-primary)]">
                <thead>
                  <tr className="bg-[var(--node-surface-strong)] text-[10px] uppercase tracking-[0.18em] text-[var(--node-text-secondary)]">
                    <th className="sticky top-0 px-4 py-3 text-left font-black">镜头</th>
                    <th className="sticky top-0 px-4 py-3 text-left font-black">画面描述</th>
                    <th className="sticky top-0 px-4 py-3 text-left font-black">景别/时长</th>
                    <th className="sticky top-0 px-4 py-3 text-left font-black">运镜</th>
                    <th className="sticky top-0 px-4 py-3 text-left font-black">台词/声音</th>
                  </tr>
                </thead>
                <tbody>
                  {sceneShots.length ? (
                    sceneShots.map((shot, index) => (
                      <tr key={shot.id} className="align-top">
                        <td className="border-t border-[var(--node-border)] px-4 py-3 font-semibold whitespace-nowrap">{index + 1}</td>
                        <td className="border-t border-[var(--node-border)] px-4 py-3 leading-5">{shot.description || "-"}</td>
                        <td className="border-t border-[var(--node-border)] px-4 py-3 leading-5">
                          <div>{shot.shotType || "-"}</div>
                          <div className="mt-1 text-[var(--node-text-secondary)]">{shot.duration || "-"}</div>
                        </td>
                        <td className="border-t border-[var(--node-border)] px-4 py-3 leading-5">{shot.movement || "-"}</td>
                        <td className="border-t border-[var(--node-border)] px-4 py-3 leading-5">
                          <div>{shot.dialogue || "-"}</div>
                          <div className="mt-1 text-[var(--node-text-secondary)]">{shot.sound || "-"}</div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[12px] text-[var(--node-text-secondary)]">
                        当前场景还没有分镜数据。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="node-surface rounded-[24px] p-6 flex-1 flex items-center justify-center text-[12px] text-[var(--node-text-secondary)]">
            当前项目还没有可展示的分镜表。
          </div>
        )}
      </div>
    </BaseNode>
  );
};
