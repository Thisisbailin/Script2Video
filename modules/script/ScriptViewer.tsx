import React from 'react';
import { Episode } from '../../types';

type Props = {
  episode?: Episode;
  rawScript?: string;
};

export const ScriptViewer: React.FC<Props> = ({ episode, rawScript }) => {
  return (
    <div className="h-full p-8 overflow-auto bg-white dark:bg-gray-950">
      <div className="max-w-4xl mx-auto space-y-8">
        {episode && (
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
            {episode.title}
          </h3>
        )}
        {episode && episode.scenes && episode.scenes.length > 0 ? (
          <div className="space-y-6">
            {episode.scenes.map((scene) => (
              <div key={scene.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-5 bg-white/50 dark:bg-gray-900/60">
                <div className="mb-3">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {scene.id} {scene.title}
                  </h4>
                </div>
                <pre className="whitespace-pre-wrap font-serif text-base leading-relaxed text-gray-800 dark:text-gray-300">
                  {scene.content || '（空场景）'}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <pre className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-gray-800 dark:text-gray-300">
            {episode
              ? episode.content
              : rawScript || <span className="text-gray-400 italic">No script loaded. Upload a text file in Assets.</span>}
          </pre>
        )}
      </div>
    </div>
  );
};
