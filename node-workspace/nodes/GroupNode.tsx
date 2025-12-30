import React from "react";
import { NodeProps, NodeResizer } from "@xyflow/react";
import { GroupNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";

export const GroupNode: React.FC<NodeProps> = ({ id, data, selected }) => {
    const { updateNodeData } = useWorkflowStore();
    const groupData = data as GroupNodeData;

    return (
        <>
            <NodeResizer
                color="var(--node-accent)"
                isVisible={selected}
                minWidth={200}
                minHeight={150}
            />
            <div
                className={`h-full w-full rounded-[32px] transition-all duration-300 overflow-visible relative ${selected
                        ? "bg-[var(--group-bg-selected)] shadow-[0_0_40px_rgba(0,0,0,0.1)]"
                        : "bg-[var(--group-bg)]"
                    }`}
            >
                {/* Group Title */}
                <div className="absolute -top-7 left-3 flex items-center gap-3">
                    <input
                        className="bg-transparent text-[var(--node-text-secondary)] hover:text-[var(--node-text-primary)] focus:text-[var(--node-text-primary)] font-black text-[10px] uppercase tracking-widest outline-none transition-colors px-1"
                        value={groupData.title}
                        onChange={(e) => updateNodeData(id, { title: e.target.value })}
                        placeholder="GROUP TITLE"
                    />
                    {selected && (
                        <div className="h-1 w-1 rounded-full bg-[var(--node-accent)] animate-pulse" />
                    )}
                </div>

                {/* Resize handle visual hint */}
                <div className={`absolute bottom-3 right-3 h-2 w-2 rounded-full transition-opacity ${selected ? 'bg-[var(--node-accent)] opacity-100' : 'bg-[var(--node-text-secondary)] opacity-20'}`} />
            </div>
        </>
    );
};
