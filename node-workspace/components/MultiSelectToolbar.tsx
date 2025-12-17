import React from "react";
import { useWorkflowStore } from "../store/workflowStore";

export const MultiSelectToolbar: React.FC = () => {
  const { nodes, removeNode, clearClipboard, copySelectedNodes, pasteNodes } = useWorkflowStore();
  const selected = nodes.filter((n) => n.selected);
  if (selected.length === 0) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#0f0f0f] text-white px-3 py-2 rounded-full border border-gray-700 shadow-lg">
      <span className="text-xs text-gray-300">{selected.length} selected</span>
      <button
        onClick={() => copySelectedNodes()}
        className="px-2 py-1 text-xs bg-gray-800 rounded-full"
      >
        Copy
      </button>
      <button
        onClick={() => pasteNodes()}
        className="px-2 py-1 text-xs bg-gray-800 rounded-full"
      >
        Paste
      </button>
      <button
        onClick={() => {
          selected.forEach((n) => removeNode(n.id));
          clearClipboard();
        }}
        className="px-2 py-1 text-xs bg-red-600 rounded-full"
      >
        Delete
      </button>
    </div>
  );
};
