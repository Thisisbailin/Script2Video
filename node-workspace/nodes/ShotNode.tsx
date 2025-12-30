import React, { useRef, useLayoutEffect } from "react";
import { Timer, MoveRight, MessageSquare, Star } from 'lucide-react';
import { ShotNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";
import { BaseNode } from "./BaseNode";

type Props = {
    id: string;
    data: ShotNodeData;
};

export const ShotNode: React.FC<Props & { selected?: boolean }> = ({ id, data, selected }) => {
    const { updateNodeData } = useWorkflowStore();
    const descriptionRef = useRef<HTMLTextAreaElement>(null);
    const dialogueRef = useRef<HTMLTextAreaElement>(null);

    const autoResize = (textarea: HTMLTextAreaElement | null) => {
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = (textarea.scrollHeight) + 'px';
        }
    };

    useLayoutEffect(() => {
        autoResize(descriptionRef.current);
        autoResize(dialogueRef.current);
    }, [data.description, data.dialogue]);

    const renderStars = (difficulty?: number) => {
        const rating = Math.min(Math.max((difficulty ?? 5) / 2, 0), 5);
        return (
            <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => {
                    const active = rating >= i + 1;
                    return (
                        <Star
                            key={i}
                            size={10}
                            className={active ? "text-amber-400" : "text-[var(--node-text-secondary)] opacity-10"}
                            fill={active ? "currentColor" : "none"}
                        />
                    );
                })}
            </div>
        );
    };

    return (
        <BaseNode
            title={data.shotId || "S-1"}
            onTitleChange={(title) => updateNodeData(id, { shotId: title })}
            inputs={["image"]}
            outputs={["text"]}
            selected={selected}
        >
            <div className="flex flex-col gap-4 flex-1">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] text-[var(--node-text-secondary)] font-bold uppercase tracking-widest bg-[var(--node-textarea-bg)] px-3 py-1.5 rounded-full">
                            <Timer size={12} className="opacity-40" />
                            <input
                                className="bg-transparent w-8 outline-none"
                                value={data.duration}
                                onChange={(e) => updateNodeData(id, { duration: e.target.value })}
                            />
                        </div>
                        {renderStars(data.difficulty)}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center px-3 py-1 rounded-full bg-[var(--node-accent)]/10 border border-[var(--node-accent)]/20 shadow-sm transition-all duration-200">
                            <input
                                className="bg-transparent text-[9px] font-black text-[var(--node-accent)] uppercase tracking-[0.2em] outline-none text-center appearance-none"
                                value={data.shotType}
                                onChange={(e) => updateNodeData(id, { shotType: e.target.value })}
                                placeholder="SHOT TYPE"
                                style={{ width: Math.max(data.shotType?.length || 4, 4) + 'ch' }}
                            />
                        </div>

                        <div className="h-1 w-1 rounded-full bg-[var(--node-text-secondary)] opacity-20" />

                        <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                            <MoveRight size={10} className="text-[var(--node-text-secondary)] opacity-40 shrink-0" />
                            <input
                                className="bg-transparent text-[9px] text-[var(--node-text-secondary)] font-bold uppercase tracking-widest outline-none appearance-none"
                                value={data.movement}
                                onChange={(e) => updateNodeData(id, { movement: e.target.value })}
                                placeholder="MOVEMENT"
                                style={{ width: Math.max(data.movement?.length || 4, 4) + 'ch' }}
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-[var(--node-textarea-bg)] rounded-2xl p-4 transition-all border border-white/5">
                    <textarea
                        ref={descriptionRef}
                        className="bg-transparent w-full text-[13px] leading-relaxed outline-none resize-none transition-all placeholder:text-[var(--node-text-secondary)] font-bold"
                        value={data.description}
                        onChange={(e) => {
                            updateNodeData(id, { description: e.target.value });
                            autoResize(e.target);
                        }}
                        onFocus={(e) => autoResize(e.target)}
                        placeholder="Enter shot description..."
                        style={{ height: 'auto' }}
                    />
                </div>

                {data.dialogue && (
                    <div className="relative">
                        <div className="text-[11px] italic text-[var(--node-text-secondary)] bg-[var(--node-textarea-bg)] rounded-xl px-4 py-3 flex items-start gap-3">
                            <MessageSquare size={12} className="mt-1 flex-shrink-0 opacity-20" />
                            <textarea
                                ref={dialogueRef}
                                className="bg-transparent w-full outline-none resize-none p-0 text-[var(--node-text-secondary)]"
                                value={data.dialogue}
                                onChange={(e) => {
                                    updateNodeData(id, { dialogue: e.target.value });
                                    autoResize(e.target);
                                }}
                                onFocus={(e) => autoResize(e.target)}
                                placeholder="Dialogue..."
                                style={{ height: 'auto' }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="pt-2 flex justify-end">
                <div className="px-2 py-1 rounded-lg bg-[var(--node-accent)]/5 text-[8px] font-black text-[var(--node-accent)]/40 uppercase tracking-[0.2em]">
                    Shot Component
                </div>
            </div>
        </BaseNode>
    );
};
