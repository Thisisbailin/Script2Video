import React, { useState } from "react";
import { BaseNode } from "./BaseNode";
import { VideoGenNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";
import { Settings2, Film, RefreshCw, AlertCircle } from "lucide-react";

type Props = {
  id: string;
  data: VideoGenNodeData;
};

export const VideoGenNode: React.FC<Props & { selected?: boolean }> = ({ id, data, selected }) => {
  const { updateNodeData, availableVideoModels } = useWorkflowStore();
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <BaseNode
      title={data.title || "Video Synthesis"}
      onTitleChange={(title) => updateNodeData(id, { title })}
      inputs={["image", "text"]}
      selected={selected}
    >
      <div className="space-y-4 flex-1 flex flex-col">
        {/* Controls Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-1.5 w-1.5 rounded-full ${data.status === 'complete' ? 'bg-emerald-500 shadow-[0_0_8px_var(--accent-green)]' : data.status === 'loading' ? 'bg-amber-500 animate-pulse' : 'bg-[var(--node-text-secondary)] opacity-20'}`} />
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--node-text-secondary)]">{data.status}</span>
            </div>

            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`p-1 rounded-full hover:bg-white/10 transition-colors ${showAdvanced ? 'text-[var(--node-accent)] bg-white/5' : 'text-[var(--node-text-secondary)]'}`}
            >
              <Settings2 size={12} />
            </button>
          </div>

          <div className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[var(--node-text-secondary)] text-[9px] font-bold text-center uppercase tracking-wide truncate">
            {data.model ? data.model.split('/').pop() : "Default Model"}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {/* Aspect Ratio */}
            <select
              className="text-[9px] font-bold px-2 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[var(--node-text-secondary)] outline-none appearance-none cursor-pointer hover:bg-white/10 transition-colors w-full"
              value={data.aspectRatio || "16:9"}
              onChange={(e) => updateNodeData(id, { aspectRatio: e.target.value })}
            >
              <option value="16:9">16:9 Landscape</option>
              <option value="9:16">9:16 Portrait</option>
              <option value="1:1">1:1 Square</option>
              <option value="21:9">21:9 Cinema</option>
            </select>

            {/* Duration */}
            <select
              className="text-[9px] font-bold px-2 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[var(--node-text-secondary)] outline-none appearance-none cursor-pointer hover:bg-white/10 transition-colors w-full"
              value={data.duration || "5s"}
              onChange={(e) => updateNodeData(id, { duration: e.target.value })}
            >
              <option value="5s">5 Seconds</option>
              <option value="10s">10 Seconds</option>
            </select>
          </div>
        </div>

        {/* Advanced Controls */}
        {showAdvanced && (
          <div className="space-y-3 p-3 bg-black/20 rounded-xl animate-in fade-in slide-in-from-top-1">
            {/* Model Selector */}
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase tracking-widest text-[var(--node-text-secondary)] opacity-70">Model Override</label>
              <select
                className="w-full text-[9px] font-medium px-2 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[var(--node-text-primary)] outline-none appearance-none cursor-pointer hover:bg-white/10 transition-colors"
                value={data.model || ""}
                onChange={(e) => updateNodeData(id, { model: e.target.value || undefined })}
              >
                <option value="">Default (Global)</option>
                {availableVideoModels.map(m => (
                  <option key={m} value={m}>{m.split('/').pop()}</option>
                ))}
              </select>
            </div>

            {/* Quality */}
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase tracking-widest text-[var(--node-text-secondary)] opacity-70">Quality</label>
              <select
                className="w-full text-[9px] font-medium px-2 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[var(--node-text-primary)] outline-none appearance-none cursor-pointer hover:bg-white/10 transition-colors"
                value={data.quality || "standard"}
                onChange={(e) => updateNodeData(id, { quality: e.target.value })}
              >
                <option value="standard">Standard</option>
                <option value="high">High Quality</option>
              </select>
            </div>
          </div>
        )}

        {/* Video Preview */}
        {data.videoUrl ? (
          <div className="relative group/vid overflow-hidden rounded-[20px] bg-[var(--node-textarea-bg)] shadow-md border border-white/5">
            <video
              controls
              className="w-full aspect-video transition-transform duration-700 bg-black/40"
            >
              <source src={data.videoUrl} />
            </video>
          </div>
        ) : (
          <div className="w-full aspect-video rounded-[20px] flex flex-col items-center justify-center bg-[var(--node-textarea-bg)] border-2 border-dashed border-[var(--node-text-secondary)]/10">
            {data.status === 'loading' ? (
              <div className="flex flex-col items-center gap-3">
                <RefreshCw size={24} className="text-[var(--node-accent)] animate-spin" />
                <span className="text-[10px] opacity-50 uppercase tracking-[0.2em] font-black">Generating...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 opacity-30">
                <Film size={24} />
                <span className="text-[10px] uppercase tracking-[0.2em] font-black">Ready</span>
              </div>
            )}
          </div>
        )}

        {data.error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-2 items-start animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
            <span className="text-[10px] text-red-500/90 font-bold uppercase tracking-tight leading-tight">
              {data.error}
            </span>
          </div>
        )}
      </div>
    </BaseNode>
  );
};
