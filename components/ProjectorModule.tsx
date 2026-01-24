import React, { useState, useRef, useMemo } from 'react';
import {
    MonitorPlay,
    AudioLines,
    Sparkles,
    Wand2,
    Play,
    Volume2,
    Settings2,
    Mic,
    History,
    Download,
    Loader2,
    Trash2,
    ChevronRight,
    Activity,
    UserCircle,
    Music,
    FastForward,
    Settings,
    Layers,
    Save,
    RotateCcw
} from 'lucide-react';
import * as QwenAudio from '../services/qwenAudioService';

type LabStage = 'design' | 'dubbing';

export const ProjectorModule: React.FC = () => {
    const [activeType, setActiveType] = useState<'visuals' | 'audio'>('audio');
    const [stage, setStage] = useState<LabStage>('design');

    // --- Persona Design State (Stage 1) ---
    const [designPrompt, setDesignPrompt] = useState('一位深沉、睿智的老者，声音里带着故事感，语速适中且平稳。');
    const [previewText, setPreviewText] = useState('在这个充满奇迹的世界里，每一个决定都将改写未来的篇章。');
    const [designRate, setDesignRate] = useState(1.0);
    const [designVolume, setDesignVolume] = useState(50);
    const [designPitch, setDesignPitch] = useState(1.0);

    // --- Character Dubbing State (Stage 2) ---
    const [dubbingText, setDubbingText] = useState('既然如此，那就按照你的计划进行吧。但记住，这是最后的机会。');
    const [atmosphere, setAtmosphere] = useState('语气庄重、缓慢，每一个字都带着不容置疑的力量。');
    const [dubbingRate, setDubbingRate] = useState(1.0);
    const [dubbingVolume, setDubbingVolume] = useState(50);

    // --- Common Logic ---
    const [isGenerating, setIsGenerating] = useState(false);
    const [audioResult, setAudioResult] = useState<{ url: string; prompt: string; text: string; time: number; type: LabStage } | null>(null);
    const [history, setHistory] = useState<Array<{ url: string; prompt: string; text: string; time: number; type: LabStage }>>([]);

    const audioRef = useRef<HTMLAudioElement>(null);

    const handleGenerate = async () => {
        const currentText = stage === 'design' ? previewText : dubbingText;
        if (!currentText.trim()) return;

        setIsGenerating(true);
        try {
            const result = await QwenAudio.generateSpeech(currentText, {
                voicePrompt: designPrompt || undefined,
                instruction: stage === 'dubbing' ? atmosphere : undefined,
                speechRate: stage === 'design' ? designRate : dubbingRate,
                volume: stage === 'design' ? designVolume : dubbingVolume,
                pitch: stage === 'design' ? designPitch : 1.0
            });

            const newEntry = {
                url: result.audioUrl,
                prompt: designPrompt,
                text: currentText,
                time: Date.now(),
                type: stage
            };

            setAudioResult(newEntry);
            setHistory(prev => [newEntry, ...prev]);
        } catch (e: any) {
            alert(`生成失败: ${e.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const clearHistory = () => {
        if (window.confirm("确定要清空历史记录吗？")) {
            setHistory([]);
            setAudioResult(null);
        }
    };

    return (
        <div className="flex bg-[var(--app-bg)] h-[750px] overflow-hidden">
            {/* SIDEBAR (Agent Settings Style) */}
            <div className="w-[260px] border-r border-[var(--app-border)] bg-[var(--app-panel-muted)] flex flex-col p-4 space-y-4">
                <div className="space-y-3">
                    <div className="text-[11px] uppercase tracking-widest text-[var(--app-text-muted)] px-1">Navigation</div>
                    <div className="flex flex-col gap-2">
                        {[
                            { key: 'audio' as const, label: 'Voice Lab', Icon: AudioLines, active: activeType === 'audio' },
                            { key: 'visuals' as const, label: 'Visuals', Icon: MonitorPlay, active: activeType === 'visuals' },
                        ].map(({ key, label, Icon, active }) => (
                            <button
                                key={key}
                                onClick={() => setActiveType(key)}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] border transition ${active
                                    ? "bg-[var(--app-panel-soft)] border-[var(--app-border-strong)] text-[var(--app-text-primary)]"
                                    : "border-transparent text-[var(--app-text-secondary)] hover:bg-[var(--app-panel-soft)]"
                                    }`}
                            >
                                <Icon size={16} className={active ? "text-[var(--app-text-primary)]" : "text-[var(--app-text-muted)]"} />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {activeType === 'audio' && (
                    <div className="space-y-3 pt-2">
                        <div className="text-[11px] uppercase tracking-widest text-[var(--app-text-muted)] px-1">Lab Stages</div>
                        <div className="flex flex-col gap-2">
                            {[
                                { key: 'design' as const, label: '1. 音色设计', desc: 'Craft unique persona' },
                                { key: 'dubbing' as const, label: '2. 精细配音', desc: 'Emotional delivery' },
                            ].map(({ key, label, desc }) => (
                                <button
                                    key={key}
                                    onClick={() => setStage(key)}
                                    className={`flex flex-col gap-0.5 px-4 py-3 rounded-xl border transition text-left ${stage === key
                                        ? "bg-[var(--app-panel-soft)] border-[var(--app-border-strong)]"
                                        : "border-transparent hover:bg-[var(--app-panel-soft)]"
                                        }`}
                                >
                                    <div className={`text-[12px] font-bold ${stage === key ? "text-[var(--app-text-primary)]" : "text-[var(--app-text-secondary)]"}`}>{label}</div>
                                    <div className="text-[10px] text-[var(--app-text-muted)]">{desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mt-auto pt-4 border-t border-[var(--app-border)]">
                    <div className="text-[10px] text-[var(--app-text-muted)] px-1 leading-relaxed">
                        Qwen3-TTS-VD Powering<br />
                        Next-gen expressive audio.
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col min-w-0 bg-[var(--app-bg)] relative overflow-hidden">
                {activeType === 'visuals' ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <div className="h-20 w-20 rounded-2xl bg-[var(--app-panel-muted)] border border-dashed border-[var(--app-border-strong)] flex items-center justify-center text-[var(--app-text-muted)] mb-4">
                            <MonitorPlay size={32} />
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--app-text-primary)]">画面放映空间</h3>
                        <p className="text-sm text-[var(--app-text-secondary)] max-w-sm mt-2 leading-relaxed italic">
                            此处将用于预览生成的视频剪辑。目前功能正在整合中，后续将实现音画精准对位放映。
                        </p>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Header Area */}
                        <div className="px-8 py-6 border-b border-[var(--app-border)] flex items-center justify-between bg-[var(--app-panel-muted)]/30">
                            <div>
                                <h2 className="text-lg font-bold flex items-center gap-3">
                                    <Sparkles className="text-violet-400" size={20} />
                                    {stage === 'design' ? 'Persona Design Lab (音色实验室)' : 'Expressive Dubbing (角色配音室)'}
                                </h2>
                                <p className="text-[11px] text-[var(--app-text-muted)] mt-1 tracking-wide">
                                    {stage === 'design' ? '通过自然语言描述，创造剧本中独一无二的音色纹理。' : '基于设计好的音色，注入情节氛围完成角色对白。'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 flex items-center gap-1.5">
                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    MODEL: QWEN3-TTS-VD
                                </span>
                            </div>
                        </div>

                        {/* Editor Content */}
                        <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">
                            <div className="max-w-3xl mx-auto space-y-10 pb-20">

                                {stage === 'design' ? (
                                    <>
                                        {/* STAGE 1: DESIGN */}
                                        <section className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-[var(--app-text-muted)] flex items-center gap-2">
                                                    <UserCircle size={14} className="text-violet-400" />
                                                    Persona Description (音色定形描述)
                                                </label>
                                                <button className="text-[10px] px-2 py-1 rounded-md border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:border-violet-400/50 transition">
                                                    Load Template
                                                </button>
                                            </div>
                                            <textarea
                                                value={designPrompt}
                                                onChange={(e) => setDesignPrompt(e.target.value)}
                                                className="w-full h-28 bg-[var(--app-panel-muted)] border border-[var(--app-border)] rounded-2xl p-4 text-[14px] text-[var(--app-text-primary)] focus:border-violet-500/50 outline-none transition-all resize-none shadow-inner"
                                                placeholder="例如：'一位优雅的王后，声线清冷且高贵，透着淡淡的哀愁...'"
                                            />
                                            <p className="text-[10px] text-[var(--app-text-muted)] italic">提示：通过性别、年龄、特征、情感倾向来精细化描述。</p>
                                        </section>

                                        <section className="space-y-4">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-[var(--app-text-muted)] flex items-center gap-2">
                                                <Music size={14} className="text-violet-400" />
                                                Tone Tuning (细致化声学参数)
                                            </label>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 rounded-3xl border border-[var(--app-border)] bg-[var(--app-panel-muted)]/40 shadow-sm">
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] text-[var(--app-text-secondary)]">Speed (语速)</span>
                                                        <span className="text-[11px] font-mono text-violet-400">{designRate.toFixed(1)}x</span>
                                                    </div>
                                                    <input type="range" min="0.5" max="2.0" step="0.1" value={designRate} onChange={(e) => setDesignRate(parseFloat(e.target.value))} className="w-full h-1.5 bg-[var(--app-border)] rounded-lg appearance-none cursor-pointer accent-violet-500" />
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] text-[var(--app-text-secondary)]">Pitch (音调)</span>
                                                        <span className="text-[11px] font-mono text-violet-400">{designPitch.toFixed(1)}x</span>
                                                    </div>
                                                    <input type="range" min="0.5" max="2.0" step="0.1" value={designPitch} onChange={(e) => setDesignPitch(parseFloat(e.target.value))} className="w-full h-1.5 bg-[var(--app-border)] rounded-lg appearance-none cursor-pointer accent-violet-500" />
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] text-[var(--app-text-secondary)]">Volume (音量)</span>
                                                        <span className="text-[11px] font-mono text-violet-400">{designVolume}%</span>
                                                    </div>
                                                    <input type="range" min="0" max="100" step="1" value={designVolume} onChange={(e) => setDesignVolume(parseInt(e.target.value))} className="w-full h-1.5 bg-[var(--app-border)] rounded-lg appearance-none cursor-pointer accent-violet-500" />
                                                </div>
                                            </div>
                                        </section>

                                        <section className="space-y-4">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-[var(--app-text-muted)] flex items-center gap-2">
                                                <Layers size={14} className="text-violet-400" />
                                                Validation Text (测试演化文本)
                                            </label>
                                            <input
                                                value={previewText}
                                                onChange={(e) => setPreviewText(e.target.value)}
                                                className="w-full bg-[var(--app-panel-muted)] border border-[var(--app-border)] rounded-2xl px-5 py-4 text-[14px] text-[var(--app-text-primary)] focus:border-violet-500/50 outline-none transition-all"
                                            />
                                        </section>
                                    </>
                                ) : (
                                    <>
                                        {/* STAGE 2: DUBBING */}
                                        <div className="p-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 mb-8">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-400 shadow-lg">
                                                    <Mic size={20} />
                                                </div>
                                                <div>
                                                    <div className="text-[12px] font-bold text-[var(--app-text-primary)]">音色已锁定</div>
                                                    <div className="text-[10px] text-[var(--app-text-muted)] truncate max-w-[400px]">{designPrompt}</div>
                                                </div>
                                                <button onClick={() => setStage('design')} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-500/30 text-[10px] font-bold text-violet-400 hover:bg-violet-500/10 transition">
                                                    <RotateCcw size={12} />
                                                    去重新设计
                                                </button>
                                            </div>
                                        </div>

                                        <section className="space-y-4">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-[var(--app-text-muted)] flex items-center gap-2">
                                                <Mic size={14} className="text-violet-400" />
                                                Dialogue Line (待配音对白)
                                            </label>
                                            <textarea
                                                value={dubbingText}
                                                onChange={(e) => setDubbingText(e.target.value)}
                                                className="w-full h-40 bg-[var(--app-panel-muted)] border border-[var(--app-border)] rounded-3xl p-6 text-[18px] font-serif leading-relaxed text-[var(--app-text-primary)] focus:border-violet-500/50 outline-none transition-all resize-none shadow-sm"
                                                placeholder="请输入剧本对白..."
                                            />
                                        </section>

                                        <section className="space-y-4">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-[var(--app-text-muted)] flex items-center gap-2">
                                                <Activity size={14} className="text-violet-400" />
                                                Atmosphere Instruction (表演/情绪指示)
                                            </label>
                                            <input
                                                value={atmosphere}
                                                onChange={(e) => setAtmosphere(e.target.value)}
                                                placeholder="例如：'激动万分，语速逐渐加快，最后略带哽咽'..."
                                                className="w-full bg-[var(--app-panel-muted)] border border-[var(--app-border)] rounded-2xl px-5 py-4 text-[14px] text-[var(--app-text-primary)] focus:border-violet-500/50 outline-none transition-all shadow-sm"
                                            />
                                        </section>

                                        <section className="space-y-4">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-[var(--app-text-muted)] flex items-center gap-2">
                                                <Settings size={14} className="text-violet-400" />
                                                Acoustic Fine Tuning (精细声学调节)
                                            </label>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 rounded-3xl border border-[var(--app-border)] bg-[var(--app-panel-muted)]/40 shadow-sm">
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] text-[var(--app-text-secondary)]">Speed (语速)</span>
                                                        <span className="text-[11px] font-mono text-violet-400">{dubbingRate.toFixed(1)}x</span>
                                                    </div>
                                                    <input type="range" min="0.5" max="2.0" step="0.1" value={dubbingRate} onChange={(e) => setDubbingRate(parseFloat(e.target.value))} className="w-full h-1.5 bg-[var(--app-border)] rounded-lg appearance-none cursor-pointer accent-violet-500" />
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] text-[var(--app-text-secondary)]">Pitch (音调)</span>
                                                        <span className="text-[11px] font-mono text-violet-400">{designPitch.toFixed(1)}x</span>
                                                    </div>
                                                    <input type="range" min="0.5" max="2.0" step="0.1" value={designPitch} onChange={(e) => setDesignPitch(parseFloat(e.target.value))} className="w-full h-1.5 bg-[var(--app-border)] rounded-lg appearance-none cursor-pointer accent-violet-500" />
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] text-[var(--app-text-secondary)]">Volume (音量)</span>
                                                        <span className="text-[11px] font-mono text-violet-400">{dubbingVolume}%</span>
                                                    </div>
                                                    <input type="range" min="0" max="100" step="1" value={dubbingVolume} onChange={(e) => setDubbingVolume(parseInt(e.target.value))} className="w-full h-1.5 bg-[var(--app-border)] rounded-lg appearance-none cursor-pointer accent-violet-500" />
                                                </div>
                                            </div>
                                        </section>
                                    </>
                                )}

                                <div className="pt-6">
                                    <button
                                        onClick={handleGenerate}
                                        disabled={isGenerating}
                                        className={`w-full py-5 rounded-fill rounded-[40px] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all text-sm shadow-2xl ${isGenerating
                                            ? 'bg-[var(--app-panel-soft)] text-[var(--app-text-muted)] cursor-not-allowed border border-[var(--app-border)]'
                                            : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:scale-[1.01] hover:shadow-violet-500/20 active:scale-95 border border-white/10'
                                            }`}
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin" />
                                                正在演化声波与情感...
                                            </>
                                        ) : (
                                            <>
                                                <Play size={18} fill="currentColor" />
                                                {stage === 'design' ? '演化音色并试听' : '完成精准对白配音'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* PREVIEW & HISTORY PANEL (Right Sidebar) */}
            <div className="w-[340px] border-l border-[var(--app-border)] bg-[var(--app-panel-muted)]/50 flex flex-col overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-[var(--app-border)] bg-[var(--app-panel-muted)]">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--app-text-muted)] mb-8 flex items-center justify-between">
                        Real-time Monitoring
                        <span className={`h-2 w-2 rounded-full ${isGenerating ? 'bg-violet-500 animate-ping' : 'bg-green-500'}`} />
                    </h4>

                    {audioResult ? (
                        <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
                            <div className="rounded-[32px] bg-[var(--app-panel-strong)] p-6 flex flex-col items-center justify-center border border-[var(--app-border-strong)] shadow-xl relative group">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.1)_0%,transparent_70%)]" />
                                <div className="z-10 h-16 w-16 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-white cursor-pointer hover:scale-110 active:scale-95 transition-all shadow-[0_10px_30px_-10px_rgba(139,92,246,0.5)] group-hover:rotate-12"
                                    onClick={() => audioRef.current?.play()}>
                                    <Volume2 size={32} />
                                </div>
                                <audio ref={audioRef} src={audioResult.url} autoPlay />
                                <div className="mt-4 text-center">
                                    <div className="text-[11px] font-bold text-[var(--app-text-primary)] uppercase tracking-wider">Evolution Successful</div>
                                    <div className="text-[9px] text-[var(--app-text-muted)] font-mono mt-1 opacity-70">
                                        {audioResult.type === 'design' ? 'Persona Tuning Output' : 'Dubbing Synthesis Output'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <a
                                    href={audioResult.url}
                                    download
                                    target="_blank"
                                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[11px] font-bold text-[var(--app-text-primary)] hover:border-[var(--app-border-strong)] transition-all shadow-sm"
                                >
                                    <Download size={14} className="text-violet-400" /> Export Audio
                                </a>
                                <button className="p-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all text-emerald-400 shadow-sm" title="Save Persona">
                                    <Save size={16} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-44 rounded-[32px] border border-dashed border-[var(--app-border-strong)] flex flex-col items-center justify-center text-[var(--app-text-muted)] p-8 text-center bg-black/10 shadow-inner">
                            <Activity className="opacity-20 mb-4" size={32} />
                            <div className="text-[12px] font-medium opacity-50">等待声码演化...</div>
                            <div className="text-[10px] opacity-30 mt-2">一旦生成，可在右侧侧边栏进行试听与管理。</div>
                        </div>
                    )}
                </div>

                {/* Evolution History */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 py-4 flex items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-panel-muted)]/80">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--app-text-muted)] flex items-center gap-2">
                            <History size={12} className="text-violet-400" /> 演化历史 (History)
                        </h4>
                        <button
                            onClick={clearHistory}
                            className="h-7 w-7 rounded-lg flex items-center justify-center border border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Clear All"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar space-y-3">
                        {history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 opacity-20">
                                <FastForward size={32} />
                                <span className="text-[10px] mt-2 font-mono">NO RECORDS</span>
                            </div>
                        ) : (
                            history.map((item, idx) => (
                                <button
                                    key={`${item.time}-${idx}`}
                                    onClick={() => {
                                        setAudioResult(item);
                                        audioRef.current?.play();
                                    }}
                                    className={`w-full text-left p-4 rounded-2xl border transition-all relative group overflow-hidden ${audioResult?.time === item.time ? 'border-violet-500/50 bg-violet-500/5 shadow-md ring-1 ring-violet-500/20' : 'border-transparent hover:border-[var(--app-border-strong)] bg-[var(--app-panel-muted)]'}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`h-1.5 w-1.5 rounded-full ${item.type === 'design' ? 'bg-violet-400' : 'bg-fuchsia-400'}`} />
                                            <div className="text-[9px] font-black text-[var(--app-text-muted)] uppercase tracking-tighter">
                                                {item.type === 'design' ? 'Designer' : 'Dubber'} • {new Date(item.time).toLocaleTimeString()}
                                            </div>
                                        </div>
                                        <ChevronRight size={12} className="text-[var(--app-text-muted)] opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0" />
                                    </div>
                                    <div className="text-[12px] text-[var(--app-text-primary)] line-clamp-1 font-serif pr-4 italic">"{item.text}"</div>
                                    <div className="mt-2 text-[9px] text-[var(--app-text-muted)] line-clamp-1 opacity-60 flex items-center gap-1">
                                        <Settings2 size={8} /> {item.prompt}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
