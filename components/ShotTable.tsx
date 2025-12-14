
import React from 'react';
import { Shot } from '../types';

interface Props {
  shots: Shot[];
  showSora: boolean;
}

export const ShotTable: React.FC<Props> = ({ shots, showSora }) => {
  if (shots.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 italic">
        No shots generated yet.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-white dark:bg-gray-900 transition-colors">
      <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
        <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700">
          <tr>
            <th className="px-4 py-3 w-20 font-semibold">Shot #</th>
            <th className="px-4 py-3 w-24 font-semibold">Dur</th>
            <th className="px-4 py-3 w-24 font-semibold">Type</th>
            <th className="px-4 py-3 w-24 font-semibold">Move</th>
            <th className="px-4 py-3 font-semibold">Description</th>
            <th className="px-4 py-3 font-semibold">Dialogue</th>
            {showSora && <th className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold">Sora Prompt</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {shots.map((shot, idx) => (
            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <td className="px-4 py-3 font-mono text-gray-500">{shot.id}</td>
              <td className="px-4 py-3">{shot.duration}</td>
              <td className="px-4 py-3">
                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">{shot.shotType}</span>
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{shot.movement}</td>
              <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">{shot.description}</td>
              <td className="px-4 py-3 italic text-gray-500 dark:text-gray-400">{shot.dialogue}</td>
              {showSora && (
                <td className="px-4 py-3 bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-800 dark:text-indigo-200 border-l border-gray-100 dark:border-gray-800">
                  {shot.soraPrompt || <span className="opacity-30">Pending...</span>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
