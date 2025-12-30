import React, { useRef, useLayoutEffect } from "react";
import { BaseNode } from "./BaseNode";
import { LLMGenerateNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";

type Props = {
  id: string;
  data: LLMGenerateNodeData;
};

export const LLMGenerateNode: React.FC<Props & { selected?: boolean }> = ({ id, data, selected }) => {
  const { updateNodeData } = useWorkflowStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  useLayoutEffect(() => {
    autoResize();
  }, [data.outputText]);

  return (
    <BaseNode
      title={data.title || "LLM Engine"}
      onTitleChange={(title) => updateNodeData(id, { title })}
      inputs={["text"]}
      outputs={["text"]}
      selected={selected}
    >
      <div className="space-y-3 flex-1 flex flex-col">
        <div className="flex items-center gap-2">
          <div className={`h-1.5 w-1.5 rounded-full ${data.status === 'complete' ? 'bg-emerald-500 shadow-[0_0_8px_var(--accent-green)]' : data.status === 'loading' ? 'bg-amber-500 animate-pulse' : 'bg-[var(--node-text-secondary)] opacity-20'}`} />
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--node-text-secondary)]">{data.status}</span>
        </div>

        <textarea
          ref={textareaRef}
          className="node-textarea w-full text-[13px] leading-relaxed p-4 outline-none resize-none transition-all placeholder:text-[var(--node-text-secondary)] flex-1 min-h-[100px]"
          value={data.outputText || ""}
          readOnly
          placeholder="Awaiting generation..."
          style={{ height: 'auto' }}
          onFocus={autoResize}
        />

        {data.error && (
          <div className="p-3 rounded-xl bg-red-500/10 text-[10px] text-red-500 font-bold uppercase tracking-tight">
            {data.error}
          </div>
        )}
      </div>
    </BaseNode>
  );
};
