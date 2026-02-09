import React, { useRef, useLayoutEffect, useState, useEffect, useMemo } from "react";
import { BaseNode } from "./BaseNode";
import { TextNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";
import { AtSign, Info } from "lucide-react";
import type { Character, CharacterForm, Location, LocationZone } from "../../types";

type Props = {
    id: string;
    data: TextNodeData;
};

type MentionKind = "form" | "zone" | "character" | "unknown";

type MentionTarget = {
    kind: Exclude<MentionKind, "unknown">;
    name: string;
    label: string;
    search: string;
    characterId?: string;
    characterName?: string;
    formName?: string;
    locationId?: string;
    locationName?: string;
    zoneId?: string;
    summary?: string;
    detail?: string;
};

const mentionPriority: Record<MentionKind, number> = {
    form: 0,
    character: 1,
    zone: 2,
    unknown: 3,
};

const toSearch = (value: string) => value.toLowerCase();

const buildFormDetail = (character: Character, form: CharacterForm) => {
    const lines = [
        character?.name ? `角色：${character.name}` : "",
        character?.role ? `身份：${character.role}` : "",
        form.episodeRange ? `区间：${form.episodeRange}` : "",
        form.identityOrState ? `状态：${form.identityOrState}` : "",
        form.visualTags ? `视觉：${form.visualTags}` : "",
        form.description ? form.description : "",
    ].filter(Boolean);
    return lines.join("\n");
};

const buildCharacterDetail = (character: Character) => {
    const lines = [
        character?.name ? `角色：${character.name}` : "",
        character?.role ? `身份：${character.role}` : "",
        character?.bio ? character.bio : "",
    ].filter(Boolean);
    return lines.join("\n");
};

const buildZoneDetail = (location: Location, zone: LocationZone) => {
    const kindLabel: Record<LocationZone["kind"], string> = {
        interior: "内景",
        exterior: "外景",
        transition: "过渡",
        unspecified: "未标注",
    };
    const lines = [
        location?.name ? `场景：${location.name}` : "",
        zone?.name ? `分区：${zone.name}` : "",
        zone?.kind ? `类型：${kindLabel[zone.kind] || zone.kind}` : "",
        zone?.episodeRange ? `区间：${zone.episodeRange}` : "",
        zone?.layoutNotes ? `布局：${zone.layoutNotes}` : "",
        zone?.keyProps ? `道具：${zone.keyProps}` : "",
        zone?.lightingWeather ? `光色：${zone.lightingWeather}` : "",
        zone?.materialPalette ? `材质：${zone.materialPalette}` : "",
    ].filter(Boolean);
    return lines.join("\n");
};

export const TextNode: React.FC<Props & { selected?: boolean }> = ({ data, id, selected }) => {
    const { updateNodeData, labContext } = useWorkflowStore();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isComposingRef = useRef(false);
    const [draftText, setDraftText] = useState(data.text || "");
    const [cursorPos, setCursorPos] = useState(0);

    const mentionTargets = useMemo(() => {
        const chars = labContext?.context?.characters || [];
        const locations = labContext?.context?.locations || [];

        const formTargets: MentionTarget[] = chars.flatMap((c) =>
            (c.forms || [])
                .filter((f) => !!f.formName)
                .map((f) => {
                    const label = c.name ? `${f.formName} · ${c.name}` : f.formName;
                    return {
                        kind: "form" as const,
                        name: f.formName,
                        label,
                        search: toSearch([f.formName, c.name, c.role, f.episodeRange, f.identityOrState, f.visualTags].filter(Boolean).join(" ")),
                        characterId: c.id,
                        characterName: c.name,
                        formName: f.formName,
                        summary: f.description,
                        detail: buildFormDetail(c, f),
                    };
                })
        );

        const characterTargets: MentionTarget[] = chars
            .filter((c) => !!c.name)
            .map((c) => ({
                kind: "character" as const,
                name: c.name,
                label: c.name,
                search: toSearch([c.name, c.role, c.bio, ...(c.tags || [])].filter(Boolean).join(" ")),
                characterId: c.id,
                characterName: c.name,
                summary: c.bio,
                detail: buildCharacterDetail(c),
            }));

        const zoneTargets: MentionTarget[] = locations.flatMap((loc) =>
            (loc.zones || [])
                .filter((z) => !!z.name)
                .map((z) => {
                    const label = loc.name ? `${z.name} · ${loc.name}` : z.name;
                    return {
                        kind: "zone" as const,
                        name: z.name,
                        label,
                        search: toSearch([z.name, loc.name, z.episodeRange, z.layoutNotes, z.keyProps, z.lightingWeather].filter(Boolean).join(" ")),
                        locationId: loc.id,
                        locationName: loc.name,
                        zoneId: z.id,
                        summary: z.layoutNotes || z.keyProps || z.lightingWeather || "",
                        detail: buildZoneDetail(loc, z),
                    };
                })
        );

        return {
            forms: formTargets,
            characters: characterTargets,
            zones: zoneTargets,
            all: [...formTargets, ...characterTargets, ...zoneTargets],
        };
    }, [labContext]);

    const mentionIndex = useMemo(() => {
        const map = new Map<string, MentionTarget[]>();
        mentionTargets.all.forEach((item) => {
            const key = toSearch(item.name);
            const list = map.get(key) || [];
            list.push(item);
            map.set(key, list);
        });
        return map;
    }, [mentionTargets]);

    const parseMentions = (text: string) => {
        const matches = text.match(/@([\w\u4e00-\u9fa5-]+)/g) || [];
        const names: string[] = [];
        matches.forEach((m) => {
            const name = m.slice(1);
            if (!names.includes(name)) names.push(name);
        });
        return names;
    };

    const resolveMention = (name: string) => {
        const list = mentionIndex.get(toSearch(name)) || [];
        if (!list.length) return null;
        return list.slice().sort((a, b) => mentionPriority[a.kind] - mentionPriority[b.kind])[0];
    };

    const computeMentionMeta = (text: string) => {
        const names = parseMentions(text);
        return names.map((n) => {
            const hit = resolveMention(n);
            return {
                name: n,
                status: hit ? "match" : "missing",
                kind: hit?.kind || "unknown",
                characterId: hit?.characterId,
                formName: hit?.formName,
                summary: hit?.summary,
                detail: hit?.detail,
                locationId: hit?.locationId,
                locationName: hit?.locationName,
                zoneId: hit?.zoneId,
            };
        });
    };

    const autoResize = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };

    const mentionState = useMemo(() => {
        const pos = Math.min(cursorPos, draftText.length);
        const textBefore = draftText.slice(0, pos);
        const match = textBefore.match(/@([\w\u4e00-\u9fa5-]*)$/);
        if (!match) return null;
        return {
            query: match[1] || "",
            start: textBefore.lastIndexOf("@"),
            end: pos,
        };
    }, [draftText, cursorPos]);

    const filteredMentions = useMemo(() => {
        if (!mentionState) {
            return mentionTargets;
        }
        const query = toSearch(mentionState.query.trim());
        if (!query) {
            return mentionTargets;
        }
        const filterList = (list: MentionTarget[]) => list.filter((item) => item.search.includes(query));
        return {
            forms: filterList(mentionTargets.forms),
            characters: filterList(mentionTargets.characters),
            zones: filterList(mentionTargets.zones),
            all: filterList(mentionTargets.all),
        };
    }, [mentionState, mentionTargets]);

    const showMentionPicker = !!mentionState;

    const insertMention = (target: MentionTarget) => {
        const el = textareaRef.current;
        const cursor = el?.selectionStart ?? draftText.length;
        const start = mentionState ? mentionState.start : cursor;
        const before = draftText.slice(0, start);
        const after = draftText.slice(cursor);
        const insertion = `@${target.name} `;
        const next = `${before}${insertion}${after}`;
        setDraftText(next);
        const mentions = computeMentionMeta(next);
        updateNodeData(id, { text: next, atMentions: mentions });
        requestAnimationFrame(() => {
            if (!el) return;
            const nextPos = start + insertion.length;
            el.focus();
            el.setSelectionRange(nextPos, nextPos);
            setCursorPos(nextPos);
        });
    };

    const updateCursor = () => {
        const pos = textareaRef.current?.selectionStart ?? draftText.length;
        setCursorPos(pos);
    };

    useLayoutEffect(() => {
        const id = window.requestAnimationFrame(autoResize);
        return () => window.cancelAnimationFrame(id);
    }, [draftText]);

    useEffect(() => {
        if (isComposingRef.current) return;
        setDraftText(data.text || "");
    }, [data.text]);

    useEffect(() => {
        if (isComposingRef.current) return;
        const text = data.text || draftText;
        if (!text.includes("@")) return;
        const mentions = computeMentionMeta(text);
        updateNodeData(id, { atMentions: mentions });
    }, [mentionTargets]);

    return (
        <BaseNode
            title={data.title || "Text"}
            onTitleChange={(title) => updateNodeData(id, { title })}
            inputs={["text"]}
            outputs={["text"]}
            selected={selected}
            variant="text"
        >
            <div className="flex flex-col flex-1">
                <textarea
                    ref={textareaRef}
                    className="node-textarea w-full text-[13px] leading-relaxed outline-none resize-none transition-all placeholder:text-[var(--node-text-secondary)] min-h-[160px] font-medium"
                    value={draftText}
                    onChange={(e) => {
                        const value = e.target.value;
                        setDraftText(value);
                        setCursorPos(e.target.selectionStart ?? value.length);
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
                        setCursorPos(e.currentTarget.selectionStart ?? value.length);
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
                            requestAnimationFrame(updateCursor);
                        }
                    }}
                    onKeyUp={updateCursor}
                    onClick={updateCursor}
                    onFocus={() => {
                        autoResize();
                        updateCursor();
                    }}
                    placeholder="Describe or input text here..."
                    style={{ height: "auto" }}
                />

                <div className="px-4 pb-4 pt-2 space-y-3">
                    {(data.atMentions?.length || 0) > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {data.atMentions?.map((m, idx) => {
                                const kind = m.kind || "unknown";
                                const tone =
                                    m.status === "missing"
                                        ? "bg-amber-500/15 text-amber-100 border border-amber-500/30"
                                        : kind === "zone"
                                            ? "bg-emerald-500/15 text-emerald-100 border border-emerald-500/30"
                                            : kind === "character"
                                                ? "bg-amber-500/20 text-amber-100 border border-amber-500/40"
                                                : "bg-sky-500/20 text-sky-100 border border-sky-500/30";
                                const label = m.formName || m.name;
                                const kindLabel =
                                    kind === "zone" ? "场景" : kind === "character" ? "角色" : kind === "form" ? "形态" : "未匹配";
                                return (
                                    <span key={`${m.name}-${idx}`} className="relative group/mention">
                                        <span className={`px-2 py-1 text-[10px] rounded-full inline-flex items-center gap-1 ${tone}`}>
                                            <AtSign size={10} />
                                            {label}
                                            <span className="text-[8px] uppercase tracking-[0.2em] opacity-70">{kindLabel}</span>
                                            {m.status === "missing" && <Info size={10} className="opacity-70" />}
                                        </span>
                                        {m.status === "match" && (m.detail || m.summary) && (
                                            <div className="absolute left-0 top-full mt-2 w-72 rounded-xl border border-white/10 bg-black/80 p-3 text-[11px] text-white/90 opacity-0 pointer-events-none transition group-hover/mention:opacity-100 z-20">
                                                <div className="text-[9px] uppercase tracking-[0.2em] text-white/60 mb-2">{kindLabel}详情</div>
                                                <div className="whitespace-pre-wrap leading-relaxed">{m.detail || m.summary}</div>
                                            </div>
                                        )}
                                    </span>
                                );
                            })}
                        </div>
                    )}

                    {showMentionPicker && (
                        <div className="node-panel p-3 space-y-3 animate-in fade-in slide-in-from-top-1">
                            <div className="text-[10px] uppercase tracking-[0.2em] font-black text-[var(--node-text-secondary)] flex items-center gap-1">
                                <AtSign size={10} /> 绑定角色/场景数据
                            </div>
                            {filteredMentions.forms.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--node-text-secondary)]">角色形态</div>
                                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                                        {filteredMentions.forms.map((f) => (
                                            <button
                                                key={`form-${f.name}-${f.characterId}`}
                                                onClick={() => insertMention(f)}
                                                className="node-control node-control--tight text-left text-[10px] font-semibold text-[var(--node-text-primary)] hover:border-[var(--node-accent)]/40"
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {filteredMentions.characters.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--node-text-secondary)]">角色</div>
                                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                                        {filteredMentions.characters.map((c) => (
                                            <button
                                                key={`char-${c.name}-${c.characterId}`}
                                                onClick={() => insertMention(c)}
                                                className="node-control node-control--tight text-left text-[10px] font-semibold text-[var(--node-text-primary)] hover:border-[var(--node-accent)]/40"
                                            >
                                                {c.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {filteredMentions.zones.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--node-text-secondary)]">场景分区</div>
                                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                                        {filteredMentions.zones.map((z) => (
                                            <button
                                                key={`zone-${z.name}-${z.zoneId}`}
                                                onClick={() => insertMention(z)}
                                                className="node-control node-control--tight text-left text-[10px] font-semibold text-[var(--node-text-primary)] hover:border-[var(--node-accent)]/40"
                                            >
                                                {z.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {filteredMentions.all.length === 0 && (
                                <div className="text-[10px] text-[var(--node-text-secondary)]">未匹配到对应的数据。</div>
                            )}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 min-h-[24px]">
                        <div className="node-pill node-pill--accent inline-flex items-center px-3 py-1 shadow-sm transition-all duration-200">
                            <input
                                className="bg-transparent text-[9px] font-black uppercase tracking-[0.2em] text-[var(--node-accent)] outline-none border-none text-center appearance-none"
                                value={data.category || ""}
                                onChange={(e) => updateNodeData(id, { category: e.target.value as any })}
                                placeholder="CATEGORY"
                                style={{ width: Math.max(data.category?.length || 4, 4) + "ch" }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </BaseNode>
    );
};
