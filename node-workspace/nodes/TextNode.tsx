import React, { useRef, useLayoutEffect, useState, useEffect, useMemo, useCallback } from "react";
import { BaseNode } from "./BaseNode";
import { TextNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";
import { AtSign } from "lucide-react";
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

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const escapeAttr = (value: string) => escapeHtml(value).replace(/\n/g, "&#10;");

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getPlainText = (el: HTMLElement) => (el.innerText || "").replace(/\u200B/g, "").replace(/\r/g, "");

const getRangeTextLength = (range: Range) => {
    const fragment = range.cloneContents();
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
    let length = 0;
    let node = walker.nextNode();
    while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
            length += (node.textContent || "").length;
        } else if ((node as HTMLElement).tagName === "BR") {
            length += 1;
        }
        node = walker.nextNode();
    }
    return length;
};

const getCaretOffset = (el: HTMLElement) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;
    const range = selection.getRangeAt(0);
    if (!el.contains(range.startContainer)) return 0;
    const preRange = range.cloneRange();
    preRange.selectNodeContents(el);
    preRange.setEnd(range.startContainer, range.startOffset);
    return getRangeTextLength(preRange);
};

const setCaretOffset = (el: HTMLElement, offset: number) => {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
    let current = 0;
    let node = walker.nextNode();
    while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || "";
            const next = current + text.length;
            if (offset <= next) {
                range.setStart(node, Math.max(0, offset - current));
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                return;
            }
            current = next;
        } else if ((node as HTMLElement).tagName === "BR") {
            const next = current + 1;
            if (offset <= next) {
                range.setStartAfter(node);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                return;
            }
            current = next;
        }
        node = walker.nextNode();
    }
    range.selectNodeContents(el);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
};

const getSelectionOffsets = (el: HTMLElement, fallback: number) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return { start: fallback, end: fallback };
    const range = selection.getRangeAt(0);
    if (!el.contains(range.startContainer)) return { start: fallback, end: fallback };
    const preStart = range.cloneRange();
    preStart.selectNodeContents(el);
    preStart.setEnd(range.startContainer, range.startOffset);
    const start = getRangeTextLength(preStart);
    const preEnd = range.cloneRange();
    preEnd.selectNodeContents(el);
    preEnd.setEnd(range.endContainer, range.endOffset);
    const end = getRangeTextLength(preEnd);
    return { start, end };
};

const getCaretRect = (el: HTMLElement) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!el.contains(range.startContainer)) return null;
    if (!range.collapsed) return range.getBoundingClientRect();
    const rects = range.getClientRects();
    if (rects.length > 0) return rects[0];
    const marker = document.createElement("span");
    marker.textContent = "\u200b";
    const clone = range.cloneRange();
    clone.insertNode(marker);
    const rect = marker.getBoundingClientRect();
    marker.parentNode?.removeChild(marker);
    return rect;
};

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
    const editorRef = useRef<HTMLDivElement>(null);
    const shellRef = useRef<HTMLDivElement>(null);
    const isComposingRef = useRef(false);
    const lastHtmlRef = useRef<string>("");
    const pendingSelectionRef = useRef<number | null>(null);
    const baseStyleRef = useRef<{ height?: string; minHeight?: string } | null>(null);
    const isLocalUpdateRef = useRef(false);
    const skipNextCursorUpdateRef = useRef(false);
    const [draftText, setDraftText] = useState(data.text || "");
    const [cursorPos, setCursorPos] = useState((data.text || "").length);
    const [isFocused, setIsFocused] = useState(false);
    const [pickerPos, setPickerPos] = useState<{ left: number; top: number } | null>(null);

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

    const resolveMention = useCallback(
        (name: string) => {
            const list = mentionIndex.get(toSearch(name)) || [];
            if (!list.length) return null;
            return list.slice().sort((a, b) => mentionPriority[a.kind] - mentionPriority[b.kind])[0];
        },
        [mentionIndex]
    );

    const parseMentions = (text: string) => {
        const matches = text.match(/@([\w\u4e00-\u9fa5-]+)/g) || [];
        const names: string[] = [];
        matches.forEach((m) => {
            const name = m.slice(1);
            if (!names.includes(name)) names.push(name);
        });
        return names;
    };

    const computeMentionMeta = useCallback(
        (text: string) => {
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
        },
        [resolveMention]
    );

    const mentionState = useMemo(() => {
        const pos = Math.min(cursorPos, draftText.length);
        const textBefore = draftText.slice(0, pos);
        const match = textBefore.match(/@([\w\u4e00-\u9fa5-]*)$/);
        if (!match) return null;
        const prevChar = textBefore.length > 1 ? textBefore[textBefore.length - match[0].length - 1] : "";
        if (prevChar && !/\s|[\(\[\{,，。:：;；"“”'‘’]/.test(prevChar)) return null;
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

    const showMentionPicker = isFocused && !!mentionState;

    const renderedHtml = useMemo(() => {
        if (!draftText) return "";
        const parts: string[] = [];
        let lastIndex = 0;
        const regex = /@([\w\u4e00-\u9fa5-]+)/g;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(draftText))) {
            const start = match.index;
            const end = start + match[0].length;
            parts.push(escapeHtml(draftText.slice(lastIndex, start)));
            const name = match[1];
            const hit = resolveMention(name);
            const kind = hit?.kind || "unknown";
            const status = hit ? "match" : "missing";
            const tooltipRaw = (hit?.detail || hit?.summary || "").trim();
            const tooltip = tooltipRaw ? escapeAttr(tooltipRaw) : "";
            const tooltipAttr = tooltip ? ` data-tooltip="${tooltip}"` : "";
            parts.push(
                `<span class="text-mention" data-kind="${kind}" data-status="${status}"${tooltipAttr}>${escapeHtml(match[0])}</span>`
            );
            lastIndex = end;
        }
        parts.push(escapeHtml(draftText.slice(lastIndex)));
        return parts.join("").replace(/\n/g, "<br />");
    }, [draftText, resolveMention]);

    const updateCursor = useCallback(() => {
        const el = editorRef.current;
        if (!el) return;
        const pos = getCaretOffset(el);
        setCursorPos(pos);
    }, []);

    const handleInput = useCallback(() => {
        const el = editorRef.current;
        if (!el) return;
        const value = getPlainText(el);
        const pos = getCaretOffset(el);
        setDraftText(value);
        setCursorPos(pos);
        pendingSelectionRef.current = pos;
        if (!isComposingRef.current) {
            isLocalUpdateRef.current = true;
            const mentions = computeMentionMeta(value);
            updateNodeData(id, { text: value, atMentions: mentions });
        }
    }, [computeMentionMeta, id, updateNodeData]);

    const insertMention = (target: MentionTarget) => {
        const start = mentionState ? mentionState.start : cursorPos;
        const end = mentionState ? mentionState.end : cursorPos;
        const before = draftText.slice(0, start);
        const after = draftText.slice(end);
        const insertion = `@${target.name} `;
        const next = `${before}${insertion}${after}`;
        const nextPos = start + insertion.length;
        setDraftText(next);
        setCursorPos(nextPos);
        pendingSelectionRef.current = nextPos;
        isLocalUpdateRef.current = true;
        const mentions = computeMentionMeta(next);
        updateNodeData(id, { text: next, atMentions: mentions });
        requestAnimationFrame(() => {
            const el = editorRef.current;
            if (!el) return;
            el.focus();
            setCaretOffset(el, nextPos);
        });
    };

    const updatePickerPosition = useCallback(() => {
        if (!showMentionPicker) return;
        const shell = shellRef.current;
        const editor = editorRef.current;
        if (!shell || !editor) return;
        const caretRect = getCaretRect(editor);
        const shellRect = shell.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        const anchorLeft = caretRect ? caretRect.left : editorRect.left + 12;
        const anchorBottom = caretRect ? caretRect.bottom : editorRect.top + 28;
        const pickerWidth = 300;
        const left = clamp(anchorLeft - shellRect.left, 12, Math.max(12, shellRect.width - pickerWidth - 12));
        const top = anchorBottom - shellRect.top + 8;
        setPickerPos({ left, top });
    }, [showMentionPicker]);

    useLayoutEffect(() => {
        const el = editorRef.current;
        if (!el || isComposingRef.current) return;
        const html = renderedHtml;
        if (html !== lastHtmlRef.current) {
            el.innerHTML = html;
            lastHtmlRef.current = html;
        }
        if (document.activeElement === el) {
            const targetPos = pendingSelectionRef.current ?? cursorPos;
            setCaretOffset(el, Math.min(targetPos, draftText.length));
            pendingSelectionRef.current = null;
        }
        updatePickerPosition();
    }, [renderedHtml, draftText, cursorPos, updatePickerPosition]);

    useEffect(() => {
        const shell = shellRef.current;
        if (!shell) return;
        const nodeEl = shell.closest(".react-flow__node") as HTMLElement | null;
        if (!nodeEl) return;
        const cardEl = nodeEl.querySelector(".node-card-base") as HTMLElement | null;
        if (cardEl) {
            const hasContent = draftText.trim().length > 0;
            if (hasContent) cardEl.dataset.hasContent = "true";
            else delete cardEl.dataset.hasContent;
        }
        if (!baseStyleRef.current) {
            baseStyleRef.current = {
                height: typeof nodeEl.style.height === "string" ? nodeEl.style.height : undefined,
                minHeight: typeof nodeEl.style.minHeight === "string" ? nodeEl.style.minHeight : undefined,
            };
        }
        const trim = draftText.trim();
        if (!trim) {
            if (baseStyleRef.current.height !== undefined) nodeEl.style.height = baseStyleRef.current.height;
            else nodeEl.style.removeProperty("height");
            if (baseStyleRef.current.minHeight !== undefined) nodeEl.style.minHeight = baseStyleRef.current.minHeight;
            else nodeEl.style.removeProperty("min-height");
            return;
        }
        const editor = editorRef.current;
        if (!editor) return;
        const paddingY = editor.clientHeight - editor.scrollHeight;
        const desired = editor.scrollHeight + Math.max(0, paddingY);
        const next = Math.max(nodeEl.offsetHeight || 0, desired);
        nodeEl.style.height = `${next}px`;
        nodeEl.style.minHeight = `${next}px`;
    }, [draftText]);

    useEffect(() => {
        if (isComposingRef.current) return;
        if (isLocalUpdateRef.current) {
            isLocalUpdateRef.current = false;
            return;
        }
        if ((data.text || "") === draftText) return;
        const next = data.text || "";
        setDraftText(next);
        setCursorPos(next.length);
        pendingSelectionRef.current = next.length;
    }, [data.text]);

    useEffect(() => {
        if (isComposingRef.current) return;
        const text = data.text || draftText;
        if (!text.includes("@")) return;
        const mentions = computeMentionMeta(text);
        updateNodeData(id, { atMentions: mentions });
    }, [computeMentionMeta, data.text, draftText, id, mentionTargets, updateNodeData]);

    useEffect(() => {
        if (showMentionPicker) return;
        setPickerPos(null);
    }, [showMentionPicker]);

    useEffect(() => {
        if (!showMentionPicker) return;
        const handleScroll = () => updatePickerPosition();
        window.addEventListener("scroll", handleScroll, true);
        window.addEventListener("resize", handleScroll);
        return () => {
            window.removeEventListener("scroll", handleScroll, true);
            window.removeEventListener("resize", handleScroll);
        };
    }, [showMentionPicker, updatePickerPosition]);

    return (
        <BaseNode
            title={data.title || "Text"}
            onTitleChange={(title) => updateNodeData(id, { title })}
            inputs={["text"]}
            outputs={["text"]}
            selected={selected}
            variant="text"
        >
            <div
                ref={shellRef}
                className="text-node-shell relative flex-1"
                data-has-content={draftText.trim().length > 0 ? "true" : "false"}
            >
                <div
                    ref={editorRef}
                    className="text-node-editor nodrag"
                    contentEditable
                    suppressContentEditableWarning
                    data-placeholder="Describe or input text here..."
                    onInput={handleInput}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") {
                            e.preventDefault();
                            const el = editorRef.current;
                            if (!el) return;
                            const { start, end } = getSelectionOffsets(el, cursorPos);
                            const next = `${draftText.slice(0, start)}\n${draftText.slice(end)}`;
                            const nextPos = start + 1;
                            setDraftText(next);
                            setCursorPos(nextPos);
                            pendingSelectionRef.current = nextPos;
                            isLocalUpdateRef.current = true;
                            skipNextCursorUpdateRef.current = true;
                            const mentions = computeMentionMeta(next);
                            updateNodeData(id, { text: next, atMentions: mentions });
                            requestAnimationFrame(() => {
                                if (!el) return;
                                el.focus();
                                setCaretOffset(el, nextPos);
                            });
                        }
                    }}
                    onKeyUp={() => {
                        if (skipNextCursorUpdateRef.current) {
                            skipNextCursorUpdateRef.current = false;
                            return;
                        }
                        updateCursor();
                        updatePickerPosition();
                    }}
                    onClick={() => {
                        updateCursor();
                        updatePickerPosition();
                    }}
                    onFocus={() => {
                        setIsFocused(true);
                        updateCursor();
                        updatePickerPosition();
                    }}
                    onBlur={() => {
                        setIsFocused(false);
                        if (!isComposingRef.current && draftText !== data.text) {
                            isLocalUpdateRef.current = true;
                            const mentions = computeMentionMeta(draftText);
                            updateNodeData(id, { text: draftText, atMentions: mentions });
                        }
                    }}
                    onCompositionStart={() => {
                        isComposingRef.current = true;
                    }}
                    onCompositionEnd={() => {
                        isComposingRef.current = false;
                        handleInput();
                    }}
                />

                {showMentionPicker && pickerPos && (
                    <div
                        className="node-panel p-3 space-y-3 animate-in fade-in slide-in-from-top-1 absolute z-30"
                        style={{ left: pickerPos.left, top: pickerPos.top, width: 300 }}
                    >
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
                                            onMouseDown={(e) => e.preventDefault()}
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
                                            onMouseDown={(e) => e.preventDefault()}
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
                                            onMouseDown={(e) => e.preventDefault()}
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
            </div>
        </BaseNode>
    );
};
