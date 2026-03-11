import React from "react";
import type { Shot } from "../types";
import { SHOT_TABLE_COLUMNS } from "../utils/shotSchema";

interface Props {
  shots: Shot[];
  showSora: boolean;
  showStoryboard: boolean;
}

const BASE_COLUMN_WIDTHS: Record<(typeof SHOT_TABLE_COLUMNS)[number]["key"], string> = {
  id: "110px",
  duration: "90px",
  shotType: "110px",
  focalLength: "120px",
  movement: "120px",
  composition: "260px",
  blocking: "240px",
  dialogue: "220px",
  sound: "180px",
  lightingVfx: "220px",
  editingNotes: "180px",
  notes: "220px",
  soraPrompt: "320px",
  storyboardPrompt: "340px",
};

export const ShotTable: React.FC<Props> = ({ shots, showSora, showStoryboard }) => {
  const columns = SHOT_TABLE_COLUMNS.filter((column) => {
    if (column.key === "soraPrompt") return showSora;
    if (column.key === "storyboardPrompt") return showStoryboard;
    return true;
  });

  if (shots.length === 0) {
    return (
      <div className="h-full flex items-start justify-center px-6 pt-24 pb-10 text-[var(--text-secondary)] italic">
        No shots generated yet.
      </div>
    );
  }

  const gridTemplateColumns = columns.map((column) => BASE_COLUMN_WIDTHS[column.key]).join(" ");

  return (
    <div className="h-full overflow-auto bg-transparent px-6 pt-10 pb-10">
      <div className="mx-auto max-w-[1600px] rounded-[28px] border border-[var(--border-subtle)]/70 bg-[var(--bg-panel)]/70 shadow-[var(--shadow-soft)] backdrop-blur-xl">
        <div className="min-w-max">
          <div
            className="sticky top-0 z-10 grid border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]/95 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-secondary)] backdrop-blur-xl"
            style={{ gridTemplateColumns }}
          >
            {columns.map((column) => (
              <div key={column.key} className="px-4 py-4">
                {column.label}
              </div>
            ))}
          </div>

          {shots.map((shot) => (
            <div
              key={shot.id}
              className="grid border-b border-[var(--border-subtle)]/60 text-[13px] leading-7 text-[var(--text-primary)] last:border-b-0"
              style={{ gridTemplateColumns }}
            >
              {columns.map((column) => (
                <div key={`${shot.id}-${column.key}`} className="px-4 py-4 whitespace-pre-wrap break-words">
                  {shot[column.key]?.trim() || "-"}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
