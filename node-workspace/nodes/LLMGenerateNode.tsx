import React from "react";
import { BaseNode } from "./BaseNode";
import { LLMGenerateNodeData } from "../types";

type Props = {
  id: string;
  data: LLMGenerateNodeData;
};

export const LLMGenerateNode: React.FC<Props & { selected?: boolean }> = ({ data, selected }) => {
  return (
    <BaseNode title="LLM Engine" inputs={["text"]} outputs={["text"]} selected={selected}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className={`h-1.5 w-1.5 rounded-full ${data.status === 'complete' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : data.status === 'loading' ? 'bg-amber-500 animate-pulse' : 'bg-white/10'}`} />
          <span className="text-[9px] font-black uppercase tracking-[0.1em] text-white/30">{data.status}</span>
        </div>

        <textarea
          className={`w-full text-[13px] leading-relaxed bg-transparent p-0 outline-none resize-none transition-all ${selected ? 'text-white' : 'text-white/60'}`}
          value={data.outputText || ""}
          readOnly
          placeholder="Awaiting generation..."
          style={{ height: 'auto' }}
          onFocus={(e) => {
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
        />

        {data.error && (
          <div className="p-2 rounded-xl bg-red-500/10 text-[10px] text-red-400 font-medium">
            {data.error}
          </div>
        )}
      </div>
    </BaseNode>
  );
};
