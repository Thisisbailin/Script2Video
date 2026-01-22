import React, { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import type { ProjectData, Scene } from "../../types";

type Props = {
  projectData: ProjectData;
};

type SceneEntry = {
  title: string;
  ids: string[];
  partitions: string[];
  timeLabels: string[];
  locations: string[];
  episodes: number[];
  count: number;
  metadata?: Scene["metadata"];
};

const formatList = (items: string[]) => Array.from(new Set(items.filter(Boolean))).join(" / ");

export const SceneLibraryPanel: React.FC<Props> = ({ projectData }) => {
  const [showAll, setShowAll] = useState(false);
  const sceneEntries = useMemo(() => {
    const map = new Map<string, SceneEntry>();
    projectData.episodes.forEach((episode) => {
      (episode.scenes || []).forEach((scene) => {
        if (!scene) return;
        const title = (scene.title || scene.metadata?.rawTitle || "未命名场景").trim();
        const key = title || scene.id || `${episode.id}-scene`;
        const existing = map.get(key);
        if (!existing) {
          map.set(key, {
            title,
            ids: scene.id ? [scene.id] : [],
            partitions: scene.partition ? [scene.partition] : [],
            timeLabels: scene.timeOfDay ? [scene.timeOfDay] : [],
            locations: scene.location ? [scene.location] : [],
            episodes: [episode.id],
            count: 1,
            metadata: scene.metadata,
          });
          return;
        }
        existing.count += 1;
        if (scene.id && !existing.ids.includes(scene.id)) existing.ids.push(scene.id);
        if (scene.partition && !existing.partitions.includes(scene.partition)) existing.partitions.push(scene.partition);
        if (scene.timeOfDay && !existing.timeLabels.includes(scene.timeOfDay)) existing.timeLabels.push(scene.timeOfDay);
        if (scene.location && !existing.locations.includes(scene.location)) existing.locations.push(scene.location);
        if (!existing.episodes.includes(episode.id)) existing.episodes.push(episode.id);
        if (!existing.metadata && scene.metadata) existing.metadata = scene.metadata;
      });
    });
    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        ids: Array.from(new Set(entry.ids)),
        episodes: Array.from(new Set(entry.episodes)).sort((a, b) => a - b),
      }))
      .sort((a, b) => {
        const diff = b.count - a.count;
        if (diff !== 0) return diff;
        return a.title.localeCompare(b.title);
      });
  }, [projectData.episodes]);

  const totalAppearances = useMemo(
    () => sceneEntries.reduce((sum, entry) => sum + entry.count, 0),
    [sceneEntries]
  );
  const visible = showAll ? sceneEntries : sceneEntries.slice(0, 8);
  const formatIds = (ids: string[]) => {
    if (!ids.length) return "未标注";
    if (ids.length <= 3) return ids.join(" / ");
    return `${ids.slice(0, 3).join(" / ")} 等`;
  };

  return (
    <div className="space-y-4 text-[var(--app-text-primary)]">
      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[12px] font-semibold">
            <MapPin size={16} className="text-cyan-300" />
            场景库
          </div>
          <div className="text-[11px] text-[var(--app-text-secondary)]">
            {sceneEntries.length} 个场景 · {totalAppearances} 次出现
          </div>
        </div>

        {sceneEntries.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visible.map((scene) => (
              <div
                key={scene.title}
                className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] font-semibold text-[var(--app-text-primary)] truncate">
                    {scene.title}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--app-border)] text-[var(--app-text-secondary)]">
                    {scene.count} 次
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-[var(--app-text-secondary)]">
                  <span>编号 {formatIds(scene.ids)}</span>
                  {scene.partitions.length ? <span>分区 {formatList(scene.partitions)}</span> : null}
                  {scene.timeLabels.length ? <span>时间 {formatList(scene.timeLabels)}</span> : null}
                  {scene.locations.length ? <span>位置 {formatList(scene.locations)}</span> : null}
                </div>
                <div className="text-[11px] text-[var(--app-text-secondary)]">
                  集数 {scene.episodes.join("、")}
                </div>
                {scene.metadata?.rawTitle && (
                  <p className="text-[12px] text-[var(--app-text-secondary)] line-clamp-2">
                    原始标题：{scene.metadata.rawTitle}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-[var(--app-text-secondary)]">尚未解析场景，请先导入剧本。</div>
        )}

        {sceneEntries.length > 8 && (
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="text-[11px] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition"
          >
            {showAll ? "收起场景库" : `展开完整场景库 · ${sceneEntries.length} 条`}
          </button>
        )}
      </div>
    </div>
  );
};
