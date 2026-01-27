type ValidationResult = { ok: true } | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

export const validateProjectData = (data: unknown): ValidationResult => {
  if (!isRecord(data)) return { ok: false, error: "projectData is not an object" };
  const rawScript = (data as Record<string, unknown>).rawScript;
  if (rawScript !== undefined && !isString(rawScript)) {
    return { ok: false, error: "rawScript is not a string" };
  }

  const context = (data as Record<string, unknown>).context;
  if (context !== undefined) {
    if (!isRecord(context)) return { ok: false, error: "context is not an object" };
    const projectSummary = (context as Record<string, unknown>).projectSummary;
    if (projectSummary !== undefined && !isString(projectSummary)) {
      return { ok: false, error: "context.projectSummary is not a string" };
    }
    const characters = (context as Record<string, unknown>).characters;
    if (characters !== undefined) {
      if (!Array.isArray(characters)) return { ok: false, error: "context.characters is not an array" };
      for (let i = 0; i < characters.length; i += 1) {
        const char = characters[i];
        if (!isRecord(char)) return { ok: false, error: `context.characters[${i}] is not an object` };
        if (!isString(char.name)) return { ok: false, error: `context.characters[${i}].name is not a string` };
        if (!isString(char.role)) return { ok: false, error: `context.characters[${i}].role is not a string` };
        if (!isBoolean(char.isMain)) return { ok: false, error: `context.characters[${i}].isMain is not a boolean` };
        if (char.forms !== undefined && !Array.isArray(char.forms)) {
          return { ok: false, error: `context.characters[${i}].forms is not an array` };
        }
      }
    }
    const locations = (context as Record<string, unknown>).locations;
    if (locations !== undefined) {
      if (!Array.isArray(locations)) return { ok: false, error: "context.locations is not an array" };
      for (let i = 0; i < locations.length; i += 1) {
        const loc = locations[i];
        if (!isRecord(loc)) return { ok: false, error: `context.locations[${i}] is not an object` };
        if (!isString(loc.name)) return { ok: false, error: `context.locations[${i}].name is not a string` };
      }
    }
  }

  const episodes = (data as Record<string, unknown>).episodes;
  if (!Array.isArray(episodes)) return { ok: false, error: "episodes is not an array" };

  for (let i = 0; i < episodes.length; i += 1) {
    const ep = episodes[i];
    if (!isRecord(ep)) return { ok: false, error: `episodes[${i}] is not an object` };
    if (!isNumber(ep.id)) return { ok: false, error: `episodes[${i}].id is not a number` };
    if (!isString(ep.title)) return { ok: false, error: `episodes[${i}].title is not a string` };
    if (!isString(ep.content)) return { ok: false, error: `episodes[${i}].content is not a string` };
    if (!Array.isArray(ep.shots)) return { ok: false, error: `episodes[${i}].shots is not an array` };
    if (ep.scenes !== undefined && !Array.isArray(ep.scenes)) {
      return { ok: false, error: `episodes[${i}].scenes is not an array` };
    }

    for (let j = 0; j < ep.shots.length; j += 1) {
      const shot = ep.shots[j];
      if (!isRecord(shot)) return { ok: false, error: `episodes[${i}].shots[${j}] is not an object` };
      const required = ["id", "duration", "shotType", "movement", "description", "dialogue", "soraPrompt"] as const;
      for (const key of required) {
        if (!isString(shot[key])) {
          return { ok: false, error: `episodes[${i}].shots[${j}].${key} is not a string` };
        }
      }
      if (shot.storyboardPrompt !== undefined && !isString(shot.storyboardPrompt)) {
        return { ok: false, error: `episodes[${i}].shots[${j}].storyboardPrompt is not a string` };
      }
      if (shot.difficulty !== undefined && !isNumber(shot.difficulty)) {
        return { ok: false, error: `episodes[${i}].shots[${j}].difficulty is not a number` };
      }
      if (shot.videoStatus !== undefined && !isString(shot.videoStatus)) {
        return { ok: false, error: `episodes[${i}].shots[${j}].videoStatus is not a string` };
      }
    }
  }

  return { ok: true };
};
