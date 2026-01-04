import React, { useMemo } from "react";
import { useReactFlow } from "@xyflow/react";
import { useWorkflowStore } from "../store/workflowStore";
import { Copy, ClipboardType, Trash2, BoxSelect } from "lucide-react";
import { useToast } from "./Toast";

export const MultiSelectToolbar: React.FC = () => {
  const { nodes, removeNode, clearClipboard, copySelectedNodes, pasteNodes, createGroupFromSelection } = useWorkflowStore();
  const { getNodes, flowToScreenPosition } = useReactFlow();
  const { show: showToast } = useToast();

  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes]);

  if (selectedNodes.length === 0) return null;

  // Calculate the bounding box of selected nodes in flow coordinates
  const bounds = selectedNodes.reduce(
    (acc, node) => {
      const pos = node.position;
      const width = node.measured?.width || 300;
      const height = node.measured?.height || 200;

      return {
        minX: Math.min(acc.minX, pos.x),
        minY: Math.min(acc.minY, pos.y),
        maxX: Math.max(acc.maxX, pos.x + width),
        maxY: Math.max(acc.maxY, pos.y + height),
      };
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  // Convert the top-center of the bounding box to screen coordinates
  const topCenterScreen = flowToScreenPosition({
    x: bounds.minX + (bounds.maxX - bounds.minX) / 2,
    y: bounds.minY
  });

  return (
    <div
      className="fixed z-[100] -translate-x-1/2 -translate-y-[120%] flex items-center gap-1 bg-[#121212]/90 backdrop-blur-2xl text-white px-1.5 py-1.5 rounded-full border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      style={{
        left: topCenterScreen.x,
        top: topCenterScreen.y,
      }}
    >
      <div className="px-3 py-1 flex items-center gap-2 border-r border-white/5 mr-1">
        <div className="h-1.5 w-1.5 rounded-full bg-[var(--node-accent)] animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
          {selectedNodes.length} Selected
        </span>
      </div>

      <button
        onClick={() => {
          if (selectedNodes.length < 2) {
            showToast("至少选择两个节点才能分组", "warning");
            return;
          }
          const result = createGroupFromSelection();
          if (!result.ok) {
            showToast(result.error || "分组失败", "error");
          } else {
            showToast("已创建 Group", "success");
          }
        }}
        className="h-8 px-3 flex items-center gap-2 hover:bg-white/10 rounded-full transition-all group"
        title="Group"
      >
        <BoxSelect size={14} className="text-white/40 group-hover:text-white" />
        <span className="text-[10px] font-bold uppercase tracking-tight">Group</span>
      </button>

      <button
        onClick={() => copySelectedNodes()}
        className="h-8 px-3 flex items-center gap-2 hover:bg-white/10 rounded-full transition-all group"
        title="Copy"
      >
        <Copy size={14} className="text-white/40 group-hover:text-white" />
        <span className="text-[10px] font-bold uppercase tracking-tight">Copy</span>
      </button>

      <button
        onClick={() => pasteNodes()}
        className="h-8 px-3 flex items-center gap-2 hover:bg-white/10 rounded-full transition-all group"
        title="Paste"
      >
        <ClipboardType size={14} className="text-white/40 group-hover:text-white" />
        <span className="text-[10px] font-bold uppercase tracking-tight">Paste</span>
      </button>

      <button
        onClick={() => {
          selectedNodes.forEach((n) => removeNode(n.id));
          clearClipboard();
        }}
        className="h-8 px-3 flex items-center gap-2 hover:bg-red-500/20 text-red-500 rounded-full transition-all group"
        title="Delete"
      >
        <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
        <span className="text-[10px] font-bold uppercase tracking-tight">Delete</span>
      </button>
    </div>
  );
};
