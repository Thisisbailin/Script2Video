import React, { useState } from "react";
import { BaseNode } from "./BaseNode";
import { ViduVideoGenNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";
import { useLabExecutor } from "../store/useLabExecutor";
import { Settings2, RefreshCw, AlertCircle, Film, Sparkles, ShieldCheck } from "lucide-react";

type Props = {
  id: string;
  data: ViduVideoGenNodeData;
  selected?: boolean;
};

export const ViduVideoGenNode: React.FC<Props> = ({ id, data, selected }) => {
  const { updateNodeData, getConnectedInputs } = useWorkflowStore();
  const { runVideoGen } = useLabExecutor();
  const [showAdvanced, setShowAdvanced] = useState(true);

  const { text: connectedText, images: connectedImages } = getConnectedInputs(id);
  const showPromptInput = !connectedText;

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await runVideoGen(id);
  };

  return (
    <BaseNode
      title={data.title || "Vidu Reference2Video"}
      onTitleChange={(title) => updateNodeData(id, { title })}
      inputs={["image", "text"]}
      selected={selected}
    >
      <div className="space-y-4 flex-1 flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-1.5 w-1.5 rounded-full ${data.status === 'complete' ? 'bg-emerald-500 shadow-[0_0_8px_var(--accent-green)]' : data.status === 'loading' ? 'bg-amber-500 animate-pulse' : 'bg-[var(--node-text-secondary)] opacity-20'}`} />
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--node-text-secondary)]">{data.status}</span>
          </div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`p-1 rounded-full node-control hover:bg-white/10 transition-colors ${showAdvanced ? 'text-[var(--node-accent)] bg-white/5' : 'text-[var(--node-text-secondary)]'}`}
          >
            <Settings2 size={12} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <select
            className="node-control node-control--tight text-[9px] font-bold px-2 text-[var(--node-text-secondary)] outline-none appearance-none cursor-pointer transition-colors w-full"
            value={data.mode || "audioVideo"}
            onChange={(e) => updateNodeData(id, { mode: e.target.value as any })}
          >
            <option value="audioVideo">音视频直出</option>
            <option value="videoOnly">纯视频直出</option>
          </select>
          <select
            className="node-control node-control--tight text-[9px] font-bold px-2 text-[var(--node-text-secondary)] outline-none appearance-none cursor-pointer transition-colors w-full"
            value={data.resolution || "1080p"}
            onChange={(e) => updateNodeData(id, { resolution: e.target.value })}
          >
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="540p">540p</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <select
            className="node-control node-control--tight text-[9px] font-bold px-2 text-[var(--node-text-secondary)] outline-none appearance-none cursor-pointer transition-colors w-full"
            value={data.aspectRatio || "16:9"}
            onChange={(e) => updateNodeData(id, { aspectRatio: e.target.value })}
          >
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="4:3">4:3</option>
            <option value="3:4">3:4</option>
          </select>

          <select
            className="node-control node-control--tight text-[9px] font-bold px-2 text-[var(--node-text-secondary)] outline-none appearance-none cursor-pointer transition-colors w-full"
            value={data.duration?.toString() || "10"}
            onChange={(e) => updateNodeData(id, { duration: parseInt(e.target.value, 10) })}
          >
            <option value="5">5s</option>
            <option value="8">8s</option>
            <option value="10">10s</option>
          </select>
        </div>

        {showAdvanced && (
          <div className="node-panel space-y-3 p-3 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2 text-[9px] text-[var(--node-text-secondary)]">
              <Sparkles size={12} className="text-amber-300" />
              默认模型：{data.model || "viduq2-pro"} · 动效 {data.movementAmplitude || "auto"} · 错峰 {data.offPeak !== false ? "On" : "Off"}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[9px] text-[var(--node-text-secondary)]">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={data.offPeak !== false}
                  onChange={(e) => updateNodeData(id, { offPeak: e.target.checked })}
                  className="accent-[var(--node-accent)]"
                />
                错峰模式
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={data.mode === "audioVideo"}
                  onChange={(e) => updateNodeData(id, { mode: e.target.checked ? "audioVideo" : "videoOnly" })}
                  className="accent-[var(--node-accent)]"
                />
                音视频直出
              </label>
            </div>
            <div className="node-control node-control--tight w-full text-[9px] font-medium px-2 text-[var(--node-text-primary)] outline-none appearance-none cursor-pointer transition-colors">
              <div className="flex items-center gap-2">
                <ShieldCheck size={12} className="text-emerald-300" />
                主体参考：{data.subjects?.length || 0} 组 · {connectedImages.length} 参考图连接
              </div>
            </div>
          </div>
        )}

        {showPromptInput && (
          <div className="group/prompt relative">
            <textarea
              className="node-textarea w-full text-[11px] leading-relaxed outline-none transition-all resize-none min-h-[60px] placeholder:text-[var(--node-text-secondary)]/40 font-medium"
              placeholder="输入 Vidu 提示词..."
              value={data.inputPrompt || ""}
              onChange={(e) => updateNodeData(id, { inputPrompt: e.target.value })}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        )}

        <div className="text-[10px] uppercase tracking-[0.2em] font-black text-[var(--node-text-secondary)]/70">
          {connectedImages.length} refs · {connectedText ? "Text in" : "Prompt needed"}
        </div>

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
                onClick={handleGenerate}
                className="h-12 w-12 rounded-full bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 backdrop-blur-xl flex items-center justify-center text-white transition-all scale-90 group-hover/vid:scale-100 border border-white/10"
                title="Regenerate"
              >
                <RefreshCw size={24} className={data.status === 'loading' ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={handleGenerate}
            className={`node-surface node-surface--dashed w-full aspect-video rounded-[20px] flex flex-col items-center justify-center transition-all duration-500 ${data.status === 'loading'
              ? 'border-amber-500/40 bg-amber-500/[0.02]'
              : 'hover:border-emerald-500/30 hover:bg-emerald-500/[0.02]'
              }`}
          >
            {data.status === 'loading' ? (
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
                  <span className="text-[8px] opacity-20 uppercase tracking-[0.1em] font-bold transition-all duration-500">Vidu reference2video</span>
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
