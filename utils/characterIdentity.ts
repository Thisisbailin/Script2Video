import type { Character, CharacterAlias, CharacterForm } from "../types";

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

export const getCharacterPrimaryAlias = (character?: Character | null): CharacterAlias | undefined =>
  (character?.aliases || []).find((item) => item.kind === "primary") || (character?.aliases || [])[0];

export const getCharacterMentionLabel = (character?: Character | null) =>
  getCharacterPrimaryAlias(character)?.value || character?.binding?.canonicalMention || character?.name || "";

export const getCharacterMentionAliases = (character?: Character | null) =>
  uniqStrings([
    character?.name,
    character?.binding?.canonicalMention,
    ...(character?.aliases || []).map((item) => item.value),
  ]);

export const getDefaultCharacterForm = (character?: Character | null): CharacterForm | undefined => {
  if (!character) return undefined;
  return (
    (character.binding?.defaultFormId
      ? (character.forms || []).find((form) => form.id === character.binding?.defaultFormId)
      : undefined) ||
    (character.forms || []).find((form) => form.isDefault) ||
    character.forms?.[0]
  );
};

export const getCharacterFormMention = (character?: Character | null, form?: CharacterForm | null) => {
  if (!character || !form) return "";
  const mention = getCharacterMentionLabel(character) || character.name;
  return mention && form.formName ? `${mention}/${form.formName}` : form.formName || mention;
};

export const getCharacterFormLabel = (character?: Character | null, form?: CharacterForm | null) => {
  if (!form) return "";
  if (!character) return form.formName || "未命名形态";
  return `${form.formName || "未命名形态"} · ${character.name || "角色"}`;
};
