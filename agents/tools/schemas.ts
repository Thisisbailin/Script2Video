import { z } from "zod";

export const readProjectDataSchema = z.object({
  episodeId: z.number().int().optional(),
  episodeTitle: z.string().optional(),
  sceneId: z.string().optional(),
  sceneIndex: z.number().int().optional(),
  characterId: z.string().optional(),
  characterName: z.string().optional(),
  locationId: z.string().optional(),
  locationName: z.string().optional(),
  query: z.string().optional(),
  queryScopes: z.array(z.enum(["script", "understanding", "characters", "locations"])).optional(),
  include: z.array(
    z.enum([
      "episodeContent",
      "sceneContent",
      "sceneList",
      "episodeCharacters",
      "matches",
      "projectSummary",
      "episodeSummary",
      "episodeSummaries",
      "characters",
      "character",
      "locations",
      "location",
      "rawScript",
    ])
  ).optional(),
  maxChars: z.number().int().optional(),
  maxMatches: z.number().int().optional(),
  maxItems: z.number().int().optional(),
});

export const searchScriptDataSchema = z.object({
  query: z.string(),
  episodeId: z.number().int().optional(),
  episodeTitle: z.string().optional(),
  maxMatches: z.number().int().optional(),
  maxSnippetChars: z.number().int().optional(),
});

export const getEpisodeScriptSchema = z.object({
  episodeId: z.number().int().optional(),
  episodeTitle: z.string().optional(),
  maxChars: z.number().int().optional(),
  maxScenes: z.number().int().optional(),
  includeSceneList: z.boolean().optional(),
  includeEpisodeSummary: z.boolean().optional(),
  includeCharacters: z.boolean().optional(),
});

export const getSceneScriptSchema = z.object({
  episodeId: z.number().int().optional(),
  episodeTitle: z.string().optional(),
  sceneId: z.string().optional(),
  sceneIndex: z.number().int().optional(),
  maxChars: z.number().int().optional(),
  includeEpisodeSummary: z.boolean().optional(),
  includeCharacters: z.boolean().optional(),
  includeSceneMetadata: z.boolean().optional(),
});

export const upsertCharacterSchema = z.object({
  character: z.object({
    id: z.string().optional(),
    name: z.string(),
    role: z.string().optional(),
    isMain: z.boolean().optional(),
    bio: z.string().optional(),
    assetPriority: z.enum(["high", "medium", "low"]).optional(),
    episodeUsage: z.string().optional(),
    archetype: z.string().optional(),
    tags: z.array(z.string()).optional(),
    forms: z.array(
      z.object({
        id: z.string().optional(),
        formName: z.string(),
        episodeRange: z.string(),
        description: z.string().optional(),
        visualTags: z.string().optional(),
        identityOrState: z.string().optional(),
        hair: z.string().optional(),
        face: z.string().optional(),
        body: z.string().optional(),
        costume: z.string().optional(),
        accessories: z.string().optional(),
        props: z.string().optional(),
        materialPalette: z.string().optional(),
        poses: z.string().optional(),
        expressions: z.string().optional(),
        lightingOrPalette: z.string().optional(),
        turnaroundNeeded: z.boolean().optional(),
        deliverables: z.string().optional(),
        designRationale: z.string().optional(),
        styleRef: z.string().optional(),
        genPrompts: z.string().optional(),
        voiceId: z.string().optional(),
        voicePrompt: z.string().optional(),
        previewAudioUrl: z.string().optional(),
      })
    ).optional(),
  }),
  mergeStrategy: z.enum(["patch", "replace"]).optional(),
  formsMode: z.enum(["merge", "replace"]).optional(),
  formsToDelete: z.array(z.string()).optional(),
  evidence: z.array(z.string()).optional(),
});

export const upsertLocationSchema = z.object({
  location: z.object({
    id: z.string().optional(),
    name: z.string(),
    type: z.enum(["core", "secondary"]).optional(),
    description: z.string().optional(),
    visuals: z.string().optional(),
    assetPriority: z.enum(["high", "medium", "low"]).optional(),
    episodeUsage: z.string().optional(),
    zones: z.array(
      z.object({
        id: z.string().optional(),
        name: z.string(),
        kind: z.enum(["interior", "exterior", "transition", "unspecified"]).optional(),
        episodeRange: z.string(),
        layoutNotes: z.string().optional(),
        keyProps: z.string().optional(),
        lightingWeather: z.string().optional(),
        materialPalette: z.string().optional(),
        designRationale: z.string().optional(),
        deliverables: z.string().optional(),
        genPrompts: z.string().optional(),
      })
    ).optional(),
  }),
  mergeStrategy: z.enum(["patch", "replace"]).optional(),
  zonesMode: z.enum(["merge", "replace"]).optional(),
  zonesToDelete: z.array(z.string()).optional(),
  evidence: z.array(z.string()).optional(),
});

export const createTextNodeSchema = z.object({
  title: z.string().optional(),
  text: z.string(),
  x: z.number().optional(),
  y: z.number().optional(),
  parentId: z.string().optional(),
});

export const createNodeWorkflowSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  wrapInGroup: z.boolean().optional(),
  parentId: z.string().optional(),
  layout: z.enum(["horizontal", "vertical", "fanout"]).optional(),
  originX: z.number().optional(),
  originY: z.number().optional(),
  nodes: z
    .array(
      z.object({
        key: z.string(),
        type: z.enum([
          "text",
          "shot",
          "annotation",
          "imageGen",
          "wanImageGen",
          "soraVideoGen",
          "wanVideoGen",
          "viduVideoGen",
        ]),
        title: z.string().optional(),
        text: z.string().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        data: z.record(z.string(), z.any()).optional(),
      })
    )
    .min(1),
  edges: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        fromHandle: z.enum(["image", "text"]).optional(),
        toHandle: z.enum(["image", "text"]).optional(),
        paused: z.boolean().optional(),
      })
    )
    .optional(),
});

export const readProjectDataParameters = z.toJSONSchema(readProjectDataSchema);
export const searchScriptDataParameters = z.toJSONSchema(searchScriptDataSchema);
export const getEpisodeScriptParameters = z.toJSONSchema(getEpisodeScriptSchema);
export const getSceneScriptParameters = z.toJSONSchema(getSceneScriptSchema);
export const upsertCharacterParameters = z.toJSONSchema(upsertCharacterSchema);
export const upsertLocationParameters = z.toJSONSchema(upsertLocationSchema);
export const createTextNodeParameters = z.toJSONSchema(createTextNodeSchema);
export const createNodeWorkflowParameters = z.toJSONSchema(createNodeWorkflowSchema);
