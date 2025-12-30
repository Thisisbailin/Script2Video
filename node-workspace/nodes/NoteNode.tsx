import React from "react";
import { useWorkflowStore } from "../store/workflowStore";
import { NoteNodeData } from "../types";

type Props = {
    id: string;
    data: NoteNodeData;
};

export const NoteNode: React.FC<Props & { selected?: boolean }> = ({ id, data, selected }) => {
    const { updateNodeData } = useWorkflowStore();

    return (
        <div
            className="node-card-base transition-all duration-300 overflow-visible w-[240px]"
            data-selected={!!selected}
        >
            <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
                    <input
                        className="bg-transparent font-black tracking-[0.2em] uppercase text-[10px] outline-none transition-colors w-full text-amber-500/80"
                        value={data.title || "ANNOTATION"}
                        onChange={(e) => updateNodeData(id, { title: e.target.value })}
                        placeholder="NAME"
                    />
                </div>
                {selected && (
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--node-accent)]" />
                )}
            </div>
            <div className="px-5 pb-5">
                <textarea
                    className="node-textarea w-full text-[13px] leading-relaxed p-4 outline-none resize-none transition-all placeholder:text-[var(--node-text-secondary)] min-h-[100px]"
                    value={data.text}
                    onChange={(e) => {
                        updateNodeData(id, { text: e.target.value });
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onFocus={(e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    placeholder="Write your note..."
                    style={{ height: 'auto' }}
                />
            </div>
        </div>
    );
};
