import React, { useMemo, useState } from "react";
import { BaseNode } from "./BaseNode";
import { ImageGenNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";
import { useLabExecutor } from "../store/useLabExecutor";
import { Sparkles, RefreshCw, AlertCircle, Settings2, ChevronUp, X } from "lucide-react";

type Props = {
  id: string;
  data: ImageGenNodeData;
};

export const ImageGenNode: React.FC<Props & { selected?: boolean }> = ({ id, data, selected }) => {
  const { updateNodeData, getConnectedInputs, availableImageModels, labContext } = useWorkflowStore();
  const { runImageGen } = useLabExecutor();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await runImageGen(id);
  };

  const { text: connectedText } = getConnectedInputs(id);
  const showPromptInput = !connectedText;

  const forms = useMemo(() => {
    const chars = labContext?.context?.characters || [];
    return chars.flatMap((c) => (c.forms || []).map((f) => f.formName)).filter(Boolean);
  }, [labContext]);

  // Derive display model name
  const currentModel = data.model ? data.model.split('/').pop() : "Default";

  return (
    <BaseNode
      title={data.title || "Visual Imaging"}
      onTitleChange={(title) => updateNodeData(id, { title })}
      inputs={["image", "text"]}
      outputs={["image"]}
      selected={selected}
    >
      <div className="space-y-4 flex-1 flex flex-col">
        {/* Controls Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-1.5 w-1.5 rounded-full ${data.status === 'complete' ? 'bg-emerald-500 shadow-[0_0_8px_var(--accent-green)]' : data.status === 'loading' ? 'bg-amber-500 animate-pulse' : 'bg-[var(--node-text-secondary)] opacity-30'}`} />
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--node-text-secondary)]">{data.status || 'idle'}</span>
            </div>

            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`p-1 rounded-full node-control hover:bg-white/10 transition-colors ${showAdvanced ? 'text-[var(--node-accent)] bg-white/5' : 'text-[var(--node-text-secondary)]'}`}
            >
              <Settings2 size={12} />
            </button>
          </div>

          <div className="node-control node-control--tight w-full px-2 text-[var(--node-text-secondary)] text-[9px] font-bold text-center uppercase tracking-wide truncate">
            {currentModel}
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {/* Aspect Ratio */}
            <select
              className="node-control node-control--tight text-[9px] font-bold px-2 text-[var(--node-text-secondary)] outline-none appearance-none cursor-pointer transition-colors w-full"
              value={data.aspectRatio || "1:1"}
              onChange={(e) => updateNodeData(id, { aspectRatio: e.target.value })}
            >
              <option value="1:1">1:1 Square</option>
              <option value="16:9">16:9 Landscape</option>
              <option value="9:16">9:16 Portrait</option>
              <option value="4:3">4:3 Standard</option>
              <option value="21:9">21:9 Ultrawide</option>
            </select>
          </div>
        </div>

        {/* Advanced Controls (Collapsible) */}
        {showAdvanced && (
          <div className="node-panel space-y-3 p-3 animate-in fade-in slide-in-from-top-1">
            {/* Model Selector */}
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase tracking-widest text-[var(--node-text-secondary)] opacity-70">Model Override</label>
              <select
                className="node-control node-control--tight w-full text-[9px] font-medium px-2 text-[var(--node-text-primary)] outline-none appearance-none cursor-pointer transition-colors"
                value={data.model || ""}
                onChange={(e) => updateNodeData(id, { model: e.target.value || undefined })}
              >
                <option value="">Use Default</option>
                {availableImageModels.map(m => (
                  <option key={m} value={m}>{m.split('/').pop()}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase tracking-widest text-[var(--node-text-secondary)] opacity-70">关联形态</label>
              <select
                className="node-control node-control--tight w-full text-[9px] font-medium px-2 text-[var(--node-text-primary)] outline-none appearance-none cursor-pointer transition-colors"
                value={data.formTag || ""}
                onChange={(e) => updateNodeData(id, { formTag: e.target.value || undefined })}
              >
                <option value="">未指定</option>
                {forms.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {showPromptInput && (
          <div className="group/prompt relative">
            <textarea
              className="node-textarea w-full text-[11px] leading-relaxed outline-none transition-all resize-none min-h-[60px] placeholder:text-[var(--node-text-secondary)]/40 font-medium"
              placeholder="Enter prompt..."
              value={data.inputPrompt || ""}
              onChange={(e) => updateNodeData(id, { inputPrompt: e.target.value })}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        )}

        <div className="flex-1 relative group/img cursor-pointer min-h-[200px]">
          {data.outputImage ? (
            <div className="node-surface relative overflow-hidden rounded-[24px] shadow-[0_18px_40px_rgba(0,0,0,0.45)] w-full h-full group-hover/img:border-white/30 transition-all">
              <img
                src={data.outputImage}
                alt="generated"
                className="w-full h-full object-contain bg-black/40"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center backdrop-blur-sm gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPreviewOpen(true);
                  }}
                  className="h-10 w-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xl flex items-center justify-center text-white transition-all scale-90 group-hover/img:scale-100 border border-white/10"
                  title="Open Full Size"
                >
                  <ChevronUp size={20} className="rotate-45" />
                </button>
                <button
                  onClick={handleGenerate}
                  className="h-12 w-12 rounded-full bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 backdrop-blur-xl flex items-center justify-center text-white transition-all scale-90 group-hover/img:scale-100 border border-white/10"
                >
                  <RefreshCw size={24} className={data.status === 'loading' ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={handleGenerate}
              className={`node-surface node-surface--dashed w-full h-full rounded-[24px] flex flex-col items-center justify-center transition-all duration-500 overflow-hidden relative ${data.status === 'loading'
                ? 'border-amber-500/40 bg-amber-500/[0.02]'
                : 'hover:border-emerald-500/30 hover:bg-emerald-500/[0.02]'
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
          <div className="node-alert p-3 flex gap-2 items-start animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
            <span className="text-[10px] text-red-500/90 font-medium leading-tight">
              {data.error}
            </span>
          </div>
        )}
      </div>

      {isPreviewOpen && data.outputImage && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setIsPreviewOpen(false)}>
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <button
              className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center border border-white/10 shadow-lg"
              onClick={(e) => {
                e.stopPropagation();
                setIsPreviewOpen(false);
              }}
              aria-label="Close preview"
            >
              <X size={18} />
            </button>
            <img
              src={data.outputImage}
              alt="Generated preview"
              className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </BaseNode>
  );
};
