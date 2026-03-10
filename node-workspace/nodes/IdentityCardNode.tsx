import React, { useMemo } from "react";
import { MapPinned, UserRound } from "lucide-react";
import type { Character, DesignAssetItem, Location } from "../../types";
import { BaseNode } from "./BaseNode";
import { IdentityCardNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";

type Props = {
  id: string;
  data: IdentityCardNodeData;
};

const getInitials = (value: string) => value.slice(0, 2).toUpperCase();

const collectCharacterAssets = (character: Character, assets: DesignAssetItem[]) =>
  (character.forms || []).flatMap((form) =>
    assets.filter((asset) => asset.category === "form" && asset.refId === `${character.id}|${form.id}`)
  );

const collectSceneAssets = (location: Location, assets: DesignAssetItem[]) => {
  const zoneIds = new Set((location.zones || []).map((zone) => zone.id));
  return assets.filter((asset) => asset.category === "zone" && (zoneIds.has(asset.refId) || Array.from(zoneIds).some((id) => asset.refId.includes(id))));
};

export const IdentityCardNode: React.FC<Props & { selected?: boolean }> = ({ id, data, selected }) => {
  const { updateNodeData, labContext } = useWorkflowStore();
  const characters = labContext.context.characters || [];
  const locations = labContext.context.locations || [];
  const designAssets = labContext.designAssets || [];

  const activeCharacter = useMemo(() => {
    return characters.find((item) => item.id === data.entityId) ?? characters[0] ?? null;
  }, [characters, data.entityId]);

  const activeLocation = useMemo(() => {
    return locations.find((item) => item.id === data.entityId) ?? locations[0] ?? null;
  }, [locations, data.entityId]);

  const isCharacter = data.entityType !== "scene";
  const characterAssets = activeCharacter ? collectCharacterAssets(activeCharacter, designAssets) : [];
  const sceneAssets = activeLocation ? collectSceneAssets(activeLocation, designAssets) : [];

  return (
    <BaseNode
      title={data.title || "身份卡片"}
      onTitleChange={(title) => updateNodeData(id, { title })}
      outputs={["text"]}
      selected={selected}
    >
      <div className="flex flex-col gap-4 h-full min-h-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updateNodeData(id, { entityType: "character", entityId: characters[0]?.id })}
              className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] transition ${
                isCharacter
                  ? "bg-[var(--node-accent)] text-white"
                  : "border border-[var(--node-border)] text-[var(--node-text-secondary)]"
              }`}
            >
              角色
            </button>
            <button
              type="button"
              onClick={() => updateNodeData(id, { entityType: "scene", entityId: locations[0]?.id })}
              className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] transition ${
                !isCharacter
                  ? "bg-[var(--node-accent)] text-white"
                  : "border border-[var(--node-border)] text-[var(--node-text-secondary)]"
              }`}
            >
              场景
            </button>
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--node-text-secondary)]">
            {isCharacter ? "Identity / Character" : "Identity / Scene"}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {(isCharacter ? characters : locations).map((item) => {
            const active = item.id === (isCharacter ? activeCharacter?.id : activeLocation?.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => updateNodeData(id, { entityId: item.id })}
                className={`shrink-0 rounded-[20px] border px-3 py-2 text-left transition min-w-[120px] ${
                  active
                    ? "border-[var(--node-accent)] bg-[var(--node-surface-strong)] text-[var(--node-text-primary)]"
                    : "border-[var(--node-border)] bg-[var(--node-surface)] text-[var(--node-text-secondary)] hover:border-[var(--node-border-strong)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--node-surface-strong)] text-[11px] font-black text-[var(--node-accent)]">
                    {isCharacter ? getInitials((item as Character).name) : <MapPinned size={14} />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold">{item.name}</div>
                    <div className="truncate text-[10px] uppercase tracking-[0.14em] opacity-70">
                      {isCharacter ? ((item as Character).role || "角色") : ((item as Location).type || "场景")}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {isCharacter && activeCharacter ? (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
            <section className="node-surface rounded-[24px] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[var(--node-surface-strong)] text-[var(--node-accent)]">
                    <UserRound size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[18px] font-semibold truncate">{activeCharacter.name}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[var(--node-text-secondary)]">{activeCharacter.role || "角色身份"}</div>
                  </div>
                </div>
                <div className="node-pill node-pill--accent px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
                  {(activeCharacter.forms || []).length} Forms
                </div>
              </div>
              <div className="mt-4 rounded-[18px] bg-[var(--node-surface-strong)] px-4 py-3 text-[12px] leading-6 text-[var(--node-text-primary)] whitespace-pre-wrap">
                {activeCharacter.bio || "暂无角色简介。"}
              </div>
            </section>

            {(activeCharacter.forms || []).length ? (
              <section className="grid grid-cols-1 gap-3">
                {activeCharacter.forms.map((form) => (
                  <article key={form.id} className="rounded-[22px] border border-[var(--node-border)] bg-[var(--node-surface)] p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[13px] font-semibold">{form.formName}</div>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--node-text-secondary)]">{form.episodeRange || "未标注集数"}</div>
                      </div>
                      <div className="node-pill px-3 py-1 text-[10px]">{form.identityOrState || "默认状态"}</div>
                    </div>
                    <div className="text-[12px] leading-6 text-[var(--node-text-secondary)]">{form.description || "暂无形态描述。"}</div>
                  </article>
                ))}
              </section>
            ) : null}

            {characterAssets.length ? (
              <section className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--node-text-secondary)]">Related Design Assets</div>
                <div className="grid grid-cols-3 gap-2">
                  {characterAssets.slice(0, 6).map((asset) => (
                    <div key={asset.id} className="overflow-hidden rounded-[18px] border border-[var(--node-border)] bg-[var(--node-surface-strong)] aspect-square">
                      <img src={asset.url} alt={asset.label || asset.id} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : activeLocation ? (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
            <section className="node-surface rounded-[24px] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[18px] font-semibold">{activeLocation.name}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[var(--node-text-secondary)]">{activeLocation.type || "场景身份"}</div>
                </div>
                <div className="node-pill node-pill--accent px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
                  {(activeLocation.zones || []).length} Zones
                </div>
              </div>
              <div className="mt-4 rounded-[18px] bg-[var(--node-surface-strong)] px-4 py-3 text-[12px] leading-6 text-[var(--node-text-primary)] whitespace-pre-wrap">
                {activeLocation.description || "暂无场景描述。"}
              </div>
              {activeLocation.visuals ? (
                <div className="mt-3 text-[11px] leading-5 text-[var(--node-text-secondary)]">视觉气质：{activeLocation.visuals}</div>
              ) : null}
            </section>

            {(activeLocation.zones || []).length ? (
              <section className="grid grid-cols-1 gap-3">
                {activeLocation.zones.map((zone) => (
                  <article key={zone.id} className="rounded-[22px] border border-[var(--node-border)] bg-[var(--node-surface)] p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[13px] font-semibold">{zone.name}</div>
                        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--node-text-secondary)]">{zone.episodeRange || "未标注集数"}</div>
                      </div>
                      <div className="node-pill px-3 py-1 text-[10px]">{zone.kind || "zone"}</div>
                    </div>
                    <div className="text-[12px] leading-6 text-[var(--node-text-secondary)]">
                      {zone.layoutNotes || zone.keyProps || zone.lightingWeather || "暂无分区描述。"}
                    </div>
                  </article>
                ))}
              </section>
            ) : null}

            {sceneAssets.length ? (
              <section className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--node-text-secondary)]">Related Design Assets</div>
                <div className="grid grid-cols-3 gap-2">
                  {sceneAssets.slice(0, 6).map((asset) => (
                    <div key={asset.id} className="overflow-hidden rounded-[18px] border border-[var(--node-border)] bg-[var(--node-surface-strong)] aspect-square">
                      <img src={asset.url} alt={asset.label || asset.id} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <div className="node-surface rounded-[24px] p-6 flex-1 flex items-center justify-center text-[12px] text-[var(--node-text-secondary)] text-center">
            当前项目还没有可展示的角色或场景档案。
          </div>
        )}
      </div>
    </BaseNode>
  );
};
