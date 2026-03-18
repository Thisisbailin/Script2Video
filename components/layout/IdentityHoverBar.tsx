import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Fingerprint } from "lucide-react";
import type { ProjectData } from "../../types";
import { buildProjectIdentities } from "../../utils/identityCards";

type Props = {
  projectData: ProjectData;
  onSelectIdentity: (identityId: string) => void;
};

const timelineSteps = ["写作", "世界观", "影像"];

const getAvatarLabel = (value: string) => value.trim().slice(0, 1).toUpperCase() || "I";

export const IdentityHoverBar: React.FC<Props> = ({ projectData, onSelectIdentity }) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const identities = useMemo(() => {
    return buildProjectIdentities(projectData.context, projectData.designAssets || [])
      .filter((identity) => identity.kind === "person")
      .sort((a, b) => Number(!!b.isMain) - Number(!!a.isMain) || a.displayName.localeCompare(b.displayName, "zh-Hans-CN"));
  }, [projectData.context, projectData.designAssets]);

  const visibleIdentities = identities.slice(0, 5);
  const extraCount = Math.max(0, identities.length - visibleIdentities.length);

  useEffect(() => {
    if (!isMoreOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isMoreOpen]);

  if (!identities.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[52] h-24">
      <div className="group relative h-full pointer-events-auto">
        <div className="absolute inset-x-0 top-0 h-24" />
        <div className="absolute left-1/2 top-3 w-[min(980px,calc(100vw-1.5rem))] -translate-x-1/2 rounded-[30px] border border-white/8 bg-[rgba(11,14,13,0.18)] px-4 py-3 opacity-0 shadow-[0_20px_50px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-[22px] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 dark:border-white/10 dark:bg-[rgba(8,10,10,0.34)]">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.32em] text-[var(--text-secondary)]/75">
              <div className="h-px w-8 bg-[var(--border-subtle)]/80" />
              Project Identity Rail
            </div>

            <div className="flex items-center justify-center gap-3 rounded-full border border-white/8 bg-white/[0.04] px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="h-px w-8 bg-[var(--border-subtle)]/80" />
              {timelineSteps.map((step, index) => (
                <React.Fragment key={step}>
                  <span className="text-[11px] font-medium tracking-[0.18em] text-[var(--text-primary)]/88">
                    {step}
                  </span>
                  {index < timelineSteps.length - 1 ? (
                    <span className="text-[10px] tracking-[0.24em] text-[var(--text-secondary)]/55">-</span>
                  ) : null}
                </React.Fragment>
              ))}
              <div className="h-px w-8 bg-[var(--border-subtle)]/80" />
            </div>

            <div className="relative flex items-center justify-end gap-2" ref={popoverRef}>
              <div className="flex items-center justify-end -space-x-3">
                {visibleIdentities.map((identity, index) => (
                  <button
                    key={identity.id}
                    type="button"
                    onClick={() => onSelectIdentity(identity.id)}
                    className="group/avatar relative h-10 w-10 overflow-hidden rounded-full border border-white/14 bg-[linear-gradient(135deg,rgba(18,27,24,0.92),rgba(28,48,42,0.92))] text-[11px] font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:z-10 hover:-translate-y-[2px] hover:border-emerald-300/35"
                    style={{ zIndex: visibleIdentities.length - index }}
                    title={`${identity.displayName} · ${identity.summary}`}
                  >
                    {identity.avatarUrl ? (
                      <img src={identity.avatarUrl} alt={identity.displayName} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(20,38,31,0.9),rgba(30,70,55,0.92))]">
                        {getAvatarLabel(identity.familyName)}
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {extraCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setIsMoreOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)]/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[1px] hover:bg-white/[0.08]"
                >
                  +{extraCount}
                  <ChevronDown size={12} className={`transition-transform duration-300 ${isMoreOpen ? "rotate-180" : ""}`} />
                </button>
              ) : null}

              {isMoreOpen ? (
                <div className="absolute right-0 top-full mt-3 w-[360px] rounded-[26px] border border-white/10 bg-[rgba(10,12,12,0.92)] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-[24px]">
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]/78">
                      项目角色身份证
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full border border-emerald-400/18 bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-200/90">
                      <Fingerprint size={10} />
                      {identities.length}
                    </div>
                  </div>

                  <div className="max-h-[320px] space-y-1 overflow-y-auto px-1 pb-1">
                    {identities.map((identity) => (
                      <button
                        key={identity.id}
                        type="button"
                        onClick={() => {
                          onSelectIdentity(identity.id);
                          setIsMoreOpen(false);
                        }}
                        className="grid w-full grid-cols-[48px_minmax(0,1fr)] items-center gap-3 rounded-[20px] border border-transparent bg-white/[0.03] px-3 py-2.5 text-left transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-emerald-300/18 hover:bg-white/[0.06]"
                      >
                        <div className="h-12 w-12 overflow-hidden rounded-[16px] border border-white/10 bg-[linear-gradient(135deg,rgba(20,38,31,0.9),rgba(30,70,55,0.92))]">
                          {identity.avatarUrl ? (
                            <img src={identity.avatarUrl} alt={identity.displayName} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[13px] font-semibold text-white">
                              {getAvatarLabel(identity.familyName)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-semibold tracking-[0.02em] text-[var(--text-primary)]">
                            {identity.displayName}
                          </div>
                          <div className="mt-1 truncate text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]/72">
                            {identity.summary}
                          </div>
                          <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-[var(--text-secondary)]/86">
                            {identity.description}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
