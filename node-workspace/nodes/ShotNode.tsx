import React, { useRef, useEffect } from "react";
import { Timer, MoveRight, MessageSquare, Star } from 'lucide-react';
import { ShotNodeData } from "../types";
import { Handle, Position } from "@xyflow/react";
import { useWorkflowStore } from "../store/workflowStore";

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
            textarea.style.height = textarea.scrollHeight + 'px';
        }
    };

    useEffect(() => {
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
        <div
            className="node-card-base transition-all duration-300 overflow-visible w-[340px] p-6 space-y-4"
            data-selected={!!selected}
        >
            {/* Handles */}
            <Handle
                type="target"
                position={Position.Left}
                id="image"
                className="!w-2 !h-2 !bg-[var(--node-text-secondary)] !border-0"
                data-handletype="image"
            />
            <Handle
                type="source"
                position={Position.Right}
                id="text"
                className="!w-2 !h-2 !bg-[var(--node-text-secondary)] !border-0"
                data-handletype="text"
            />

            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <input
                            className="w-12 px-2 py-0.5 rounded-lg bg-[var(--node-textarea-bg)] font-black text-[10px] tracking-tight text-[var(--node-text-primary)] outline-none"
                            value={data.shotId}
                            onChange={(e) => updateNodeData(id, { shotId: e.target.value })}
                        />
                        <div className="flex items-center gap-1.5 text-[10px] text-[var(--node-text-secondary)] font-bold uppercase tracking-widest px-2">
                            <Timer size={12} className="opacity-40" />
                            <input
                                className="bg-transparent w-8 outline-none"
                                value={data.duration}
                                onChange={(e) => updateNodeData(id, { duration: e.target.value })}
                            />
                        </div>
                    </div>
                    {renderStars(data.difficulty)}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <input
                        className="text-[9px] font-black text-[var(--node-accent)] uppercase tracking-widest bg-transparent outline-none w-24"
                        value={data.shotType}
                        onChange={(e) => updateNodeData(id, { shotType: e.target.value })}
                        placeholder="SHOT TYPE"
                    />
                    <div className="h-1 w-1 rounded-full bg-[var(--node-text-secondary)] opacity-20" />
                    <div className="flex items-center gap-1">
                        <MoveRight size={10} className="text-[var(--node-text-secondary)] opacity-40" />
                        <input
                            className="text-[9px] text-[var(--node-text-secondary)] font-bold uppercase tracking-widest bg-transparent outline-none w-20"
                            value={data.movement}
                            onChange={(e) => updateNodeData(id, { movement: e.target.value })}
                            placeholder="MOVEMENT"
                        />
                    </div>
                </div>
            </div>

            <textarea
                ref={descriptionRef}
                className="node-textarea w-full text-[13px] leading-relaxed p-4 outline-none resize-none transition-all placeholder:text-[var(--node-text-secondary)] font-bold"
                value={data.description}
                onChange={(e) => {
                    updateNodeData(id, { description: e.target.value });
                    autoResize(e.target);
                }}
                onFocus={(e) => autoResize(e.target)}
                placeholder="Enter shot description..."
                style={{ height: 'auto' }}
            />

            <div className="relative">
                <div className="text-[11px] italic text-[var(--node-text-secondary)] bg-[var(--node-textarea-bg)] rounded-xl px-4 py-3 flex items-start gap-3">
                    <MessageSquare size={12} className="mt-1 flex-shrink-0 opacity-20" />
                    <textarea
                        ref={dialogueRef}
                        className="bg-transparent w-full outline-none resize-none p-0 text-[var(--node-text-secondary)]"
                        value={data.dialogue || ""}
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

            <div className="pt-2 flex justify-end">
                <div className="px-2 py-1 rounded-lg bg-[var(--node-accent)]/5 text-[8px] font-black text-[var(--node-accent)]/40 uppercase tracking-[0.2em]">
                    Shot Data Component
                </div>
            </div>
        </div>
    );
};
