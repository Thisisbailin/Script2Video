import React from "react";
import { NodeProps, NodeResizer } from "@xyflow/react";
import { GroupNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";

export const GroupNode: React.FC<NodeProps> = ({ id, data, selected }) => {
    const { updateNodeData } = useWorkflowStore();
    const groupData = data as GroupNodeData;

    return (
        <div
            className={`h-full w-full rounded-[32px] transition-all duration-300 overflow-visible relative group/node border ${selected
                ? "bg-[var(--group-bg-selected)] shadow-[0_24px_60px_rgba(0,0,0,0.35)] border-[var(--node-border-strong)]"
                : "bg-[var(--group-bg)] border-[var(--node-border)]"
                }`}
        >
            <NodeResizer
                color="var(--node-accent)"
                isVisible={selected}
                minWidth={300}
                minHeight={200}
                handleClassName="group-resize-handle"
                lineClassName="group-resize-line"
            />

            {/* Group Title - Floating above */}
            <div className="absolute -top-7 left-4 flex items-center gap-3">
                <input
                    className="node-title-input bg-transparent text-[11px] outline-none transition-colors px-1"
                    value={groupData.title}
                    onChange={(e) => updateNodeData(id, { title: e.target.value })}
                    placeholder="GROUP TITLE"
                />
                {selected && (
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--node-accent)] shadow-[0_0_8px_var(--node-accent)] animate-pulse" />
                )}
            </div>

            {/* Content area if needed (usually just holds nested nodes provided by React Flow) */}
            <div className="w-full h-full p-6 pointer-events-none">
                {/* Visual arc at bottom right - shown on hover or selection */}
                <div className={`absolute bottom-0 right-0 p-4 transition-all duration-300 ${selected ? 'opacity-100' : 'opacity-0 group-hover/node:opacity-40'}`}>
                    <div className="w-6 h-6 border-r-2 border-b-2 border-[var(--node-accent)] rounded-br-[28px]" />
                </div>
            </div>
        </div>
    );
};
