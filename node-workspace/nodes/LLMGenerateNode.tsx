import React from "react";
import { BaseNode } from "./BaseNode";
import { LLMGenerateNodeData } from "../types";

type Props = {
  id: string;
  data: LLMGenerateNodeData;
};

export const LLMGenerateNode: React.FC<Props> = ({ data }) => {
  return (
    <BaseNode title="LLM Engine" inputs={["text"]} outputs={["text"]}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${data.status === 'complete' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : data.status === 'loading' ? 'bg-amber-500 animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-[11px] font-medium uppercase tracking-wider opacity-60">{data.status}</span>
          </div>
        </div>

        <textarea
          className="w-full min-h-[120px] text-[13px] bg-white/5 dark:bg-black/20 rounded-xl border border-[var(--border-subtle)]/50 p-3 outline-none resize-none transition-all"
          value={data.outputText || ""}
          readOnly
          placeholder="Awaiting generation..."
        />

        {data.error && (
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] text-red-400">
            {data.error}
          </div>
        )}
      </div>
    </BaseNode>
  );
};
