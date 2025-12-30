import React from "react";
import { BaseNode } from "./BaseNode";
import { VideoGenNodeData } from "../types";

type Props = {
  id: string;
  data: VideoGenNodeData;
};

export const VideoGenNode: React.FC<Props> = ({ data }) => {
  return (
    <BaseNode title="Video Synthesis" inputs={["image", "text"]}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${data.status === 'complete' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : data.status === 'loading' ? 'bg-amber-500 animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-[11px] font-medium uppercase tracking-wider opacity-60">{data.status}</span>
          </div>
        </div>

        {data.videoUrl ? (
          <div className="relative group/vid overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-black/40 shadow-inner">
            <video
              controls
              className="w-full aspect-video transition-transform duration-700"
            >
              <source src={data.videoUrl} />
            </video>
          </div>
        ) : (
          <div className="w-full aspect-video rounded-xl border border-dashed border-[var(--border-subtle)]/50 flex items-center justify-center bg-black/5">
            <span className="text-[10px] opacity-20 uppercase tracking-widest font-bold">Video Clip Area</span>
          </div>
        )}

        {data.error && (
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] text-red-400">
            {data.error}
          </div>
        )}
      </div>
    </BaseNode>
  );
};
