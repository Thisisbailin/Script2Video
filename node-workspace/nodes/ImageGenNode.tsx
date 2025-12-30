import React from "react";
import { BaseNode } from "./BaseNode";
import { ImageGenNodeData } from "../types";

type Props = {
  id: string;
  data: ImageGenNodeData;
};

export const ImageGenNode: React.FC<Props & { selected?: boolean }> = ({ data, selected }) => {
  return (
    <BaseNode title="Visual Imaging" inputs={["image", "text"]} outputs={["image"]} selected={selected}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className={`h-1.5 w-1.5 rounded-full ${data.status === 'complete' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : data.status === 'loading' ? 'bg-amber-500 animate-pulse' : 'bg-white/10'}`} />
          <span className="text-[9px] font-black uppercase tracking-[0.1em] text-white/30">{data.status}</span>
        </div>

        {data.outputImage ? (
          <div className="relative group/img overflow-hidden rounded-xl bg-black/40">
            <img
              src={data.outputImage}
              alt="generated"
              className="w-full aspect-square object-cover transition-transform duration-700 group-hover/img:scale-105"
            />
          </div>
        ) : (
          <div className="w-full aspect-square rounded-xl flex items-center justify-center bg-black/20">
            <span className="text-[10px] opacity-10 uppercase tracking-widest font-bold">Waiting...</span>
          </div>
        )}

        {data.error && (
          <div className="p-2 rounded-xl bg-red-500/10 text-[10px] text-red-400 font-medium">
            {data.error}
          </div>
        )}
      </div>
    </BaseNode>
  );
};
