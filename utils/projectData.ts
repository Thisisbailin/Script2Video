import { Character, CharacterForm, DesignAssetItem, Episode, Location, LocationZone, ProjectContext, ProjectData, Shot } from "../types";
import { ensureStableId } from "./id";
import { INITIAL_PROJECT_DATA } from "../constants";

const stripConflictMarkers = (value: string) => {
  const cleaned = value
    .replace(/^[ \t]*<<<REMOTE VERSION>>>[ \t]*\n?/gm, "")
    .replace(/^[ \t]*<<<LOCAL VERSION>>>[ \t]*\n?/gm, "");
  return cleaned.replace(/\n{3,}/g, "\n\n");
};

const sanitizeValue = (value: unknown): unknown => {
  if (typeof value === "string") return stripConflictMarkers(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeValue(entry)])
    );
  }
  return value;
};

const toSafeString = (value: unknown, fallback = "") => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const toOptionalString = (value: unknown) => (typeof value === "string" ? value : undefined);

const toOptionalNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const num = Number(trimmed);
    if (Number.isFinite(num)) return num;
  }
  return undefined;
};

export const normalizeVideoParams = (params?: Shot["videoParams"]) => {
  if (!params) return undefined;
  const { inputImage, ...rest } = params;
  return rest;
};

const normalizeShot = (shot: any): Shot => {
  if (!shot || typeof shot !== "object") return shot as Shot;
  return {
    ...shot,
    id: toSafeString(shot.id),
    duration: toSafeString(shot.duration),
    shotType: toSafeString(shot.shotType),
    movement: toSafeString(shot.movement),
    description: toSafeString(shot.description),
    dialogue: toSafeString(shot.dialogue),
    soraPrompt: toSafeString(shot.soraPrompt),
    difficulty: typeof shot.difficulty === "number" ? shot.difficulty : undefined,
    finalVideoPrompt: toOptionalString(shot.finalVideoPrompt),
    videoStatus: toSafeString(shot.videoStatus),
    videoParams: normalizeVideoParams(shot.videoParams),
    videoUrl: toOptionalString(shot.videoUrl),
    videoId: toOptionalString(shot.videoId),
    videoErrorMsg: toOptionalString(shot.videoErrorMsg)
  };
};

const normalizeEpisode = (episode: any): Episode => {
  if (!episode || typeof episode !== "object") return episode as Episode;
  const shots = Array.isArray(episode.shots) ? episode.shots.map(normalizeShot) : [];
  return {
    ...episode,
    title: toSafeString(episode.title),
    content: toSafeString(episode.content),
    summary: toOptionalString(episode.summary),
    shots
  };
};

const normalizeCharacterForm = (form: any): CharacterForm => {
  if (!form || typeof form !== "object") {
    return {
      id: ensureStableId(undefined, "form"),
      formName: "",
      episodeRange: "",
      description: "",
      visualTags: ""
    };
  }
  return {
    ...form,
    id: ensureStableId(form.id, "form"),
    formName: toSafeString(form.formName),
    episodeRange: toSafeString(form.episodeRange),
    description: toSafeString(form.description),
    visualTags: toSafeString(form.visualTags),
    identityOrState: toOptionalString(form.identityOrState),
    hair: toOptionalString(form.hair),
    face: toOptionalString(form.face),
    body: toOptionalString(form.body),
    costume: toOptionalString(form.costume),
    accessories: toOptionalString(form.accessories),
    props: toOptionalString(form.props),
    materialPalette: toOptionalString(form.materialPalette),
    poses: toOptionalString(form.poses),
    expressions: toOptionalString(form.expressions),
    lightingOrPalette: toOptionalString(form.lightingOrPalette),
    turnaroundNeeded: typeof form.turnaroundNeeded === "boolean" ? form.turnaroundNeeded : undefined,
    deliverables: toOptionalString(form.deliverables),
    designRationale: toOptionalString(form.designRationale),
    styleRef: toOptionalString(form.styleRef),
    genPrompts: toOptionalString(form.genPrompts)
  };
};

const normalizeCharacter = (character: any): Character => {
  if (!character || typeof character !== "object") {
    return {
      id: "",
      name: "",
      role: "",
      isMain: false,
      bio: "",
      forms: []
    };
  }
  const forms = Array.isArray(character.forms)
    ? character.forms.map(normalizeCharacterForm)
    : [];
  return {
    ...character,
    id: toSafeString(character.id || character.name),
    name: toSafeString(character.name),
    role: toSafeString(character.role),
    isMain: typeof character.isMain === "boolean" ? character.isMain : false,
    bio: toSafeString(character.bio),
    forms,
    assetPriority: character.assetPriority,
    archetype: toOptionalString(character.archetype),
    episodeUsage: toOptionalString(character.episodeUsage)
  };
};

const normalizeLocationZone = (zone: any): LocationZone => {
  if (!zone || typeof zone !== "object") {
    return {
      id: ensureStableId(undefined, "zone"),
      name: "",
      kind: "unspecified",
      episodeRange: "",
      layoutNotes: "",
      keyProps: "",
      lightingWeather: "",
      materialPalette: ""
    };
  }
  return {
    ...zone,
    id: ensureStableId(zone.id, "zone"),
    name: toSafeString(zone.name),
    kind:
      zone.kind === "interior" ||
      zone.kind === "exterior" ||
      zone.kind === "transition" ||
      zone.kind === "unspecified"
        ? zone.kind
        : "unspecified",
    episodeRange: toSafeString(zone.episodeRange),
    layoutNotes: toSafeString(zone.layoutNotes),
    keyProps: toSafeString(zone.keyProps),
    lightingWeather: toSafeString(zone.lightingWeather),
    materialPalette: toSafeString(zone.materialPalette),
    designRationale: toOptionalString(zone.designRationale),
    deliverables: toOptionalString(zone.deliverables),
    genPrompts: toOptionalString(zone.genPrompts)
  };
};

const normalizeLocation = (location: any): Location => {
  if (!location || typeof location !== "object") {
    return {
      id: "",
      name: "",
      type: "secondary",
      description: "",
      visuals: "",
      zones: []
    };
  }
  const zones = Array.isArray(location.zones)
    ? location.zones.map(normalizeLocationZone)
    : [];
  const type =
    location.type === "core" || location.type === "secondary"
      ? location.type
      : "secondary";
  return {
    ...location,
    id: toSafeString(location.id || location.name),
    name: toSafeString(location.name),
    type,
    description: toSafeString(location.description),
    visuals: toSafeString(location.visuals),
    assetPriority: location.assetPriority,
    episodeUsage: toOptionalString(location.episodeUsage),
    zones
  };
};

const remapDesignAssets = (assets: DesignAssetItem[], context: ProjectContext): DesignAssetItem[] => {
  if (!Array.isArray(assets) || assets.length === 0) return assets;
  const formRefMap = new Map<string, { refId: string; label: string }>();
  const zoneRefMap = new Map<string, { refId: string; label: string }>();

  (context.characters || []).forEach((char) => {
    (char.forms || []).forEach((form) => {
      const oldRefId = `${char.id}|${form.formName}`;
      const newRefId = `${char.id}|${form.id}`;
      if (oldRefId !== newRefId) {
        formRefMap.set(oldRefId, { refId: newRefId, label: `${char.name} · ${form.formName}` });
      }
    });
  });

  (context.locations || []).forEach((loc) => {
    (loc.zones || []).forEach((zone) => {
      const oldRefId = `${loc.id}|${zone.name}`;
      const newRefId = `${loc.id}|${zone.id}`;
      if (oldRefId !== newRefId) {
        zoneRefMap.set(oldRefId, { refId: newRefId, label: `${loc.name} · ${zone.name}` });
      }
    });
  });

  if (formRefMap.size === 0 && zoneRefMap.size === 0) return assets;

  return assets.map((asset) => {
    if (asset.category === "form") {
      const mapped = formRefMap.get(asset.refId);
      if (!mapped) return asset;
      return { ...asset, refId: mapped.refId, label: mapped.label };
    }
    if (asset.category === "zone") {
      const mapped = zoneRefMap.get(asset.refId);
      if (!mapped) return asset;
      return { ...asset, refId: mapped.refId, label: mapped.label };
    }
    return asset;
  });
};

export const normalizeProjectData = (data: any): ProjectData => {
  const base: ProjectData = {
    ...INITIAL_PROJECT_DATA,
    ...data,
    context: { ...INITIAL_PROJECT_DATA.context, ...(data?.context || {}) },
    designAssets: Array.isArray(data?.designAssets) ? data.designAssets : [],
    phase1Usage: { ...INITIAL_PROJECT_DATA.phase1Usage, ...(data?.phase1Usage || {}) },
    phase4Usage: data?.phase4Usage || INITIAL_PROJECT_DATA.phase4Usage,
    phase5Usage: data?.phase5Usage || INITIAL_PROJECT_DATA.phase5Usage,
    stats: { ...INITIAL_PROJECT_DATA.stats, ...(data?.stats || {}) }
  };
  base.episodes = Array.isArray(data?.episodes) ? data.episodes.map(normalizeEpisode) : [];
  base.context.characters = Array.isArray(base.context.characters)
    ? base.context.characters.map(normalizeCharacter)
    : [];
  base.context.locations = Array.isArray(base.context.locations)
    ? base.context.locations.map(normalizeLocation)
    : [];
  base.designAssets = remapDesignAssets(base.designAssets as DesignAssetItem[], base.context);
  base.shotGuide = data?.shotGuide || INITIAL_PROJECT_DATA.shotGuide;
  base.soraGuide = data?.soraGuide || INITIAL_PROJECT_DATA.soraGuide;
  base.globalStyleGuide = data?.globalStyleGuide || INITIAL_PROJECT_DATA.globalStyleGuide;
  base.rawScript = typeof data?.rawScript === "string" ? data.rawScript : "";
  base.fileName = typeof data?.fileName === "string" ? data.fileName : "";
  return sanitizeValue(base) as ProjectData;
};
