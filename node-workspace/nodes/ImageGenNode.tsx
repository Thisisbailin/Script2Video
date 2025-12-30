import React from "react";
import { BaseNode } from "./BaseNode";
import { ImageGenNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";

type Props = {
  id: string;
  data: ImageGenNodeData;
};

export const ImageGenNode: React.FC<Props & { selected?: boolean }> = ({ id, data, selected }) => {
  const { updateNodeData } = useWorkflowStore();

  return (
    <BaseNode
      title={data.title || "Visual Imaging"}
      onTitleChange={(title) => updateNodeData(id, { title })}
      inputs={["image", "text"]}
      outputs={["image"]}
      selected={selected}
    >
      <div className="space-y-4 flex-1 flex flex-col">
        <div className="flex items-center gap-2">
          <div className={`h-1.5 w-1.5 rounded-full ${data.status === 'complete' ? 'bg-emerald-500 shadow-[0_0_8px_var(--accent-green)]' : data.status === 'loading' ? 'bg-amber-500 animate-pulse' : 'bg-[var(--node-text-secondary)] opacity-20'}`} />
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--node-text-secondary)]">{data.status}</span>
        </div>

        {data.outputImage ? (
          <div className="relative group/img overflow-hidden rounded-[20px] bg-[var(--node-textarea-bg)] shadow-md">
            <img
              src={data.outputImage}
              alt="generated"
              className="w-full aspect-square object-cover transition-transform duration-700 group-hover/img:scale-105"
            />
          </div>
        ) : (
          <div className="w-full aspect-square rounded-[20px] flex flex-col items-center justify-center bg-[var(--node-textarea-bg)] border-2 border-dashed border-[var(--node-text-secondary)]/10">
            <span className="text-[10px] opacity-20 uppercase tracking-[0.2em] font-black">Waiting</span>
          </div>
        )}

        {data.error && (
          <div className="p-3 rounded-xl bg-red-500/10 text-[10px] text-red-500 font-bold uppercase tracking-tight">
            {data.error}
          </div>
        )}
      </div>
    </BaseNode>
  );
};
