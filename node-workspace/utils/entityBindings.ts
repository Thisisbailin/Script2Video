import type { Character, CharacterForm, Location, LocationZone } from "../../types";
import type { EntityBinding, TextNodeData } from "../types";
import { createStableId } from "../../utils/id";

export type MentionKind = "form" | "zone" | "character" | "unknown";

export type MentionTarget = {
  kind: Exclude<MentionKind, "unknown">;
  name: string;
  label: string;
  search: string;
  aliasValue?: string;
  characterId?: string;
  characterName?: string;
  formId?: string;
  formName?: string;
  locationId?: string;
  locationName?: string;
  zoneId?: string;
  summary?: string;
  detail?: string;
};

export const mentionPriority: Record<MentionKind, number> = {
  form: 0,
  character: 1,
  zone: 2,
  unknown: 3,
};

export const toSearch = (value: string) => value.toLowerCase().replace(/\s+/g, "");

const uniqStrings = (values: Array<string | undefined | null>) => {
  const seen = new Set<string>();
  return values
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => {
      if (!item) return false;
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const parseMentionTokens = (text: string) => {
  const regex = /@([\w\u4e00-\u9fa5\-\/]+)/g;
  const matches: Array<{ rawText: string; name: string; start: number; end: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text || ""))) {
    const rawText = match[0];
    matches.push({
      rawText,
      name: match[1],
      start: match.index,
      end: match.index + rawText.length,
    });
  }
  return matches;
};

export const buildFormDetail = (character: Character, form: CharacterForm) => {
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

export const buildCharacterDetail = (character: Character) => {
  const lines = [
    character?.name ? `角色：${character.name}` : "",
    character?.role ? `身份：${character.role}` : "",
    character?.bio ? character.bio : "",
  ].filter(Boolean);
  return lines.join("\n");
};

export const buildZoneDetail = (location: Location, zone: LocationZone) => {
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

export const buildMentionTargets = (characters: Character[], locations: Location[]) => {
  const formTargets: MentionTarget[] = characters.flatMap((character) =>
    (character.forms || []).flatMap((form) => {
      const aliases = uniqStrings([
        form.formName,
        ...(form.aliases || []),
        character.name && form.formName ? `${character.name}/${form.formName}` : "",
        character.name && form.formName ? `${character.name}-${form.formName}` : "",
      ]);
      return aliases.map((alias, index) => ({
        kind: "form" as const,
        name: alias,
        label: `${form.formName} · ${character.name}`,
        search: toSearch(
          [
            alias,
            form.formName,
            character.name,
            character.role,
            form.episodeRange,
            form.identityOrState,
            form.visualTags,
          ]
            .filter(Boolean)
            .join(" ")
        ),
        aliasValue: index === 0 ? undefined : alias,
        characterId: character.id,
        characterName: character.name,
        formId: form.id,
        formName: form.formName,
        summary: form.description,
        detail: buildFormDetail(character, form),
      }));
    })
  );

  const characterTargets: MentionTarget[] = characters.flatMap((character) => {
    const aliases = uniqStrings([character.name, ...(character.aliases || []).map((item) => item.value)]);
    return aliases.map((alias, index) => ({
      kind: "character" as const,
      name: alias,
      label: character.name,
      search: toSearch(
        [alias, character.name, character.role, character.bio, ...(character.tags || [])].filter(Boolean).join(" ")
      ),
      aliasValue: index === 0 ? undefined : alias,
      characterId: character.id,
      characterName: character.name,
      summary: character.bio,
      detail: buildCharacterDetail(character),
    }));
  });

  const zoneTargets: MentionTarget[] = locations.flatMap((location) =>
    (location.zones || []).flatMap((zone) => {
      const aliases = uniqStrings([zone.name]);
      return aliases.map((alias) => ({
        kind: "zone" as const,
        name: alias,
        label: location.name ? `${zone.name} · ${location.name}` : zone.name,
        search: toSearch(
          [alias, location.name, zone.episodeRange, zone.layoutNotes, zone.keyProps, zone.lightingWeather]
            .filter(Boolean)
            .join(" ")
        ),
        locationId: location.id,
        locationName: location.name,
        zoneId: zone.id,
        summary: zone.layoutNotes || zone.keyProps || zone.lightingWeather || "",
        detail: buildZoneDetail(location, zone),
      }));
    })
  );

  return {
    forms: formTargets,
    characters: characterTargets,
    zones: zoneTargets,
    all: [...formTargets, ...characterTargets, ...zoneTargets],
  };
};

export const buildMentionIndex = (targets: MentionTarget[]) => {
  const map = new Map<string, MentionTarget[]>();
  targets.forEach((item) => {
    const key = toSearch(item.name);
    const list = map.get(key) || [];
    list.push(item);
    map.set(key, list);
  });
  return map;
};

export const resolveMentionTarget = (name: string, mentionIndex: Map<string, MentionTarget[]>) => {
  const list = mentionIndex.get(toSearch(name)) || [];
  if (!list.length) return null;
  return list.slice().sort((a, b) => mentionPriority[a.kind] - mentionPriority[b.kind])[0];
};

export const computeMentionData = (
  text: string,
  mentionIndex: Map<string, MentionTarget[]>
): {
  atMentions: NonNullable<TextNodeData["atMentions"]>;
  entityBindings: EntityBinding[];
} => {
  const seen = new Set<string>();
  const atMentions: NonNullable<TextNodeData["atMentions"]> = [];
  const entityBindings: EntityBinding[] = [];

  parseMentionTokens(text).forEach((token) => {
    const hit = resolveMentionTarget(token.name, mentionIndex);
    const atKey = token.name.toLowerCase();
    if (!seen.has(atKey)) {
      seen.add(atKey);
      atMentions.push({
        name: token.name,
        status: hit ? "match" : "missing",
        kind: hit?.kind || "unknown",
        characterId: hit?.characterId,
        formName: hit?.formName,
        summary: hit?.summary,
        detail: hit?.detail,
        locationId: hit?.locationId,
        locationName: hit?.locationName,
        zoneId: hit?.zoneId,
      });
    }

    entityBindings.push({
      id: createStableId("binding"),
      rawText: token.rawText,
      status: hit ? "resolved" : "missing",
      entityType: hit?.kind || "unknown",
      entityId:
        hit?.kind === "character"
          ? hit.characterId
          : hit?.kind === "form"
            ? hit.formId
            : hit?.kind === "zone"
              ? hit.zoneId
              : undefined,
      characterId: hit?.characterId,
      formId: hit?.formId,
      formName: hit?.formName,
      aliasValue: hit?.aliasValue,
      summary: hit?.summary,
      detail: hit?.detail,
      locationId: hit?.locationId,
      locationName: hit?.locationName,
      zoneId: hit?.zoneId,
      start: token.start,
      end: token.end,
      resolutionSource: "auto",
      version: 1,
    });
  });

  return { atMentions, entityBindings };
};
