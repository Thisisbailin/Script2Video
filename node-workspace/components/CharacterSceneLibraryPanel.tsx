import React, { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, MapPin, Users } from "lucide-react";
import type { DesignAssetItem, ProjectData, Scene } from "../../types";

type Props = {
  projectData: ProjectData;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;
};

type Selection =
  | { type: "character"; key: string }
  | { type: "scene"; key: string };

type UploadTarget = {
  category: "form" | "zone";
  refId: string;
  label: string;
};

type ScenePartitionEntry = {
  key: string;
  name: string;
  ids: string[];
  times: string[];
  locations: string[];
  episodes: number[];
  count: number;
  refId: string;
};

type SceneEntry = {
  key: string;
  title: string;
  ids: string[];
  episodes: number[];
  count: number;
  partitions: ScenePartitionEntry[];
  metadata?: Scene["metadata"];
};

const createDesignAssetId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });

const normalizeLabel = (value: string) => value.trim();
const formatList = (items: string[]) => Array.from(new Set(items.filter(Boolean))).join(" / ");

export const CharacterSceneLibraryPanel: React.FC<Props> = ({
  projectData,
  setProjectData,
}) => {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const characters = useMemo(() => {
    const items = projectData.context.characters || [];
    return [...items].sort((a, b) => {
      const countDiff = (b.appearanceCount || 0) - (a.appearanceCount || 0);
      if (countDiff !== 0) return countDiff;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [projectData.context.characters]);

  const sceneEntries = useMemo(() => {
    const map = new Map<string, SceneEntry>();
    projectData.episodes.forEach((episode) => {
      (episode.scenes || []).forEach((scene) => {
        if (!scene) return;
        const title = normalizeLabel(scene.title || scene.metadata?.rawTitle || "未命名场景");
        const key = title || scene.id || `scene-${episode.id}`;
        const partitionName = normalizeLabel(scene.partition || "主场景");
        const partitionKey = `${key}::${partitionName}`;
        const refId = `scene:${key}|${partitionName}`;
        const entry = map.get(key);
        if (!entry) {
          map.set(key, {
            key,
            title,
            ids: scene.id ? [scene.id] : [],
            episodes: [episode.id],
            count: 1,
            partitions: [
              {
                key: partitionKey,
                name: partitionName,
                ids: scene.id ? [scene.id] : [],
                times: scene.timeOfDay ? [scene.timeOfDay] : [],
                locations: scene.location ? [scene.location] : [],
                episodes: [episode.id],
                count: 1,
                refId,
              },
            ],
            metadata: scene.metadata,
          });
          return;
        }
        entry.count += 1;
        if (scene.id && !entry.ids.includes(scene.id)) entry.ids.push(scene.id);
        if (!entry.episodes.includes(episode.id)) entry.episodes.push(episode.id);
        if (!entry.metadata && scene.metadata) entry.metadata = scene.metadata;

        let partition = entry.partitions.find((item) => item.key === partitionKey);
        if (!partition) {
          partition = {
            key: partitionKey,
            name: partitionName,
            ids: [],
            times: [],
            locations: [],
            episodes: [],
            count: 0,
            refId,
          };
          entry.partitions.push(partition);
        }
        partition.count += 1;
        if (scene.id && !partition.ids.includes(scene.id)) partition.ids.push(scene.id);
        if (scene.timeOfDay && !partition.times.includes(scene.timeOfDay)) partition.times.push(scene.timeOfDay);
        if (scene.location && !partition.locations.includes(scene.location)) partition.locations.push(scene.location);
        if (!partition.episodes.includes(episode.id)) partition.episodes.push(episode.id);
      });
    });
    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        ids: Array.from(new Set(entry.ids)),
        episodes: Array.from(new Set(entry.episodes)).sort((a, b) => a - b),
        partitions: entry.partitions
          .map((partition) => ({
            ...partition,
            ids: Array.from(new Set(partition.ids)),
            episodes: Array.from(new Set(partition.episodes)).sort((a, b) => a - b),
          }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  }, [projectData.episodes]);

  useEffect(() => {
    if (!selection) {
      if (characters.length) {
        setSelection({ type: "character", key: characters[0].id });
        return;
      }
      if (sceneEntries.length) {
        setSelection({ type: "scene", key: sceneEntries[0].key });
      }
      return;
    }
    if (selection.type === "character") {
      if (!characters.some((char) => char.id === selection.key)) {
        if (characters.length) {
          setSelection({ type: "character", key: characters[0].id });
        } else if (sceneEntries.length) {
          setSelection({ type: "scene", key: sceneEntries[0].key });
        } else {
          setSelection(null);
        }
      }
    } else if (selection.type === "scene") {
      if (!sceneEntries.some((scene) => scene.key === selection.key)) {
        if (sceneEntries.length) {
          setSelection({ type: "scene", key: sceneEntries[0].key });
        } else if (characters.length) {
          setSelection({ type: "character", key: characters[0].id });
        } else {
          setSelection(null);
        }
      }
    }
  }, [characters, sceneEntries, selection]);

  const totalCharacterAppearances = useMemo(
    () => characters.reduce((sum, char) => sum + (char.appearanceCount || 0), 0),
    [characters]
  );
  const totalSceneAppearances = useMemo(
    () => sceneEntries.reduce((sum, entry) => sum + entry.count, 0),
    [sceneEntries]
  );

  const selectedCharacter =
    selection?.type === "character"
      ? characters.find((char) => char.id === selection.key)
      : undefined;
  const selectedScene =
    selection?.type === "scene"
      ? sceneEntries.find((scene) => scene.key === selection.key)
      : undefined;

  const designAssets = projectData.designAssets || [];

  const handleUploadClick = (target: UploadTarget) => {
    setUploadTarget(target);
    uploadInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const target = uploadTarget;
    const files = Array.from(event.target.files || []);
    if (!target || files.length === 0) return;
    try {
      const urls = await Promise.all(files.map((file) => readFileAsDataUrl(file)));
      const createdAt = Date.now();
      const newAssets: DesignAssetItem[] = urls.map((url) => ({
        id: createDesignAssetId(),
        category: target.category,
        refId: target.refId,
        url,
        createdAt,
        label: target.label,
      }));
      setProjectData((prev) => ({
        ...prev,
        designAssets: [...(prev.designAssets || []), ...newAssets],
      }));
    } catch (err) {
      alert((err as Error).message || "设定图上传失败");
    } finally {
      event.target.value = "";
      setUploadTarget(null);
    }
  };

  const removeDesignAsset = (id: string) => {
    setProjectData((prev) => ({
      ...prev,
      designAssets: (prev.designAssets || []).filter((asset) => asset.id !== id),
    }));
  };

  const DesignAssetStrip = ({
    assets,
    onUpload,
    onRemove,
  }: {
    assets: DesignAssetItem[];
    onUpload: () => void;
    onRemove: (id: string) => void;
  }) => (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {assets.length === 0 && (
        <span className="text-[10px] text-[var(--app-text-secondary)]">暂无设定图</span>
      )}
      {assets.map((asset) => (
        <div
          key={asset.id}
          className="group relative h-16 w-20 overflow-hidden rounded-lg border border-[var(--app-border)] bg-black/30"
        >
          <img src={asset.url} alt={asset.label || "design"} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onRemove(asset.id)}
            className="absolute right-1 top-1 h-5 w-5 rounded-full border border-white/20 bg-black/50 text-white/70 opacity-0 transition group-hover:opacity-100 hover:text-white"
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onUpload}
        className="h-16 min-w-[100px] rounded-lg border border-dashed border-[var(--app-border)]/70 px-3 text-[11px] text-[var(--app-text-secondary)] hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-primary)] transition"
      >
        上传设定图
      </button>
    </div>
  );

  const formatIds = (ids: string[]) => {
    if (!ids.length) return "未标注";
    if (ids.length <= 3) return ids.join(" / ");
    return `${ids.slice(0, 3).join(" / ")} 等`;
  };

  return (
    <div className="space-y-4 text-[var(--app-text-primary)]">
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-3 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[12px] font-semibold">
                <Users size={16} className="text-emerald-300" />
                角色列表
              </div>
              <div className="text-[11px] text-[var(--app-text-secondary)]">
                {characters.length} 人 · {totalCharacterAppearances} 次
              </div>
            </div>
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {characters.length ? (
                characters.map((char) => {
                  const isActive = selection?.type === "character" && selection.key === char.id;
                  return (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => setSelection({ type: "character", key: char.id })}
                      className={`w-full text-left rounded-2xl border px-3 py-2 transition ${
                        isActive
                          ? "border-emerald-400/60 bg-emerald-500/10"
                          : "border-[var(--app-border)] bg-[var(--app-panel-soft)] hover:border-[var(--app-border-strong)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[12px] font-semibold truncate">
                          {char.name || "未命名角色"}
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--app-border)] text-[var(--app-text-secondary)]">
                          {char.appearanceCount ?? 1} 次
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] text-[var(--app-text-secondary)]">
                        形态 {char.forms?.length || 0} · {char.role || "定位未标注"}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-[12px] text-[var(--app-text-secondary)]">
                  尚未解析角色。
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[12px] font-semibold">
                <MapPin size={16} className="text-cyan-300" />
                场景列表
              </div>
              <div className="text-[11px] text-[var(--app-text-secondary)]">
                {sceneEntries.length} 个 · {totalSceneAppearances} 次
              </div>
            </div>
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {sceneEntries.length ? (
                sceneEntries.map((scene) => {
                  const isActive = selection?.type === "scene" && selection.key === scene.key;
                  return (
                    <button
                      key={scene.key}
                      type="button"
                      onClick={() => setSelection({ type: "scene", key: scene.key })}
                      className={`w-full text-left rounded-2xl border px-3 py-2 transition ${
                        isActive
                          ? "border-cyan-400/60 bg-cyan-500/10"
                          : "border-[var(--app-border)] bg-[var(--app-panel-soft)] hover:border-[var(--app-border-strong)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[12px] font-semibold truncate">{scene.title}</div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--app-border)] text-[var(--app-text-secondary)]">
                          {scene.count} 次
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] text-[var(--app-text-secondary)]">
                        分区 {scene.partitions.length} · 集数 {scene.episodes.join("、")}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-[12px] text-[var(--app-text-secondary)]">
                  尚未解析场景。
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4 space-y-4">
          {selection?.type === "character" ? (
            selectedCharacter ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold">
                      {selectedCharacter.name || "未命名角色"}
                    </div>
                    <div className="text-[12px] text-[var(--app-text-secondary)] mt-1">
                      {selectedCharacter.role || "角色定位未标注"}
                      {selectedCharacter.assetPriority ? ` · 优先级 ${selectedCharacter.assetPriority}` : ""}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-[var(--app-text-secondary)]">
                    <div>出现 {selectedCharacter.appearanceCount ?? 1} 次</div>
                    <div>集数 {selectedCharacter.episodeUsage || "未标注"}</div>
                  </div>
                </div>

                {selectedCharacter.bio && (
                  <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3 text-[12px] text-[var(--app-text-secondary)]">
                    {selectedCharacter.bio}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-semibold">角色形态</div>
                  <div className="text-[11px] text-[var(--app-text-secondary)]">
                    {selectedCharacter.forms?.length || 0} 个形态
                  </div>
                </div>

                {selectedCharacter.forms?.length ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {selectedCharacter.forms.map((form) => {
                      const refId = `${selectedCharacter.id}|${form.id}`;
                      const assets = designAssets.filter(
                        (asset) => asset.category === "form" && asset.refId === refId
                      );
                      const label = `${selectedCharacter.name || "角色"} · ${form.formName || "形态"}`;
                      return (
                        <div
                          key={form.id}
                          className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[13px] font-semibold">
                                {form.formName || "未命名形态"}
                              </div>
                              <div className="text-[11px] text-[var(--app-text-secondary)]">
                                {form.episodeRange || "出现范围未标注"}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleUploadClick({
                                  category: "form",
                                  refId,
                                  label,
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-full border border-[var(--app-border)] px-2 py-1 text-[10px] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:border-[var(--app-border-strong)] transition"
                            >
                              <ImagePlus size={12} />
                              设定图
                            </button>
                          </div>
                          {(form.identityOrState || form.visualTags) && (
                            <div className="text-[11px] text-[var(--app-text-secondary)]">
                              {form.identityOrState || form.visualTags}
                            </div>
                          )}
                          {form.description && (
                            <div className="text-[11px] text-[var(--app-text-secondary)] line-clamp-3">
                              {form.description}
                            </div>
                          )}
                          <DesignAssetStrip
                            assets={assets}
                            onUpload={() =>
                              handleUploadClick({
                                category: "form",
                                refId,
                                label,
                              })
                            }
                            onRemove={removeDesignAsset}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[12px] text-[var(--app-text-secondary)]">暂无形态信息</div>
                )}
              </>
            ) : (
              <div className="text-[12px] text-[var(--app-text-secondary)]">请选择左侧角色查看详情。</div>
            )
          ) : selection?.type === "scene" ? (
            selectedScene ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold">{selectedScene.title}</div>
                    <div className="text-[12px] text-[var(--app-text-secondary)] mt-1">
                      编号 {formatIds(selectedScene.ids)}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-[var(--app-text-secondary)]">
                    <div>出现 {selectedScene.count} 次</div>
                    <div>集数 {selectedScene.episodes.join("、")}</div>
                  </div>
                </div>

                {selectedScene.metadata?.rawTitle && (
                  <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3 text-[12px] text-[var(--app-text-secondary)]">
                    原始标题：{selectedScene.metadata.rawTitle}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-semibold">场景分区</div>
                  <div className="text-[11px] text-[var(--app-text-secondary)]">
                    {selectedScene.partitions.length} 个分区
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {selectedScene.partitions.map((partition) => {
                    const assets = designAssets.filter(
                      (asset) => asset.category === "zone" && asset.refId === partition.refId
                    );
                    const timeLabel = formatList(partition.times);
                    const locationLabel = formatList(partition.locations);
                    const label = `${selectedScene.title} · ${partition.name}`;
                    return (
                      <div
                        key={partition.key}
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[13px] font-semibold">{partition.name}</div>
                            <div className="text-[11px] text-[var(--app-text-secondary)]">
                              出现 {partition.count} 次
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleUploadClick({
                                category: "zone",
                                refId: partition.refId,
                                label,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--app-border)] px-2 py-1 text-[10px] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:border-[var(--app-border-strong)] transition"
                          >
                            <ImagePlus size={12} />
                            设定图
                          </button>
                        </div>
                        <div className="text-[11px] text-[var(--app-text-secondary)] space-y-1">
                          <div>编号 {formatIds(partition.ids)}</div>
                          {timeLabel && <div>时间 {timeLabel}</div>}
                          {locationLabel && <div>位置 {locationLabel}</div>}
                          <div>集数 {partition.episodes.join("、")}</div>
                        </div>
                        <DesignAssetStrip
                          assets={assets}
                          onUpload={() =>
                            handleUploadClick({
                              category: "zone",
                              refId: partition.refId,
                              label,
                            })
                          }
                          onRemove={removeDesignAsset}
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-[12px] text-[var(--app-text-secondary)]">请选择左侧场景查看详情。</div>
            )
          ) : (
            <div className="text-[12px] text-[var(--app-text-secondary)]">请选择左侧条目查看详情。</div>
          )}
        </div>
      </div>
    </div>
  );
};
