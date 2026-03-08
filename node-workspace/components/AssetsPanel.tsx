import React, { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  FileText,
  Film,
  Image as ImageIcon,
  MapPin,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useWorkflowStore } from "../store/workflowStore";
import { Episode, ProjectData } from "../../types";

type AssetTab =
  | "images"
  | "videos"
  | "guides"
  | "scripts"
  | "shots"
  | "characters"
  | "scenes";

type InsertTextPayload = {
  title: string;
  text: string;
  refId?: string;
};

type Props = {
  projectData: ProjectData;
  onInsertTextNode: (payload: InsertTextPayload) => void;
  onImportEpisodeShots: (episodeId: number) => void;
  floating?: boolean;
  inlineAnchor?: boolean;
};

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const buildEpisodeScript = (episode: Episode) => {
  if (episode.scenes?.length) {
    return episode.scenes
      .map((scene) => `${scene.id} ${scene.title}\n${scene.content || ""}`.trim())
      .filter(Boolean)
      .join("\n\n");
  }
  return episode.content || "";
};

const getSnippet = (text: string, limit = 120) => {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
};

export const AssetsPanel: React.FC<Props> = ({
  projectData,
  onInsertTextNode,
  onImportEpisodeShots,
  floating = true,
  inlineAnchor = false,
}) => {
  const { globalAssetHistory, removeGlobalHistoryItem, clearGlobalHistory } = useWorkflowStore();
  const [collapsed, setCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<AssetTab>("images");

  const imageAssets = useMemo(
    () => globalAssetHistory.filter((item) => item.type === "image"),
    [globalAssetHistory]
  );
  const videoAssets = useMemo(
    () => globalAssetHistory.filter((item) => item.type === "video"),
    [globalAssetHistory]
  );

  const guideItems = useMemo(() => {
    const items = [
      { key: "globalStyleGuide", title: "Style Guide", text: projectData.globalStyleGuide || "" },
      { key: "shotGuide", title: "Shot Guide", text: projectData.shotGuide || "" },
      { key: "soraGuide", title: "Sora Guide", text: projectData.soraGuide || "" },
      { key: "storyboardGuide", title: "Storyboard Guide", text: projectData.storyboardGuide || "" },
      { key: "dramaGuide", title: "Drama Guide", text: projectData.dramaGuide || "" },
    ];
    return items.filter((item) => item.text.trim().length > 0);
  }, [
    projectData.globalStyleGuide,
    projectData.shotGuide,
    projectData.soraGuide,
    projectData.storyboardGuide,
    projectData.dramaGuide,
  ]);

  const scriptItems = useMemo(
    () =>
      projectData.episodes.map((episode) => ({
        id: episode.id,
        title: episode.title || `Episode ${episode.id}`,
        text: buildEpisodeScript(episode),
        scenes: episode.scenes?.length || 0,
      })),
    [projectData.episodes]
  );

  const characterItems = projectData.context.characters || [];
  const sceneItems = projectData.context.locations || [];

  const tabs = [
    { key: "images" as const, label: "Images", count: imageAssets.length },
    { key: "videos" as const, label: "Videos", count: videoAssets.length },
    { key: "guides" as const, label: "Guides", count: guideItems.length },
    { key: "scripts" as const, label: "Scripts", count: scriptItems.length },
    { key: "shots" as const, label: "Shots", count: projectData.episodes.length },
    { key: "characters" as const, label: "Characters", count: characterItems.length },
    { key: "scenes" as const, label: "Scenes", count: sceneItems.length },
  ];

  const totalCount = tabs.reduce((sum, tab) => sum + tab.count, 0);
  const mediaCount = imageAssets.length + videoAssets.length;
  const libraryCount = guideItems.length + scriptItems.length;
  const referenceCount = projectData.episodes.length + characterItems.length + sceneItems.length;

  const tabMeta: Record<AssetTab, { label: string; note: string; Icon: typeof ImageIcon }> = {
    images: { label: "Images", note: "参考图与生成图", Icon: ImageIcon },
    videos: { label: "Videos", note: "视频片段", Icon: Film },
    guides: { label: "Guides", note: "风格与规则", Icon: BookOpen },
    scripts: { label: "Scripts", note: "剧本与场次", Icon: FileText },
    shots: { label: "Shots", note: "镜头批量导入", Icon: Clapperboard },
    characters: { label: "Characters", note: "人物资料", Icon: Users },
    scenes: { label: "Scenes", note: "场景设定", Icon: MapPin },
  };

  const showClear = activeTab === "images" ? imageAssets.length > 0 : activeTab === "videos" && videoAssets.length > 0;
  const clearType = activeTab === "images" ? "image" : "video";
  const activeMeta = tabMeta[activeTab];

  const insertCharacter = (id: string, name: string, text: string) => {
    onInsertTextNode({
      title: name,
      text,
      refId: id,
    });
  };

  const insertScene = (id: string, name: string, text: string) => {
    onInsertTextNode({
      title: name,
      text,
      refId: id,
    });
  };

  const anchorClass = inlineAnchor ? "relative h-12 flex items-center" : floating ? "fixed bottom-4 right-4 z-30" : "";

  const EmptyState = ({ title, detail }: { title: string; detail: string }) => (
    <div className="assets-empty-state">
      <div className="assets-empty-title">{title}</div>
      <div className="assets-empty-detail">{detail}</div>
    </div>
  );

  if (collapsed) {
    return (
      <div className={anchorClass}>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="assets-launcher flex items-center gap-2 rounded-full px-3 py-2"
        >
          <span className="assets-launcher-orb">
            <Sparkles size={13} className="text-[var(--app-accent-strong)]" />
          </span>
          <span className="min-w-0 text-left">
            <span className="block text-[12px] font-semibold leading-none text-[var(--app-text-primary)]">Assets</span>
            <span className="mt-1 block text-[10px] leading-none text-[var(--app-text-muted)]">
              {mediaCount} media · {libraryCount + referenceCount} refs
            </span>
          </span>
          <span className="rounded-full border border-[var(--app-border)] px-2 py-0.5 text-[10px] text-[var(--app-text-secondary)]">
            {totalCount}
          </span>
          <ChevronUp size={14} className="text-[var(--app-text-secondary)]" />
        </button>
      </div>
    );
  }

  const panelCore = (
    <div className="assets-panel-shell flex max-h-[min(74dvh,760px)] w-[400px] flex-col overflow-hidden rounded-[28px]">
        <div className="assets-panel-header border-b border-[var(--app-border)] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="assets-panel-badge">
              <Sparkles size={15} className="text-[var(--app-accent-strong)]" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[-0.02em] text-[var(--app-text-primary)]">Assets</div>
              <div className="text-[11px] text-[var(--app-text-muted)]">右下角资产与设定抽屉</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showClear && (
              <button
                type="button"
                onClick={() => clearGlobalHistory(clearType)}
                className="h-8 w-8 rounded-full border border-[var(--app-border)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-muted)] transition"
                title="Clear"
              >
                <Trash2 size={14} className="mx-auto text-[var(--app-text-secondary)]" />
              </button>
            )}
              <button
                type="button"
                onClick={() => setCollapsed(true)}
              className="h-8 w-8 rounded-full border border-[var(--app-border)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-muted)] transition"
              title="Collapse"
              >
                <ChevronDown size={14} className="mx-auto text-[var(--app-text-secondary)]" />
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "Media", value: mediaCount, hint: "Images + Videos" },
              { label: "Guides", value: libraryCount, hint: "Text references" },
              { label: "Library", value: referenceCount, hint: "Shots / Cast / Scenes" },
            ].map((item) => (
              <div key={item.label} className="assets-stat-card">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-text-muted)]">{item.label}</div>
                <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--app-text-primary)]">{item.value}</div>
                <div className="mt-1 text-[10px] text-[var(--app-text-secondary)]">{item.hint}</div>
              </div>
            ))}
          </div>
        </div>

      <div className="px-4 pb-3 pt-3">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-text-muted)]">Current Surface</div>
            <div className="mt-1 text-[13px] font-medium text-[var(--app-text-primary)]">{activeMeta.label}</div>
          </div>
          <div className="text-right text-[10px] text-[var(--app-text-secondary)]">{tabs.find((tab) => tab.key === activeTab)?.count ?? 0} items</div>
        </div>

      <div className="grid grid-cols-3 gap-2">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          const meta = tabMeta[tab.key];
          const TabIcon = meta.Icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className="assets-tab-button"
              data-active={isActive}
            >
              <span className="flex items-center gap-2">
                <span className="assets-tab-icon">
                  <TabIcon size={12} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-medium text-[var(--app-text-primary)]">{meta.label}</span>
                  <span className="block text-[9px] text-[var(--app-text-muted)]">{tab.count}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      </div>

      <div className="assets-panel-content flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {activeTab === "images" && (
          <>
            {imageAssets.length === 0 ? (
              <EmptyState title="No images yet." detail="生成图像后会在这里汇总，方便继续拖入工作流。" />
            ) : (
              imageAssets.map((item) => (
                <div
                  key={item.id}
                  className="assets-media-card group"
                >
                  <div className="assets-media-preview">
                    <img src={item.src} alt={item.prompt} className="w-full h-full object-cover" />
                    <div className="assets-media-tag">
                      <ImageIcon size={10} />
                      image
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="truncate text-[12px] font-semibold text-[var(--app-text-primary)]">
                      {item.prompt || "Untitled prompt"}
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-[var(--app-text-muted)]">
                      {item.model && <span className="assets-meta-pill">{item.model.split("/").pop()}</span>}
                      {item.aspectRatio && <span className="assets-meta-pill">{item.aspectRatio}</span>}
                      <span className="assets-meta-pill">{formatTime(item.timestamp)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeGlobalHistoryItem(item.id)}
                    className="assets-icon-button opacity-0 group-hover:opacity-100"
                    title="Remove"
                  >
                    <X size={12} className="mx-auto" />
                  </button>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === "videos" && (
          <>
            {videoAssets.length === 0 ? (
              <EmptyState title="No videos yet." detail="生成视频后会在这里形成时间序列，方便回看和筛选。" />
            ) : (
              videoAssets.map((item) => (
                <div
                  key={item.id}
                  className="assets-media-card group"
                >
                  <div className="assets-media-preview">
                    <video className="w-full h-full object-cover" muted preload="metadata" playsInline>
                      <source src={item.src} />
                    </video>
                    <div className="assets-media-tag">
                      <Film size={10} />
                      video
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="truncate text-[12px] font-semibold text-[var(--app-text-primary)]">
                      {item.prompt || "Untitled prompt"}
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-[var(--app-text-muted)]">
                      {item.model && <span className="assets-meta-pill">{item.model.split("/").pop()}</span>}
                      {item.aspectRatio && <span className="assets-meta-pill">{item.aspectRatio}</span>}
                      <span className="assets-meta-pill">{formatTime(item.timestamp)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeGlobalHistoryItem(item.id)}
                    className="assets-icon-button opacity-0 group-hover:opacity-100"
                    title="Remove"
                  >
                    <X size={12} className="mx-auto" />
                  </button>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === "guides" && (
          <>
            {guideItems.length === 0 ? (
              <EmptyState title="No guides loaded." detail="风格指南、镜头指南和剧情说明会显示在这里。" />
            ) : (
              guideItems.map((guide) => (
                <div
                  key={guide.key}
                  className="assets-row-card"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="assets-row-icon">
                      <BookOpen size={15} className="text-[var(--app-accent-strong)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold text-[var(--app-text-primary)]">{guide.title}</div>
                      <div className="truncate text-[10px] text-[var(--app-text-muted)]">
                        {getSnippet(guide.text) || "No content"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onInsertTextNode({
                        title: guide.title,
                        text: guide.text,
                        refId: guide.key,
                      })
                    }
                    className="assets-action-button"
                  >
                    Insert
                  </button>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === "scripts" && (
          <>
            {scriptItems.length === 0 ? (
              <EmptyState title="No scripts yet." detail="导入剧本后，这里会显示分集脚本与场次概览。" />
            ) : (
              scriptItems.map((script) => (
                <div
                  key={script.id}
                  className="assets-row-card"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="assets-row-icon">
                      <FileText size={15} className="text-[var(--app-accent-strong)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold text-[var(--app-text-primary)]">{script.title}</div>
                      <div className="truncate text-[10px] text-[var(--app-text-muted)]">
                        {script.scenes > 0 ? `${script.scenes} scenes` : "Script text"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onInsertTextNode({
                        title: script.title,
                        text: script.text,
                        refId: `episode-${script.id}`,
                      })
                    }
                    className="assets-action-button disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={!script.text.trim()}
                  >
                    Insert
                  </button>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === "shots" && (
          <>
            {projectData.episodes.length === 0 ? (
              <EmptyState title="No episodes yet." detail="有分集后可以一键把镜头导入到当前节点工作区。" />
            ) : (
              projectData.episodes.map((episode) => (
                <div
                  key={episode.id}
                  className="assets-row-card"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="assets-row-icon">
                      <Clapperboard size={15} className="text-[var(--app-accent-strong)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold text-[var(--app-text-primary)]">
                        Episode {episode.id}: {episode.title || "Untitled"}
                      </div>
                      <div className="truncate text-[10px] text-[var(--app-text-muted)]">
                        {episode.shots.length} shots
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onImportEpisodeShots(episode.id)}
                    className="assets-action-button disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={episode.shots.length === 0}
                  >
                    Import
                  </button>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === "characters" && (
          <>
            {characterItems.length === 0 ? (
              <EmptyState title="No characters yet." detail="人物解析完成后，可以快速插入角色设定到文本节点。" />
            ) : (
              characterItems.map((character) => {
                const parts = [
                  character.role ? `Role: ${character.role}` : "",
                  character.archetype ? `Archetype: ${character.archetype}` : "",
                  character.episodeUsage ? `Usage: ${character.episodeUsage}` : "",
                  character.bio ? `Bio: ${character.bio}` : "",
                ].filter(Boolean);
                const text = parts.join("\n");
                return (
                  <div
                    key={character.id}
                    className="assets-row-card"
                  >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="assets-row-icon">
                      <Users size={15} className="text-[var(--app-accent-strong)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold text-[var(--app-text-primary)]">{character.name}</div>
                        <div className="truncate text-[10px] text-[var(--app-text-muted)]">
                          {character.role || "Character"}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => insertCharacter(character.id, character.name, text)}
                      className="assets-action-button"
                    >
                      Insert
                    </button>
                  </div>
                );
              })
            )}
          </>
        )}

        {activeTab === "scenes" && (
          <>
            {sceneItems.length === 0 ? (
              <EmptyState title="No scenes yet." detail="场景资料会在理解完成后归档到这里，方便随时抽取。" />
            ) : (
              sceneItems.map((scene) => {
                const parts = [
                  scene.type ? `Type: ${scene.type}` : "",
                  scene.assetPriority ? `Priority: ${scene.assetPriority}` : "",
                  scene.episodeUsage ? `Usage: ${scene.episodeUsage}` : "",
                  scene.description ? `Description: ${scene.description}` : "",
                  scene.visuals ? `Visuals: ${scene.visuals}` : "",
                ].filter(Boolean);
                const text = parts.join("\n");
                return (
                  <div
                    key={scene.id}
                    className="assets-row-card"
                  >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="assets-row-icon">
                      <MapPin size={15} className="text-[var(--app-accent-strong)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold text-[var(--app-text-primary)]">{scene.name}</div>
                        <div className="truncate text-[10px] text-[var(--app-text-muted)]">
                          {scene.type === "core" ? "Core scene" : "Secondary scene"}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => insertScene(scene.id, scene.name, text)}
                      className="assets-action-button"
                    >
                      Insert
                    </button>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );

  if (inlineAnchor) {
    return (
      <div className={anchorClass}>
        <div className="absolute bottom-0 right-0 z-40">{panelCore}</div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="sr-only"
        >
          Close assets
        </button>
      </div>
    );
  }

  return <div className={anchorClass}>{panelCore}</div>;
};
