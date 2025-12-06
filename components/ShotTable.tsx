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
    <div className="h-full overflow-auto">
      <table className="w-full text-sm text-left text-gray-300">
        <thead className="text-xs text-gray-400 uppercase bg-gray-800 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 w-20">Shot #</th>
            <th className="px-4 py-3 w-24">Dur</th>
            <th className="px-4 py-3 w-24">Type</th>
            <th className="px-4 py-3 w-24">Move</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3">Dialogue</th>
            {showSora && <th className="px-4 py-3 bg-indigo-900/30 text-indigo-300">Sora Prompt</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {shots.map((shot, idx) => (
            <tr key={idx} className="hover:bg-gray-800/50 transition-colors">
              <td className="px-4 py-3 font-mono text-gray-500">{shot.id}</td>
              <td className="px-4 py-3">{shot.duration}</td>
              <td className="px-4 py-3">
                <span className="px-2 py-1 bg-gray-700 rounded text-xs">{shot.shotType}</span>
              </td>
              <td className="px-4 py-3">{shot.movement}</td>
              <td className="px-4 py-3 text-gray-200">{shot.description}</td>
              <td className="px-4 py-3 italic text-gray-400">{shot.dialogue}</td>
              {showSora && (
                <td className="px-4 py-3 bg-indigo-900/10 text-indigo-200 border-l border-gray-800">
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
