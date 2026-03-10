import React from "react";
import { Episode } from "../../types";

type Props = {
  episode?: Episode;
  rawScript?: string;
};

export const ScriptViewer: React.FC<Props> = ({ episode, rawScript }) => {
  const scenes = episode?.scenes || [];

  return (
    <div className="h-full overflow-auto bg-transparent px-8 pb-12 pt-20 text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1100px] space-y-8">
        {episode ? (
          <div className="space-y-3">
            <h3 className="text-3xl font-bold text-[var(--text-primary)]">{episode.title}</h3>
            <div className="text-sm text-[var(--text-secondary)]">
              兼容剧本视图。新的角色绑定与高亮展示已迁移到节点工作流中的剧本面板节点。
            </div>
          </div>
        ) : null}

        {episode && scenes.length > 0 ? (
          <div className="space-y-6">
            {scenes.map((scene) => (
              <div
                key={scene.id}
                className="rounded-2xl border border-[var(--border-subtle)]/90 bg-[var(--bg-overlay)] p-5 shadow-[var(--shadow-soft)]"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-lg font-semibold text-[var(--text-primary)]">
                    {scene.id} {scene.title}
                  </h4>
                  <span className="rounded-full border border-[var(--border-subtle)]/80 bg-[var(--bg-panel)]/70 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    Scene
                  </span>
                </div>
                <div className="whitespace-pre-wrap text-base leading-relaxed text-[var(--text-secondary)]">
                  {scene.content || "当前场景还没有正文内容。"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--border-subtle)]/90 bg-[var(--bg-overlay)] p-5 shadow-[var(--shadow-soft)]">
            <div className="whitespace-pre-wrap text-lg leading-relaxed text-[var(--text-secondary)]">
              {episode ? (
                episode.content || "当前剧本暂无正文内容。"
              ) : rawScript ? (
                rawScript
              ) : (
                <span className="italic text-[var(--text-secondary)]">No script loaded.</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
