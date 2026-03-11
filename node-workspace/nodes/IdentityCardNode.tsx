import React, { useMemo, useCallback } from "react";
import { AtSign, BadgeCheck, Fingerprint, Layers, MapPinned, Upload, UserRound } from "lucide-react";
import type { Character, DesignAssetItem, Location } from "../../types";
import { BaseNode } from "./BaseNode";
import { IdentityCardNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";
import {
  getCharacterFormMention,
  getCharacterMentionAliases,
  getCharacterMentionLabel,
  getDefaultCharacterForm,
} from "../../utils/characterIdentity";

type Props = {
  id: string;
  data: IdentityCardNodeData;
};

type VariantCard = {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  description: string;
  mention?: string;
  isDefault?: boolean;
  assetsCount?: number;
  avatarUrl?: string;
};

const getInitials = (value: string) => value.slice(0, 2).toUpperCase();

const findAssetUrl = (assets: DesignAssetItem[], category: "form" | "zone", refId: string) =>
  assets.find((asset) => asset.category === category && asset.refId === refId)?.url;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("无法读取图片内容"));
    };
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });

export const IdentityCardNode: React.FC<Props & { selected?: boolean }> = ({ id, data, selected }) => {
  const { updateNodeData, labContext } = useWorkflowStore();
  const characters = labContext.context.characters || [];
  const locations = labContext.context.locations || [];
  const designAssets = labContext.designAssets || [];
  const avatarOverrides = data.avatarOverrides || {};

  const isCharacter = data.entityType !== "scene";

  const activeCharacter = useMemo(() => {
    return characters.find((item) => item.id === data.entityId) ?? characters[0] ?? null;
  }, [characters, data.entityId]);

  const activeLocation = useMemo(() => {
    return locations.find((item) => item.id === data.entityId) ?? locations[0] ?? null;
  }, [locations, data.entityId]);

  const variantCards = useMemo<VariantCard[]>(() => {
    if (isCharacter && activeCharacter) {
      return (activeCharacter.forms || []).map((form) => ({
        id: form.id,
        title: form.formName,
        subtitle: form.episodeRange || "未标注集数",
        badge: form.identityOrState || "角色形态",
        description: form.description || form.visualTags || "暂无形态说明。",
        mention: `@${getCharacterFormMention(activeCharacter, form)}`,
        isDefault: form.id === getDefaultCharacterForm(activeCharacter)?.id,
        assetsCount: designAssets.filter((asset) => asset.category === "form" && asset.refId === `${activeCharacter.id}|${form.id}`).length,
        avatarUrl:
          avatarOverrides[form.id] || findAssetUrl(designAssets, "form", `${activeCharacter.id}|${form.id}`),
      }));
    }
    if (!isCharacter && activeLocation) {
      return (activeLocation.zones || []).map((zone) => ({
        id: zone.id,
        title: zone.name,
        subtitle: zone.episodeRange || "未标注集数",
        badge: zone.kind || "zone",
        description: zone.layoutNotes || zone.keyProps || zone.lightingWeather || "暂无分区说明。",
        avatarUrl:
          avatarOverrides[zone.id] || findAssetUrl(designAssets, "zone", `${activeLocation.id}|${zone.id}`),
      }));
    }
    return [];
  }, [activeCharacter, activeLocation, avatarOverrides, designAssets, isCharacter]);

  const selectedVariant = useMemo(() => {
    if (!variantCards.length) return null;
    if (data.selectedVariantId) {
      const matched = variantCards.find((item) => item.id === data.selectedVariantId);
      if (matched) return matched;
    }
    if (isCharacter) {
      const preferredId = getDefaultCharacterForm(activeCharacter)?.id;
      if (preferredId) {
        const matched = variantCards.find((item) => item.id === preferredId);
        if (matched) return matched;
      }
    }
    return variantCards[0] ?? null;
  }, [activeCharacter, data.selectedVariantId, isCharacter, variantCards]);
  const primaryMention = getCharacterMentionLabel(activeCharacter);
  const mentionAliases = getCharacterMentionAliases(activeCharacter);
  const defaultForm = getDefaultCharacterForm(activeCharacter);

  const handleEntityModeChange = (entityType: "character" | "scene") => {
    if (entityType === "character") {
      const nextCharacter = characters[0];
      updateNodeData(id, {
        entityType,
        entityId: nextCharacter?.id,
        selectedVariantId: nextCharacter?.forms?.[0]?.id,
      });
      return;
    }
    const nextLocation = locations[0];
    updateNodeData(id, {
      entityType,
      entityId: nextLocation?.id,
      selectedVariantId: nextLocation?.zones?.[0]?.id,
    });
  };

  const handleEntitySelect = (entityId: string) => {
    if (isCharacter) {
      const nextCharacter = characters.find((item) => item.id === entityId);
      updateNodeData(id, {
        entityId,
        selectedVariantId: nextCharacter?.forms?.[0]?.id,
      });
      return;
    }
    const nextLocation = locations.find((item) => item.id === entityId);
    updateNodeData(id, {
      entityId,
      selectedVariantId: nextLocation?.zones?.[0]?.id,
    });
  };

  const handleAvatarUpload = useCallback(
    async (variantId: string, file?: File | null) => {
      if (!file) return;
      const nextUrl = await readFileAsDataUrl(file);
      updateNodeData(id, {
        avatarOverrides: {
          ...avatarOverrides,
          [variantId]: nextUrl,
        },
      });
    },
    [avatarOverrides, id, updateNodeData]
  );

  const parentTitle = isCharacter ? activeCharacter?.name : activeLocation?.name;
  const parentMeta = isCharacter ? activeCharacter?.role || "角色身份" : activeLocation?.type || "场景身份";
  const parentBody = isCharacter
    ? activeCharacter?.bio || "暂无角色简介。"
    : activeLocation?.description || activeLocation?.visuals || "暂无场景描述。";
  const entityOptions = isCharacter ? characters : locations;

  return (
    <BaseNode title={data.title || "角色 / 场景身份卡片节点"} outputs={["text"]} selected={selected}>
      <div className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--node-border)] pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--node-border)] bg-[var(--node-surface-strong)] text-[var(--node-accent)]">
              <Layers size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold tracking-[-0.02em] text-[var(--node-text-primary)]">
                {data.title || "角色 / 场景身份卡片节点"}
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--node-text-secondary)]">
                {isCharacter ? "Character Passport" : "Scene Identity"}
              </div>
            </div>
          </div>
          <div className="flex gap-1 rounded-full border border-[var(--node-border)] p-1">
            <button
              type="button"
              onClick={() => handleEntityModeChange("character")}
              className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] transition ${
                isCharacter ? "bg-[var(--node-accent)] text-white" : "text-[var(--node-text-secondary)]"
              }`}
            >
              角色
            </button>
            <button
              type="button"
              onClick={() => handleEntityModeChange("scene")}
              className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] transition ${
                !isCharacter ? "bg-[var(--node-accent)] text-white" : "text-[var(--node-text-secondary)]"
              }`}
            >
              场景
            </button>
          </div>
        </div>

        {parentTitle ? (
          <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <section className="flex min-h-0 flex-col rounded-[24px] border border-[var(--node-border)] bg-[var(--node-surface)]/70">
              <div className="border-b border-[var(--node-border)] px-4 py-4">
                <div className="mb-4 space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-[var(--node-text-secondary)]">
                    {isCharacter ? "当前角色" : "当前场景"}
                  </label>
                  <select
                    value={(isCharacter ? activeCharacter?.id : activeLocation?.id) || ""}
                    onChange={(event) => handleEntitySelect(event.target.value)}
                    className="w-full rounded-[16px] border border-[var(--node-border)] bg-[var(--node-surface-strong)] px-3 py-2.5 text-[12px] font-medium text-[var(--node-text-primary)] outline-none transition focus:border-[var(--node-accent)]"
                  >
                    {entityOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-[var(--node-border)] bg-[var(--node-surface-strong)] text-[var(--node-accent)]">
                    {selectedVariant?.avatarUrl ? (
                      <img src={selectedVariant.avatarUrl} alt={selectedVariant.title} className="h-full w-full rounded-[20px] object-cover" />
                    ) : isCharacter ? (
                      <span className="text-[16px] font-black">{getInitials(parentTitle)}</span>
                    ) : (
                      <MapPinned size={22} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--node-text-primary)]">{parentTitle}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[var(--node-text-secondary)]">{parentMeta}</div>
                  </div>
                </div>
                {isCharacter && activeCharacter ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-[18px] border border-[var(--node-border)] bg-[var(--node-surface-strong)] px-4 py-3">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--node-text-secondary)]">
                        <Fingerprint size={12} />
                        角色身份证
                      </div>
                      <div className="mt-3 space-y-2 text-[12px] leading-6 text-[var(--node-text-primary)]">
                        <div>ID: {activeCharacter.id}</div>
                        {primaryMention ? <div>主唤起: @{primaryMention}</div> : null}
                        {defaultForm ? <div>默认形态: {defaultForm.formName}</div> : null}
                        {activeCharacter.status ? <div>状态: {activeCharacter.status}</div> : null}
                      </div>
                    </div>
                    <div className="rounded-[18px] border border-[var(--node-border)] bg-[var(--node-surface-strong)] px-4 py-3 text-[12px] leading-6 text-[var(--node-text-primary)]">
                      {parentBody}
                    </div>
                    {mentionAliases.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {mentionAliases.map((alias) => (
                          <span
                            key={alias}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--node-border)] bg-[var(--node-surface-strong)] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--node-text-secondary)]"
                          >
                            <AtSign size={10} />
                            {alias}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[18px] border border-[var(--node-border)] bg-[var(--node-surface-strong)] px-4 py-3 text-[12px] leading-6 text-[var(--node-text-primary)]">
                    {parentBody}
                  </div>
                )}
              </div>

              <div className="min-h-0 flex-1 px-4 py-4">
                <div className="rounded-[20px] border border-[var(--node-border)] bg-[var(--node-surface-strong)] px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--node-text-secondary)]">
                    {isCharacter ? "默认执行形态" : "Active Zone"}
                  </div>
                  {selectedVariant ? (
                    <>
                      <div className="mt-2 text-[14px] font-semibold text-[var(--node-text-primary)]">{selectedVariant.title}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--node-text-secondary)]">
                        {selectedVariant.subtitle}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <div className="rounded-full border border-[var(--node-border)] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--node-text-secondary)]">
                          {selectedVariant.badge}
                        </div>
                        {selectedVariant.isDefault ? (
                          <div className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-emerald-200">
                            <BadgeCheck size={10} />
                            Default
                          </div>
                        ) : null}
                      </div>
                      {selectedVariant.mention ? (
                        <div className="mt-3 text-[11px] uppercase tracking-[0.14em] text-[var(--node-text-secondary)]">
                          绑定语法 {selectedVariant.mention}
                        </div>
                      ) : null}
                      <div className="mt-3 text-[12px] leading-6 text-[var(--node-text-primary)]">{selectedVariant.description}</div>
                    </>
                  ) : (
                    <div className="mt-2 text-[12px] leading-6 text-[var(--node-text-secondary)]">
                      {isCharacter ? "当前角色没有形态卡片。" : "当前场景没有分区卡片。"}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="flex min-h-0 flex-col rounded-[24px] border border-[var(--node-border)] bg-[var(--node-surface)]/70">
              <div className="flex items-center justify-between border-b border-[var(--node-border)] px-4 py-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--node-text-secondary)]">
                    {isCharacter ? "身份形态卡" : "场景分区卡"}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--node-text-secondary)]">
                    {isCharacter ? "这个角色的可执行形态与定模入口" : "这个场景的可执行分区与定模入口"}
                  </div>
                </div>
                <div className="rounded-full border border-[var(--node-border)] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--node-text-secondary)]">
                  {variantCards.length}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {variantCards.length ? (
                  <div className="grid grid-cols-1 gap-3">
                    {variantCards.map((variant) => {
                      const isActive = variant.id === selectedVariant?.id;
                      return (
                        <article
                          key={variant.id}
                          className={`rounded-[22px] border p-3 transition ${
                            isActive
                              ? "border-[var(--node-accent)] bg-[var(--node-surface-strong)]"
                              : "border-[var(--node-border)] bg-[var(--node-surface)] hover:border-[var(--node-border-strong)]"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => updateNodeData(id, { selectedVariantId: variant.id })}
                            className="w-full text-left"
                          >
                            <div className="flex items-start gap-3">
                              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[18px] border border-[var(--node-border)] bg-[var(--node-surface-strong)]">
                                {variant.avatarUrl ? (
                                  <img src={variant.avatarUrl} alt={variant.title} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[var(--node-accent)]">
                                    {isCharacter ? <UserRound size={20} /> : <MapPinned size={20} />}
                                  </div>
                                )}
                                <label className="absolute bottom-1 right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-[var(--node-border)] bg-[rgba(15,18,16,0.88)] text-white">
                                  <Upload size={12} />
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(event) => {
                                      const file = event.target.files?.[0];
                                      void handleAvatarUpload(variant.id, file);
                                      event.currentTarget.value = "";
                                    }}
                                  />
                                </label>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-[13px] font-semibold text-[var(--node-text-primary)]">{variant.title}</div>
                                    <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--node-text-secondary)]">
                                      {variant.subtitle}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {variant.isDefault ? (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-emerald-200">
                                        <BadgeCheck size={9} />
                                        Default
                                      </span>
                                    ) : null}
                                    <div className="rounded-full border border-[var(--node-border)] px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-[var(--node-text-secondary)]">
                                      {variant.badge}
                                    </div>
                                  </div>
                                </div>
                                {variant.mention ? (
                                  <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--node-text-secondary)]">
                                    {variant.mention}
                                  </div>
                                ) : null}
                                <div className="mt-3 text-[12px] leading-6 text-[var(--node-text-primary)]">
                                  {variant.description}
                                </div>
                                {typeof variant.assetsCount === "number" ? (
                                  <div className="mt-3 text-[10px] uppercase tracking-[0.14em] text-[var(--node-text-secondary)]">
                                    {variant.assetsCount} design assets
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </button>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-[12px] text-[var(--node-text-secondary)]">
                    {isCharacter ? "当前角色还没有形态卡片。" : "当前场景还没有分区卡片。"}
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="mt-4 flex flex-1 items-center justify-center rounded-[24px] border border-dashed border-[var(--node-border)] text-[12px] text-[var(--node-text-secondary)]">
            当前项目还没有可展示的角色或场景档案。
          </div>
        )}
      </div>
    </BaseNode>
  );
};
