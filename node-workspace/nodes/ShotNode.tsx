import React from "react";
import { Timer, MoveRight, MessageSquare, Star } from 'lucide-react';
import { ShotNodeData } from "../types";
import { Handle, Position } from "@xyflow/react";

type Props = {
    data: ShotNodeData;
};

export const ShotNode: React.FC<Props & { selected?: boolean }> = ({ data, selected }) => {
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
                            className={active ? "text-amber-400" : "text-white/5"}
                            fill={active ? "currentColor" : "none"}
                        />
                    );
                })}
            </div>
        );
    };

    return (
        <div className={`relative px-5 py-5 rounded-2xl transition-all duration-300 overflow-visible w-[340px] space-y-4 ${selected
                ? "bg-[#1e293b] shadow-[0_20px_50px_rgba(0,0,0,0.5)] scale-[1.02]"
                : "bg-[#111827] shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
            }`}>
            {/* Handles */}
            <Handle
                type="target"
                position={Position.Left}
                id="image"
                className="!w-2 !h-2 !bg-blue-500 !border-0"
            />
            <Handle
                type="source"
                position={Position.Right}
                id="text"
                className="!w-2 !h-2 !bg-emerald-500 !border-0"
            />

            <div className="flex items-start justify-between">
                <div className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded bg-white/5 font-mono text-[10px] font-black text-white/50">
                            {data.shotId}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-white/20 font-bold uppercase tracking-wider">
                            <Timer size={12} className="opacity-40" /> {data.duration}
                        </div>
                        {renderStars(data.difficulty)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[9px] font-black text-blue-400/80 uppercase tracking-[0.1em]">
                            {data.shotType}
                        </span>
                        <span className="text-[9px] text-white/20 font-bold uppercase tracking-[0.1em] inline-flex items-center gap-1">
                            <MoveRight size={10} className="opacity-40" /> {data.movement || 'Static'}
                        </span>
                    </div>
                </div>
            </div>

            <div className={`text-[13px] leading-relaxed font-semibold transition-colors ${selected ? 'text-white' : 'text-white/70'}`}>
                {data.description}
            </div>

            {data.dialogue && (
                <div className="text-[11px] italic text-white/40 bg-white/5 rounded-xl px-4 py-3 flex items-start gap-3">
                    <MessageSquare size={12} className="mt-0.5 opacity-20" />
                    <span>{data.dialogue}</span>
                </div>
            )}

            <div className="pt-2 flex justify-end">
                <div className="px-2 py-1 rounded bg-emerald-500/10 text-[8px] font-black text-emerald-400/60 uppercase tracking-widest">
                    Shot Metadata
                </div>
            </div>
        </div>
    );
};
