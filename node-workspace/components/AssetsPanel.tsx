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
import { TextNodeData } from "../types";

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
  category?: TextNodeData["category"];
  refId?: string;
};

type Props = {
  projectData: ProjectData;
  onInsertTextNode: (payload: InsertTextPayload) => void;
  onImportEpisodeShots: (episodeId: number) => void;
  floating?: boolean;
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
      { key: "dramaGuide", title: "Drama Guide", text: projectData.dramaGuide || "" },
    ];
    return items.filter((item) => item.text.trim().length > 0);
  }, [
    projectData.globalStyleGuide,
    projectData.shotGuide,
    projectData.soraGuide,
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

  const showClear = activeTab === "images" ? imageAssets.length > 0 : activeTab === "videos" && videoAssets.length > 0;
  const clearType = activeTab === "images" ? "image" : "video";

  const insertCharacter = (id: string, name: string, text: string) => {
    onInsertTextNode({
      title: name,
      text,
      category: "character",
      refId: id,
    });
  };

  const insertScene = (id: string, name: string, text: string) => {
    onInsertTextNode({
      title: name,
      text,
      category: "scene",
      refId: id,
    });
  };

  const anchorClass = floating ? "fixed bottom-4 right-4 z-30" : "";

  if (collapsed) {
    return (
      <div className={anchorClass}>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 bg-[#0d0f12]/90 text-white shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur"
        >
          <span className="flex items-center gap-1.5">
            <ImageIcon size={14} className="text-sky-300" />
            <Film size={14} className="text-emerald-300" />
            <BookOpen size={14} className="text-violet-300" />
          </span>
          <span className="text-xs font-semibold">Assets</span>
          <span className="text-[10px] text-white/60">{totalCount}</span>
          <ChevronUp size={14} className="text-white/60" />
        </button>
      </div>
    );
  }

  return (
    <div className={anchorClass}>
      <div className="w-[380px] max-h-[calc(100vh-140px)] overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d10]/95 text-white shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500/30 via-blue-500/10 to-transparent border border-white/10 flex items-center justify-center">
              <Sparkles size={16} className="text-sky-200" />
            </div>
            <div>
              <div className="text-sm font-semibold">Assets</div>
              <div className="text-[11px] text-white/50">{totalCount} items</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showClear && (
              <button
                type="button"
                onClick={() => clearGlobalHistory(clearType)}
                className="h-8 w-8 rounded-full border border-white/10 hover:border-white/30 hover:bg-white/5 transition"
                title="Clear"
              >
                <Trash2 size={14} className="mx-auto text-white/60" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="h-8 w-8 rounded-full border border-white/10 hover:border-white/30 hover:bg-white/5 transition"
              title="Collapse"
            >
              <ChevronDown size={14} className="mx-auto text-white/70" />
            </button>
          </div>
        </div>

      <div className="px-4 pt-3 pb-3 flex items-center gap-2 overflow-x-auto assets-tabs">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-full text-[11px] uppercase tracking-wide border transition whitespace-nowrap ${
                isActive
                  ? "bg-white/10 border-white/40 text-white"
                  : "border-white/10 text-white/50 hover:border-white/30 hover:text-white"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          );
        })}
      </div>

      <div className="px-4 pb-4 flex-1 overflow-y-auto space-y-3">
        {activeTab === "images" && (
          <>
            {imageAssets.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-xs text-white/40">
                No images yet.
              </div>
            ) : (
              imageAssets.map((item) => (
                <div
                  key={item.id}
                  className="group flex gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30 transition"
                >
                  <div className="relative w-20 h-16 rounded-lg overflow-hidden border border-white/10 bg-black/40 shrink-0">
                    <img src={item.src} alt={item.prompt} className="w-full h-full object-cover" />
                    <div className="absolute left-1 top-1 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] uppercase tracking-widest">
                      <ImageIcon size={10} />
                      image
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-xs font-semibold text-white truncate">
                      {item.prompt || "Untitled prompt"}
                    </div>
                    <div className="text-[10px] text-white/45 flex flex-wrap gap-2">
                      {item.model && <span>{item.model.split("/").pop()}</span>}
                      {item.aspectRatio && <span>{item.aspectRatio}</span>}
                      <span>{formatTime(item.timestamp)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeGlobalHistoryItem(item.id)}
                    className="h-7 w-7 rounded-full border border-white/10 text-white/50 hover:text-white hover:border-white/30 hover:bg-white/10 transition opacity-0 group-hover:opacity-100"
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
              <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-xs text-white/40">
                No videos yet.
              </div>
            ) : (
              videoAssets.map((item) => (
                <div
                  key={item.id}
                  className="group flex gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30 transition"
                >
                  <div className="relative w-20 h-16 rounded-lg overflow-hidden border border-white/10 bg-black/40 shrink-0">
                    <video className="w-full h-full object-cover" muted preload="metadata" playsInline>
                      <source src={item.src} />
                    </video>
                    <div className="absolute left-1 top-1 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] uppercase tracking-widest">
                      <Film size={10} />
                      video
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-xs font-semibold text-white truncate">
                      {item.prompt || "Untitled prompt"}
                    </div>
                    <div className="text-[10px] text-white/45 flex flex-wrap gap-2">
                      {item.model && <span>{item.model.split("/").pop()}</span>}
                      {item.aspectRatio && <span>{item.aspectRatio}</span>}
                      <span>{formatTime(item.timestamp)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeGlobalHistoryItem(item.id)}
                    className="h-7 w-7 rounded-full border border-white/10 text-white/50 hover:text-white hover:border-white/30 hover:bg-white/10 transition opacity-0 group-hover:opacity-100"
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
              <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-xs text-white/40">
                No guides loaded.
              </div>
            ) : (
              guideItems.map((guide) => (
                <div
                  key={guide.key}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <BookOpen size={16} className="text-violet-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{guide.title}</div>
                      <div className="text-[10px] text-white/40 truncate">
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
                        category: "guide",
                        refId: guide.key,
                      })
                    }
                    className="px-2.5 py-1 rounded-full border border-white/10 text-[10px] uppercase tracking-wide text-white/70 hover:text-white hover:border-white/30 transition"
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
              <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-xs text-white/40">
                No scripts yet.
              </div>
            ) : (
              scriptItems.map((script) => (
                <div
                  key={script.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <FileText size={16} className="text-sky-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{script.title}</div>
                      <div className="text-[10px] text-white/40 truncate">
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
                        category: "script",
                        refId: `episode-${script.id}`,
                      })
                    }
                    className="px-2.5 py-1 rounded-full border border-white/10 text-[10px] uppercase tracking-wide text-white/70 hover:text-white hover:border-white/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
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
              <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-xs text-white/40">
                No episodes yet.
              </div>
            ) : (
              projectData.episodes.map((episode) => (
                <div
                  key={episode.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <Clapperboard size={16} className="text-emerald-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        Episode {episode.id}: {episode.title || "Untitled"}
                      </div>
                      <div className="text-[10px] text-white/40 truncate">
                        {episode.shots.length} shots
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onImportEpisodeShots(episode.id)}
                    className="px-2.5 py-1 rounded-full border border-white/10 text-[10px] uppercase tracking-wide text-white/70 hover:text-white hover:border-white/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
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
              <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-xs text-white/40">
                No characters yet.
              </div>
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
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30 transition"
                  >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <Users size={16} className="text-purple-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{character.name}</div>
                        <div className="text-[10px] text-white/40 truncate">
                          {character.role || "Character"}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => insertCharacter(character.id, character.name, text)}
                      className="px-2.5 py-1 rounded-full border border-white/10 text-[10px] uppercase tracking-wide text-white/70 hover:text-white hover:border-white/30 transition"
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
              <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-xs text-white/40">
                No scenes yet.
              </div>
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
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30 transition"
                  >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <MapPin size={16} className="text-amber-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{scene.name}</div>
                        <div className="text-[10px] text-white/40 truncate">
                          {scene.type === "core" ? "Core scene" : "Secondary scene"}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => insertScene(scene.id, scene.name, text)}
                      className="px-2.5 py-1 rounded-full border border-white/10 text-[10px] uppercase tracking-wide text-white/70 hover:text-white hover:border-white/30 transition"
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
    </div>
  );
};
