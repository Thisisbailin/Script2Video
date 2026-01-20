import React from "react";
import { BaseNode } from "./BaseNode";
import { VideoGenNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";
import { useLabExecutor } from "../store/useLabExecutor";
import { RefreshCw, Film, AlertCircle, ChevronUp } from "lucide-react";
import { QWEN_WAN_VIDEO_MODEL } from "../../constants";

type Props = {
  id: string;
  data: VideoGenNodeData;
};

export const WanVideoGenNode: React.FC<Props & { selected?: boolean }> = ({ id, data, selected }) => {
  const { updateNodeData, getConnectedInputs } = useWorkflowStore();
  const { runVideoGen } = useLabExecutor();

  const { text: connectedText, images: connectedImages } = getConnectedInputs(id);
  const showPromptInput = !connectedText;
  const hasConnectedImages = connectedImages.length > 0;

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await runVideoGen(id);
  };

  return (
    <BaseNode
      title={data.title || "WAN Video"}
      onTitleChange={(title) => updateNodeData(id, { title })}
      inputs={["image", "text"]}
      selected={selected}
    >
      <div className="space-y-4 flex-1 flex flex-col">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-1.5 w-1.5 rounded-full ${data.status === "complete" ? "bg-emerald-500 shadow-[0_0_8px_var(--accent-green)]" : data.status === "loading" ? "bg-amber-500 animate-pulse" : "bg-[var(--node-text-secondary)] opacity-20"}`} />
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--node-text-secondary)]">{data.status}</span>
            </div>
            <div className="text-[9px] font-black uppercase tracking-widest text-[var(--node-text-secondary)]">
              WAN
            </div>
          </div>

          <div className="node-control node-control--tight w-full px-2 text-[var(--node-text-secondary)] text-[9px] font-bold text-center uppercase tracking-wide truncate">
            {QWEN_WAN_VIDEO_MODEL}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <select
              className="node-control node-control--tight text-[9px] font-bold px-2 text-[var(--node-text-secondary)] outline-none appearance-none cursor-pointer transition-colors w-full"
              value={data.aspectRatio || "16:9"}
              onChange={(e) => updateNodeData(id, { aspectRatio: e.target.value })}
            >
              <option value="16:9">16:9 Landscape</option>
              <option value="9:16">9:16 Portrait</option>
              <option value="1:1">1:1 Square</option>
              <option value="21:9">21:9 Cinema</option>
            </select>

            <select
              className="node-control node-control--tight text-[9px] font-bold px-2 text-[var(--node-text-secondary)] outline-none appearance-none cursor-pointer transition-colors w-full"
              value={data.duration || "10s"}
              onChange={(e) => updateNodeData(id, { duration: e.target.value })}
            >
              <option value="5s">5 Seconds</option>
              <option value="10s">10 Seconds</option>
            </select>
          </div>
        </div>

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

        {hasConnectedImages && (
          <div className="text-[10px] uppercase tracking-[0.2em] font-black text-[var(--node-text-secondary)]/70">
            {connectedImages.length} image reference{connectedImages.length > 1 ? "s" : ""} connected
          </div>
        )}

        {data.videoUrl ? (
          <div className="node-surface relative group/vid overflow-hidden rounded-[20px] shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
            <video
              controls
              className="w-full aspect-video transition-transform duration-700 bg-black/40"
            >
              <source src={data.videoUrl} />
            </video>
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/vid:opacity-100 transition-all flex items-center justify-center backdrop-blur-sm gap-2">
              <button
                onClick={() => window.open(data.videoUrl!, "_blank")}
                className="h-10 w-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xl flex items-center justify-center text-white transition-all scale-90 group-hover/vid:scale-100 border border-white/10"
                title="Open Video"
              >
                <ChevronUp size={20} className="rotate-45" />
              </button>
              <button
                onClick={handleGenerate}
                className="h-12 w-12 rounded-full bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 backdrop-blur-xl flex items-center justify-center text-white transition-all scale-90 group-hover/vid:scale-100 border border-white/10"
                title="Regenerate"
              >
                <RefreshCw size={24} className={data.status === "loading" ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={handleGenerate}
            className={`node-surface node-surface--dashed w-full aspect-video rounded-[20px] flex flex-col items-center justify-center transition-all duration-500 ${data.status === "loading"
              ? "border-amber-500/40 bg-amber-500/[0.02]"
              : "hover:border-emerald-500/30 hover:bg-emerald-500/[0.02]"
              }`}
          >
            {data.status === "loading" ? (
              <div className="flex flex-col items-center gap-3">
                <RefreshCw size={24} className="text-[var(--node-accent)] animate-spin" />
                <span className="text-[10px] opacity-50 uppercase tracking-[0.2em] font-black">Generating...</span>
              </div>
            ) : (
              <>
                <div className="h-14 w-14 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-4 transition-all duration-500 shadow-inner">
                  <Film className="text-[var(--node-text-secondary)]" size={28} />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] opacity-40 uppercase tracking-[0.2em] font-black transition-all duration-500 text-white">GENERATE</span>
                  <span className="text-[8px] opacity-20 uppercase tracking-[0.1em] font-bold transition-all duration-500">Click to run flow</span>
                </div>
              </>
            )}
          </div>
        )}

        {data.error && (
          <div className="node-alert p-3 flex gap-2 items-start animate-in fade-in slide-in-from-top-2">
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
