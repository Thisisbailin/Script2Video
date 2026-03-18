import React, { useCallback, useMemo } from "react";
import { AtSign, Fingerprint, Layers, MapPinned, Upload, UserRound } from "lucide-react";
import { BaseNode } from "./BaseNode";
import { IdentityCardNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";
import { buildProjectIdentities, resolveLegacyIdentity, type ProjectIdentity } from "../../utils/identityCards";

type Props = {
  id: string;
  data: IdentityCardNodeData;
};

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

const toneClasses: Record<ProjectIdentity["tone"], { surface: string; border: string; text: string }> = {
  emerald: {
    surface: "bg-emerald-500/12",
    border: "border-emerald-400/28",
    text: "text-emerald-200",
  },
  sky: {
    surface: "bg-sky-500/12",
    border: "border-sky-400/28",
    text: "text-sky-200",
  },
};

export const IdentityCardNode: React.FC<Props & { selected?: boolean }> = ({ id, data, selected }) => {
  const { updateNodeData, labContext } = useWorkflowStore();
  const avatarOverrides = data.avatarOverrides || {};

  const identities = useMemo(
    () => buildProjectIdentities(labContext.context, labContext.designAssets || []),
    [labContext.context, labContext.designAssets]
  );

  const activeIdentity = useMemo(
    () =>
      resolveLegacyIdentity(identities, {
        identityId: data.identityId,
      }),
    [data.identityId, identities]
  );

  const siblingIdentities = useMemo(() => {
    if (!activeIdentity) return [];
    return identities.filter((item) => item.familyId === activeIdentity.familyId && item.id !== activeIdentity.id);
  }, [activeIdentity, identities]);

  const commitIdentitySelection = useCallback(
    (identity: ProjectIdentity | undefined | null) => {
      if (!identity) return;
      updateNodeData(id, {
        identityId: identity.id,
      });
    },
    [id, updateNodeData]
  );

  const handleAvatarUpload = useCallback(
    async (identity: ProjectIdentity, file?: File | null) => {
      if (!file) return;
      const nextUrl = await readFileAsDataUrl(file);
      updateNodeData(id, {
        avatarOverrides: {
          ...avatarOverrides,
          [identity.id]: nextUrl,
        },
      });
    },
    [avatarOverrides, id, updateNodeData]
  );

  if (!activeIdentity) {
    return (
      <BaseNode title={data.title || "身份卡片节点"} outputs={["text"]} selected={selected}>
        <div className="flex min-h-[220px] items-center justify-center rounded-[24px] border border-dashed border-[var(--node-border)] text-[12px] text-[var(--node-text-secondary)]">
          当前项目还没有可展示的身份证。
        </div>
      </BaseNode>
    );
  }

  const tone = toneClasses[activeIdentity.tone];
  const avatarUrl = avatarOverrides[activeIdentity.id] || activeIdentity.avatarUrl;

  return (
    <BaseNode title={data.title || "身份卡片节点"} outputs={["text"]} selected={selected}>
      <div className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--node-border)] pb-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--node-border)] bg-[var(--node-surface-strong)] text-[var(--node-accent)]">
              <Layers size={18} />
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold tracking-[-0.02em] text-[var(--node-text-primary)]">
                  {data.title || "身份卡片节点"}
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--node-text-secondary)]">
                  Identity Passport
                </div>
              </div>
              <select
                value={activeIdentity.id}
                onChange={(event) => commitIdentitySelection(identities.find((item) => item.id === event.target.value))}
                className="min-w-[180px] max-w-[240px] rounded-[10px] border border-[var(--node-border)] bg-[var(--node-surface-strong)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--node-text-primary)] outline-none transition focus:border-[var(--node-accent)]"
              >
                {identities.map((identity) => (
                  <option key={identity.id} value={identity.id}>
                    {identity.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={`h-8 w-8 rounded-full border ${tone.border} ${tone.surface}`} title={activeIdentity.kind === "person" ? "人物身份" : "场景身份"} />
        </div>

        <div className="mt-3">
          <section className="flex min-h-0 flex-col rounded-[24px] border border-[var(--node-border)] bg-[var(--node-surface)]/70">
            <div className="border-b border-[var(--node-border)] px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-[var(--node-border)] bg-[var(--node-surface-strong)] text-[var(--node-accent)]">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={activeIdentity.displayName} className="h-full w-full rounded-[22px] object-cover" />
                  ) : activeIdentity.kind === "person" ? (
                    <UserRound size={24} />
                  ) : (
                    <MapPinned size={24} />
                  )}
                  <label className="absolute -bottom-1 -right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-[var(--node-border)] bg-[rgba(15,18,16,0.92)] text-white shadow-[0_8px_18px_rgba(0,0,0,0.24)]">
                    <Upload size={11} />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        void handleAvatarUpload(activeIdentity, file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-[18px] font-semibold tracking-[-0.02em] text-[var(--node-text-primary)]">
                      {activeIdentity.familyName}
                    </div>
                    <div className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${tone.border} ${tone.surface} ${tone.text}`}>
                      {activeIdentity.givenName}
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[var(--node-text-secondary)]">
                    {activeIdentity.displayName}
                  </div>
                  <div className="mt-2 text-[12px] text-[var(--node-text-secondary)]">
                    {activeIdentity.title} · {activeIdentity.subtitle}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-[18px] border border-[var(--node-border)] bg-[var(--node-surface-strong)] px-4 py-3">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--node-text-secondary)]">
                  <Fingerprint size={12} />
                  身份证信息
                </div>
                <div className="mt-3 space-y-2 text-[12px] leading-6 text-[var(--node-text-primary)]">
                  {activeIdentity.detailLines.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              </div>

              <div className="mt-3 rounded-[18px] border border-[var(--node-border)] bg-[var(--node-surface-strong)] px-4 py-3 text-[12px] leading-6 text-[var(--node-text-primary)]">
                {activeIdentity.description}
              </div>
            </div>

            <div className="px-4 py-4">
              <div className="rounded-[20px] border border-[var(--node-border)] bg-[var(--node-surface-strong)] px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--node-text-secondary)]">
                  身份唤起
                </div>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--node-border)] px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-[var(--node-text-primary)]">
                  <AtSign size={12} />
                  @{activeIdentity.mention}
                </div>

                {siblingIdentities.length > 0 ? (
                  <div className="mt-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--node-text-secondary)]">
                      同谱系身份证
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {siblingIdentities.map((identity) => {
                        const siblingTone = toneClasses[identity.tone];
                        return (
                          <button
                            key={identity.id}
                            type="button"
                            onClick={() => commitIdentitySelection(identity)}
                            className={`rounded-full border px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] transition ${siblingTone.border} ${siblingTone.surface} ${siblingTone.text}`}
                          >
                            @{identity.mention}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </BaseNode>
  );
};
