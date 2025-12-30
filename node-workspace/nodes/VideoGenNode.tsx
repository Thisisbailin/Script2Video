import React from "react";
import { BaseNode } from "./BaseNode";
import { VideoGenNodeData } from "../types";

type Props = {
  id: string;
  data: VideoGenNodeData;
};

export const VideoGenNode: React.FC<Props & { selected?: boolean }> = ({ data, selected }) => {
  return (
    <BaseNode title="Video Synthesis" inputs={["image", "text"]} selected={selected}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className={`h-1.5 w-1.5 rounded-full ${data.status === 'complete' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : data.status === 'loading' ? 'bg-amber-500 animate-pulse' : 'bg-white/10'}`} />
          <span className="text-[9px] font-black uppercase tracking-[0.1em] text-white/30">{data.status}</span>
        </div>

        {data.videoUrl ? (
          <div className="relative group/vid overflow-hidden rounded-xl bg-black/40">
            <video
              controls
              className="w-full aspect-video transition-transform duration-700"
            >
              <source src={data.videoUrl} />
            </video>
          </div>
        ) : (
          <div className="w-full aspect-video rounded-xl flex items-center justify-center bg-black/20">
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
