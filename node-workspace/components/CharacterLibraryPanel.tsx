import React, { useMemo, useState } from "react";
import { Users } from "lucide-react";
import type { ProjectData } from "../../types";

type Props = {
  projectData: ProjectData;
};

export const CharacterLibraryPanel: React.FC<Props> = ({ projectData }) => {
  const [showAll, setShowAll] = useState(false);
  const characters = useMemo(() => {
    const items = projectData.context.characters || [];
    return [...items].sort((a, b) => {
      const countDiff = (b.appearanceCount || 0) - (a.appearanceCount || 0);
      if (countDiff !== 0) return countDiff;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [projectData.context.characters]);
  const totalAppearances = useMemo(
    () => characters.reduce((sum, char) => sum + (char.appearanceCount || 0), 0),
    [characters]
  );
  const visible = showAll ? characters : characters.slice(0, 8);

  return (
    <div className="space-y-4 text-[var(--app-text-primary)]">
      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[12px] font-semibold">
            <Users size={16} className="text-emerald-300" />
            角色库
          </div>
          <div className="text-[11px] text-[var(--app-text-secondary)]">
            {characters.length} 人 · {totalAppearances} 次出现
          </div>
        </div>

        {characters.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visible.map((char) => (
              <div
                key={char.id}
                className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] font-semibold text-[var(--app-text-primary)] truncate">
                    {char.name || "未命名角色"}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--app-border)] text-[var(--app-text-secondary)]">
                    {char.appearanceCount ?? 1} 次
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-[var(--app-text-secondary)]">
                  <span>形态 {char.forms?.length || 0}</span>
                  {char.role && <span>定位 {char.role}</span>}
                  {char.assetPriority && <span>优先级 {char.assetPriority}</span>}
                </div>
                <div className="text-[11px] text-[var(--app-text-secondary)]">
                  集数 {char.episodeUsage || "未标注"}
                </div>
                <p className="text-[12px] text-[var(--app-text-secondary)] line-clamp-2">
                  {char.bio || "暂无角色概述"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-[var(--app-text-secondary)]">尚未解析角色，请先导入剧本。</div>
        )}

        {characters.length > 8 && (
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="text-[11px] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition"
          >
            {showAll ? "收起角色库" : `展开完整角色库 · ${characters.length} 人`}
          </button>
        )}
      </div>
    </div>
  );
};
