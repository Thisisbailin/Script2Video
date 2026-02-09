import type { Character, Location, ProjectData } from "../../../types";
import { createStableId, ensureStableId } from "../../../utils/id";

type UpsertResult = { next: ProjectData; result: any };
type ReadResult = { result: any };

const hasKey = (obj: any, key: string) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const mergeCharacterForms = (
  existingForms: any[],
  incomingForms: any[] | undefined,
  mode: "merge" | "replace",
  formsToDelete: string[]
) => {
  if (!Array.isArray(existingForms)) existingForms = [];
  const deleteSet = new Set(formsToDelete || []);
  if (!Array.isArray(incomingForms)) {
    return existingForms.filter((form) => !deleteSet.has(form.id));
  }

  const normalizedIncoming = incomingForms.map((form) => ({
    ...form,
    id: ensureStableId(form?.id, "form"),
  }));

  if (mode === "replace") {
    const next = normalizedIncoming.map((form) => ({
      id: form.id,
      formName: form.formName || "默认",
      episodeRange: form.episodeRange || "",
      description: form.description || "",
      visualTags: form.visualTags || "",
      identityOrState: form.identityOrState,
      hair: form.hair,
      face: form.face,
      body: form.body,
      costume: form.costume,
      accessories: form.accessories,
      props: form.props,
      materialPalette: form.materialPalette,
      poses: form.poses,
      expressions: form.expressions,
      lightingOrPalette: form.lightingOrPalette,
      turnaroundNeeded: form.turnaroundNeeded,
      deliverables: form.deliverables,
      designRationale: form.designRationale,
      styleRef: form.styleRef,
      genPrompts: form.genPrompts,
    }));
    return next.filter((form) => !deleteSet.has(form.id));
  }

  const nextForms = existingForms.map((form) => ({ ...form }));
  const indexById = new Map(nextForms.map((form, idx) => [form.id, idx]));
  const additions: any[] = [];

  normalizedIncoming.forEach((incoming) => {
    const idx = indexById.get(incoming.id);
    if (idx !== undefined) {
      const current = nextForms[idx];
      const updated = { ...current };
      if (hasKey(incoming, "formName")) updated.formName = incoming.formName;
      if (hasKey(incoming, "episodeRange")) updated.episodeRange = incoming.episodeRange;
      if (hasKey(incoming, "description")) updated.description = incoming.description;
      if (hasKey(incoming, "visualTags")) updated.visualTags = incoming.visualTags;
      if (hasKey(incoming, "identityOrState")) updated.identityOrState = incoming.identityOrState;
      if (hasKey(incoming, "hair")) updated.hair = incoming.hair;
      if (hasKey(incoming, "face")) updated.face = incoming.face;
      if (hasKey(incoming, "body")) updated.body = incoming.body;
      if (hasKey(incoming, "costume")) updated.costume = incoming.costume;
      if (hasKey(incoming, "accessories")) updated.accessories = incoming.accessories;
      if (hasKey(incoming, "props")) updated.props = incoming.props;
      if (hasKey(incoming, "materialPalette")) updated.materialPalette = incoming.materialPalette;
      if (hasKey(incoming, "poses")) updated.poses = incoming.poses;
      if (hasKey(incoming, "expressions")) updated.expressions = incoming.expressions;
      if (hasKey(incoming, "lightingOrPalette")) updated.lightingOrPalette = incoming.lightingOrPalette;
      if (hasKey(incoming, "turnaroundNeeded")) updated.turnaroundNeeded = incoming.turnaroundNeeded;
      if (hasKey(incoming, "deliverables")) updated.deliverables = incoming.deliverables;
      if (hasKey(incoming, "designRationale")) updated.designRationale = incoming.designRationale;
      if (hasKey(incoming, "styleRef")) updated.styleRef = incoming.styleRef;
      if (hasKey(incoming, "genPrompts")) updated.genPrompts = incoming.genPrompts;
      nextForms[idx] = updated;
      return;
    }
    additions.push({
      id: incoming.id,
      formName: incoming.formName || "默认",
      episodeRange: incoming.episodeRange || "",
      description: incoming.description || "",
      visualTags: incoming.visualTags || "",
      identityOrState: incoming.identityOrState,
      hair: incoming.hair,
      face: incoming.face,
      body: incoming.body,
      costume: incoming.costume,
      accessories: incoming.accessories,
      props: incoming.props,
      materialPalette: incoming.materialPalette,
      poses: incoming.poses,
      expressions: incoming.expressions,
      lightingOrPalette: incoming.lightingOrPalette,
      turnaroundNeeded: incoming.turnaroundNeeded,
      deliverables: incoming.deliverables,
      designRationale: incoming.designRationale,
      styleRef: incoming.styleRef,
      genPrompts: incoming.genPrompts,
    });
  });

  return [...nextForms, ...additions].filter((form) => !deleteSet.has(form.id));
};

const mergeLocationZones = (
  existingZones: any[],
  incomingZones: any[] | undefined,
  mode: "merge" | "replace",
  zonesToDelete: string[]
) => {
  if (!Array.isArray(existingZones)) existingZones = [];
  const deleteSet = new Set(zonesToDelete || []);
  if (!Array.isArray(incomingZones)) {
    return existingZones.filter((zone) => !deleteSet.has(zone.id));
  }

  const normalizedIncoming = incomingZones.map((zone) => ({
    ...zone,
    id: ensureStableId(zone?.id, "zone"),
  }));

  if (mode === "replace") {
    const next = normalizedIncoming.map((zone) => ({
      id: zone.id,
      name: zone.name || "默认",
      kind: zone.kind || "unspecified",
      episodeRange: zone.episodeRange || "",
      layoutNotes: zone.layoutNotes || "",
      keyProps: zone.keyProps || "",
      lightingWeather: zone.lightingWeather || "",
      materialPalette: zone.materialPalette || "",
      designRationale: zone.designRationale,
      deliverables: zone.deliverables,
      genPrompts: zone.genPrompts,
    }));
    return next.filter((zone) => !deleteSet.has(zone.id));
  }

  const nextZones = existingZones.map((zone) => ({ ...zone }));
  const indexById = new Map(nextZones.map((zone, idx) => [zone.id, idx]));
  const additions: any[] = [];

  normalizedIncoming.forEach((incoming) => {
    const idx = indexById.get(incoming.id);
    if (idx !== undefined) {
      const current = nextZones[idx];
      const updated = { ...current };
      if (hasKey(incoming, "name")) updated.name = incoming.name;
      if (hasKey(incoming, "kind")) updated.kind = incoming.kind;
      if (hasKey(incoming, "episodeRange")) updated.episodeRange = incoming.episodeRange;
      if (hasKey(incoming, "layoutNotes")) updated.layoutNotes = incoming.layoutNotes;
      if (hasKey(incoming, "keyProps")) updated.keyProps = incoming.keyProps;
      if (hasKey(incoming, "lightingWeather")) updated.lightingWeather = incoming.lightingWeather;
      if (hasKey(incoming, "materialPalette")) updated.materialPalette = incoming.materialPalette;
      if (hasKey(incoming, "designRationale")) updated.designRationale = incoming.designRationale;
      if (hasKey(incoming, "deliverables")) updated.deliverables = incoming.deliverables;
      if (hasKey(incoming, "genPrompts")) updated.genPrompts = incoming.genPrompts;
      nextZones[idx] = updated;
      return;
    }
    additions.push({
      id: incoming.id,
      name: incoming.name || "默认",
      kind: incoming.kind || "unspecified",
      episodeRange: incoming.episodeRange || "",
      layoutNotes: incoming.layoutNotes || "",
      keyProps: incoming.keyProps || "",
      lightingWeather: incoming.lightingWeather || "",
      materialPalette: incoming.materialPalette || "",
      designRationale: incoming.designRationale,
      deliverables: incoming.deliverables,
      genPrompts: incoming.genPrompts,
    });
  });

  return [...nextZones, ...additions].filter((zone) => !deleteSet.has(zone.id));
};

const updateDesignAssetsForCharacter = (assets: any[], character: any, formsToDelete: string[]) => {
  const prefix = `${character.id}|`;
  const deleteSet = new Set(formsToDelete || []);
  const formNameById = new Map((character.forms || []).map((form: any) => [form.id, form.formName]));
  return (assets || [])
    .filter((asset) => {
      if (asset.category !== "form" || !asset.refId?.startsWith(prefix)) return true;
      const formId = asset.refId.slice(prefix.length);
      return !deleteSet.has(formId);
    })
    .map((asset) => {
      if (asset.category !== "form" || !asset.refId?.startsWith(prefix)) return asset;
      const formId = asset.refId.slice(prefix.length);
      const formName = formNameById.get(formId);
      if (!formName) return asset;
      return { ...asset, label: `${character.name} · ${formName}` };
    });
};

const updateDesignAssetsForLocation = (assets: any[], location: any, zonesToDelete: string[]) => {
  const prefix = `${location.id}|`;
  const deleteSet = new Set(zonesToDelete || []);
  const zoneNameById = new Map((location.zones || []).map((zone: any) => [zone.id, zone.name]));
  return (assets || [])
    .filter((asset) => {
      if (asset.category !== "zone" || !asset.refId?.startsWith(prefix)) return true;
      const zoneId = asset.refId.slice(prefix.length);
      return !deleteSet.has(zoneId);
    })
    .map((asset) => {
      if (asset.category !== "zone" || !asset.refId?.startsWith(prefix)) return asset;
      const zoneId = asset.refId.slice(prefix.length);
      const zoneName = zoneNameById.get(zoneId);
      if (!zoneName) return asset;
      return { ...asset, label: `${location.name} · ${zoneName}` };
    });
};

export const upsertCharacter = (prev: ProjectData, args: any): UpsertResult => {
  const input = args?.character || {};
  const mergeStrategy = args?.mergeStrategy === "replace" ? "replace" : "patch";
  const formsMode = args?.formsMode === "replace" ? "replace" : "merge";
  const formsToDelete = Array.isArray(args?.formsToDelete) ? args.formsToDelete : [];
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const chars = [...(prev.context.characters || [])];
  let matchIndex = -1;
  if (input.id) {
    matchIndex = chars.findIndex((c) => c.id === input.id);
  }
  if (matchIndex < 0 && name) {
    matchIndex = chars.findIndex((c) => c.name === name);
  }
  const existing = matchIndex >= 0 ? chars[matchIndex] : null;
  const id = input.id || existing?.id || createStableId("char");

  let next: Character = existing
    ? { ...existing }
    : {
        id,
        name: name || "",
        role: "",
        isMain: false,
        bio: "",
        forms: [],
      };

  if (mergeStrategy === "replace") {
    next = {
      id,
      name: name || existing?.name || "",
      role: "",
      isMain: false,
      bio: "",
      forms: Array.isArray(existing?.forms) ? existing?.forms : [],
      assetPriority: existing?.assetPriority,
      archetype: existing?.archetype,
      episodeUsage: existing?.episodeUsage,
      tags: existing?.tags,
      appearanceCount: existing?.appearanceCount,
    };
  }

  if (hasKey(input, "name")) next.name = input.name;
  if (hasKey(input, "role")) next.role = input.role;
  if (hasKey(input, "isMain")) next.isMain = input.isMain;
  if (hasKey(input, "bio")) next.bio = input.bio;
  if (hasKey(input, "assetPriority")) next.assetPriority = input.assetPriority;
  if (hasKey(input, "archetype")) next.archetype = input.archetype;
  if (hasKey(input, "episodeUsage")) next.episodeUsage = input.episodeUsage;
  if (hasKey(input, "tags")) next.tags = input.tags;

  const hasIncomingForms = Array.isArray(input.forms);
  if (hasIncomingForms || formsToDelete.length > 0) {
    next.forms = mergeCharacterForms(
      next.forms || [],
      hasIncomingForms ? input.forms : undefined,
      formsMode,
      formsToDelete
    );
  }

  const designAssets = updateDesignAssetsForCharacter(prev.designAssets || [], next, formsToDelete);
  const updatedChars = [...chars];
  if (existing && matchIndex >= 0) {
    updatedChars[matchIndex] = next;
  } else {
    updatedChars.push(next);
  }

  return {
    next: {
      ...prev,
      context: { ...prev.context, characters: updatedChars },
      designAssets,
    },
    result: {
      kind: "character",
      action: existing ? "updated" : "created",
      id: next.id,
      name: next.name,
      formsCount: (next.forms || []).length,
    },
  };
};

const toNumber = (value: any): number | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  if (!raw) return undefined;
  const match = raw.match(/\d+/);
  if (!match) return undefined;
  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const clipText = (text: string, maxChars: number) => {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}...`;
};

const toLower = (value: string) => value.toLowerCase();

const buildSnippet = (text: string, query: string, radius = 120) => {
  if (!text || !query) return clipText(text, radius * 2);
  const lowerText = toLower(text);
  const lowerQuery = toLower(query);
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return clipText(text, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";
  return `${prefix}${text.slice(start, end)}${suffix}`;
};

const normalizeSceneId = (value: any, episodeId?: number) => {
  if (value === null || value === undefined) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  if (raw.includes("-")) return raw;
  if (episodeId) return `${episodeId}-${raw}`;
  return raw;
};

const pickEpisodeByTitle = (episodes: any[], title: string) => {
  if (!title) return undefined;
  const normalized = title.trim().toLowerCase();
  if (!normalized) return undefined;
  return episodes.find((ep) => (ep.title || "").toLowerCase().includes(normalized));
};

const summarizeCharacters = (characters: Character[], maxChars: number) =>
  (characters || []).map((c) => ({
    id: c.id,
    name: c.name,
    role: c.role,
    isMain: c.isMain,
    bio: clipText(c.bio || "", Math.max(120, Math.min(maxChars, 400))),
    episodeUsage: c.episodeUsage,
    tags: c.tags,
  }));

const summarizeLocations = (locations: Location[], maxChars: number) =>
  (locations || []).map((loc) => ({
    id: loc.id,
    name: loc.name,
    type: loc.type,
    description: clipText(loc.description || "", Math.max(120, Math.min(maxChars, 400))),
    visuals: clipText(loc.visuals || "", Math.max(120, Math.min(maxChars, 400))),
    episodeUsage: loc.episodeUsage,
  }));

export const readScriptData = (data: ProjectData, args: any): ReadResult => {
  const episodes = data.episodes || [];
  const query = typeof args?.query === "string" ? args.query.trim() : "";
  const episodeId = toNumber(args?.episodeId ?? args?.episode ?? args?.episodeNumber);
  const episodeTitle = typeof args?.episodeTitle === "string" ? args.episodeTitle.trim() : "";
  const sceneIndex = toNumber(args?.sceneIndex ?? args?.sceneNumber);
  const sceneId = normalizeSceneId(args?.sceneId ?? args?.scene, episodeId);
  const maxChars = Math.max(200, Math.min(4000, toNumber(args?.maxChars) || 1200));
  const maxMatches = Math.max(1, Math.min(20, toNumber(args?.maxMatches) || 5));
  const includeList = Array.isArray(args?.include) ? args.include : [];
  const include = new Set(includeList.map((item: any) => String(item)));

  if (!include.size) {
    if (sceneId || sceneIndex) {
      include.add("sceneContent");
      include.add("episodeSummary");
      include.add("projectSummary");
    } else if (episodeId || episodeTitle) {
      include.add("episodeContent");
      include.add("sceneList");
      include.add("episodeSummary");
    } else if (query) {
      include.add("matches");
      include.add("projectSummary");
    } else {
      include.add("projectSummary");
    }
  }

  let episode = episodeId ? episodes.find((ep) => ep.id === episodeId) : undefined;
  if (!episode && episodeTitle) {
    episode = pickEpisodeByTitle(episodes, episodeTitle);
  }

  let scene = undefined;
  if (episode) {
    if (sceneId) {
      scene = (episode.scenes || []).find((sc) => sc.id === sceneId);
    }
    if (!scene && sceneIndex) {
      const idx = sceneIndex - 1;
      if (idx >= 0 && idx < (episode.scenes || []).length) {
        scene = episode.scenes[idx];
      }
    }
  } else if (sceneId) {
    for (const ep of episodes) {
      const found = (ep.scenes || []).find((sc) => sc.id === sceneId);
      if (found) {
        episode = ep;
        scene = found;
        break;
      }
    }
  }

  const result: any = {
    request: {
      episodeId: episodeId ?? null,
      episodeTitle: episodeTitle || null,
      sceneId: sceneId ?? null,
      sceneIndex: sceneIndex ?? null,
      query: query || null,
    },
    resolved: {
      episode: episode ? { id: episode.id, title: episode.title } : null,
      scene: scene ? { id: scene.id, title: scene.title } : null,
    },
    data: {},
    warnings: [] as string[],
  };

  if (include.has("episodeContent") && episode?.content) {
    result.data.episodeContent = clipText(episode.content, maxChars);
  }
  if (include.has("sceneContent") && scene?.content) {
    result.data.sceneContent = clipText(scene.content, maxChars);
  }
  if (include.has("sceneList") && episode) {
    result.data.sceneList = (episode.scenes || []).map((sc) => ({
      id: sc.id,
      title: sc.title,
      location: sc.location,
      timeOfDay: sc.timeOfDay,
    }));
  }

  if (include.has("projectSummary") && data.context?.projectSummary) {
    result.data.projectSummary = clipText(data.context.projectSummary, maxChars);
  }
  if (include.has("episodeSummary") && episode && data.context?.episodeSummaries) {
    const summary = data.context.episodeSummaries.find((s) => s.episodeId === episode.id);
    if (summary?.summary) {
      result.data.episodeSummary = clipText(summary.summary, maxChars);
    }
  }

  if (include.has("characters") && data.context?.characters) {
    result.data.characters = summarizeCharacters(data.context.characters, maxChars);
  }
  if (include.has("locations") && data.context?.locations) {
    result.data.locations = summarizeLocations(data.context.locations, maxChars);
  }
  if (include.has("rawScript") && data.rawScript) {
    result.data.rawScript = clipText(data.rawScript, maxChars);
  }

  if (include.has("matches") && query) {
    const matches: any[] = [];
    const lowerQuery = toLower(query);
    for (const ep of episodes) {
      if (matches.length >= maxMatches) break;
      const epContent = ep.content || "";
      if (epContent && toLower(epContent).includes(lowerQuery)) {
        matches.push({
          scope: "episode",
          episodeId: ep.id,
          episodeTitle: ep.title,
          snippet: buildSnippet(epContent, query),
        });
        if (matches.length >= maxMatches) break;
      }
      for (const sc of ep.scenes || []) {
        if (matches.length >= maxMatches) break;
        const scContent = sc.content || "";
        const scTitle = sc.title || "";
        if (
          (scContent && toLower(scContent).includes(lowerQuery)) ||
          (scTitle && toLower(scTitle).includes(lowerQuery))
        ) {
          matches.push({
            scope: "scene",
            episodeId: ep.id,
            episodeTitle: ep.title,
            sceneId: sc.id,
            sceneTitle: sc.title,
            snippet: buildSnippet(scContent || scTitle, query),
          });
        }
      }
    }
    result.data.matches = matches;
  }

  if (!episode && (episodeId || episodeTitle)) {
    result.warnings.push("episode_not_found");
  }
  if (episode && sceneId && !scene) {
    result.warnings.push("scene_not_found");
  }
  if (!query && !episode && !scene) {
    result.warnings.push("no_target_specified");
  }

  return { result };
};

export const upsertLocation = (prev: ProjectData, args: any): UpsertResult => {
  const input = args?.location || {};
  const mergeStrategy = args?.mergeStrategy === "replace" ? "replace" : "patch";
  const zonesMode = args?.zonesMode === "replace" ? "replace" : "merge";
  const zonesToDelete = Array.isArray(args?.zonesToDelete) ? args.zonesToDelete : [];
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const locations = [...(prev.context.locations || [])];
  let matchIndex = -1;
  if (input.id) {
    matchIndex = locations.findIndex((l) => l.id === input.id);
  }
  if (matchIndex < 0 && name) {
    matchIndex = locations.findIndex((l) => l.name === name);
  }
  const existing = matchIndex >= 0 ? locations[matchIndex] : null;
  const id = input.id || existing?.id || createStableId("loc");

  let next: Location = existing
    ? { ...existing }
    : {
        id,
        name: name || "",
        type: "secondary",
        description: "",
        visuals: "",
        zones: [],
      };

  if (mergeStrategy === "replace") {
    next = {
      id,
      name: name || existing?.name || "",
      type: existing?.type || "secondary",
      description: "",
      visuals: "",
      zones: Array.isArray(existing?.zones) ? existing?.zones : [],
      assetPriority: existing?.assetPriority,
      episodeUsage: existing?.episodeUsage,
    };
  }

  if (hasKey(input, "name")) next.name = input.name;
  if (hasKey(input, "type") && (input.type === "core" || input.type === "secondary")) next.type = input.type;
  if (hasKey(input, "description")) next.description = input.description;
  if (hasKey(input, "visuals")) next.visuals = input.visuals;
  if (hasKey(input, "assetPriority")) next.assetPriority = input.assetPriority;
  if (hasKey(input, "episodeUsage")) next.episodeUsage = input.episodeUsage;

  const hasIncomingZones = Array.isArray(input.zones);
  if (hasIncomingZones || zonesToDelete.length > 0) {
    next.zones = mergeLocationZones(
      next.zones || [],
      hasIncomingZones ? input.zones : undefined,
      zonesMode,
      zonesToDelete
    );
  }

  const designAssets = updateDesignAssetsForLocation(prev.designAssets || [], next, zonesToDelete);
  const updatedLocs = [...locations];
  if (existing && matchIndex >= 0) {
    updatedLocs[matchIndex] = next;
  } else {
    updatedLocs.push(next);
  }

  return {
    next: {
      ...prev,
      context: { ...prev.context, locations: updatedLocs },
      designAssets,
    },
    result: {
      kind: "location",
      action: existing ? "updated" : "created",
      id: next.id,
      name: next.name,
      zonesCount: (next.zones || []).length,
    },
  };
};
