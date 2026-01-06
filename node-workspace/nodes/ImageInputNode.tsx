import React, { useMemo, useRef } from "react";
import { BaseNode } from "./BaseNode";
import { ImageInputNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";

type Props = {
  id: string;
  data: ImageInputNodeData;
  selected?: boolean;
};

export const ImageInputNode: React.FC<Props> = ({ id, data, selected }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result as string;
      const img = new Image();
      img.onload = () => {
        updateNodeData(id, {
          image: result,
          filename: file.name,
          dimensions: { width: img.width, height: img.height },
        });
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const aspectRatio = useMemo(() => {
    if (data.dimensions?.width && data.dimensions?.height) {
      return `${data.dimensions.width}/${data.dimensions.height}`;
    }
    return "16/9";
  }, [data.dimensions?.height, data.dimensions?.width]);

  return (
    <BaseNode title="Visual Input" outputs={["image"]} selected={selected}>
      <div className="space-y-4 flex-1 flex flex-col">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="node-button node-button-primary w-full h-11 flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] active:scale-95"
        >
          <span>Select Asset</span>
        </button>
        {data.image && (
          <div
            className="node-surface relative group/img overflow-hidden rounded-[20px] shadow-[0_18px_40px_rgba(0,0,0,0.4)] bg-black/40"
            style={{ aspectRatio }}
          >
            <img
              src={data.image}
              alt="preview"
              className="w-full h-full object-contain transition-transform duration-500 group-hover/img:scale-[1.02]"
            />
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
              <div className="text-[10px] font-black text-white truncate uppercase tracking-widest">{data.filename}</div>
            </div>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </BaseNode>
  );
};
