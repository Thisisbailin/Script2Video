import React from "react";
import { Character, Episode } from "../../types";

type Props = {
  episode?: Episode;
  rawScript?: string;
  characters?: Character[];
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildCharacterDetail = (character?: Character) => {
  if (!character) return "";
  return [
    character.name ? `角色：${character.name}` : "",
    character.role ? `身份：${character.role}` : "",
    character.episodeUsage ? `出现：${character.episodeUsage}` : "",
    character.bio || "",
  ]
    .filter(Boolean)
    .join("\n");
};

const buildCharacterMatcher = (characters: Character[]) => {
  const names = characters
    .map((character) => character.name?.trim())
    .filter((name): name is string => !!name)
    .sort((a, b) => b.length - a.length);
  if (!names.length) return null;
  return new RegExp(`(${names.map((name) => escapeRegExp(name)).join("|")})`, "g");
};

export const ScriptViewer: React.FC<Props> = ({ episode, rawScript, characters }) => {
  const allCharacters = React.useMemo(() => (characters || []).filter((character) => !!character?.name?.trim()), [characters]);
  const characterMap = React.useMemo(() => {
    const map = new Map<string, Character>();
    allCharacters.forEach((character) => map.set(character.name.trim(), character));
    return map;
  }, [allCharacters]);
  const cast = episode?.characters || [];
  const characterMatcher = React.useMemo(() => buildCharacterMatcher(allCharacters), [allCharacters]);
  const [selectedCharacterName, setSelectedCharacterName] = React.useState<string | null>(cast[0] || allCharacters[0]?.name || null);
  const selectedCharacter = selectedCharacterName ? characterMap.get(selectedCharacterName) || null : null;

  React.useEffect(() => {
    if (!selectedCharacterName && allCharacters[0]?.name) {
      setSelectedCharacterName(allCharacters[0].name);
      return;
    }
    if (selectedCharacterName && !characterMap.has(selectedCharacterName)) {
      setSelectedCharacterName(allCharacters[0]?.name || null);
    }
  }, [allCharacters, characterMap, selectedCharacterName]);

  const renderBoundText = React.useCallback(
    (text: string) => {
      if (!text) return "（空内容）";
      if (!characterMatcher) return text;
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      characterMatcher.lastIndex = 0;
      while ((match = characterMatcher.exec(text))) {
        const [matchedName] = match;
        const start = match.index;
        const end = start + matchedName.length;
        if (start > lastIndex) {
          parts.push(text.slice(lastIndex, start));
        }
        const character = characterMap.get(matchedName);
        const isMain = !!character?.isMain;
        parts.push(
          <button
            type="button"
            key={`${matchedName}-${start}`}
            title={buildCharacterDetail(character)}
            onClick={() => setSelectedCharacterName(matchedName)}
            className={`rounded-md border px-1.5 py-0.5 font-semibold tracking-[-0.01em] ${
              isMain
                ? "border-emerald-400/40 bg-emerald-500/12 text-emerald-100"
                : "border-sky-400/30 bg-sky-500/10 text-sky-100"
            } transition hover:-translate-y-px hover:border-[var(--border-strong,#fff)] hover:shadow-[0_10px_24px_-18px_rgba(0,0,0,0.45)]`}
          >
            @{matchedName}
          </button>
        );
        lastIndex = end;
      }
      if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
      }
      return parts;
    },
    [characterMap, characterMatcher]
  );

  return (
    <div className="h-full overflow-auto bg-transparent px-8 pb-12 pt-20 text-[var(--text-primary)]">
      <div className="mx-auto grid max-w-[1380px] gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-8">
        {episode ? (
          <div className="space-y-3">
            <h3 className="text-3xl font-bold text-[var(--text-primary)]">{episode.title}</h3>
            <div className="text-sm text-[var(--text-secondary)]">
              当前正文中的角色名已按项目角色库自动识别，并以 `@角色名` 的形式绑定显示。
            </div>
          </div>
        ) : null}

        {cast.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {cast.map((name) => {
              const info = characterMap.get(name);
              const count = info?.appearanceCount;
              const isMain = info?.isMain;
              return (
                <button
                  type="button"
                  key={`${episode?.id || "ep"}-${name}`}
                  onClick={() => setSelectedCharacterName(name)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    selectedCharacterName === name
                      ? "border-emerald-300/80 bg-emerald-500/18 text-emerald-50"
                      : isMain
                      ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                      : "border-white/15 bg-white/5 text-white/70"
                  } transition hover:-translate-y-px hover:border-[var(--border-strong,#fff)]`}
                  title={buildCharacterDetail(info)}
                >
                  @{name}
                  {typeof count === "number" ? ` x${count}` : ""}
                </button>
              );
            })}
          </div>
        ) : null}

        {episode && episode.scenes && episode.scenes.length > 0 ? (
          <div className="space-y-6">
            {episode.scenes.map((scene) => (
              <div
                key={scene.id}
                className="rounded-2xl border border-[var(--border-subtle)]/90 bg-[var(--bg-overlay)] p-5 shadow-[var(--shadow-soft)]"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-lg font-semibold text-[var(--text-primary)]">
                    {scene.id} {scene.title}
                  </h4>
                  <span className="rounded-full border border-[var(--border-subtle)]/80 bg-[var(--bg-panel)]/70 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    Scene
                  </span>
                </div>
                <div className="whitespace-pre-wrap font-serif text-base leading-relaxed text-[var(--text-secondary)]">
                  {renderBoundText(scene.content || "")}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--border-subtle)]/90 bg-[var(--bg-overlay)] p-5 shadow-[var(--shadow-soft)]">
            <div className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-[var(--text-secondary)]">
              {episode
                ? renderBoundText(episode.content || "")
                : rawScript
                  ? renderBoundText(rawScript)
                  : <span className="italic text-[var(--text-secondary)]">No script loaded.</span>}
            </div>
          </div>
        )}
        </div>

        <aside className="xl:sticky xl:top-20 xl:h-fit">
          <div className="overflow-hidden rounded-[28px] border border-[var(--border-subtle)]/90 bg-[linear-gradient(180deg,var(--bg-overlay),rgba(255,255,255,0.02))] shadow-[var(--shadow-soft)] backdrop-blur-xl">
            <div className="border-b border-[var(--border-subtle)]/80 px-5 py-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Character Bound Detail</div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">点击正文中的 `@角色名` 或顶部标签，右侧查看角色卡。</div>
            </div>
            <div className="space-y-4 px-5 py-5">
              {selectedCharacter ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">@{selectedCharacter.name}</div>
                      <div className="mt-1 text-sm text-[var(--text-secondary)]">
                        {selectedCharacter.role || "身份未设置"}
                        {selectedCharacter.assetPriority ? ` · 优先级 ${selectedCharacter.assetPriority}` : ""}
                      </div>
                    </div>
                    <div className="rounded-full border border-[var(--border-subtle)]/80 bg-[var(--bg-panel)]/70 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                      {selectedCharacter.isMain ? "Main" : "Support"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-[var(--border-subtle)]/80 bg-[var(--bg-panel)]/60 px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">Appearances</div>
                      <div className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{selectedCharacter.appearanceCount ?? 0}</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border-subtle)]/80 bg-[var(--bg-panel)]/60 px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">Forms</div>
                      <div className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{selectedCharacter.forms?.length ?? 0}</div>
                    </div>
                  </div>

                  {selectedCharacter.episodeUsage ? (
                    <div className="rounded-2xl border border-[var(--border-subtle)]/80 bg-[var(--bg-panel)]/60 px-4 py-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">Episode Usage</div>
                      <div className="mt-1 text-sm leading-6 text-[var(--text-primary)]">{selectedCharacter.episodeUsage}</div>
                    </div>
                  ) : null}

                  {selectedCharacter.bio ? (
                    <div className="rounded-2xl border border-[var(--border-subtle)]/80 bg-[var(--bg-panel)]/60 px-4 py-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">Bio</div>
                      <div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--text-primary)]">{selectedCharacter.bio}</div>
                    </div>
                  ) : null}

                  {selectedCharacter.tags?.length ? (
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">Tags</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedCharacter.tags.map((tag) => (
                          <span
                            key={`${selectedCharacter.id}-${tag}`}
                            className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-100"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {selectedCharacter.forms?.length ? (
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">Character Forms</div>
                      <div className="space-y-2">
                        {selectedCharacter.forms.map((form) => (
                          <div
                            key={form.id}
                            className="rounded-2xl border border-[var(--border-subtle)]/80 bg-[var(--bg-panel)]/60 px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-[var(--text-primary)]">{form.formName || "Untitled Form"}</div>
                              <div className="text-[11px] text-[var(--text-secondary)]">{form.episodeRange || "Range unset"}</div>
                            </div>
                            {form.identityOrState || form.visualTags ? (
                              <div className="mt-1 text-[12px] text-[var(--text-secondary)]">{form.identityOrState || form.visualTags}</div>
                            ) : null}
                            {form.description ? (
                              <div className="mt-2 line-clamp-3 whitespace-pre-wrap text-[12px] leading-5 text-[var(--text-primary)]">{form.description}</div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--border-subtle)]/80 bg-[var(--bg-panel)]/40 px-4 py-6 text-sm leading-6 text-[var(--text-secondary)]">
                  当前没有选中的角色。点击正文里的 <span className="font-semibold text-[var(--text-primary)]">@角色名</span>，或顶部 cast 标签查看角色卡。
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
