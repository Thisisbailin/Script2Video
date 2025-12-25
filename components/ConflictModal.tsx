import React, { useMemo, useState } from "react";
import { Cloud, HardDrive, AlertTriangle } from "lucide-react";
import { ProjectData } from "../types";

type Props = {
  isOpen: boolean;
  remoteData: ProjectData;
  localData: ProjectData;
  onUseRemote?: () => void;
  onKeepLocal?: () => void;
  onAcknowledge?: () => void;
  mode?: "decision" | "notice";
};

const summarize = (data: ProjectData) => {
  const episodes = data.episodes.length;
  const shots = data.episodes.reduce((acc, ep) => acc + ep.shots.length, 0);
  const scriptChars = data.rawScript?.length || 0;
  return { episodes, shots, scriptChars };
};

const buildDiffs = (remoteData: ProjectData, localData: ProjectData) => {
  const diffs: string[] = [];
  const remoteSummary = summarize(remoteData);
  const localSummary = summarize(localData);

  if (remoteSummary.episodes !== localSummary.episodes) {
    diffs.push(`集数：云端 ${remoteSummary.episodes} / 本地 ${localSummary.episodes}`);
  }
  if (remoteSummary.shots !== localSummary.shots) {
    diffs.push(`镜头数：云端 ${remoteSummary.shots} / 本地 ${localSummary.shots}`);
  }
  if (remoteSummary.scriptChars !== localSummary.scriptChars) {
    diffs.push(`脚本文本：云端 ${remoteSummary.scriptChars} / 本地 ${localSummary.scriptChars} 字符`);
  }

  const remoteById = new Map(remoteData.episodes.map((ep) => [ep.id, ep]));
  const localById = new Map(localData.episodes.map((ep) => [ep.id, ep]));
  const onlyRemote = remoteData.episodes.filter((ep) => !localById.has(ep.id));
  const onlyLocal = localData.episodes.filter((ep) => !remoteById.has(ep.id));

  if (onlyRemote.length > 0) {
    const names = onlyRemote.slice(0, 3).map((ep) => ep.title).join("、");
    diffs.push(`仅云端：${names}${onlyRemote.length > 3 ? " 等" : ""}`);
  }
  if (onlyLocal.length > 0) {
    const names = onlyLocal.slice(0, 3).map((ep) => ep.title).join("、");
    diffs.push(`仅本地：${names}${onlyLocal.length > 3 ? " 等" : ""}`);
  }

  const sharedIds = remoteData.episodes
    .map((ep) => ep.id)
    .filter((id) => localById.has(id));
  const perEpisodeDiffs: string[] = [];
  sharedIds.forEach((id) => {
    const remoteEp = remoteById.get(id)!;
    const localEp = localById.get(id)!;
    if (remoteEp.shots.length !== localEp.shots.length) {
      perEpisodeDiffs.push(`第${id}集镜头：云端 ${remoteEp.shots.length} / 本地 ${localEp.shots.length}`);
    }
  });
  diffs.push(...perEpisodeDiffs.slice(0, 5));
  if (perEpisodeDiffs.length > 5) {
    diffs.push(`还有 ${perEpisodeDiffs.length - 5} 条镜头差异未显示`);
  }

  return diffs;
};

export const ConflictModal: React.FC<Props> = ({ isOpen, remoteData, localData, onUseRemote, onKeepLocal, onAcknowledge, mode = "decision" }) => {
  const [showDiffs, setShowDiffs] = useState(false);
  const remote = useMemo(() => summarize(remoteData), [remoteData]);
  const local = useMemo(() => summarize(localData), [localData]);
  const diffItems = useMemo(() => buildDiffs(remoteData, localData), [remoteData, localData]);
  if (!isOpen) return null;
  const isNotice = mode === "notice";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-[520px] max-w-[92vw] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-[var(--shadow-strong)] p-6 text-[var(--text-primary)]">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-300">
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="text-lg font-semibold">{isNotice ? "检测到冲突并已自动合并" : "检测到云端冲突"}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              {isNotice ? "系统已自动合并并保留文本双份，请稍后检查内容。" : "云端与本地均有改动，请选择保留哪一份数据。"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)]/70 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold mb-3">
              <Cloud size={16} /> 云端版本
            </div>
            <div className="text-xs text-[var(--text-secondary)] space-y-1">
              <div>集数：{remote.episodes}</div>
              <div>镜头数：{remote.shots}</div>
              <div>脚本文本：{remote.scriptChars} 字符</div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)]/70 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold mb-3">
              <HardDrive size={16} /> 本地版本
            </div>
            <div className="text-xs text-[var(--text-secondary)] space-y-1">
              <div>集数：{local.episodes}</div>
              <div>镜头数：{local.shots}</div>
              <div>脚本文本：{local.scriptChars} 字符</div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <button
            onClick={() => setShowDiffs((v) => !v)}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          >
            {showDiffs ? "隐藏差异" : "查看差异"}
          </button>
          {showDiffs && (
            <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)]/60 p-3 text-xs text-[var(--text-secondary)] space-y-1">
              {diffItems.length === 0 && <div>未检测到结构性差异。</div>}
              {diffItems.map((item, idx) => (
                <div key={`${item}-${idx}`}>{item}</div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-6">
          {isNotice ? (
            <button
              onClick={onAcknowledge}
              className="px-4 py-2 rounded-lg text-sm bg-[var(--accent-blue)] text-white hover:bg-sky-500 transition"
            >
              知道了
            </button>
          ) : (
            <>
              <button
                onClick={onKeepLocal}
                className="px-4 py-2 rounded-lg text-sm border border-[var(--border-subtle)] hover:border-sky-400 hover:text-sky-200 transition"
              >
                保留本地
              </button>
              <button
                onClick={onUseRemote}
                className="px-4 py-2 rounded-lg text-sm bg-[var(--accent-blue)] text-white hover:bg-sky-500 transition"
              >
                使用云端
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
