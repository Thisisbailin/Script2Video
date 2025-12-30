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
        <BaseNode
            title={data.title || "Text"}
            onTitleChange={(title) => updateNodeData(id, { title })}
            outputs={["text"]}
            selected={selected}
        >
            <div className="space-y-3 flex-1 flex flex-col">
                <input
                    className="inline-flex px-2 py-0.5 rounded-lg bg-[var(--node-accent)]/10 text-[9px] font-black uppercase tracking-widest text-[var(--node-accent)] outline-none border-none w-fit"
                    value={data.category || ""}
                    onChange={(e) => updateNodeData(id, { category: e.target.value as any })}
                    placeholder="CATEGORY"
                />
                <textarea
                    className="node-textarea w-full text-[13px] leading-relaxed p-3 outline-none resize-none transition-all placeholder:text-[var(--node-text-secondary)] flex-1 min-h-[40px]"
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
                    placeholder="Describe or input text here..."
                    style={{ height: 'auto' }}
                />
            </div>
        </BaseNode>
    );
};
