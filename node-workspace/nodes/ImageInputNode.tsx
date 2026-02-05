import React, { useMemo, useRef } from "react";
import { BaseNode } from "./BaseNode";
import { ImageInputNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";
import { ImagePlus } from "lucide-react";

type Props = {
  id: string;
  data: ImageInputNodeData;
  selected?: boolean;
};

export const ImageInputNode: React.FC<Props> = ({ id, data, selected }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { updateNodeData, labContext } = useWorkflowStore();

  const forms = useMemo(() => {
    const chars = labContext?.context?.characters || [];
    return chars.flatMap((c) => (c.forms || []).map((f) => f.formName)).filter(Boolean);
  }, [labContext]);

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

  return (
    <BaseNode title="Visual Input" outputs={["image"]} selected={selected}>
      <div className="space-y-4 flex-1 flex flex-col">
        <div className="relative">
          {data.image ? (
            <div
              className="node-surface node-media-frame relative group/img overflow-hidden rounded-[24px] shadow-[0_18px_40px_rgba(0,0,0,0.45)] bg-black/40 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <img
                src={data.image}
                alt="preview"
                className="node-media-preview transition-transform duration-500 group-hover/img:scale-[1.02]"
              />
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                <div className="flex items-center justify-between gap-2 text-[9px] font-semibold text-white/80">
                  <span className="truncate">{data.filename || "Image"}</span>
                  {data.dimensions && (
                    <span className="text-[8px] uppercase tracking-widest text-white/60">
                      {data.dimensions.width}x{data.dimensions.height}
                    </span>
                  )}
                </div>
              </div>
              <div className="absolute top-3 right-3 h-7 w-7 rounded-full bg-black/60 border border-white/10 text-white/80 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition">
                <ImagePlus size={12} />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="node-surface node-surface--dashed w-full h-[180px] rounded-[24px] flex flex-col items-center justify-center transition-all duration-500 overflow-hidden relative hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] group/img"
            >
              <div className="h-14 w-14 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-4 group-hover/img:scale-110 group-hover/img:bg-emerald-500/10 group-hover/img:border-emerald-500/20 transition-all duration-500 shadow-inner">
                <ImagePlus className="text-[var(--node-text-secondary)] group-hover/img:text-emerald-500 transition-colors" size={28} />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] opacity-40 uppercase tracking-[0.2em] font-black text-white">UPLOAD</span>
                <span className="text-[8px] opacity-30 uppercase tracking-[0.1em] font-bold">Click to select</span>
              </div>
            </button>
          )}
        </div>

        {forms.length > 0 && (
          <div className="node-panel space-y-2 p-3">
            <label className="text-[8px] font-black uppercase tracking-widest text-[var(--node-text-secondary)] opacity-70">关联形态</label>
            <select
              className="node-control node-control--tight text-[9px] font-semibold px-2 text-[var(--node-text-primary)] outline-none appearance-none cursor-pointer transition-colors w-full"
              value={data.formTag || ""}
              onChange={(e) => updateNodeData(id, { formTag: e.target.value || undefined })}
            >
              <option value="">未指定</option>
              {forms.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </BaseNode>
  );
};
