import { Character, CharacterForm, DesignAssetItem, Episode, Location, LocationZone, ProjectContext, ProjectData, Shot } from "../types";
import { ensureStableId, ensureTypedStableId } from "./id";
import { INITIAL_PROJECT_DATA } from "../constants";
import { sanitizeShot } from "./shotSchema";

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

const slugifyIdentityKey = (value: string, fallback: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s_/]+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || fallback;
};

const normalizeCharacterAliases = (character: any, name: string) => {
  const rawAliases = Array.isArray(character?.aliases) ? character.aliases : [];
  const seen = new Set<string>();
  const aliases = rawAliases
    .map((entry: any, index: number) => {
      const value = typeof entry === "string" ? entry.trim() : toSafeString(entry?.value).trim();
      if (!value) return null;
      const normalized = value.toLowerCase();
      if (seen.has(normalized)) return null;
      seen.add(normalized);
      return {
        id: ensureStableId(typeof entry === "object" ? entry?.id : undefined, "alias"),
        value,
        kind:
          entry?.kind === "primary" || entry?.kind === "alias" || entry?.kind === "title" || entry?.kind === "short" || entry?.kind === "legacy"
            ? entry.kind
            : index === 0
              ? "alias"
              : "alias",
        normalized,
      };
    })
    .filter(Boolean) as NonNullable<Character["aliases"]>;

  if (name.trim()) {
    const normalized = name.trim().toLowerCase();
    if (!seen.has(normalized)) {
      aliases.unshift({
        id: ensureStableId(undefined, "alias"),
        value: name.trim(),
        kind: "primary",
        normalized,
      });
    } else {
      const primary = aliases.find((item) => item.value.trim().toLowerCase() === normalized);
      if (primary) primary.kind = "primary";
    }
  }

  const legacyId = typeof character?.id === "string" ? character.id.trim() : "";
  if (legacyId && !legacyId.startsWith("char-") && legacyId.toLowerCase() !== name.trim().toLowerCase() && !seen.has(legacyId.toLowerCase())) {
    aliases.push({
      id: ensureStableId(undefined, "alias"),
      value: legacyId,
      kind: "legacy",
      normalized: legacyId.toLowerCase(),
    });
  }
  return aliases;
};

export const normalizeVideoParams = (params?: Shot["videoParams"]) => {
  if (!params) return undefined;
  const { inputImage, ...rest } = params;
  return rest;
};

const normalizeShot = (shot: any): Shot => {
  const { shot: normalized } = sanitizeShot(shot, {
    mode: "project",
    requireStructuredId: false,
    allowGeneratedIds: true,
  });
  return {
    ...normalized,
    finalVideoPrompt: toOptionalString(shot?.finalVideoPrompt),
    videoStatus: toOptionalString(shot?.videoStatus) as Shot["videoStatus"],
    videoParams: normalizeVideoParams(shot?.videoParams),
    videoUrl: toOptionalString(shot?.videoUrl),
    videoId: toOptionalString(shot?.videoId),
    videoErrorMsg: toOptionalString(shot?.videoErrorMsg),
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
    characterId: toOptionalString(form.characterId),
    key: toOptionalString(form.key),
    type:
      form.type === "default" ||
      form.type === "age" ||
      form.type === "costume" ||
      form.type === "identity" ||
      form.type === "state" ||
      form.type === "disguise" ||
      form.type === "battle" ||
      form.type === "special"
        ? form.type
        : undefined,
    isDefault: typeof form.isDefault === "boolean" ? form.isDefault : undefined,
    aliases: Array.isArray(form.aliases) ? form.aliases.map((item: any) => toSafeString(item)).filter(Boolean) : undefined,
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
  const name = toSafeString(character.name);
  const characterId = ensureTypedStableId(character.id, "char");
  const forms = Array.isArray(character.forms)
    ? character.forms.map(normalizeCharacterForm)
    : [];
  const normalizedForms = forms.map((form, index) => {
    const fallbackKey = index === 0 ? "default" : `form-${index + 1}`;
    return {
      ...form,
      characterId,
      key: form.key || slugifyIdentityKey(form.formName || "", fallbackKey),
      isDefault: typeof form.isDefault === "boolean" ? form.isDefault : index === 0,
    };
  });
  const aliases = normalizeCharacterAliases(character, name);
  const canonicalMention = aliases.find((item) => item.kind === "primary")?.value || name || characterId;
  const defaultFormId = normalizedForms.find((item) => item.isDefault)?.id || normalizedForms[0]?.id;
  return {
    ...character,
    id: characterId,
    slug: toOptionalString(character.slug) || slugifyIdentityKey(name, characterId),
    name,
    role: toSafeString(character.role),
    isMain: typeof character.isMain === "boolean" ? character.isMain : false,
    bio: toSafeString(character.bio),
    forms: normalizedForms,
    aliases,
    status:
      character.status === "draft" ||
      character.status === "verified" ||
      character.status === "locked" ||
      character.status === "archived"
        ? character.status
        : "draft",
    binding: {
      canonicalMention,
      defaultFormId,
      defaultVoiceScope:
        character.binding?.defaultVoiceScope === "form" || character.binding?.defaultVoiceScope === "character"
          ? character.binding.defaultVoiceScope
          : "character",
      mentionPolicy:
        character.binding?.mentionPolicy === "form-first" || character.binding?.mentionPolicy === "character-first"
          ? character.binding.mentionPolicy
          : "character-first",
    },
    version: typeof character.version === "number" && Number.isFinite(character.version) ? character.version : 1,
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
      const newRefId = `${char.id}|${form.id}`;
      const legacyRefIds = new Set<string>([
        `${char.id}|${form.formName}`,
        `${char.name}|${form.formName}`,
      ]);
      (char.aliases || []).forEach((alias) => legacyRefIds.add(`${alias.value}|${form.formName}`));
      legacyRefIds.forEach((oldRefId) => {
        if (oldRefId !== newRefId) {
          formRefMap.set(oldRefId, { refId: newRefId, label: `${char.name} · ${form.formName}` });
        }
      });
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
  base.storyboardGuide = data?.storyboardGuide || INITIAL_PROJECT_DATA.storyboardGuide;
  base.globalStyleGuide = data?.globalStyleGuide || INITIAL_PROJECT_DATA.globalStyleGuide;
  base.rawScript = typeof data?.rawScript === "string" ? data.rawScript : "";
  base.fileName = typeof data?.fileName === "string" ? data.fileName : "";
  return sanitizeValue(base) as ProjectData;
};
