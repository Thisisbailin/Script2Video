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
            className={`relative p-5 rounded-2xl transition-all duration-300 w-full ${selected
                    ? "bg-[#1e293b] shadow-[0_20px_50px_rgba(0,0,0,0.5)] scale-[1.02]"
                    : "bg-[#111827] shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
                }`}
        >
            <div className="flex items-center gap-2 mb-3">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span className={`text-[10px] font-black uppercase tracking-widest ${selected ? 'text-amber-400' : 'text-amber-500/40'}`}>tips</span>
            </div>
            <textarea
                className={`w-full text-[12px] leading-relaxed bg-transparent p-0 outline-none resize-none transition-all placeholder:text-white/10 ${selected ? 'text-white' : 'text-white/60'}`}
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
    );
};
