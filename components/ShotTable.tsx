
import React from 'react';
import { Shot } from '../types';

interface Props {
  shots: Shot[];
  showSora: boolean;
}

export const ShotTable: React.FC<Props> = ({ shots, showSora }) => {
  if (shots.length === 0) {
    return (
      <div className="h-full flex items-start justify-center text-[var(--text-secondary)] italic bg-[var(--bg-panel)] px-6 pt-24 pb-10">
        No shots generated yet.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-[var(--bg-panel)] transition-colors px-6 pt-20 pb-10">
      <table className="w-full text-sm text-left text-[var(--text-primary)]">
        <thead className="text-xs text-[var(--text-secondary)] uppercase bg-[var(--bg-panel)]/80 sticky top-0 z-10 border-b border-[var(--border-subtle)]">
          <tr>
            <th className="px-4 py-3 w-20 font-semibold">Shot #</th>
            <th className="px-4 py-3 w-24 font-semibold">Dur</th>
            <th className="px-4 py-3 w-24 font-semibold">Type</th>
            <th className="px-4 py-3 w-24 font-semibold">Move</th>
            <th className="px-4 py-3 font-semibold">Description</th>
            <th className="px-4 py-3 font-semibold">Dialogue</th>
            {showSora && <th className="px-4 py-3 bg-indigo-900/20 text-indigo-200 font-semibold">Sora Prompt</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]/60">
          {shots.map((shot, idx) => (
            <tr key={idx} className="hover:bg-white/5 transition-colors">
              <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{shot.id}</td>
              <td className="px-4 py-3">{shot.duration}</td>
              <td className="px-4 py-3">
                <span className="px-2 py-1 bg-white/5 rounded text-xs text-[var(--text-primary)] border border-[var(--border-subtle)]">{shot.shotType}</span>
              </td>
              <td className="px-4 py-3 text-[var(--text-secondary)]">{shot.movement}</td>
              <td className="px-4 py-3 text-[var(--text-primary)] font-medium">{shot.description}</td>
              <td className="px-4 py-3 italic text-[var(--text-secondary)]">{shot.dialogue}</td>
              {showSora && (
                <td className="px-4 py-3 bg-indigo-900/10 text-indigo-200 border-l border-[var(--border-subtle)]/60">
                  {shot.soraPrompt || <span className="opacity-40">Pending...</span>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
