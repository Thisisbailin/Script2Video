import React from "react";
import { useWorkflowStore } from "../store/workflowStore";

type Props = {
  edgeId: string;
};

export const EdgeToolbar: React.FC<Props> = ({ edgeId }) => {
  const { edges, removeEdge, toggleEdgePause } = useWorkflowStore();
  const edge = edges.find((e) => e.id === edgeId);
  if (!edge) return null;

  return (
    <div className="flex items-center gap-2 bg-[#0f0f0f] text-white px-2 py-1 rounded border border-gray-700 shadow">
      <button
        onClick={() => toggleEdgePause(edgeId)}
        className={`px-2 py-1 text-xs rounded ${edge.data?.hasPause ? "bg-amber-600" : "bg-gray-800"}`}
      >
        {edge.data?.hasPause ? "Unpause" : "Pause"}
      </button>
      <button onClick={() => removeEdge(edgeId)} className="px-2 py-1 text-xs bg-red-600 rounded">
        Delete
      </button>
    </div>
  );
};
