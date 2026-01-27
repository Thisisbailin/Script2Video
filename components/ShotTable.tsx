
import React from 'react';
import { Shot } from '../types';
import { Film, Timer, MoveRight, MessageSquare, Wand2, Star, Image, Aperture, Mic, Sun, Scissors } from 'lucide-react';

interface Props {
  shots: Shot[];
  showSora: boolean;
  showStoryboard: boolean;
}

export const ShotTable: React.FC<Props> = ({ shots, showSora, showStoryboard }) => {
  if (shots.length === 0) {
    return (
      <div className="h-full flex items-start justify-center text-[var(--text-secondary)] italic bg-transparent px-6 pt-24 pb-10">
        No shots generated yet.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-transparent transition-colors px-6 pt-20 pb-10">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm">
            <Film size={16} className="text-[var(--text-primary)]/80" />
            <span>Shot Preview</span>
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            共 {shots.length} 条 · 更适合阅读的卡片视图
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          {shots.map((shot, idx) => (
            <div
              key={idx}
              className="relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)] shadow-[var(--shadow-strong)] p-4 space-y-3 hover:border-[var(--accent-blue)]/50 transition-all overflow-hidden"
            >

              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                    <span className="px-2 py-1 rounded-full bg-white/5 border border-[var(--border-subtle)] font-mono text-[12px]">
                      {shot.id}
                    </span>
                    <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                      <Timer size={14} /> {shot.duration}
                    </span>
                    {renderStars(shot.difficulty)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="px-2 py-1 rounded-full bg-white/8 border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)]">
                      {shot.shotType}
                    </span>
                    {shot.focalLength && (
                      <span className="px-2 py-1 rounded-full bg-white/5 text-[11px] text-[var(--text-secondary)] border border-[var(--border-subtle)]/70 inline-flex items-center gap-1">
                        <Aperture size={12} /> {shot.focalLength}
                      </span>
                    )}
                    <span className="px-2 py-1 rounded-full bg-white/5 text-[11px] text-[var(--text-secondary)] border border-[var(--border-subtle)]/70 inline-flex items-center gap-1">
                      <MoveRight size={12} /> {shot.movement || 'Static'}
                    </span>
                  </div>
                </div>
              </div>

              {shot.composition && (
                <div className="text-sm text-[var(--text-primary)] leading-relaxed relative z-10">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-secondary)] mr-2">机位/构图</span>
                  {shot.composition}
                </div>
              )}

              {shot.blocking && (
                <div className="text-sm text-[var(--text-primary)] leading-relaxed relative z-10">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-secondary)] mr-2">调度/动作</span>
                  {shot.blocking}
                </div>
              )}

              {shot.dialogue && (
                <div className="text-sm italic text-[var(--text-primary)] bg-white/8 border border-[var(--border-subtle)]/70 rounded-xl px-3 py-2 flex items-start gap-2 relative z-10">
                  <MessageSquare size={14} className="mt-0.5" />
                  <span>{shot.dialogue}</span>
                </div>
              )}

              {shot.sound && (
                <div className="text-sm text-[var(--text-primary)] bg-white/5 border border-[var(--border-subtle)]/50 rounded-xl px-3 py-2 flex items-start gap-2 relative z-10">
                  <Mic size={14} className="mt-0.5 text-[var(--text-secondary)]" />
                  <span>{shot.sound}</span>
                </div>
              )}

              {shot.lightingVfx && (
                <div className="text-sm text-[var(--text-primary)] bg-white/5 border border-[var(--border-subtle)]/50 rounded-xl px-3 py-2 flex items-start gap-2 relative z-10">
                  <Sun size={14} className="mt-0.5 text-[var(--text-secondary)]" />
                  <span>{shot.lightingVfx}</span>
                </div>
              )}

              {shot.editingNotes && (
                <div className="text-sm text-[var(--text-primary)] bg-white/5 border border-[var(--border-subtle)]/50 rounded-xl px-3 py-2 flex items-start gap-2 relative z-10">
                  <Scissors size={14} className="mt-0.5 text-[var(--text-secondary)]" />
                  <span>{shot.editingNotes}</span>
                </div>
              )}

              {shot.notes && (
                <div className="text-sm text-[var(--text-primary)] bg-white/5 border border-[var(--border-subtle)]/50 rounded-xl px-3 py-2 relative z-10">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-secondary)] mr-2">备注</span>
                  {shot.notes}
                </div>
              )}

              {showStoryboard && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-amber-50/10 text-[var(--text-primary)] px-3 py-2 text-sm flex items-start gap-2 relative z-10">
                  <Image size={14} className="mt-0.5" />
                  <span>{shot.storyboardPrompt || <span className="opacity-60">Storyboard prompt pending...</span>}</span>
                </div>
              )}

              {showSora && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-muted)]/90 text-[var(--text-primary)] px-3 py-2 text-sm flex items-start gap-2 relative z-10">
                  <Wand2 size={14} className="mt-0.5" />
                  <span>{shot.soraPrompt || <span className="opacity-60">Sora prompt pending...</span>}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
  const renderStars = (difficulty?: number) => {
    const rating = Math.min(Math.max((difficulty ?? 5) / 2, 0), 5); // map 0-10 to 0-5
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => {
          const fill = rating >= i + 1 ? "text-amber-400" : rating > i ? "text-amber-300/70" : "text-[var(--text-secondary)]/40";
          return <Star key={i} size={14} className={fill} fill={fill.includes("amber") ? "currentColor" : "none"} />;
        })}
        <span className="text-[11px] text-[var(--text-secondary)]">
          {difficulty !== undefined ? `${difficulty}/10` : "未标注"}
        </span>
      </div>
    );
  };
