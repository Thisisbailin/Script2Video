import React, { useState, useRef } from 'react';
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
    Activity
} from 'lucide-react';
import * as QwenAudio from '../services/qwenAudioService';

export const ProjectorModule: React.FC = () => {
    const [activePane, setActivePane] = useState<'visuals' | 'audio'>('audio');

    // --- Audio Lab State ---
    const [voicePrompt, setVoicePrompt] = useState('一位非常有威严的国王，声音低沉、宏亮，带着一丝岁月的沧桑感。');
    const [dubbingText, setDubbingText] = useState('既然如此，那就按照你的计划进行吧。但记住，这是最后的机会。');
    const [instruction, setInstruction] = useState('语气庄重、缓慢，每一个字都带着不容置疑的力量。');
    const [audioResult, setAudioResult] = useState<{ url: string, prompt: string, text: string, time: number } | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [history, setHistory] = useState<Array<{ url: string, prompt: string, text: string, time: number }>>([]);

    const audioRef = useRef<HTMLAudioElement>(null);

    const handleGenerate = async () => {
        if (!dubbingText.trim()) return;
        setIsGenerating(true);
        try {
            const result = await QwenAudio.generateSpeech(dubbingText, {
                voicePrompt: voicePrompt || undefined,
                instruction: instruction || undefined,
            });

            const newEntry = {
                url: result.audioUrl,
                prompt: voicePrompt,
                text: dubbingText,
                time: Date.now()
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
        <div className="flex h-[720px] bg-[var(--app-bg)] overflow-hidden">
            {/* SIDEBAR NAVIGATION */}
            <div className="w-16 border-r border-[var(--app-border)] flex flex-col items-center py-6 gap-6 bg-[var(--app-panel-muted)]">
                <button
                    onClick={() => setActivePane('visuals')}
                    className={`h-10 w-10 flex items-center justify-center rounded-xl transition-all ${activePane === 'visuals' ? 'bg-[var(--app-accent)] text-white shadow-lg shadow-[var(--app-accent-soft)]' : 'text-[var(--app-text-secondary)] hover:bg-[var(--app-panel-soft)]'}`}
                    title="画面放映"
                >
                    <MonitorPlay size={20} />
                </button>
                <button
                    onClick={() => setActivePane('audio')}
                    className={`h-10 w-10 flex items-center justify-center rounded-xl transition-all ${activePane === 'audio' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'text-[var(--app-text-secondary)] hover:bg-[var(--app-panel-soft)]'}`}
                    title="声音实验室"
                >
                    <AudioLines size={20} />
                </button>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex overflow-hidden">

                {/* LEFT PANE: VISUALS (PLACEHOLDER) */}
                {activePane === 'visuals' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
                        <div className="h-24 w-24 rounded-3xl bg-[var(--app-panel-muted)] border border-dashed border-[var(--app-border-strong)] flex items-center justify-center text-[var(--app-text-muted)]">
                            <MonitorPlay size={40} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">画面放映空间</h3>
                            <p className="text-sm text-[var(--app-text-secondary)] max-w-xs">画面模块目前正在全力开发中，未来将与声音模块联动，打造极致视听剪辑体验。</p>
                        </div>
                    </div>
                )}

                {/* RIGHT PANE: AUDIO LAB (ACTIVE) */}
                {activePane === 'audio' && (
                    <div className="flex-1 flex overflow-hidden">
                        {/* LAB EDITOR */}
                        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8 custom-scrollbar">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold flex items-center gap-3">
                                        <Sparkles className="text-rose-400" size={24} />
                                        音色与配音实验室
                                    </h2>
                                    <p className="text-xs text-[var(--app-text-muted)] mt-1 uppercase tracking-widest font-mono">Qwen3-TTS Powering Creative Audio</p>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-bold text-rose-300">
                                    <Wand2 size={12} />
                                    SMART PERSONA DESIGN
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                {/* VOICE DESIGN SECTION */}
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black uppercase tracking-widest text-[var(--app-text-muted)] flex items-center gap-2">
                                        <Settings2 size={14} className="text-rose-400" />
                                        音色设计 (Voice Design Prompt)
                                    </label>
                                    <textarea
                                        value={voicePrompt}
                                        onChange={(e) => setVoicePrompt(e.target.value)}
                                        placeholder="描述你想要创造的角色音色，例如：'一位温婉的年轻女性，声音清脆，说话带着柔和的古风韵味'..."
                                        className="w-full h-24 bg-[var(--app-panel-muted)] border border-[var(--app-border)] rounded-2xl p-4 text-sm focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 outline-none transition-all resize-none leading-relaxed"
                                    />
                                    <p className="text-[10px] text-[var(--app-text-muted)]">模型将根据该描述实时演化出专属的声码特征。</p>
                                </div>

                                {/* DUBBING TEXT SECTION */}
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black uppercase tracking-widest text-[var(--app-text-muted)] flex items-center gap-2">
                                        <Mic size={14} className="text-rose-400" />
                                        配音台词 (Dialogue Text)
                                    </label>
                                    <textarea
                                        value={dubbingText}
                                        onChange={(e) => setDubbingText(e.target.value)}
                                        placeholder="请输入需要朗读的台词内容..."
                                        className="w-full h-32 bg-[var(--app-panel-muted)] border border-[var(--app-border)] rounded-2xl p-4 text-sm focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 outline-none transition-all resize-none leading-relaxed font-serif text-lg"
                                    />
                                </div>

                                {/* ATMOSPHERE INSTRUCTION SECTION */}
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black uppercase tracking-widest text-[var(--app-text-muted)] flex items-center gap-2">
                                        <Activity size={14} className="text-rose-400" />
                                        配音情感/表演指示 (Atmosphere Instruction)
                                    </label>
                                    <input
                                        value={instruction}
                                        onChange={(e) => setInstruction(e.target.value)}
                                        placeholder="例如：'语气低沉，充满绝望感' 或 '兴奋地欢呼，语速加快'..."
                                        className="w-full bg-[var(--app-panel-muted)] border border-[var(--app-border)] rounded-2xl px-4 py-3 text-sm focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 outline-none transition-all"
                                    />
                                </div>

                                {/* GENERATE BUTTON */}
                                <div className="pt-2">
                                    <button
                                        onClick={handleGenerate}
                                        disabled={isGenerating || !dubbingText.trim()}
                                        className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all ${isGenerating ? 'bg-rose-500/20 text-rose-300 cursor-not-allowed' : 'bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:scale-[1.01] hover:shadow-xl hover:shadow-rose-500/20 active:scale-95'}`}
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Loader2 size={20} className="animate-spin" />
                                                正在演化声码与情感...
                                            </>
                                        ) : (
                                            <>
                                                <Play size={20} fill="currentColor" />
                                                生成角色配音
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* PREVIEW & HISTORY PANEL */}
                        <div className="w-80 border-l border-[var(--app-border)] bg-[var(--app-panel-muted)]/50 flex flex-col">

                            {/* LIVE PREVIEW */}
                            <div className="p-6 border-b border-[var(--app-border)]">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--app-text-muted)] mb-6 flex items-center justify-between">
                                    Live Preview
                                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                                </h4>

                                {audioResult ? (
                                    <div className="space-y-4">
                                        <div className="h-32 rounded-2xl bg-[var(--app-panel-strong)] flex flex-col items-center justify-center border border-[var(--app-border-strong)] relative overflow-hidden group">
                                            <div className="absolute inset-x-0 bottom-0 h-1 bg-rose-500/20" />
                                            <div className="z-10 h-12 w-12 rounded-full bg-rose-500 flex items-center justify-center text-white cursor-pointer hover:scale-110 active:scale-95 transition-all shadow-lg" onClick={() => audioRef.current?.play()}>
                                                <Volume2 size={24} />
                                            </div>
                                            <audio ref={audioRef} src={audioResult.url} autoPlay />
                                            <span className="mt-3 text-[10px] text-[var(--app-text-muted)] font-mono">Audio Generated Successfully</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <a
                                                href={audioResult.url}
                                                download
                                                target="_blank"
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] text-[11px] font-bold hover:bg-[var(--app-panel-soft)] transition-all"
                                            >
                                                <Download size={14} /> Download
                                            </a>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-32 rounded-2xl border border-dashed border-[var(--app-border-strong)] flex flex-col items-center justify-center text-[var(--app-text-muted)] italic text-xs">
                                        等待生成音频...
                                    </div>
                                )}
                            </div>

                            {/* HISTORY LIST */}
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="px-6 py-4 flex items-center justify-between border-b border-[var(--app-border)]">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--app-text-muted)] flex items-center gap-2">
                                        <History size={12} /> 历史演化
                                    </h4>
                                    <button
                                        onClick={clearHistory}
                                        className="text-[10px] text-rose-400 hover:underline"
                                    >
                                        清空历史
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar space-y-2">
                                    {history.length === 0 ? (
                                        <div className="py-12 text-center text-[var(--app-text-muted)] text-[10px] italic">暂无历史记录</div>
                                    ) : (
                                        history.map((item, idx) => (
                                            <button
                                                key={`${item.time}-${idx}`}
                                                onClick={() => {
                                                    setAudioResult(item);
                                                    audioRef.current?.play();
                                                }}
                                                className={`w-full text-left p-3 rounded-xl border transition-all group ${audioResult?.time === item.time ? 'border-rose-500/50 bg-rose-500/5 shadow-sm' : 'border-[var(--app-border)] hover:border-[var(--app-border-strong)] bg-[var(--app-panel-muted)]'}`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="text-[10px] font-bold text-[var(--app-text-muted)] uppercase">{new Date(item.time).toLocaleTimeString()}</div>
                                                    <ChevronRight size={10} className="text-[var(--app-text-muted)] opacity-0 group-hover:opacity-100" />
                                                </div>
                                                <div className="text-[11px] text-[var(--app-text-primary)] line-clamp-1 font-serif">"{item.text}"</div>
                                                <div className="mt-1 text-[9px] text-[var(--app-text-muted)] line-clamp-1">{item.prompt}</div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
