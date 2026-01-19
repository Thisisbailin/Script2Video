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
    <div className="flex items-center gap-2 app-panel px-2 py-1 rounded">
      <button
        onClick={() => toggleEdgePause(edgeId)}
        className={`px-2 py-1 text-xs rounded ${edge.data?.hasPause ? "bg-amber-600 text-white" : "bg-[var(--app-panel-muted)] text-[var(--app-text-primary)]"}`}
      >
        {edge.data?.hasPause ? "Unpause" : "Pause"}
      </button>
      <button onClick={() => removeEdge(edgeId)} className="px-2 py-1 text-xs bg-red-600 text-white rounded">
        Delete
      </button>
    </div>
  );
};
