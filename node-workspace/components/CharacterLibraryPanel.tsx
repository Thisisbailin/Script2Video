import React, { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Users } from "lucide-react";
import type { DesignAssetItem, ProjectData } from "../../types";

type Props = {
  projectData: ProjectData;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;
};

type UploadTarget = {
  characterId: string;
  formId: string;
  label: string;
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

export const CharacterLibraryPanel: React.FC<Props> = ({
  projectData,
  setProjectData,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!selectedId && characters.length) {
      setSelectedId(characters[0].id);
      return;
    }
    if (selectedId && !characters.some((char) => char.id === selectedId)) {
      setSelectedId(characters[0]?.id ?? null);
    }
  }, [characters, selectedId]);

  const totalAppearances = useMemo(
    () => characters.reduce((sum, char) => sum + (char.appearanceCount || 0), 0),
    [characters]
  );
  const selectedCharacter = characters.find((char) => char.id === selectedId);
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
      const refId = `${target.characterId}|${target.formId}`;
      const newAssets: DesignAssetItem[] = urls.map((url) => ({
        id: createDesignAssetId(),
        category: "form",
        refId,
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

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12px] font-semibold">
              <Users size={16} className="text-emerald-300" />
              角色列表
            </div>
            <div className="text-[11px] text-[var(--app-text-secondary)]">
              {characters.length} 人 · {totalAppearances} 次
            </div>
          </div>
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {characters.length ? (
              characters.map((char) => {
                const isActive = char.id === selectedId;
                return (
                  <button
                    key={char.id}
                    type="button"
                    onClick={() => setSelectedId(char.id)}
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
                尚未解析角色，请先导入剧本。
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4 space-y-4">
          {selectedCharacter ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold">{selectedCharacter.name || "未命名角色"}</div>
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
                                characterId: selectedCharacter.id,
                                formId: form.id,
                                label: `${selectedCharacter.name || "角色"} · ${form.formName || "形态"}`,
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
                              characterId: selectedCharacter.id,
                              formId: form.id,
                              label: `${selectedCharacter.name || "角色"} · ${form.formName || "形态"}`,
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
          )}
        </div>
      </div>
    </div>
  );
};
