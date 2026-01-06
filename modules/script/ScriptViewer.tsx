import React from 'react';
import { Character, Episode } from '../../types';

type Props = {
  episode?: Episode;
  rawScript?: string;
  characters?: Character[];
};

export const ScriptViewer: React.FC<Props> = ({ episode, rawScript, characters }) => {
  const characterMap = React.useMemo(() => {
    const map = new Map<string, Character>();
    (characters || []).forEach((c) => map.set(c.name, c));
    return map;
  }, [characters]);

  const cast = episode?.characters || [];

  return (
    <div className="h-full px-8 pt-20 pb-12 overflow-auto bg-transparent text-[var(--text-primary)]">
      <div className="max-w-4xl mx-auto space-y-8">
        {episode && (
          <h3 className="text-3xl font-bold text-[var(--text-primary)]">
            {episode.title}
          </h3>
        )}
        {cast.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {cast.map((name) => {
              const info = characterMap.get(name);
              const count = info?.appearanceCount;
              const isMain = info?.isMain;
              return (
                <span
                  key={`${episode?.id || 'ep'}-${name}`}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    isMain
                      ? 'border-emerald-400/60 text-emerald-100 bg-emerald-500/10'
                      : 'border-white/15 text-white/70 bg-white/5'
                  }`}
                  title={info?.episodeUsage ? `出现：${info.episodeUsage}` : undefined}
                >
                  {name}
                  {typeof count === 'number' ? ` x${count}` : ""}
                </span>
              );
            })}
          </div>
        )}
        {episode && episode.scenes && episode.scenes.length > 0 ? (
          <div className="space-y-6">
            {episode.scenes.map((scene) => (
              <div
                key={scene.id}
                className="border border-[var(--border-subtle)]/90 rounded-2xl p-5 bg-[var(--bg-overlay)] shadow-[var(--shadow-soft)]"
              >
                <div className="mb-3">
                  <h4 className="text-lg font-semibold text-[var(--text-primary)]">
                    {scene.id} {scene.title}
                  </h4>
                </div>
                <pre className="whitespace-pre-wrap font-serif text-base leading-relaxed text-[var(--text-secondary)]">
                  {scene.content || '（空场景）'}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-[var(--border-subtle)]/90 rounded-2xl p-5 bg-[var(--bg-overlay)] shadow-[var(--shadow-soft)]">
            <pre className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-[var(--text-secondary)]">
              {episode
                ? episode.content
                : rawScript || <span className="text-[var(--text-secondary)] italic">No script loaded. Upload a text file in Assets.</span>}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
