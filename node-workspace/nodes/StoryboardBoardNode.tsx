import React, { useMemo, useCallback } from "react";
import { GripVertical, LayoutPanelTop } from "lucide-react";
import { BaseNode } from "./BaseNode";
import { StoryboardBoardNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";

type Props = {
  id: string;
  data: StoryboardBoardNodeData;
};

const DEFAULT_COLUMN_WIDTHS = [88, 300, 180, 150, 200];
const MIN_COLUMN_WIDTH = 72;
const MIN_ROW_HEIGHT = 74;

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

  const columnWidths = useMemo(() => {
    const widths = [...DEFAULT_COLUMN_WIDTHS];
    (data.columnWidths || []).forEach((value, index) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        widths[index] = Math.max(MIN_COLUMN_WIDTH, value);
      }
    });
    return widths;
  }, [data.columnWidths]);

  const rowHeights = data.rowHeights || {};
  const gridTemplateColumns = columnWidths.map((value) => `${value}px`).join(" ");

  const updateColumnWidth = useCallback(
    (index: number, nextWidth: number) => {
      const next = [...columnWidths];
      next[index] = Math.max(MIN_COLUMN_WIDTH, Math.round(nextWidth));
      updateNodeData(id, { columnWidths: next });
    },
    [columnWidths, id, updateNodeData]
  );

  const startColumnResize = useCallback(
    (index: number, event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startWidth = columnWidths[index];
      const handleMove = (moveEvent: PointerEvent) => {
        updateColumnWidth(index, startWidth + moveEvent.clientX - startX);
      };
      const handleUp = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [columnWidths, updateColumnWidth]
  );

  const startRowResize = useCallback(
    (rowKey: string, event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const startY = event.clientY;
      const startHeight = rowHeights[rowKey] || 92;
      const handleMove = (moveEvent: PointerEvent) => {
        updateNodeData(id, {
          rowHeights: {
            ...rowHeights,
            [rowKey]: Math.max(MIN_ROW_HEIGHT, Math.round(startHeight + moveEvent.clientY - startY)),
          },
        });
      };
      const handleUp = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [id, rowHeights, updateNodeData]
  );

  return (
    <BaseNode title={data.title || "分镜表面板节点"} outputs={["text"]} selected={selected}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--node-border)] pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--node-border)] bg-[var(--node-surface-strong)] text-[var(--node-accent)]">
              <LayoutPanelTop size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold tracking-[-0.02em] text-[var(--node-text-primary)]">
                {data.title || "分镜表面板节点"}
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--node-text-secondary)]">
                Resizable Storyboard Table
              </div>
            </div>
          </div>
          <div className="rounded-full border border-[var(--node-border)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--node-text-secondary)]">
            {sceneShots.length} rows
          </div>
        </div>

        {episode && scene ? (
          <>
            <div className="mt-3 grid gap-2 md:grid-cols-[160px_220px_minmax(0,1fr)]">
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--node-text-secondary)]">Episode</span>
                <select
                  value={episode.id}
                  onChange={(event) => {
                    const nextEpisode = episodes.find((item) => item.id === Number(event.target.value));
                    updateNodeData(id, {
                      episodeId: nextEpisode?.id,
                      sceneId: nextEpisode?.scenes[0]?.id,
                    });
                  }}
                  className="w-full rounded-[16px] border border-[var(--node-border)] bg-[var(--node-surface)] px-3 py-2 text-[12px] text-[var(--node-text-primary)] outline-none"
                >
                  {episodes.map((item) => (
                    <option key={item.id} value={item.id}>
                      第 {item.id} 集
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--node-text-secondary)]">Scene</span>
                <select
                  value={scene.id}
                  onChange={(event) => updateNodeData(id, { episodeId: episode.id, sceneId: event.target.value })}
                  className="w-full rounded-[16px] border border-[var(--node-border)] bg-[var(--node-surface)] px-3 py-2 text-[12px] text-[var(--node-text-primary)] outline-none"
                >
                  {episode.scenes.map((item, index) => (
                    <option key={item.id} value={item.id}>
                      {`场 ${index + 1} · ${item.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-[16px] border border-[var(--node-border)] bg-[var(--node-surface-strong)] px-4 py-2.5">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--node-text-secondary)]">Scene Note</div>
                <div className="mt-1 text-[12px] leading-6 text-[var(--node-text-primary)]">
                  {shorten(scene.content || "当前场景没有文字描述。")}
                </div>
              </div>
            </div>

            <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-[24px] border border-[var(--node-border)] bg-[var(--node-surface)]/70">
              <div className="min-w-max">
                <div
                  className="sticky top-0 z-10 grid border-b border-[var(--node-border)] bg-[var(--node-surface-strong)] text-[10px] font-black uppercase tracking-[0.18em] text-[var(--node-text-secondary)]"
                  style={{ gridTemplateColumns }}
                >
                  {["镜头", "画面描述", "构图 / 调度", "镜头参数", "台词 / 声音"].map((label, index) => (
                    <div key={label} className="relative px-4 py-3">
                      {label}
                      <div
                        onPointerDown={(event) => startColumnResize(index, event)}
                        className="absolute right-0 top-0 h-full w-3 cursor-col-resize touch-none"
                        title="拖动调整列宽"
                      >
                        <div className="absolute bottom-2 right-1 top-2 w-px bg-[var(--node-border-strong)]/80" />
                      </div>
                    </div>
                  ))}
                </div>

                {sceneShots.length ? (
                  sceneShots.map((shot, index) => {
                    const rowKey = shot.id;
                    const rowHeight = rowHeights[rowKey] || 92;
                    return (
                      <div
                        key={shot.id}
                        className="relative border-b border-[var(--node-border)] last:border-b-0"
                        style={{ minHeight: rowHeight }}
                      >
                        <div className="grid h-full" style={{ gridTemplateColumns }}>
                          <div className="px-4 py-3 text-[12px] font-semibold text-[var(--node-text-primary)]">
                            <div>{index + 1}</div>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--node-text-secondary)]">{shot.id}</div>
                          </div>
                          <div className="px-4 py-3 text-[12px] leading-6 text-[var(--node-text-primary)]">
                            {shot.description || "-"}
                          </div>
                          <div className="px-4 py-3 text-[12px] leading-6 text-[var(--node-text-primary)]">
                            <div>{shot.composition || "-"}</div>
                            <div className="mt-1 text-[var(--node-text-secondary)]">{shot.blocking || "-"}</div>
                          </div>
                          <div className="px-4 py-3 text-[12px] leading-6 text-[var(--node-text-primary)]">
                            <div>{shot.shotType || "-"}</div>
                            <div className="text-[var(--node-text-secondary)]">{shot.duration || "-"}</div>
                            <div className="text-[var(--node-text-secondary)]">{shot.movement || "-"}</div>
                          </div>
                          <div className="px-4 py-3 text-[12px] leading-6 text-[var(--node-text-primary)]">
                            <div>{shot.dialogue || "-"}</div>
                            <div className="mt-1 text-[var(--node-text-secondary)]">{shot.sound || "-"}</div>
                          </div>
                        </div>
                        <div
                          onPointerDown={(event) => startRowResize(rowKey, event)}
                          className="absolute bottom-0 left-0 flex h-3 w-full cursor-row-resize items-center justify-center touch-none"
                          title="拖动调整行高"
                        >
                          <div className="rounded-full border border-[var(--node-border)] bg-[var(--node-surface)] px-2 py-0.5 text-[var(--node-text-secondary)]">
                            <GripVertical size={11} />
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-4 py-10 text-center text-[12px] text-[var(--node-text-secondary)]">
                    当前场景还没有分镜数据。
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="mt-4 flex flex-1 items-center justify-center rounded-[24px] border border-dashed border-[var(--node-border)] text-[12px] text-[var(--node-text-secondary)]">
            当前项目还没有可展示的分镜表。
          </div>
        )}
      </div>
    </BaseNode>
  );
};
