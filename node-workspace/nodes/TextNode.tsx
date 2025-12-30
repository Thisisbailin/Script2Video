import React from "react";
import { BaseNode } from "./BaseNode";
import { TextNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";

type Props = {
    id: string;
    data: TextNodeData;
};

export const TextNode: React.FC<Props> = ({ data, id }) => {
    const { updateNodeData } = useWorkflowStore();

    return (
        <BaseNode title={data.title || "Text"} outputs={["text"]}>
            <div className="space-y-3">
                {data.category && (
                    <div className="inline-flex px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[9px] font-bold uppercase tracking-widest text-blue-400/80">
                        {data.category}
                    </div>
                )}
                <textarea
                    className="w-full min-h-[120px] text-[13px] leading-relaxed bg-white/5 dark:bg-black/20 rounded-xl border border-[var(--border-subtle)]/50 p-3 focus:border-[var(--accent-blue)]/50 focus:ring-4 focus:ring-blue-500/5 outline-none resize-none transition-all placeholder:opacity-30"
                    value={data.text}
                    onChange={(e) => updateNodeData(id, { text: e.target.value })}
                    placeholder="Describe or input text here..."
                />
            </div>
        </BaseNode>
    );
};
