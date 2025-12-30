import React from "react";
import { BaseNode } from "./BaseNode";
import { ImageGenNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";
import { useLabExecutor } from "../store/useLabExecutor";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";

type Props = {
  id: string;
  data: ImageGenNodeData;
};

export const ImageGenNode: React.FC<Props & { selected?: boolean }> = ({ id, data, selected }) => {
  const { updateNodeData, getConnectedInputs } = useWorkflowStore();
  const { runImageGen } = useLabExecutor();

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await runImageGen(id);
  };

  const { text: connectedText } = getConnectedInputs(id);
  const showPromptInput = !connectedText;

  return (
    <BaseNode
      title={data.title || "Visual Imaging"}
      onTitleChange={(title) => updateNodeData(id, { title })}
      inputs={["image", "text"]}
      outputs={["image"]}
      selected={selected}
    >
      <div className="space-y-4 flex-1 flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-1.5 w-1.5 rounded-full ${data.status === 'complete' ? 'bg-emerald-500 shadow-[0_0_8px_var(--accent-green)]' : data.status === 'loading' ? 'bg-amber-500 animate-pulse' : 'bg-[var(--node-text-secondary)] opacity-30'}`} />
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--node-text-secondary)]">{data.status || 'idle'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <select
              className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-white/5 border border-white/5 text-[var(--node-text-secondary)] outline-none appearance-none cursor-pointer hover:bg-white/10 transition-colors"
              value={data.aspectRatio || "1:1"}
              onChange={(e) => updateNodeData(id, { aspectRatio: e.target.value })}
            >
              <option value="1:1">1:1</option>
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="4:3">4:3</option>
            </select>
            {data.model && (
              <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-[var(--node-text-secondary)] uppercase tracking-tighter">
                {data.model.split('/').pop()}
              </span>
            )}
          </div>
        </div>

        {showPromptInput && (
          <div className="group/prompt relative">
            <textarea
              className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-3 text-[11px] leading-relaxed outline-none focus:border-white/10 transition-all resize-none min-h-[60px] placeholder:text-[var(--node-text-secondary)]/30 font-medium"
              placeholder="Enter manual prompt or connect a Text node..."
              value={data.inputPrompt || ""}
              onChange={(e) => updateNodeData(id, { inputPrompt: e.target.value })}
            />
          </div>
        )}

        <div className="flex-1 relative group/img cursor-pointer">
          {data.outputImage ? (
            <div className="relative overflow-hidden rounded-[24px] bg-[var(--node-textarea-bg)] shadow-xl aspect-square border border-white/5">
              <img
                src={data.outputImage}
                alt="generated"
                className="w-full h-full object-cover transition-transform duration-1000 group-hover/img:scale-110"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center backdrop-blur-sm">
                <button
                  onClick={handleGenerate}
                  className="h-12 w-12 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xl flex items-center justify-center text-white transition-all scale-90 group-hover/img:scale-100 border border-white/10"
                >
                  <RefreshCw size={24} className={data.status === 'loading' ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={handleGenerate}
              className={`w-full aspect-square rounded-[24px] flex flex-col items-center justify-center bg-[var(--node-textarea-bg)] border-2 border-dashed transition-all duration-500 overflow-hidden relative ${data.status === 'loading'
                ? 'border-amber-500/40 bg-amber-500/[0.02]'
                : 'border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/[0.02]'
                }`}
            >
              {data.status === 'loading' ? (
                <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-full border-2 border-amber-500/10 border-t-amber-500 animate-spin" />
                    <Sparkles className="absolute inset-0 m-auto text-amber-500 animate-pulse" size={24} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/80">Imaging...</span>
                </div>
              ) : (
                <>
                  <div className="h-14 w-14 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-4 group-hover/img:scale-110 group-hover/img:bg-emerald-500/10 group-hover/img:border-emerald-500/20 transition-all duration-500 shadow-inner">
                    <Sparkles className="text-[var(--node-text-secondary)] group-hover/img:text-emerald-500 transition-colors" size={28} />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] opacity-40 uppercase tracking-[0.2em] font-black group-hover/img:opacity-100 transition-all duration-500 translate-y-2 group-hover/img:translate-y-0 text-white">GENERATE</span>
                    <span className="text-[8px] opacity-20 uppercase tracking-[0.1em] font-bold group-hover/img:opacity-40 transition-all duration-500">Click to run flow</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {data.error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-2 items-start animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
            <span className="text-[10px] text-red-500/90 font-medium leading-tight">
              {data.error}
            </span>
          </div>
        )}
      </div>
    </BaseNode>
  );
};
