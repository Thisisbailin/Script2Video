import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, UserRound } from "lucide-react";
import type { ProjectData } from "../../types";
import { buildProjectIdentities } from "../../utils/identityCards";

type Props = {
  projectData: ProjectData;
  onSelectIdentity: (identityId: string) => void;
  floating?: boolean;
  inlineAnchor?: boolean;
};

const getAvatarLabel = (value: string) => value.trim().slice(0, 1).toUpperCase() || "R";

export const IdentityDock: React.FC<Props> = ({
  projectData,
  onSelectIdentity,
  floating = true,
  inlineAnchor = false,
}) => {
  const [collapsed, setCollapsed] = useState(true);

  const identities = useMemo(
    () =>
      buildProjectIdentities(projectData.context, projectData.designAssets || [])
        .filter((identity) => identity.kind === "person")
        .sort(
          (a, b) =>
            Number(!!b.isMain) - Number(!!a.isMain) ||
            a.displayName.localeCompare(b.displayName, "zh-Hans-CN")
        ),
    [projectData.context, projectData.designAssets]
  );

  const anchorClass = inlineAnchor
    ? "relative h-12 flex items-center"
    : floating
      ? "fixed bottom-4 right-4 z-30"
      : "";

  if (collapsed) {
    return (
      <div className={anchorClass}>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="qalam-surface flex h-11 items-center gap-2 rounded-full px-3.5"
          title={`Roles (${identities.length})`}
        >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-panel-muted)] text-[var(--app-text-secondary)]">
            <UserRound size={14} />
          </span>
          <span className="text-[12px] font-semibold tracking-[0.01em] text-[var(--app-text-primary)]">
            Roles
          </span>
          <span className="text-[11px] text-[var(--app-text-muted)]">{identities.length}</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-panel)]">
            <ChevronUp size={13} className="text-[var(--app-text-secondary)]" />
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className={anchorClass}>
      <div className="qalam-surface flex max-h-[calc(100vh-180px)] w-[360px] flex-col overflow-hidden rounded-[26px]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--app-border)] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[linear-gradient(135deg,rgba(22,44,35,0.82),rgba(16,24,22,0.6))] text-emerald-100">
              <UserRound size={16} />
            </div>
            <div>
              <div className="text-sm font-semibold">Roles</div>
              <div className="text-[11px] text-[var(--app-text-muted)]">
                {identities.length} identity cards
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="h-8 w-8 rounded-full border border-[var(--app-border)] transition hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-muted)]"
            title="Collapse"
          >
            <ChevronDown size={14} className="mx-auto text-[var(--app-text-secondary)]" />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
          {identities.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-[var(--app-border)] px-4 py-5 text-center text-xs text-[var(--app-text-muted)]">
              No role identities yet.
            </div>
          ) : (
            identities.map((identity) => (
              <button
                key={identity.id}
                type="button"
                onClick={() => {
                  onSelectIdentity(identity.id);
                  setCollapsed(true);
                }}
                className="group grid w-full grid-cols-[48px_minmax(0,1fr)] items-center gap-3 rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel-muted)] px-3 py-3 text-left transition hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-soft)]"
              >
                <div className="h-12 w-12 overflow-hidden rounded-[15px] border border-[var(--app-border)] bg-[linear-gradient(135deg,rgba(22,44,35,0.92),rgba(44,88,68,0.84))]">
                  {identity.avatarUrl ? (
                    <img
                      src={identity.avatarUrl}
                      alt={identity.displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[13px] font-semibold text-white">
                      {getAvatarLabel(identity.familyName)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-semibold text-[var(--app-text-primary)]">
                      {identity.displayName}
                    </span>
                    {identity.isMain ? (
                      <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                        Main
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 truncate text-[10px] uppercase tracking-[0.16em] text-[var(--app-text-muted)]">
                    @{identity.mention}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-[var(--app-text-secondary)]">
                    {identity.summary || identity.description || "Load identity card into workflow."}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
