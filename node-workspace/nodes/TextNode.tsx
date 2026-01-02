import React, { useRef, useLayoutEffect } from "react";
import { BaseNode } from "./BaseNode";
import { TextNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";
import { Plus, X } from "lucide-react";

type Props = {
    id: string;
    data: TextNodeData;
};

export const TextNode: React.FC<Props & { selected?: boolean }> = ({ data, id, selected }) => {
    const { updateNodeData } = useWorkflowStore();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const autoResize = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    };

    useLayoutEffect(() => {
        // Initial resize after mount or when text changes
        autoResize();
    }, [data.text]);

    const handleAddTag = () => {
        const currentTags = data.tags || [];
        updateNodeData(id, { tags: [...currentTags, "NEW TAG"] });
    };

    const handleUpdateTag = (index: number, value: string) => {
        const currentTags = [...(data.tags || [])];
        currentTags[index] = value;
        updateNodeData(id, { tags: currentTags });
    };

    const handleRemoveTag = (index: number) => {
        const currentTags = data.tags?.filter((_, i) => i !== index);
        updateNodeData(id, { tags: currentTags });
    };

    return (
        <BaseNode
            title={data.title || "Text"}
            onTitleChange={(title) => updateNodeData(id, { title })}
            inputs={["text"]} // Enabled input
            outputs={["text"]} // Enabled output
            selected={selected}
        >
            <div className="space-y-4 flex-1 flex flex-col">
                {/* Tags Layout */}
                <div className="flex flex-wrap items-center gap-2 min-h-[24px]">
                    {/* Primary Category - Capsule Style */}
                    <div className="inline-flex items-center px-3 py-1 rounded-full bg-[var(--node-accent)]/10 border border-[var(--node-accent)]/20 shadow-sm transition-all duration-200">
                        <input
                            className="bg-transparent text-[9px] font-black uppercase tracking-[0.2em] text-[var(--node-accent)] outline-none border-none text-center appearance-none"
                            value={data.category || ""}
                            onChange={(e) => updateNodeData(id, { category: e.target.value as any })}
                            placeholder="CATEGORY"
                            style={{ width: Math.max(data.category?.length || 4, 4) + 'ch' }}
                        />
                    </div>

                    {/* Additional Tags - Capsule Style */}
                    {data.tags?.map((tag, idx) => (
                        <div
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group/tag"
                        >
                            <input
                                className="bg-transparent text-[9px] font-bold uppercase tracking-widest text-[var(--node-text-secondary)] outline-none border-none appearance-none"
                                value={tag}
                                onChange={(e) => handleUpdateTag(idx, e.target.value)}
                                style={{ width: Math.max(tag.length, 4) + 'ch' }}
                            />
                            <button
                                onClick={() => handleRemoveTag(idx)}
                                className="opacity-0 group-hover/tag:opacity-100 transition-opacity text-[var(--node-text-secondary)] hover:text-red-500"
                            >
                                <X size={10} />
                            </button>
                        </div>
                    ))}

                    {/* Add Tag Button */}
                    <button
                        onClick={handleAddTag}
                        className="h-6 w-6 flex items-center justify-center rounded-full bg-white/5 border border-dashed border-white/20 text-[var(--node-text-secondary)] hover:bg-[var(--node-accent)]/10 hover:border-[var(--node-accent)]/30 hover:text-[var(--node-accent)] transition-all active:scale-90"
                        title="Add Tag"
                    >
                        <Plus size={12} />
                    </button>
                </div>

                {/* Text Area - Auto Height */}
                <textarea
                    ref={textareaRef}
                    className="node-textarea w-full text-[13px] leading-relaxed p-4 outline-none resize-none transition-all placeholder:text-[var(--node-text-secondary)] min-h-[60px] font-medium"
                    value={data.text}
                    onChange={(e) => {
                        updateNodeData(id, { text: e.target.value });
                        autoResize();
                    }}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                    }}
                    onFocus={autoResize}
                    placeholder="Describe or input text here..."
                    style={{ height: 'auto' }}
                />
            </div>
        </BaseNode>
    );
};
