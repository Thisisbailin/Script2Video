import React from 'react';
import { Episode } from '../../types';

type Props = {
  episode?: Episode;
  rawScript?: string;
};

export const ScriptViewer: React.FC<Props> = ({ episode, rawScript }) => {
  return (
    <div className="h-full px-8 pt-20 pb-12 overflow-auto bg-transparent text-[var(--text-primary)]">
      <div className="max-w-4xl mx-auto space-y-8">
        {episode && (
          <h3 className="text-3xl font-bold text-[var(--text-primary)]">
            {episode.title}
          </h3>
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
