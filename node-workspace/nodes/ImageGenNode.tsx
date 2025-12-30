import React from "react";
import { BaseNode } from "./BaseNode";
import { ImageGenNodeData } from "../types";

type Props = {
  id: string;
  data: ImageGenNodeData;
};

export const ImageGenNode: React.FC<Props> = ({ data }) => {
  return (
    <BaseNode title="Image Gen" inputs={["image", "text"]} outputs={["image"]}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${data.status === 'complete' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : data.status === 'loading' ? 'bg-amber-500 animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-[11px] font-medium uppercase tracking-wider opacity-60">{data.status}</span>
          </div>
          <div className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 opacity-40">Ready</div>
        </div>

        {data.outputImage ? (
          <div className="relative group/img overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-black/40">
            <img
              src={data.outputImage}
              alt="generated"
              className="w-full aspect-square object-cover transition-transform duration-700 group-hover/img:scale-105"
            />
          </div>
        ) : (
          <div className="w-full aspect-square rounded-xl border border-dashed border-[var(--border-subtle)] flex items-center justify-center bg-black/5">
            <span className="text-[10px] opacity-20 uppercase tracking-widest font-bold">Result Area</span>
          </div>
        )}

        {data.error && (
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 leading-tight">
            {data.error}
          </div>
        )}
      </div>
    </BaseNode>
  );
};
