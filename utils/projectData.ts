import {
  DesignAssetItem,
  Episode,
  ProjectContext,
  ProjectData,
  ProjectRoleIdentity,
  Shot,
} from "../types";
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

const sanitizeIdentityToken = (value: string, fallback = "normal") => {
  const normalized = value
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || fallback;
};

const buildMention = (familyName: string, givenName: string) =>
  `${sanitizeIdentityToken(familyName, "identity")}_${sanitizeIdentityToken(givenName, "normal")}`;

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
    shots,
  };
};

const normalizeAliases = (values: unknown[], seed: string[]) => {
  const seen = new Set<string>();
  const items = [...seed, ...values.map((item) => toSafeString(item).trim()).filter(Boolean)];
  return items
    .map((value) => value.trim())
    .filter((value) => {
      if (!value) return false;
      const normalized = value.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .map((value) => ({
      id: ensureStableId(undefined, "alias"),
      value,
      normalized: value.toLowerCase(),
    }));
};

const normalizeRoleIdentity = (role: any): ProjectRoleIdentity => {
  const familyName = toSafeString(role?.familyName || role?.name || role?.displayName || "身份");
  const givenName = sanitizeIdentityToken(toSafeString(role?.givenName || role?.title || "normal"), "normal");
  const mention = toSafeString(role?.mention).replace(/^@/, "") || buildMention(familyName, givenName);
  const kind = role?.kind === "scene" ? "scene" : "person";
  const tone = role?.tone === "sky" ? "sky" : "emerald";
  const aliases = normalizeAliases(Array.isArray(role?.aliases) ? role.aliases.map((item: any) => item?.value ?? item) : [], [
    familyName,
    `@${mention}`,
  ]);

  return {
    id: ensureTypedStableId(role?.id, "role"),
    familyId: toSafeString(role?.familyId || slugifyIdentityKey(familyName, "family")),
    familyName,
    givenName,
    displayName: toSafeString(role?.displayName || `@${mention}`),
    mention,
    slug: toOptionalString(role?.slug) || slugifyIdentityKey(mention, familyName),
    kind,
    tone,
    isMain: typeof role?.isMain === "boolean" ? role.isMain : undefined,
    isCore: typeof role?.isCore === "boolean" ? role.isCore : undefined,
    title: toOptionalString(role?.title) || givenName,
    summary: toSafeString(role?.summary || role?.role || role?.type || `${kind === "person" ? "人物" : "场景"}身份`),
    description: toSafeString(role?.description || role?.bio || role?.visuals),
    visualTags: toOptionalString(role?.visualTags),
    episodeUsage: toOptionalString(role?.episodeUsage),
    tags: Array.isArray(role?.tags) ? role.tags.map((item: any) => toSafeString(item)).filter(Boolean) : undefined,
    status:
      role?.status === "draft" ||
      role?.status === "verified" ||
      role?.status === "locked" ||
      role?.status === "archived"
        ? role.status
        : "draft",
    aliases,
    binding: {
      mention,
      aliases: aliases.map((item) => item.value),
    },
    voiceId: toOptionalString(role?.voiceId),
    voicePrompt: toOptionalString(role?.voicePrompt),
    previewAudioUrl: toOptionalString(role?.previewAudioUrl),
    designPrompt: toOptionalString(role?.designPrompt || role?.genPrompts),
    designNotes: toOptionalString(role?.designNotes || role?.designRationale),
    lightingPalette: toOptionalString(role?.lightingPalette || role?.lightingOrPalette || role?.lightingWeather),
    props: toOptionalString(role?.props || role?.keyProps),
    assetPriority:
      role?.assetPriority === "high" || role?.assetPriority === "medium" || role?.assetPriority === "low"
        ? role.assetPriority
        : undefined,
    avatarUrl: toOptionalString(role?.avatarUrl),
  };
};

const migrateLegacyCharacters = (characters: any[]): ProjectRoleIdentity[] =>
  characters.flatMap((character, index) => {
    const familyName = toSafeString(character?.name, `角色${index + 1}`);
    const familyId = `family-${slugifyIdentityKey(familyName, `character-${index + 1}`)}`;
    const forms = Array.isArray(character?.forms) && character.forms.length ? character.forms : [null];
    const aliases = Array.isArray(character?.aliases) ? character.aliases.map((item: any) => item?.value ?? item) : [];

    return forms.map((form: any, formIndex: number) => {
      const isDefault = !!form?.isDefault || formIndex === 0 || form?.key === "default";
      const givenName = isDefault
        ? "normal"
        : sanitizeIdentityToken(toSafeString(form?.key || form?.formName || `alt${formIndex + 1}`), `alt${formIndex + 1}`);
      const mention = buildMention(familyName, givenName);
      return normalizeRoleIdentity({
        id: undefined,
        familyId,
        familyName,
        givenName,
        displayName: `@${mention}`,
        mention,
        kind: "person",
        tone: "emerald",
        isMain: typeof character?.isMain === "boolean" ? character.isMain : false,
        isCore: typeof character?.isCore === "boolean" ? character.isCore : undefined,
        title: toOptionalString(form?.formName) || givenName,
        summary: toSafeString(character?.role || "人物身份"),
        description: toSafeString(form?.description || form?.visualTags || character?.bio),
        visualTags: toOptionalString(form?.visualTags),
        episodeUsage: toOptionalString(form?.episodeRange || character?.episodeUsage),
        tags: Array.isArray(character?.tags) ? character.tags : undefined,
        status: character?.status,
        aliases: [familyName, `@${mention}`, ...aliases],
        voiceId: toOptionalString(form?.voiceId || character?.voiceId),
        voicePrompt: toOptionalString(form?.voicePrompt || character?.voicePrompt),
        previewAudioUrl: toOptionalString(form?.previewAudioUrl || character?.previewAudioUrl),
        designPrompt: toOptionalString(form?.genPrompts),
        designNotes: toOptionalString(form?.designRationale),
        lightingPalette: toOptionalString(form?.lightingOrPalette),
        props: toOptionalString(form?.props),
        assetPriority: character?.assetPriority,
      });
    });
  });

const migrateLegacyLocations = (locations: any[]): ProjectRoleIdentity[] =>
  locations.flatMap((location, index) => {
    const familyName = toSafeString(location?.name, `场景${index + 1}`);
    const familyId = `family-${slugifyIdentityKey(familyName, `scene-${index + 1}`)}`;
    const zones = Array.isArray(location?.zones) && location.zones.length ? location.zones : [null];

    return zones.map((zone: any, zoneIndex: number) => {
      const givenName = sanitizeIdentityToken(toSafeString(zone?.name || (zoneIndex === 0 ? "normal" : `zone${zoneIndex + 1}`)), "normal");
      const mention = buildMention(familyName, givenName);
      return normalizeRoleIdentity({
        id: undefined,
        familyId,
        familyName,
        givenName,
        displayName: `@${mention}`,
        mention,
        kind: "scene",
        tone: "sky",
        title: toOptionalString(zone?.name) || givenName,
        summary: toSafeString(location?.type === "core" ? "核心场景身份" : "场景身份"),
        description: toSafeString(zone?.layoutNotes || zone?.lightingWeather || zone?.keyProps || location?.description || location?.visuals),
        visualTags: toOptionalString(zone?.materialPalette || location?.visuals),
        episodeUsage: toOptionalString(zone?.episodeRange || location?.episodeUsage),
        aliases: [familyName, `@${mention}`],
        designPrompt: toOptionalString(zone?.genPrompts),
        designNotes: toOptionalString(zone?.designRationale),
        lightingPalette: toOptionalString(zone?.lightingWeather),
        props: toOptionalString(zone?.keyProps),
        assetPriority: location?.assetPriority,
      });
    });
  });

const normalizeContext = (context: any): ProjectContext => {
  const explicitRoles = Array.isArray(context?.roles) ? context.roles.map(normalizeRoleIdentity) : [];
  if (explicitRoles.length > 0) {
    return {
      projectSummary: toSafeString(context?.projectSummary),
      episodeSummaries: Array.isArray(context?.episodeSummaries) ? context.episodeSummaries : [],
      roles: explicitRoles,
    };
  }

  const migratedRoles = [
    ...migrateLegacyCharacters(Array.isArray(context?.characters) ? context.characters : []),
    ...migrateLegacyLocations(Array.isArray(context?.locations) ? context.locations : []),
  ];
  return {
    projectSummary: toSafeString(context?.projectSummary),
    episodeSummaries: Array.isArray(context?.episodeSummaries) ? context.episodeSummaries : [],
    roles: migratedRoles,
  };
};

const remapDesignAssets = (assets: DesignAssetItem[], context: ProjectContext): DesignAssetItem[] => {
  if (!Array.isArray(assets) || assets.length === 0) return [];

  const mentionMap = new Map<string, { refId: string; label: string }>();
  context.roles.forEach((role) => {
    const label = role.displayName || `@${role.mention}`;
    mentionMap.set(role.id, { refId: role.id, label });
    mentionMap.set(role.mention, { refId: role.id, label });
    mentionMap.set(`@${role.mention}`, { refId: role.id, label });
    mentionMap.set(role.displayName, { refId: role.id, label });
  });

  return assets
    .map((asset) => {
      const mapped = mentionMap.get(asset.refId) || mentionMap.get(asset.label || "");
      if (asset.category === "identity") {
        return {
          ...asset,
          category: "identity" as const,
          refId: mapped?.refId || asset.refId,
          label: mapped?.label || asset.label,
        };
      }
      return {
        ...asset,
        category: "identity" as const,
        refId: mapped?.refId || asset.refId,
        label: mapped?.label || asset.label,
      };
    })
    .filter((asset) => !!asset.refId);
};

export const normalizeProjectData = (data: any): ProjectData => {
  const context = normalizeContext(data?.context || {});
  const base: ProjectData = {
    ...INITIAL_PROJECT_DATA,
    ...data,
    context,
    designAssets: Array.isArray(data?.designAssets) ? data.designAssets : [],
    phase1Usage: { ...INITIAL_PROJECT_DATA.phase1Usage, ...(data?.phase1Usage || {}) },
    phase4Usage: data?.phase4Usage || INITIAL_PROJECT_DATA.phase4Usage,
    phase5Usage: data?.phase5Usage || INITIAL_PROJECT_DATA.phase5Usage,
    stats: { ...INITIAL_PROJECT_DATA.stats, ...(data?.stats || {}) },
  };

  base.episodes = Array.isArray(data?.episodes) ? data.episodes.map(normalizeEpisode) : [];
  base.designAssets = remapDesignAssets(base.designAssets as DesignAssetItem[], context);
  base.shotGuide = data?.shotGuide || INITIAL_PROJECT_DATA.shotGuide;
  base.soraGuide = data?.soraGuide || INITIAL_PROJECT_DATA.soraGuide;
  base.storyboardGuide = data?.storyboardGuide || INITIAL_PROJECT_DATA.storyboardGuide;
  base.dramaGuide = data?.dramaGuide || INITIAL_PROJECT_DATA.dramaGuide;
  base.globalStyleGuide = data?.globalStyleGuide || INITIAL_PROJECT_DATA.globalStyleGuide;
  base.rawScript = typeof data?.rawScript === "string" ? data.rawScript : "";
  base.fileName = typeof data?.fileName === "string" ? data.fileName : "";
  return sanitizeValue(base) as ProjectData;
};
