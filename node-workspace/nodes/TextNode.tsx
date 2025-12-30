import React from "react";
import { BaseNode } from "./BaseNode";
import { TextNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";

type Props = {
    id: string;
    data: TextNodeData;
};

export const TextNode: React.FC<Props & { selected?: boolean }> = ({ data, id, selected }) => {
    const { updateNodeData } = useWorkflowStore();

    return (
        <BaseNode title={data.title || "Text"} outputs={["text"]} selected={selected}>
            <div className="space-y-3">
                {data.category && (
                    <div className="inline-flex px-2 py-0.5 rounded-lg bg-blue-500/10 text-[9px] font-black uppercase tracking-widest text-blue-400">
                        {data.category}
                    </div>
                )}
                <textarea
                    className="w-full min-h-[40px] text-[13px] leading-relaxed bg-transparent text-white/80 p-0 outline-none resize-none transition-all placeholder:text-white/10"
                    value={data.text}
                    onChange={(e) => {
                        updateNodeData(id, { text: e.target.value });
                        // Auto resize
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onFocus={(e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    placeholder="Describe or input text here..."
                    style={{ height: 'auto' }}
                />
            </div>
        </BaseNode>
    );
};
