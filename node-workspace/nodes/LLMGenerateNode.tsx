import React, { useMemo, useRef, useLayoutEffect } from "react";
import { BaseNode } from "./BaseNode";
import { LLMGenerateNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";
import { useConfig } from "../../hooks/useConfig";
import { AVAILABLE_MODELS } from "../../constants";
import { Loader2, Play } from "lucide-react";
import { useLabExecutor } from "../store/useLabExecutor";

type Props = {
  id: string;
  data: LLMGenerateNodeData;
};

export const LLMGenerateNode: React.FC<Props & { selected?: boolean }> = ({ id, data, selected }) => {
  const { updateNodeData, labContext } = useWorkflowStore();
  const { config } = useConfig("script2video_config_v1");
  const { runLLM } = useLabExecutor();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isLoading = data.status === "loading";

  const modelOptions = useMemo(() => {
    const options = AVAILABLE_MODELS.map((m) => ({ id: m.id, name: m.name }));
    if (config.textConfig.model && !options.find((m) => m.id === config.textConfig.model)) {
      options.unshift({ id: config.textConfig.model, name: config.textConfig.model });
    }
    return options;
  }, [config.textConfig.model]);

  const contextChips = [
    { key: "script", label: "剧本", available: !!labContext.rawScript },
    { key: "globalStyleGuide", label: "Style Guide", available: !!labContext.globalStyleGuide },
    { key: "shotGuide", label: "Shot Guide", available: !!labContext.shotGuide },
    { key: "soraGuide", label: "Sora Guide", available: !!labContext.soraGuide },
    { key: "dramaGuide", label: "Drama Guide", available: !!labContext.dramaGuide },
    { key: "projectSummary", label: "项目概览", available: !!labContext.context.projectSummary },
    { key: "episodeSummaries", label: "剧集概览", available: labContext.context.episodeSummaries.length > 0 },
    { key: "characters", label: "角色", available: labContext.context.characters.length > 0 },
    { key: "locations", label: "场景", available: labContext.context.locations.length > 0 },
  ];

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(autoResize);
    return () => window.cancelAnimationFrame(frame);
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`h-1.5 w-1.5 rounded-full ${data.status === 'complete' ? 'bg-emerald-500 shadow-[0_0_8px_var(--accent-green)]' : data.status === 'loading' ? 'bg-amber-500 animate-pulse' : 'bg-[var(--node-text-secondary)] opacity-20'}`} />
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--node-text-secondary)]">{data.status}</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              runLLM(id);
            }}
            disabled={isLoading}
            className={`node-button node-button-primary h-7 px-3 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${isLoading ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {isLoading ? "Generating" : "Run"}
          </button>
        </div>

        <div className="space-y-2">
          <div className="text-[9px] font-black uppercase tracking-widest text-[var(--node-text-secondary)]">Text Model</div>
          <select
            className="node-control node-control--tight w-full text-[10px] font-bold px-2 text-[var(--node-text-secondary)] outline-none appearance-none cursor-pointer transition-colors"
            value={data.model || ""}
            onChange={(e) => updateNodeData(id, { model: e.target.value || undefined })}
          >
            <option value="">Use Default · {config.textConfig.model || "default"}</option>
            {modelOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <div className="text-[9px] font-black uppercase tracking-widest text-[var(--node-text-secondary)]">Context</div>
          <div className="flex flex-wrap gap-2">
            {contextChips.map((chip) => {
              const isActive = !!data.contextSelection?.[chip.key as keyof NonNullable<LLMGenerateNodeData["contextSelection"]>];
              return (
                <button
                  key={chip.key}
                  type="button"
                  disabled={!chip.available}
                  onClick={() =>
                    updateNodeData(id, {
                      contextSelection: {
                        ...data.contextSelection,
                        [chip.key]: !isActive,
                      },
                    })
                  }
                  className={`node-pill inline-flex items-center px-3 py-1 text-[9px] font-bold uppercase tracking-widest transition-all ${
                    isActive ? "node-pill--accent" : ""
                  } ${chip.available ? "" : "opacity-40 cursor-not-allowed"}`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        <textarea
          ref={textareaRef}
          className="node-textarea w-full text-[13px] leading-relaxed p-4 outline-none resize-none transition-all placeholder:text-[var(--node-text-secondary)] min-h-[100px]"
          value={data.outputText || ""}
          readOnly
          placeholder="Awaiting generation..."
          style={{ height: 'auto' }}
          onFocus={autoResize}
        />

        {data.error && (
          <div className="node-alert p-3 text-[10px] font-bold uppercase tracking-tight">
            {data.error}
          </div>
        )}
      </div>
    </BaseNode>
  );
};
