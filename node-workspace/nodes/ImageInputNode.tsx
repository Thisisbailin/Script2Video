import React, { useRef } from "react";
import { BaseNode } from "./BaseNode";
import { ImageInputNodeData } from "../types";

type Props = {
  id: string;
  data: ImageInputNodeData;
};

export const ImageInputNode: React.FC<Props> = ({ data }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result as string;
      data.image = result;
      data.filename = file.name;
      const img = new Image();
      img.onload = () => {
        data.dimensions = { width: img.width, height: img.height };
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <BaseNode title="Image Input" outputs={["image"]}>
      <div className="space-y-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-blue-600/10 border border-blue-500/20 text-[13px] font-semibold text-blue-400 hover:bg-blue-600/20 transition-all active:scale-95"
        >
          <span>Select Asset</span>
        </button>
        {data.image && (
          <div className="relative group/img overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-black/40">
            <img
              src={data.image}
              alt="preview"
              className="w-full aspect-video object-cover transition-transform duration-500 group-hover/img:scale-110"
            />
            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
              <div className="text-[10px] text-white/70 truncate">{data.filename}</div>
            </div>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </BaseNode>
  );
};
