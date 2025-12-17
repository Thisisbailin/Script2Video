import React from "react";
import { useWorkflowStore } from "../store/workflowStore";

export const GlobalImageHistory: React.FC = () => {
  const { globalImageHistory } = useWorkflowStore();
  if (globalImageHistory.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-10 w-64 max-h-64 overflow-y-auto bg-[#0f0f0f] text-white rounded-lg border border-gray-700 shadow-lg p-2 space-y-2">
      <div className="text-sm font-semibold">Image History</div>
      {globalImageHistory.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <img src={item.image} alt="history" className="w-12 h-12 object-cover rounded border border-gray-700" />
          <div className="text-xs text-gray-300 truncate">{item.prompt}</div>
        </div>
      ))}
    </div>
  );
};
