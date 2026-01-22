import React, { useState } from "react";
import { FileText, Sparkles, Target } from "lucide-react";

type SectionKey = "about" | "roadmap";

export const InfoPanel: React.FC = () => {
  const [active, setActive] = useState<SectionKey>("about");

  return (
    <div className="space-y-4 text-[var(--app-text-primary)]">
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4 space-y-3">
            <div className="text-[11px] uppercase tracking-widest app-text-muted">Account</div>
            {[
              { key: "about" as const, label: "About", Icon: FileText },
              { key: "roadmap" as const, label: "Roadmap", Icon: Target },
            ].map(({ key, label, Icon }) => {
              const activeItem = active === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActive(key)}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[12px] border transition ${
                    activeItem
                      ? "bg-[var(--app-panel-soft)] border-[var(--app-border-strong)] text-[var(--app-text-primary)]"
                      : "border-[var(--app-border)] text-[var(--app-text-secondary)] hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-primary)]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon size={14} />
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4 text-[11px] text-[var(--app-text-secondary)] space-y-2">
            <div className="uppercase tracking-widest">Info</div>
            <div>Qalam is evolving into a full production stack.</div>
            <div>Agent settings now host visual/video routes.</div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4 space-y-4">
          {active === "about" ? (
            <>
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-[var(--app-border)] flex items-center justify-center">
                  <Sparkles size={18} className="text-emerald-200" />
                </div>
                <div>
                  <div className="text-lg font-semibold">Qalam</div>
                  <div className="text-[12px] text-[var(--app-text-secondary)]">v0.3 · NodeLab</div>
                  <div className="text-[12px] text-[var(--app-text-secondary)] mt-2 max-w-xl">
                    Node-first AIGC workflow for script, assets, and production planning.
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { label: "Workspace", value: "NodeLab" },
                  { label: "Pipeline", value: "Script → Assets → Shots" },
                  { label: "Agents", value: "Qalam System" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-3"
                  >
                    <div className="text-[11px] text-[var(--app-text-secondary)] uppercase tracking-widest">
                      {item.label}
                    </div>
                    <div className="text-[13px] font-semibold mt-1">{item.value}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="text-lg font-semibold">Roadmap</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  {
                    title: "Timeline & Replay",
                    desc: "Browse generation history, compare versions, and branch edits.",
                  },
                  {
                    title: "Asset Management",
                    desc: "Centralize images, videos, and prompts with tagging.",
                  },
                  {
                    title: "Collaboration",
                    desc: "Team reviews, annotations, and release approvals.",
                  },
                  {
                    title: "Publishing",
                    desc: "Export pipelines, CDN delivery, and versioned releases.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4 space-y-2"
                  >
                    <div className="text-[13px] font-semibold">{item.title}</div>
                    <div className="text-[12px] text-[var(--app-text-secondary)]">{item.desc}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
