import React, { useEffect, useRef, useState } from "react";
import { BaseNode } from "./BaseNode";
import { VideoGenNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";
import { useLabExecutor } from "../store/useLabExecutor";
import { RefreshCw, Film, AlertCircle, Download, Upload, X, Video } from "lucide-react";
import {
  QWEN_WAN_REFERENCE_VIDEO_FLASH_MODEL,
  QWEN_WAN_REFERENCE_VIDEO_MODEL,
} from "../../constants";
import { buildApiUrl } from "../../utils/api";

type Props = {
  id: string;
  data: VideoGenNodeData;
};

const clampDuration = (value: number) => Math.max(2, Math.min(10, Math.round(value)));

export const WanReferenceVideoGenNode: React.FC<Props & { selected?: boolean }> = ({ id, data, selected }) => {
  const { updateNodeData, getConnectedInputs } = useWorkflowStore();
  const { runVideoGen } = useLabExecutor();
  const [progress, setProgress] = useState(0);
  const [isUploadingRefs, setIsUploadingRefs] = useState(false);
  const refVideoInputRef = useRef<HTMLInputElement>(null);

  const { images: connectedImages } = getConnectedInputs(id);
  const referenceVideos = Array.isArray(data.referenceVideos) ? data.referenceVideos.filter(Boolean) : [];
  const hasConnectedImages = connectedImages.length > 0;
  const isLoading = data.status === "loading";
  const currentModel =
    data.model === QWEN_WAN_REFERENCE_VIDEO_FLASH_MODEL
      ? QWEN_WAN_REFERENCE_VIDEO_FLASH_MODEL
      : QWEN_WAN_REFERENCE_VIDEO_MODEL;
  const supportsAudioToggle = currentModel === QWEN_WAN_REFERENCE_VIDEO_FLASH_MODEL;
  const currentResolution = (data.resolution || "720P").toUpperCase();
  const aspectRatioOptions: Record<string, { value: string; label: string }[]> = {
    "720P": [
      { value: "16:9", label: "16:9 Landscape" },
      { value: "9:16", label: "9:16 Portrait" },
      { value: "1:1", label: "1:1 Square" },
      { value: "4:3", label: "4:3 Standard" },
      { value: "3:4", label: "3:4 Portrait" },
    ],
    "1080P": [
      { value: "16:9", label: "16:9 Landscape" },
      { value: "9:16", label: "9:16 Portrait" },
      { value: "1:1", label: "1:1 Square" },
      { value: "4:3", label: "4:3 Standard" },
      { value: "3:4", label: "3:4 Portrait" },
    ],
  };
  const allowedAspectOptions = aspectRatioOptions[currentResolution] || aspectRatioOptions["720P"];
  const currentAspect =
    allowedAspectOptions.find((opt) => opt.value === data.aspectRatio)?.value || allowedAspectOptions[0].value;
  const currentDuration = clampDuration(Number.parseInt((data.duration || "5s").replace("s", ""), 10) || 5);

  useEffect(() => {
    const next: Partial<VideoGenNodeData> = {};
    if (data.model !== currentModel) {
      next.model = currentModel;
    }
    if (data.resolution && data.resolution !== currentResolution) {
      next.resolution = currentResolution;
    }
    if (!allowedAspectOptions.some((opt) => opt.value === data.aspectRatio)) {
      next.aspectRatio = currentAspect;
    }
    if (!Array.isArray(data.referenceVideos)) {
      next.referenceVideos = [];
    }
    if (Object.keys(next).length > 0) {
      updateNodeData(id, next);
    }
  }, [allowedAspectOptions, currentAspect, currentModel, currentResolution, data.aspectRatio, data.model, data.referenceVideos, data.resolution, id, updateNodeData]);

  useEffect(() => {
    if (!isLoading) {
      setProgress(0);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const eased = 1 - Math.exp(-elapsed / 14000);
      setProgress(Math.min(95, Math.round(eased * 100)));
    }, 500);
    return () => clearInterval(timer);
  }, [isLoading]);

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await runVideoGen(id);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data.videoUrl) return;
    const link = document.createElement("a");
    link.href = data.videoUrl;
    link.download = "wan-reference-video.mp4";
    link.rel = "noreferrer";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const uploadReferenceVideo = async (file: File) => {
    const safeName = file.name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").toLowerCase();
    const contentType = file.type || "video/mp4";
    const payload = {
      fileName: `wan-reference-video/${Date.now()}-${safeName}`,
      bucket: "assets",
      contentType,
    };
    const res = await fetch(buildApiUrl("/api/upload-url"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Upload URL error ${res.status}`);
    }
    const dataRes = await res.json();
    if (!dataRes?.signedUrl) {
      throw new Error("Missing signedUrl");
    }

    const uploadRes = await fetch(dataRes.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!uploadRes.ok) {
      const txt = await uploadRes.text();
      throw new Error(`Upload failed ${uploadRes.status}: ${txt}`);
    }

    let url = dataRes.publicUrl || "";
    if (!url && dataRes.path) {
      const signedRes = await fetch(buildApiUrl("/api/download-url"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: dataRes.path, bucket: dataRes.bucket || "assets" }),
      });
      if (signedRes.ok) {
        const signedData = await signedRes.json();
        url = signedData.signedUrl || "";
      }
    }
    if (!url) {
      throw new Error("Missing reference video URL");
    }
    return url;
  };

  const handleReferenceFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = Math.max(0, 3 - referenceVideos.length);
    if (remaining === 0) {
      updateNodeData(id, { error: "最多支持 3 个参考视频。" });
      return;
    }
    setIsUploadingRefs(true);
    try {
      const selected = Array.from(files).slice(0, remaining);
      const uploaded: string[] = [];
      for (const file of selected) {
        uploaded.push(await uploadReferenceVideo(file));
      }
      updateNodeData(id, {
        referenceVideos: [...referenceVideos, ...uploaded],
        error: null,
      });
    } catch (e: any) {
      updateNodeData(id, { error: e?.message || "参考视频上传失败。" });
    } finally {
      setIsUploadingRefs(false);
      if (refVideoInputRef.current) {
        refVideoInputRef.current.value = "";
      }
    }
  };

  const handleRemoveReference = (index: number) => {
    updateNodeData(id, {
      referenceVideos: referenceVideos.filter((_, itemIndex) => itemIndex !== index),
    });
  };

  return (
    <BaseNode
      title={data.title || "WAN Ref Video"}
      onTitleChange={(title) => updateNodeData(id, { title })}
      inputs={["image", "text"]}
      selected={selected}
    >
      <div className="space-y-4 flex-1 flex flex-col">
        {data.videoUrl ? (
          <div className="node-surface relative overflow-hidden rounded-[20px] shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
            <video
              controls
              playsInline
              disablePictureInPicture
              disableRemotePlayback
              controlsList="nodownload noplaybackrate noremoteplayback"
              className="w-full aspect-video transition-transform duration-700 bg-black/40 nodrag"
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <source src={data.videoUrl} />
            </video>
          </div>
        ) : (
          <div
            onClick={handleGenerate}
            className={`node-surface node-surface--dashed w-full aspect-video rounded-[20px] flex flex-col items-center justify-center transition-all duration-500 ${
              data.status === "loading"
                ? "border-amber-500/40 bg-amber-500/[0.02]"
                : "hover:border-fuchsia-500/30 hover:bg-fuchsia-500/[0.02]"
            }`}
          >
            {data.status === "loading" ? (
              <div className="flex flex-col items-center gap-3">
                <RefreshCw size={24} className="text-[var(--node-accent)] animate-spin" />
                <span className="text-[10px] opacity-50 uppercase tracking-[0.2em] font-black">Generating...</span>
                <div className="w-full max-w-[180px] space-y-2">
                  <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-amber-400 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="text-[9px] font-semibold text-amber-300/80 text-center">{progress}%</div>
                </div>
              </div>
            ) : (
              <>
                <div className="h-14 w-14 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-4 transition-all duration-500 shadow-inner">
                  <Film className="text-[var(--node-text-secondary)]" size={28} />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] opacity-40 uppercase tracking-[0.2em] font-black transition-all duration-500 text-white">GENERATE</span>
                  <span className="text-[8px] opacity-20 uppercase tracking-[0.1em] font-bold transition-all duration-500">
                    Wan 2.6 reference video
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {data.videoUrl && (
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-2 rounded-full text-[10px] font-semibold uppercase tracking-widest text-[var(--node-text-secondary)] bg-white/5 hover:bg-white/10 transition"
            >
              <Download size={12} />
              下载
            </button>
            <div className="flex-1" />
            {isLoading ? (
              <div className="flex items-center gap-2 text-[9px] font-semibold text-amber-300/90">
                <div className="h-1 w-24 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-amber-400 transition-all" style={{ width: `${progress}%` }} />
                </div>
                <span>{progress}%</span>
              </div>
            ) : (
              <button
                onClick={handleGenerate}
                className="flex items-center gap-2 px-3 py-2 rounded-full text-[10px] font-semibold uppercase tracking-widest text-white bg-emerald-500/80 hover:bg-emerald-500 transition"
                title="Regenerate"
              >
                <RefreshCw size={12} />
                重试
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-[0.18em] font-black text-[var(--node-text-secondary)]/70">
          <div>{referenceVideos.length} video ref{referenceVideos.length !== 1 ? "s" : ""}</div>
          <div className="text-right">{connectedImages.length} image ref{connectedImages.length !== 1 ? "s" : ""}</div>
        </div>

        <div className="node-panel space-y-3 p-3 nodrag">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase tracking-widest text-[var(--node-text-secondary)] opacity-70">
                参考视频
              </label>
              <div className="text-[9px] text-[var(--node-text-secondary)]">
                上传 1-3 个 MP4 / MOV，可额外连接图片作为补充参考。
              </div>
            </div>
            <button
              type="button"
              onClick={() => refVideoInputRef.current?.click()}
              disabled={isUploadingRefs || referenceVideos.length >= 3}
              className="node-button node-button-primary h-9 px-3 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] disabled:opacity-60 nodrag"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Upload size={12} />
              {isUploadingRefs ? "Uploading" : "Add Ref"}
            </button>
            <input
              ref={refVideoInputRef}
              type="file"
              accept="video/mp4,video/quicktime,.mp4,.mov"
              multiple
              className="hidden"
              onChange={(e) => handleReferenceFiles(e.target.files)}
            />
          </div>

          {referenceVideos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {referenceVideos.map((url, index) => (
                <div key={`${url}-${index}`} className="relative overflow-hidden rounded-[14px] border border-white/10 bg-black/20 aspect-[4/5]">
                  <video
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover nodrag"
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <source src={url} />
                  </video>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/80">
                        Ref {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveReference(index)}
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-black/45 text-white/80 transition hover:bg-black/65"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {hasConnectedImages && (
          <div className="text-[10px] uppercase tracking-[0.2em] font-black text-[var(--node-text-secondary)]/70">
            {connectedImages.length} image reference{connectedImages.length > 1 ? "s" : ""} connected
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-1.5 w-1.5 rounded-full ${
                data.status === "complete"
                  ? "bg-emerald-500 shadow-[0_0_8px_var(--accent-green)]"
                  : data.status === "loading"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-[var(--node-text-secondary)] opacity-20"
              }`} />
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--node-text-secondary)]">{data.status}</span>
            </div>
            <div className="text-[9px] font-black uppercase tracking-widest text-[var(--node-text-secondary)]">
              WAN R2V
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 nodrag">
            <select
              className="node-control node-control--tight text-[9px] font-bold px-2 text-[var(--node-text-secondary)] outline-none appearance-none cursor-pointer transition-colors w-full nodrag"
              value={currentModel}
              onChange={(e) => {
                const nextModel =
                  e.target.value === QWEN_WAN_REFERENCE_VIDEO_FLASH_MODEL
                    ? QWEN_WAN_REFERENCE_VIDEO_FLASH_MODEL
                    : QWEN_WAN_REFERENCE_VIDEO_MODEL;
                updateNodeData(id, {
                  model: nextModel,
                  audioEnabled: nextModel === QWEN_WAN_REFERENCE_VIDEO_FLASH_MODEL ? data.audioEnabled !== false : true,
                });
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <option value={QWEN_WAN_REFERENCE_VIDEO_MODEL}>wan2.6-r2v</option>
              <option value={QWEN_WAN_REFERENCE_VIDEO_FLASH_MODEL}>wan2.6-r2v-flash</option>
            </select>

            <select
              className="node-control node-control--tight text-[9px] font-bold px-2 text-[var(--node-text-secondary)] outline-none appearance-none cursor-pointer transition-colors w-full nodrag"
              value={data.shotType || "single"}
              onChange={(e) => updateNodeData(id, { shotType: e.target.value as "single" | "multi" })}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <option value="single">Single Shot</option>
              <option value="multi">Multi Shot</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-1.5 nodrag">
            <select
              className="node-control node-control--tight text-[9px] font-bold px-2 text-[var(--node-text-secondary)] outline-none appearance-none cursor-pointer transition-colors w-full nodrag"
              value={currentResolution}
              onChange={(e) => {
                const nextResolution = e.target.value.toUpperCase();
                const nextOptions = aspectRatioOptions[nextResolution] || allowedAspectOptions;
                const nextAspect = nextOptions.some((opt) => opt.value === data.aspectRatio)
                  ? data.aspectRatio
                  : nextOptions[0].value;
                updateNodeData(id, { resolution: nextResolution, aspectRatio: nextAspect });
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <option value="720P">720P</option>
              <option value="1080P">1080P</option>
            </select>

            <select
              className="node-control node-control--tight text-[9px] font-bold px-2 text-[var(--node-text-secondary)] outline-none appearance-none cursor-pointer transition-colors w-full nodrag"
              value={currentAspect}
              onChange={(e) => updateNodeData(id, { aspectRatio: e.target.value })}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {allowedAspectOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-1.5 nodrag">
            <div className="node-control node-control--tight flex items-center gap-2 px-2">
              <Video size={11} className="text-[var(--node-text-secondary)]" />
              <input
                type="number"
                min={2}
                max={10}
                className="w-full bg-transparent text-[9px] font-semibold text-[var(--node-text-primary)] outline-none nodrag"
                value={currentDuration}
                onChange={(e) => {
                  const next = clampDuration(Number(e.target.value) || 5);
                  updateNodeData(id, { duration: `${next}s` });
                }}
                onMouseDown={(e) => e.stopPropagation()}
              />
            </div>
            <div className="node-control node-control--tight w-full px-2 text-[var(--node-text-secondary)] text-[9px] font-bold text-center uppercase tracking-wide truncate">
              total refs ≤ 5
            </div>
          </div>
        </div>

        <div className="node-panel space-y-2 p-3 nodrag">
          <label className="text-[8px] font-black uppercase tracking-widest text-[var(--node-text-secondary)] opacity-70">
            WAN 参数
          </label>
          <div className="flex items-center justify-between text-[9px] font-semibold text-[var(--node-text-secondary)]">
            <span>添加水印</span>
            <button
              className={`h-5 w-9 rounded-full border transition-all ${data.watermark ? "bg-emerald-500/20 border-emerald-400/40" : "bg-white/5 border-white/10"}`}
              onClick={() => updateNodeData(id, { watermark: !data.watermark })}
            >
              <span className={`block h-4 w-4 rounded-full bg-white/70 transition-all ${data.watermark ? "translate-x-4" : "translate-x-1"}`} />
            </button>
          </div>
          <div className="space-y-1">
            <label className="text-[8px] uppercase tracking-widest text-[var(--node-text-secondary)]">随机种子</label>
            <input
              type="number"
              min={0}
              className="node-control node-control--tight w-full text-[9px] font-semibold px-2 text-[var(--node-text-primary)] nodrag"
              value={data.seed ?? ""}
              onChange={(e) => {
                const next = e.target.value === "" ? undefined : Number(e.target.value);
                updateNodeData(id, { seed: Number.isFinite(next) ? next : undefined });
              }}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>
          {supportsAudioToggle && (
            <div className="flex items-center justify-between text-[9px] font-semibold text-[var(--node-text-secondary)]">
              <span>有声输出</span>
              <button
                className={`h-5 w-9 rounded-full border transition-all ${data.audioEnabled !== false ? "bg-emerald-500/20 border-emerald-400/40" : "bg-white/5 border-white/10"}`}
                onClick={() => updateNodeData(id, { audioEnabled: data.audioEnabled === false })}
              >
                <span className={`block h-4 w-4 rounded-full bg-white/70 transition-all ${data.audioEnabled !== false ? "translate-x-4" : "translate-x-1"}`} />
              </button>
            </div>
          )}
        </div>

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
