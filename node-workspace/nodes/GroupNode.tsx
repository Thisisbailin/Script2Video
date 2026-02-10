import React from "react";
import { NodeProps, NodeResizer } from "@xyflow/react";
import { GroupNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";

export const GroupNode: React.FC<NodeProps> = ({ id, data, selected }) => {
    const { updateNodeData } = useWorkflowStore();
    const groupData = data as GroupNodeData;

    return (
        <div
            className="group-surface h-full w-full rounded-[32px] transition-all duration-300 overflow-visible relative group/node"
            data-selected={selected ? "true" : "false"}
        >
            <NodeResizer
                color="var(--node-accent)"
                isVisible
                minWidth={300}
                minHeight={200}
                handleClassName="custom-node-handle"
                lineClassName="custom-node-line"
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
            <div className="w-full h-full p-6 pointer-events-none" />
        </div>
    );
};
