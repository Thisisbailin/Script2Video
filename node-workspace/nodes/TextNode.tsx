import React, { useRef, useLayoutEffect, useState, useEffect, useMemo } from "react";
import { BaseNode } from "./BaseNode";
import { TextNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";
import { Plus, X, AtSign, Info } from "lucide-react";

type Props = {
    id: string;
    data: TextNodeData;
};

export const TextNode: React.FC<Props & { selected?: boolean }> = ({ data, id, selected }) => {
    const { updateNodeData, labContext } = useWorkflowStore();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isComposingRef = useRef(false);
    const [draftText, setDraftText] = useState(data.text || "");
    const [showMentionPicker, setShowMentionPicker] = useState(false);

    const forms = useMemo(() => {
        const chars = labContext?.context?.characters || [];
        return chars.flatMap((c) =>
            (c.forms || []).map((f) => ({
                name: f.formName,
                characterId: c.id,
                summary: (f as any).description || "",
                image: (f as any).image || (f as any).preview || undefined,
            }))
        );
    }, [labContext]);

    const parseMentions = (text: string) => {
        const matches = text.match(/@([\\w\\u4e00-\\u9fa5-]+)/g) || [];
        const names: string[] = [];
        matches.forEach((m) => {
            const name = m.slice(1);
            if (!names.includes(name)) names.push(name);
        });
        return names;
    };

    const computeMentionMeta = (text: string) => {
        const names = parseMentions(text);
        return names.map((n) => {
            const hit = forms.find((f) => f.name?.toLowerCase() === n.toLowerCase());
            return {
                name: n,
                status: hit ? "match" : "missing",
                characterId: hit?.characterId,
                formName: hit?.name,
                summary: hit?.summary,
                image: hit?.image,
            };
        });
    };

    const autoResize = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    };

    useLayoutEffect(() => {
        const id = window.requestAnimationFrame(autoResize);
        return () => window.cancelAnimationFrame(id);
    }, [draftText]);

    useEffect(() => {
        if (isComposingRef.current) return;
        setDraftText(data.text || "");
    }, [data.text]);

    const handleAddTag = () => {
        const currentTags = data.tags || [];
        updateNodeData(id, { tags: [...currentTags, "NEW TAG"] });
    };

    const handleUpdateTag = (index: number, value: string) => {
        const currentTags = [...(data.tags || [])];
        currentTags[index] = value;
        updateNodeData(id, { tags: currentTags });
    };

    const handleRemoveTag = (index: number) => {
        const currentTags = data.tags?.filter((_, i) => i !== index);
        updateNodeData(id, { tags: currentTags });
    };

    return (
        <BaseNode
            title={data.title || "Text"}
            onTitleChange={(title) => updateNodeData(id, { title })}
            inputs={["text"]} // Enabled input
            outputs={["text"]} // Enabled output
            selected={selected}
        >
            <div className="space-y-4 flex-1 flex flex-col">
                {/* Text Area - Auto Height */}
                <textarea
                    ref={textareaRef}
                    className="node-textarea w-full text-[13px] leading-relaxed p-4 outline-none resize-none transition-all placeholder:text-[var(--node-text-secondary)] min-h-[60px] font-medium"
                    value={draftText}
                    onChange={(e) => {
                        const value = e.target.value;
                        setDraftText(value);
                        if (!isComposingRef.current) {
                            const mentions = computeMentionMeta(value);
                            updateNodeData(id, { text: value, atMentions: mentions });
                        }
                    }}
                    onCompositionStart={() => {
                        isComposingRef.current = true;
                    }}
                    onCompositionEnd={(e) => {
                        isComposingRef.current = false;
                        const value = e.currentTarget.value;
                        setDraftText(value);
                        const mentions = computeMentionMeta(value);
                        updateNodeData(id, { text: value, atMentions: mentions });
                    }}
                    onBlur={() => {
                        if (!isComposingRef.current && draftText !== data.text) {
                            const mentions = computeMentionMeta(draftText);
                            updateNodeData(id, { text: draftText, atMentions: mentions });
                        }
                    }}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "@") {
                            setShowMentionPicker(true);
                        }
                    }}
                    onFocus={autoResize}
                    placeholder="Describe or input text here..."
                    style={{ height: 'auto' }}
                />

                {(data.atMentions?.length || 0) > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {data.atMentions?.map((m, idx) => (
                            <span
                                key={`${m.name}-${idx}`}
                                className={`px-2 py-1 text-[10px] rounded-full inline-flex items-center gap-1 ${m.status === 'match'
                                    ? 'bg-sky-500/20 text-sky-100 border border-sky-500/30'
                                    : 'bg-amber-500/15 text-amber-100 border border-amber-500/30'
                                    }`}
                                title={m.summary || (m.status === 'match' ? '匹配到角色形态' : '未找到对应形态')}
                            >
                                <AtSign size={10} />
                                {m.formName || m.name}
                                {m.status === 'missing' && <Info size={10} className="opacity-70" />}
                            </span>
                        ))}
                        </div>
                )}

                {showMentionPicker && forms.length > 0 && (
                    <div className="node-panel p-3 space-y-2 animate-in fade-in slide-in-from-top-1">
                        <div className="text-[10px] uppercase tracking-[0.2em] font-black text-[var(--node-text-secondary)] flex items-center gap-1">
                            <AtSign size={10} /> 插入角色形态引用
                        </div>
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                            {forms.map((f) => (
                                <button
                                    key={f.name}
                                    onClick={() => {
                                        const el = textareaRef.current;
                                        const cursor = el ? el.selectionStart || draftText.length : draftText.length;
                                        const before = draftText.slice(0, cursor);
                                        const after = draftText.slice(cursor);
                                        const insertion = `@${f.name} `;
                                        const next = `${before}${insertion}${after}`;
                                        setDraftText(next);
                                        const mentions = computeMentionMeta(next);
                                        updateNodeData(id, { text: next, atMentions: mentions });
                                        setShowMentionPicker(false);
                                        requestAnimationFrame(() => {
                                            if (el) {
                                                el.focus();
                                                const pos = cursor + insertion.length;
                                                el.setSelectionRange(pos, pos);
                                            }
                                        });
                                    }}
                                    className="node-control node-control--tight text-left text-[10px] font-semibold text-[var(--node-text-primary)] hover:border-[var(--node-accent)]/40"
                                >
                                    {f.name}
                                </button>
                            ))}
                        </div>
                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowMentionPicker(false)}
                                className="text-[10px] text-[var(--node-text-secondary)] hover:text-white"
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                )}

                {/* Tags Layout */}
                <div className="flex flex-wrap items-center gap-2 min-h-[24px]">
                    {/* Primary Category - Capsule Style */}
                    <div className="node-pill node-pill--accent inline-flex items-center px-3 py-1 shadow-sm transition-all duration-200">
                        <input
                            className="bg-transparent text-[9px] font-black uppercase tracking-[0.2em] text-[var(--node-accent)] outline-none border-none text-center appearance-none"
                            value={data.category || ""}
                            onChange={(e) => updateNodeData(id, { category: e.target.value as any })}
                            placeholder="CATEGORY"
                            style={{ width: Math.max(data.category?.length || 4, 4) + 'ch' }}
                        />
                    </div>

                    {/* Additional Tags - Capsule Style */}
                    {data.tags?.map((tag, idx) => (
                        <div
                            key={idx}
                            className="node-pill inline-flex items-center gap-1.5 px-3 py-1 hover:bg-white/10 transition-colors group/tag"
                        >
                            <input
                                className="bg-transparent text-[9px] font-bold uppercase tracking-widest text-[var(--node-text-secondary)] outline-none border-none appearance-none"
                                value={tag}
                                onChange={(e) => handleUpdateTag(idx, e.target.value)}
                                style={{ width: Math.max(tag.length, 4) + 'ch' }}
                            />
                            <button
                                onClick={() => handleRemoveTag(idx)}
                                className="opacity-0 group-hover/tag:opacity-100 transition-opacity text-[var(--node-text-secondary)] hover:text-red-500"
                            >
                                <X size={10} />
                            </button>
                        </div>
                    ))}

                    {/* Add Tag Button */}
                    <button
                        onClick={handleAddTag}
                        className="node-pill node-pill--dashed h-6 w-6 flex items-center justify-center text-[var(--node-text-secondary)] hover:border-[var(--node-accent)]/30 hover:text-[var(--node-accent)] transition-all active:scale-90"
                        title="Add Tag"
                    >
                        <Plus size={12} />
                    </button>
                </div>
            </div>
        </BaseNode>
    );
};
