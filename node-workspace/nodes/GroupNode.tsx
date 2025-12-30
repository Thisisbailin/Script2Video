import React from "react";
import { NodeProps } from "@xyflow/react";
import { GroupNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";

export const GroupNode: React.FC<NodeProps> = ({ id, data, selected }) => {
    const { updateNodeData } = useWorkflowStore();
    const groupData = data as GroupNodeData;

    return (
        <div
            className={`h-full w-full rounded-[32px] border transition-all duration-500 overflow-visible ${selected
                    ? "bg-white/[0.03] border-white/20 shadow-[0_0_40px_rgba(255,255,255,0.05)]"
                    : "bg-white/[0.01] border-white/5"
                }`}
        >
            {/* Group Title */}
            <div className="absolute -top-8 left-2 flex items-center gap-3">
                <input
                    className="bg-transparent text-white/40 hover:text-white/80 focus:text-white font-medium text-sm outline-none transition-colors px-2 py-1 rounded-lg"
                    value={groupData.title}
                    onChange={(e) => updateNodeData(id, { title: e.target.value })}
                    placeholder="Group Title"
                />
                {selected && (
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                )}
            </div>

            {/* Background/Frame */}
            <div className="absolute inset-0 pointer-events-none rounded-[32px] bg-gradient-to-br from-white/[0.02] to-transparent" />

            {/* Resize handle hint (optional, but React Flow handles resizing via style) */}
            <div className="absolute bottom-4 right-4 h-2 w-2 rounded-full bg-white/10" />
        </div>
    );
};
