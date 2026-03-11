import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, FileText, Plus, Sparkles, Theater, Trash2 } from "lucide-react";
import type { Character, Episode, ProjectData } from "../../types";
import { parseScriptToEpisodes } from "../../utils/parser";
import { ensureStableId } from "../../utils/id";

type Props = {
  projectData: ProjectData;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;
};

type BlockType = "action" | "dialogue" | "os" | "vo";

type WritingBlock = {
  id: string;
  type: BlockType;
  speaker?: string;
  qualifier?: string;
  content: string;
};

type WritingScene = {
  id: string;
  title: string;
  timeOfDay: string;
  location: string;
  castLine: string;
  blocks: WritingBlock[];
};

type WritingEpisode = {
  id: number;
  title: string;
  scenes: WritingScene[];
};

const BLOCK_TYPE_OPTIONS: { value: BlockType; label: string }[] = [
  { value: "action", label: "动作" },
  { value: "dialogue", label: "对白" },
  { value: "os", label: "OS" },
  { value: "vo", label: "VO" },
];

const createEmptyBlock = (type: BlockType = "action"): WritingBlock => ({
  id: ensureStableId(undefined, "writing-block"),
  type,
  speaker: "",
  qualifier: type === "os" ? "OS" : type === "vo" ? "VO" : "",
  content: "",
});

const createEmptyScene = (episodeId: number, sceneIndex: number): WritingScene => ({
  id: `${episodeId}-${sceneIndex}`,
  title: `场景 ${sceneIndex}`,
  timeOfDay: "",
  location: "",
  castLine: "",
  blocks: [createEmptyBlock("action")],
});

const createEmptyEpisode = (episodeId: number): WritingEpisode => ({
  id: episodeId,
  title: `第${episodeId}集`,
  scenes: [createEmptyScene(episodeId, 1)],
});

const parseBlocksFromSceneContent = (content: string) => {
  const blocks: WritingBlock[] = [];
  let castLine = "";
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  lines.forEach((line) => {
    const castMatch = line.match(/^人物[:：]\s*(.+)$/);
    if (castMatch) {
      castLine = castMatch[1].trim();
      return;
    }

    const qualifiedMatch = line.match(/^([^：（:]+?)\s*（([^）]+)）\s*[:：]\s*(.+)$/);
    if (qualifiedMatch) {
      const [, speaker, qualifier, body] = qualifiedMatch;
      const type = /VO/i.test(qualifier) ? "vo" : /OS/i.test(qualifier) ? "os" : "dialogue";
      blocks.push({
        id: ensureStableId(undefined, "writing-block"),
        type,
        speaker: speaker.trim(),
        qualifier: qualifier.trim(),
        content: body.trim(),
      });
      return;
    }

    const dialogueMatch = line.match(/^([^：:]+?)\s*[:：]\s*(.+)$/);
    if (dialogueMatch) {
      const [, speaker, body] = dialogueMatch;
      blocks.push({
        id: ensureStableId(undefined, "writing-block"),
        type: "dialogue",
        speaker: speaker.trim(),
        qualifier: "",
        content: body.trim(),
      });
      return;
    }

    blocks.push({
      id: ensureStableId(undefined, "writing-block"),
      type: "action",
      content: line.replace(/^△\s*/, "").trim(),
    });
  });

  return {
    castLine,
    blocks: blocks.length ? blocks : [createEmptyBlock("action")],
  };
};

const buildDraftFromEpisodes = (episodes: Episode[], rawScript: string): WritingEpisode[] => {
  if (!episodes.length && !rawScript.trim()) {
    return [createEmptyEpisode(1)];
  }

  if (!episodes.length && rawScript.trim()) {
    const parsed = parseScriptToEpisodes(rawScript);
    return buildDraftFromEpisodes(parsed, "");
  }

  return episodes.map((episode, episodeIndex) => ({
    id: episode.id || episodeIndex + 1,
    title: (episode.title || `第${episode.id || episodeIndex + 1}集`).trim(),
    scenes:
      episode.scenes?.length
        ? episode.scenes.map((scene, sceneIndex) => {
            const parsed = parseBlocksFromSceneContent(scene.content || "");
            return {
              id: scene.id || `${episode.id || episodeIndex + 1}-${sceneIndex + 1}`,
              title: scene.title || `场景 ${sceneIndex + 1}`,
              timeOfDay: scene.timeOfDay || "",
              location: scene.location || "",
              castLine:
                parsed.castLine ||
                ((episode.characters || []).length ? (episode.characters || []).join("、") : ""),
              blocks: parsed.blocks,
            };
          })
        : [createEmptyScene(episode.id || episodeIndex + 1, 1)],
  }));
};

const exportBlock = (block: WritingBlock) => {
  const content = (block.content || "").trim();
  if (!content) return "";
  if (block.type === "action") {
    return `△${content}`;
  }
  if (block.type === "dialogue") {
    return `${(block.speaker || "").trim() || "角色"}：${content}`;
  }
  if (block.type === "os") {
    const qualifier = (block.qualifier || "OS").trim() || "OS";
    return `${(block.speaker || "").trim() || "角色"}（${qualifier}）：${content}`;
  }
  const qualifier = (block.qualifier || "VO").trim() || "VO";
  return `${(block.speaker || "").trim() || "声源"}（${qualifier}）：${content}`;
};

const exportScene = (scene: WritingScene) => {
  const header = [scene.id, scene.title.trim(), scene.timeOfDay.trim(), scene.location.trim()]
    .filter(Boolean)
    .join(" ");
  const lines = [
    header,
    scene.castLine.trim() ? `人物：${scene.castLine.trim()}` : "",
    ...scene.blocks.map(exportBlock).filter(Boolean),
  ].filter(Boolean);
  return lines.join("\n");
};

const exportEpisode = (episode: WritingEpisode) => {
  const lines = [
    episode.title.trim() || `第${episode.id}集`,
    "",
    ...episode.scenes.map((scene) => exportScene(scene)),
  ];
  return lines.join("\n\n").trim();
};

const exportDraft = (episodes: WritingEpisode[]) => episodes.map(exportEpisode).filter(Boolean).join("\n\n");

const mergeEpisodes = (previous: Episode[], parsed: Episode[]) => {
  const previousMap = new Map(previous.map((episode) => [episode.id, episode]));
  return parsed.map((episode) => {
    const prev = previousMap.get(episode.id);
    return {
      ...episode,
      summary: prev?.summary,
      shots: prev?.shots || [],
      status: prev?.status || "pending",
      errorMsg: prev?.errorMsg,
      shotGenUsage: prev?.shotGenUsage,
      soraGenUsage: prev?.soraGenUsage,
      storyboardGenUsage: prev?.storyboardGenUsage,
    };
  });
};

const formatParserIssues = (draftEpisodes: WritingEpisode[]) => {
  const issues: string[] = [];
  draftEpisodes.forEach((episode) => {
    if (!/^第.+集$/.test((episode.title || "").trim())) {
      issues.push(`${episode.title || `第${episode.id}集`} 的集标题不符合“第X集”格式。`);
    }
    episode.scenes.forEach((scene, index) => {
      if (!/^\d+-\d+$/.test((scene.id || "").trim())) {
        issues.push(`${episode.title} 的第 ${index + 1} 场缺少合法场号。`);
      }
      if (!(scene.title || "").trim()) {
        issues.push(`${scene.id || `${episode.id}-${index + 1}`} 缺少场景标题。`);
      }
      if (!scene.blocks.some((block) => block.content.trim())) {
        issues.push(`${scene.id || `${episode.id}-${index + 1}`} 还没有正文内容。`);
      }
    });
  });
  return issues;
};

const titleClass = "text-[11px] font-black uppercase tracking-[0.24em] text-[var(--app-text-secondary)]";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildCharacterDetail = (character?: Character) => {
  if (!character) return "";
  return [
    character.name ? `角色：${character.name}` : "",
    character.role ? `身份：${character.role}` : "",
    typeof character.appearanceCount === "number" ? `出现次数：${character.appearanceCount}` : "",
    character.episodeUsage ? `出现区间：${character.episodeUsage}` : "",
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

const parseCastNames = (castLine: string) =>
  castLine
    .split(/[、，,／/|\s]+/)
    .map((name) => name.trim().replace(/^@/, ""))
    .filter(Boolean);

export const WritingPanel: React.FC<Props> = ({ projectData, setProjectData }) => {
  const [draft, setDraft] = useState<WritingEpisode[]>(() =>
    buildDraftFromEpisodes(projectData.episodes, projectData.rawScript)
  );
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number>(() => draft[0]?.id || 1);
  const [selectedSceneId, setSelectedSceneId] = useState<string>(() => draft[0]?.scenes[0]?.id || "1-1");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(() => draft[0]?.scenes[0]?.blocks[0]?.id || null);
  const knownCharacters = useMemo(
    () => (projectData.context.characters || []).filter((character) => !!character?.name?.trim()),
    [projectData.context.characters]
  );
  const characterMap = useMemo(() => {
    const map = new Map<string, Character>();
    knownCharacters.forEach((character) => {
      if (character.name?.trim()) map.set(character.name.trim(), character);
    });
    return map;
  }, [knownCharacters]);
  const characterMatcher = useMemo(() => buildCharacterMatcher(knownCharacters), [knownCharacters]);

  useEffect(() => {
    setDraft((current) => (current.length ? current : buildDraftFromEpisodes(projectData.episodes, projectData.rawScript)));
  }, [projectData.episodes, projectData.rawScript]);

  const selectedEpisode =
    draft.find((episode) => episode.id === selectedEpisodeId) || draft[0] || createEmptyEpisode(1);
  const selectedScene =
    selectedEpisode.scenes.find((scene) => scene.id === selectedSceneId) ||
    selectedEpisode.scenes[0] ||
    createEmptyScene(selectedEpisode.id, 1);

  useEffect(() => {
    if (!draft.some((episode) => episode.id === selectedEpisodeId)) {
      setSelectedEpisodeId(draft[0]?.id || 1);
    }
  }, [draft, selectedEpisodeId]);

  useEffect(() => {
    if (!selectedEpisode.scenes.some((scene) => scene.id === selectedSceneId)) {
      setSelectedSceneId(selectedEpisode.scenes[0]?.id || `${selectedEpisode.id}-1`);
    }
  }, [selectedEpisode, selectedSceneId]);

  useEffect(() => {
    const allBlockIds = selectedScene.blocks.map((block) => block.id);
    if (!selectedBlockId || !allBlockIds.includes(selectedBlockId)) {
      setSelectedBlockId(allBlockIds[0] || null);
    }
  }, [selectedBlockId, selectedScene.blocks]);

  const fullScript = useMemo(() => exportDraft(draft), [draft]);
  const parserPreview = useMemo(() => parseScriptToEpisodes(fullScript), [fullScript]);
  const parserIssues = useMemo(() => {
    const issues = formatParserIssues(draft);
    const sceneIdSet = new Set<string>();

    draft.forEach((episode) => {
      episode.scenes.forEach((scene, index) => {
        const normalizedSceneId = (scene.id || "").trim();
        if (normalizedSceneId) {
          if (sceneIdSet.has(normalizedSceneId)) {
            issues.push(`${normalizedSceneId} 在全剧本中重复出现。`);
          }
          sceneIdSet.add(normalizedSceneId);
        }
        if (normalizedSceneId && !normalizedSceneId.startsWith(`${episode.id}-`)) {
          issues.push(`${normalizedSceneId} 的场号前缀与 ${episode.title} 不一致。`);
        }
        if (!(scene.timeOfDay || "").trim()) {
          issues.push(`${scene.id || `${episode.id}-${index + 1}`} 缺少时间标记。`);
        }
        if (!(scene.location || "").trim()) {
          issues.push(`${scene.id || `${episode.id}-${index + 1}`} 缺少内/外标记。`);
        }

        const castNames = parseCastNames(scene.castLine || "");
        castNames.forEach((name) => {
          if (!characterMap.has(name)) {
            issues.push(`${scene.id || `${episode.id}-${index + 1}`} 的人物行中包含未绑定角色：${name}`);
          }
        });

        scene.blocks.forEach((block, blockIndex) => {
          if (block.type !== "action" && !(block.speaker || "").trim()) {
            issues.push(`${scene.id || `${episode.id}-${index + 1}`} 的第 ${blockIndex + 1} 个正文块缺少说话角色。`);
          }
          if ((block.type === "os" || block.type === "vo") && !(block.qualifier || "").trim()) {
            issues.push(`${scene.id || `${episode.id}-${index + 1}`} 的第 ${blockIndex + 1} 个 ${block.type.toUpperCase()} 块缺少标注。`);
          }
          const mentions = (block.content.match(/@([\w\u4e00-\u9fa5-]+)/g) || []).map((item) => item.slice(1));
          mentions.forEach((name) => {
            if (!characterMap.has(name)) {
              issues.push(`${scene.id || `${episode.id}-${index + 1}`} 中引用了未绑定角色 @${name}`);
            }
          });
        });
      });
    });

    return Array.from(new Set(issues));
  }, [characterMap, draft]);
  const selectedScenePreview = useMemo(() => exportScene(selectedScene), [selectedScene]);

  const renderBoundText = useCallback(
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
          parts.push(<React.Fragment key={`text-${lastIndex}`}>{text.slice(lastIndex, start)}</React.Fragment>);
        }
        const character = characterMap.get(matchedName);
        parts.push(
          <span
            key={`${matchedName}-${start}`}
            className="text-mention"
            data-kind="character"
            data-status={character ? "match" : "missing"}
            data-tooltip={buildCharacterDetail(character) || undefined}
          >
            @{matchedName}
          </span>
        );
        lastIndex = end;
      }

      if (lastIndex < text.length) {
        parts.push(<React.Fragment key={`text-${lastIndex}`}>{text.slice(lastIndex)}</React.Fragment>);
      }
      return parts;
    },
    [characterMap, characterMatcher]
  );

  const patchEpisode = (episodeId: number, updater: (episode: WritingEpisode) => WritingEpisode) => {
    setDraft((prev) => prev.map((episode) => (episode.id === episodeId ? updater(episode) : episode)));
  };

  const patchScene = (episodeId: number, sceneId: string, updater: (scene: WritingScene, index: number) => WritingScene) => {
    patchEpisode(episodeId, (episode) => ({
      ...episode,
      scenes: episode.scenes.map((scene, index) => (scene.id === sceneId ? updater(scene, index) : scene)),
    }));
  };

  const addEpisode = () => {
    const nextId = draft.length ? Math.max(...draft.map((episode) => episode.id)) + 1 : 1;
    const nextEpisode = createEmptyEpisode(nextId);
    setDraft((prev) => [...prev, nextEpisode]);
    setSelectedEpisodeId(nextEpisode.id);
    setSelectedSceneId(nextEpisode.scenes[0].id);
  };

  const addScene = () => {
    const nextSceneIndex = selectedEpisode.scenes.length + 1;
    const nextScene = createEmptyScene(selectedEpisode.id, nextSceneIndex);
    patchEpisode(selectedEpisode.id, (episode) => ({
      ...episode,
      scenes: [...episode.scenes, nextScene],
    }));
    setSelectedSceneId(nextScene.id);
  };

  const addBlock = (type: BlockType) => {
    patchScene(selectedEpisode.id, selectedScene.id, (scene) => ({
      ...scene,
      blocks: [...scene.blocks, createEmptyBlock(type)],
    }));
  };

  const removeBlock = (blockId: string) => {
    patchScene(selectedEpisode.id, selectedScene.id, (scene) => ({
      ...scene,
      blocks: scene.blocks.length > 1 ? scene.blocks.filter((block) => block.id !== blockId) : scene.blocks,
    }));
  };

  const insertCharacterMention = (blockId: string, characterName: string) => {
    patchScene(selectedEpisode.id, selectedScene.id, (scene) => ({
      ...scene,
      blocks: scene.blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              content: `${block.content}${block.content ? " " : ""}@${characterName}`,
            }
          : block
      ),
    }));
    setSelectedBlockId(blockId);
  };

  const assignSpeaker = (blockId: string, characterName: string) => {
    patchScene(selectedEpisode.id, selectedScene.id, (scene) => ({
      ...scene,
      blocks: scene.blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              speaker: characterName,
            }
          : block
      ),
    }));
    setSelectedBlockId(blockId);
  };

  const applyToProject = () => {
    const generatedScript = exportDraft(draft);
    const parsedEpisodes = parseScriptToEpisodes(generatedScript);
    setProjectData((prev) => ({
      ...prev,
      rawScript: generatedScript,
      episodes: mergeEpisodes(prev.episodes, parsedEpisodes),
      context: {
        ...prev.context,
        episodeSummaries: (prev.context.episodeSummaries || []).filter((item) =>
          parsedEpisodes.some((episode) => episode.id === item.episodeId)
        ),
      },
    }));
  };

  return (
    <div className="space-y-5 text-[var(--app-text-primary)]">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="space-y-4">
          <div className="rounded-[28px] border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4">
            <div className={titleClass}>Writing</div>
            <div className="mt-2 text-[13px] leading-6 text-[var(--app-text-secondary)]">
              结构化写作工作台。左侧维护集与场，右侧编辑正文块，系统实时生成标准剧本格式。
            </div>
            <button
              type="button"
              onClick={addEpisode}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-[var(--app-border-strong)] bg-[linear-gradient(180deg,rgba(16,185,129,0.18),rgba(16,185,129,0.06))] px-4 text-[12px] font-semibold text-[var(--app-text-primary)] transition hover:-translate-y-px"
            >
              <Plus size={14} />
              新建一集
            </button>
          </div>

          <div className="rounded-[28px] border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-3">
            <div className="px-2 pb-2">
              <div className={titleClass}>Episodes</div>
              <div className="mt-1 text-[11px] text-[var(--app-text-secondary)]">{draft.length} 集</div>
            </div>
            <div className="space-y-2">
              {draft.map((episode) => {
                const activeEpisode = episode.id === selectedEpisode.id;
                return (
                  <div
                    key={episode.id}
                    className={`rounded-[22px] border px-3 py-3 transition ${
                      activeEpisode
                        ? "border-[var(--app-border-strong)] bg-[var(--app-panel-soft)]"
                        : "border-[var(--app-border)] bg-[var(--app-panel-muted)]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEpisodeId(episode.id);
                        setSelectedSceneId(episode.scenes[0]?.id || `${episode.id}-1`);
                      }}
                      className="w-full text-left"
                    >
                      <div className="text-[13px] font-semibold tracking-[-0.02em]">{episode.title}</div>
                      <div className="mt-1 text-[11px] text-[var(--app-text-secondary)]">{episode.scenes.length} 场</div>
                    </button>
                    {activeEpisode ? (
                      <div className="mt-3 space-y-1.5 border-t border-[var(--app-border)] pt-3">
                        {episode.scenes.map((scene) => (
                          <button
                            key={scene.id}
                            type="button"
                            onClick={() => setSelectedSceneId(scene.id)}
                            className={`flex w-full items-center justify-between rounded-[16px] px-3 py-2 text-left text-[12px] transition ${
                              scene.id === selectedScene.id
                                ? "bg-[var(--app-panel-soft)] text-[var(--app-text-primary)]"
                                : "text-[var(--app-text-secondary)] hover:bg-[var(--app-panel-soft)]"
                            }`}
                          >
                            <span className="truncate">{scene.id} {scene.title}</span>
                            <ChevronDown size={12} className="rotate-[-90deg]" />
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={addScene}
                          className="mt-1 flex w-full items-center justify-center gap-2 rounded-[16px] border border-dashed border-[var(--app-border)] px-3 py-2 text-[11px] text-[var(--app-text-secondary)] transition hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-primary)]"
                        >
                          <Plus size={12} />
                          新建场次
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="space-y-4">
          <div className="rounded-[30px] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className={titleClass}>Scene Editor</div>
                <div className="mt-2 text-[20px] font-semibold tracking-[-0.03em]">
                  {selectedScene.id} {selectedScene.title}
                </div>
                <div className="mt-1 text-[12px] text-[var(--app-text-secondary)]">
                  动作 / 对白 / OS / VO 四类正文块直接对应当前解析与导出格式。
                </div>
              </div>
              <button
                type="button"
                onClick={applyToProject}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--app-border-strong)] bg-[linear-gradient(180deg,rgba(16,185,129,0.2),rgba(16,185,129,0.08))] px-5 text-[12px] font-semibold transition hover:-translate-y-px"
              >
                <Sparkles size={14} />
                写回项目
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2">
                <div className={titleClass}>Episode</div>
                <input
                  value={selectedEpisode.title}
                  onChange={(event) =>
                    patchEpisode(selectedEpisode.id, (episode) => ({
                      ...episode,
                      title: event.target.value,
                    }))
                  }
                  className="w-full rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3 text-[13px] outline-none transition focus:border-[var(--app-border-strong)]"
                />
              </label>
              <label className="space-y-2">
                <div className={titleClass}>Scene Id</div>
                <input
                  value={selectedScene.id}
                  onChange={(event) =>
                    patchScene(selectedEpisode.id, selectedScene.id, (scene) => ({
                      ...scene,
                      id: event.target.value,
                    }))
                  }
                  className="w-full rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3 text-[13px] outline-none transition focus:border-[var(--app-border-strong)]"
                />
              </label>
              <label className="space-y-2">
                <div className={titleClass}>Scene Title</div>
                <input
                  value={selectedScene.title}
                  onChange={(event) =>
                    patchScene(selectedEpisode.id, selectedScene.id, (scene) => ({
                      ...scene,
                      title: event.target.value,
                    }))
                  }
                  className="w-full rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3 text-[13px] outline-none transition focus:border-[var(--app-border-strong)]"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-2">
                  <div className={titleClass}>Time</div>
                  <input
                    value={selectedScene.timeOfDay}
                    onChange={(event) =>
                      patchScene(selectedEpisode.id, selectedScene.id, (scene) => ({
                        ...scene,
                        timeOfDay: event.target.value,
                      }))
                    }
                    className="w-full rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3 text-[13px] outline-none transition focus:border-[var(--app-border-strong)]"
                  />
                </label>
                <label className="space-y-2">
                  <div className={titleClass}>Space</div>
                  <input
                    value={selectedScene.location}
                    onChange={(event) =>
                      patchScene(selectedEpisode.id, selectedScene.id, (scene) => ({
                        ...scene,
                        location: event.target.value,
                      }))
                    }
                    className="w-full rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3 text-[13px] outline-none transition focus:border-[var(--app-border-strong)]"
                  />
                </label>
              </div>
            </div>

            <label className="mt-4 block space-y-2">
              <div className={titleClass}>Cast</div>
              <input
                value={selectedScene.castLine}
                onChange={(event) =>
                  patchScene(selectedEpisode.id, selectedScene.id, (scene) => ({
                    ...scene,
                    castLine: event.target.value,
                  }))
                }
                placeholder="人物：洛青舟、宋如月"
                className="w-full rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3 text-[13px] outline-none transition focus:border-[var(--app-border-strong)]"
              />
              {knownCharacters.length ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {knownCharacters.map((character) => (
                    <button
                      key={character.id}
                      type="button"
                      onClick={() =>
                        patchScene(selectedEpisode.id, selectedScene.id, (scene) => {
                          const names = parseCastNames(scene.castLine || "");
                          if (names.includes(character.name)) return scene;
                          return {
                            ...scene,
                            castLine: [...names, character.name].join("、"),
                          };
                        })
                      }
                      className="text-mention"
                      data-kind="character"
                      data-status="match"
                      data-tooltip={buildCharacterDetail(character) || undefined}
                    >
                      @{character.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className={titleClass}>Blocks</div>
                <div className="mt-1 text-[12px] text-[var(--app-text-secondary)]">每一个块都会按标准剧本格式导出为一行。</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {BLOCK_TYPE_OPTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => addBlock(item.value)}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-panel-muted)] px-3 text-[11px] font-semibold text-[var(--app-text-secondary)] transition hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-primary)]"
                  >
                    <Plus size={12} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {selectedScene.blocks.map((block, index) => (
              <div
                key={block.id}
                className={`rounded-[26px] border p-4 transition ${
                  block.id === selectedBlockId
                    ? "border-[var(--app-border-strong)] bg-[var(--app-panel-soft)]"
                    : "border-[var(--app-border)] bg-[var(--app-panel-muted)]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-text-secondary)]">
                      {block.type === "action" ? <Theater size={16} /> : <FileText size={16} />}
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold">正文块 {index + 1}</div>
                      <div className="text-[11px] text-[var(--app-text-secondary)]">导出后保留标准格式。</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBlock(block.id)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--app-border)] text-[var(--app-text-secondary)] transition hover:border-red-400/40 hover:text-red-300"
                    title="删除正文块"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)]">
                  <label className="space-y-2">
                    <div className={titleClass}>Type</div>
                    <select
                      value={block.type}
                      onChange={(event) =>
                        patchScene(selectedEpisode.id, selectedScene.id, (scene) => ({
                          ...scene,
                          blocks: scene.blocks.map((item) =>
                            item.id === block.id
                              ? {
                                  ...item,
                                  type: event.target.value as BlockType,
                                  qualifier:
                                    event.target.value === "os"
                                      ? item.qualifier || "OS"
                                      : event.target.value === "vo"
                                      ? item.qualifier || "VO"
                                      : "",
                                }
                              : item
                          ),
                        }))
                      }
                      className="w-full rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3 text-[13px] outline-none transition focus:border-[var(--app-border-strong)]"
                    >
                      {BLOCK_TYPE_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {block.type !== "action" ? (
                    <label className="space-y-2">
                      <div className={titleClass}>Speaker</div>
                      <input
                        value={block.speaker || ""}
                        onChange={(event) =>
                          patchScene(selectedEpisode.id, selectedScene.id, (scene) => ({
                            ...scene,
                            blocks: scene.blocks.map((item) =>
                              item.id === block.id ? { ...item, speaker: event.target.value } : item
                            ),
                          }))
                        }
                        className="w-full rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3 text-[13px] outline-none transition focus:border-[var(--app-border-strong)]"
                        onFocus={() => setSelectedBlockId(block.id)}
                      />
                      {knownCharacters.length ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {knownCharacters.map((character) => (
                            <button
                              key={character.id}
                              type="button"
                              onClick={() => assignSpeaker(block.id, character.name)}
                              className="text-mention"
                              data-kind="character"
                              data-status="match"
                              data-tooltip={buildCharacterDetail(character) || undefined}
                            >
                              @{character.name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </label>
                  ) : (
                    <div className="hidden md:block" />
                  )}

                  {block.type === "os" || block.type === "vo" ? (
                    <label className="space-y-2">
                      <div className={titleClass}>Qualifier</div>
                      <input
                        value={block.qualifier || ""}
                        onChange={(event) =>
                          patchScene(selectedEpisode.id, selectedScene.id, (scene) => ({
                            ...scene,
                            blocks: scene.blocks.map((item) =>
                              item.id === block.id ? { ...item, qualifier: event.target.value } : item
                            ),
                          }))
                        }
                        className="w-full rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3 text-[13px] outline-none transition focus:border-[var(--app-border-strong)]"
                        onFocus={() => setSelectedBlockId(block.id)}
                      />
                    </label>
                  ) : (
                    <div className="hidden md:block" />
                  )}
                </div>

                <label className="mt-3 block space-y-2">
                  <div className={titleClass}>Content</div>
                  <textarea
                    value={block.content}
                    onChange={(event) =>
                      patchScene(selectedEpisode.id, selectedScene.id, (scene) => ({
                        ...scene,
                        blocks: scene.blocks.map((item) =>
                          item.id === block.id ? { ...item, content: event.target.value } : item
                        ),
                      }))
                    }
                    rows={4}
                    className="w-full rounded-[22px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3 text-[13px] leading-6 outline-none transition focus:border-[var(--app-border-strong)]"
                    onFocus={() => setSelectedBlockId(block.id)}
                  />
                  {knownCharacters.length ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {knownCharacters.map((character) => (
                        <button
                          key={character.id}
                          type="button"
                          onClick={() => insertCharacterMention(block.id, character.name)}
                          className="text-mention"
                          data-kind="character"
                          data-status="match"
                          data-tooltip={buildCharacterDetail(character) || undefined}
                        >
                          @{character.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </label>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-[28px] border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(250,204,21,0.18),rgba(250,204,21,0.06))] text-yellow-200">
                <BookOpen size={18} />
              </div>
              <div>
                <div className={titleClass}>Scene Preview</div>
                <div className="mt-1 text-[12px] text-[var(--app-text-secondary)]">当前场导出的标准格式。</div>
              </div>
            </div>
            <div className="mt-4 max-h-[280px] overflow-auto whitespace-pre-wrap rounded-[22px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-4 text-[12px] leading-7 text-[var(--app-text-primary)]">
              {renderBoundText(selectedScenePreview)}
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4">
            <div className={titleClass}>Parser Preview</div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="rounded-[20px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-text-secondary)]">Episodes</div>
                <div className="mt-1 text-[18px] font-semibold">{parserPreview.length}</div>
              </div>
              <div className="rounded-[20px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-text-secondary)]">Scenes</div>
                <div className="mt-1 text-[18px] font-semibold">
                  {parserPreview.reduce((sum, episode) => sum + (episode.scenes?.length || 0), 0)}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-[22px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-secondary)]">
                <Sparkles size={13} />
                Format Check
              </div>
              {parserIssues.length ? (
                <div className="space-y-2 text-[12px] leading-6 text-[var(--app-text-secondary)]">
                  {parserIssues.slice(0, 6).map((issue, index) => (
                    <div key={`${issue}-${index}`}>• {issue}</div>
                  ))}
                </div>
              ) : (
                <div className="text-[12px] leading-6 text-emerald-200">
                  当前结构可以稳定导出为现有解析器可识别的标准剧本格式。
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4">
            <div className={titleClass}>Whole Episode Export</div>
            <div className="mt-2 text-[12px] text-[var(--app-text-secondary)]">
              写回项目时会用完整导出文本替换 `rawScript`，并重新生成 `episodes`。
            </div>
            <div className="mt-4 max-h-[320px] overflow-auto whitespace-pre-wrap rounded-[22px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-4 text-[12px] leading-7 text-[var(--app-text-primary)]">
              {renderBoundText(exportEpisode(selectedEpisode))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
