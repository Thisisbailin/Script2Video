type ValidationResult = { ok: true } | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const PROJECT_PATCH_KEYS = new Set([
  "fileName",
  "rawScript",
  "episodes",
  "context",
  "contextUsage",
  "phase1Usage",
  "phase4Usage",
  "phase5Usage",
  "shotGuide",
  "soraGuide",
  "dramaGuide",
  "globalStyleGuide",
  "stats"
]);

export const validateProjectPayload = (data: unknown): ValidationResult => {
  if (!isRecord(data)) return { ok: false, error: "projectData is not an object" };
  const rawScript = (data as Record<string, unknown>).rawScript;
  if (rawScript !== undefined && !isString(rawScript)) {
    return { ok: false, error: "rawScript is not a string" };
  }

  const episodes = (data as Record<string, unknown>).episodes;
  if (!Array.isArray(episodes)) return { ok: false, error: "episodes is not an array" };

  for (let i = 0; i < episodes.length; i += 1) {
    const ep = episodes[i];
    if (!isRecord(ep)) return { ok: false, error: `episodes[${i}] is not an object` };
    if (!isNumber(ep.id)) return { ok: false, error: `episodes[${i}].id is not a number` };
    if (!isString(ep.title)) return { ok: false, error: `episodes[${i}].title is not a string` };
    if (!isString(ep.content)) return { ok: false, error: `episodes[${i}].content is not a string` };
    if (ep.status !== undefined && !isString(ep.status)) {
      return { ok: false, error: `episodes[${i}].status is not a string` };
    }
    if (!Array.isArray(ep.shots)) return { ok: false, error: `episodes[${i}].shots is not an array` };

    for (let j = 0; j < ep.shots.length; j += 1) {
      const shot = ep.shots[j];
      if (!isRecord(shot)) return { ok: false, error: `episodes[${i}].shots[${j}] is not an object` };
      const required = ["id", "duration", "shotType", "movement", "description", "dialogue", "soraPrompt"] as const;
      for (const key of required) {
        if (!isString(shot[key])) {
          return { ok: false, error: `episodes[${i}].shots[${j}].${key} is not a string` };
        }
      }
      if (shot.difficulty !== undefined && !isNumber(shot.difficulty)) {
        return { ok: false, error: `episodes[${i}].shots[${j}].difficulty is not a number` };
      }
    }
  }

  return { ok: true };
};

export const validateSecretsPayload = (secrets: unknown): ValidationResult => {
  if (!isRecord(secrets)) return { ok: false, error: "secrets is not an object" };
  const keys = ["textApiKey", "multiApiKey", "videoApiKey"] as const;
  for (const key of keys) {
    const value = secrets[key];
    if (value !== undefined && !isString(value)) {
      return { ok: false, error: `${key} is not a string` };
    }
  }
  return { ok: true };
};

export const validateProjectPatch = (patch: unknown): ValidationResult => {
  if (!isRecord(patch)) return { ok: false, error: "patch is not an object" };
  const set = patch.set;
  const unset = patch.unset;
  if (!isRecord(set)) return { ok: false, error: "patch.set is not an object" };
  if (!Array.isArray(unset)) return { ok: false, error: "patch.unset is not an array" };

  for (const key of Object.keys(set)) {
    if (!PROJECT_PATCH_KEYS.has(key)) {
      return { ok: false, error: `patch.set has invalid key: ${key}` };
    }
  }

  for (let i = 0; i < unset.length; i += 1) {
    const key = unset[i];
    if (!isString(key)) return { ok: false, error: `patch.unset[${i}] is not a string` };
    if (!PROJECT_PATCH_KEYS.has(key)) {
      return { ok: false, error: `patch.unset has invalid key: ${key}` };
    }
  }

  return { ok: true };
};
