import { verifyToken } from "@clerk/backend";
import { validateProjectDelta, validateProjectPayload } from "./validation";
import { logAudit } from "./audit";
import { getSyncRolloutInfo, RolloutEnv } from "./rollout";

type Env = {
  DB: any; // D1 binding injected by Cloudflare Pages
  CLERK_SECRET_KEY: string;
  CLERK_JWT_KEY?: string;
} & RolloutEnv;

const JSON_HEADERS = { "content-type": "application/json" };
const SNAPSHOT_LIMIT = 10;
const MAX_PROJECT_BYTES = 1_800_000;

const jsonResponse = (body: unknown, init: ResponseInit = {}) => {
  const headers = { ...JSON_HEADERS, ...(init.headers || {}) };
  return new Response(JSON.stringify(body), { ...init, headers });
};

const emptyTokenUsage = { promptTokens: 0, responseTokens: 0, totalTokens: 0 };
const emptyPhase1Usage = {
  projectSummary: emptyTokenUsage,
  episodeSummaries: emptyTokenUsage,
  charList: emptyTokenUsage,
  charDeepDive: emptyTokenUsage,
  locList: emptyTokenUsage,
  locDeepDive: emptyTokenUsage
};
const emptyStats = {
  context: { total: 0, success: 0, error: 0 },
  shotGen: { total: 0, success: 0, error: 0 },
  soraGen: { total: 0, success: 0, error: 0 }
};

type ProjectMeta = {
  fileName: string;
  rawScript: string;
  shotGuide: string;
  soraGuide: string;
  dramaGuide: string;
  globalStyleGuide: string;
  context: {
    projectSummary: string;
    episodeSummaries: { episodeId: number; summary: string }[];
  };
  contextUsage: typeof emptyTokenUsage;
  phase1Usage: typeof emptyPhase1Usage;
  phase4Usage: typeof emptyTokenUsage;
  phase5Usage: typeof emptyTokenUsage;
  stats: typeof emptyStats;
};

const DEFAULT_META: ProjectMeta = {
  fileName: "",
  rawScript: "",
  shotGuide: "",
  soraGuide: "",
  dramaGuide: "",
  globalStyleGuide: "",
  context: {
    projectSummary: "",
    episodeSummaries: []
  },
  contextUsage: emptyTokenUsage,
  phase1Usage: emptyPhase1Usage,
  phase4Usage: emptyTokenUsage,
  phase5Usage: emptyTokenUsage,
  stats: emptyStats
};

type ProjectDelta = {
  meta?: Partial<ProjectMeta>;
  episodes?: Array<Record<string, unknown>>;
  scenes?: Array<Record<string, unknown>>;
  shots?: Array<Record<string, unknown>>;
  characters?: Array<Record<string, unknown>>;
  locations?: Array<Record<string, unknown>>;
  deleted?: {
    episodes?: number[];
    scenes?: { episodeId: number; sceneId: string }[];
    shots?: { episodeId: number; shotId: string }[];
    characters?: string[];
    locations?: string[];
  };
};

const safeJsonParse = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const getDeviceId = (request: Request, body?: any) => {
  const headerId = request.headers.get("x-device-id") || request.headers.get("X-Device-Id");
  const bodyId = body && typeof body.deviceId === "string" ? body.deviceId : undefined;
  return headerId || bodyId || undefined;
};

async function ensureMetaTable(env: Env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS user_project_meta (user_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL, last_op_id TEXT)"
  ).run();
}

async function ensureEpisodesTable(env: Env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS user_project_episodes (user_id TEXT NOT NULL, episode_id INTEGER NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, episode_id))"
  ).run();
}

async function ensureScenesTable(env: Env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS user_project_scenes (user_id TEXT NOT NULL, episode_id INTEGER NOT NULL, scene_id TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, episode_id, scene_id))"
  ).run();
}

async function ensureShotsTable(env: Env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS user_project_shots (user_id TEXT NOT NULL, episode_id INTEGER NOT NULL, shot_id TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, episode_id, shot_id))"
  ).run();
}

async function ensureCharactersTable(env: Env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS user_project_characters (user_id TEXT NOT NULL, char_id TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, char_id))"
  ).run();
}

async function ensureLocationsTable(env: Env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS user_project_locations (user_id TEXT NOT NULL, loc_id TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, loc_id))"
  ).run();
}

async function ensureSnapshotsTable(env: Env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS user_project_snapshots (user_id TEXT NOT NULL, version INTEGER NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (user_id, version))"
  ).run();
}

async function ensureTables(env: Env) {
  await ensureMetaTable(env);
  await ensureEpisodesTable(env);
  await ensureScenesTable(env);
  await ensureShotsTable(env);
  await ensureCharactersTable(env);
  await ensureLocationsTable(env);
  await ensureSnapshotsTable(env);
}

const ensureColumn = async (env: Env, table: string, column: string, type: string) => {
  const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  const columns = new Set((info?.results || []).map((row: any) => row.name));
  if (!columns.has(column)) {
    await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
  }
};

const ensureSchema = async (env: Env) => {
  await ensureTables(env);
  await ensureColumn(env, "user_project_meta", "data", "TEXT");
  await ensureColumn(env, "user_project_meta", "updated_at", "INTEGER");
  await ensureColumn(env, "user_project_meta", "last_op_id", "TEXT");
  await ensureColumn(env, "user_project_episodes", "updated_at", "INTEGER");
  await ensureColumn(env, "user_project_scenes", "updated_at", "INTEGER");
  await ensureColumn(env, "user_project_shots", "updated_at", "INTEGER");
  await ensureColumn(env, "user_project_characters", "updated_at", "INTEGER");
  await ensureColumn(env, "user_project_locations", "updated_at", "INTEGER");
  await ensureColumn(env, "user_project_snapshots", "data", "TEXT");
  await ensureColumn(env, "user_project_snapshots", "version", "INTEGER");
  await ensureColumn(env, "user_project_snapshots", "created_at", "INTEGER");
};

const buildMetaFromProject = (projectData: any): ProjectMeta => ({
  fileName: typeof projectData?.fileName === "string" ? projectData.fileName : "",
  rawScript: typeof projectData?.rawScript === "string" ? projectData.rawScript : "",
  shotGuide: typeof projectData?.shotGuide === "string" ? projectData.shotGuide : "",
  soraGuide: typeof projectData?.soraGuide === "string" ? projectData.soraGuide : "",
  dramaGuide: typeof projectData?.dramaGuide === "string" ? projectData.dramaGuide : "",
  globalStyleGuide: typeof projectData?.globalStyleGuide === "string" ? projectData.globalStyleGuide : "",
  context: {
    projectSummary: typeof projectData?.context?.projectSummary === "string" ? projectData.context.projectSummary : "",
    episodeSummaries: Array.isArray(projectData?.context?.episodeSummaries) ? projectData.context.episodeSummaries : []
  },
  contextUsage: projectData?.contextUsage || emptyTokenUsage,
  phase1Usage: projectData?.phase1Usage || emptyPhase1Usage,
  phase4Usage: projectData?.phase4Usage || emptyTokenUsage,
  phase5Usage: projectData?.phase5Usage || emptyTokenUsage,
  stats: projectData?.stats || emptyStats
});

const collectProjectParts = (projectData: any) => {
  const episodes = Array.isArray(projectData?.episodes) ? projectData.episodes : [];
  const scenes: Array<{ episodeId: number; scene: any }> = [];
  const shots: Array<{ episodeId: number; shot: any }> = [];

  episodes.forEach((episode: any) => {
    const episodeId = episode?.id;
    if (!Array.isArray(episode?.scenes)) return;
    episode.scenes.forEach((scene: any) => {
      scenes.push({ episodeId, scene });
    });
  });

  episodes.forEach((episode: any) => {
    const episodeId = episode?.id;
    if (!Array.isArray(episode?.shots)) return;
    episode.shots.forEach((shot: any) => {
      shots.push({ episodeId, shot });
    });
  });

  const episodeRows = episodes.map((episode: any) => ({
    id: episode.id,
    title: episode.title,
    content: episode.content,
    summary: episode.summary,
    status: episode.status,
    errorMsg: episode.errorMsg,
    shotGenUsage: episode.shotGenUsage,
    soraGenUsage: episode.soraGenUsage
  }));

  return {
    episodes: episodeRows,
    scenes,
    shots,
    characters: Array.isArray(projectData?.context?.characters) ? projectData.context.characters : [],
    locations: Array.isArray(projectData?.context?.locations) ? projectData.context.locations : []
  };
};

const loadProjectData = async (env: Env, userId: string) => {
  const metaRow = await env.DB.prepare(
    "SELECT data, updated_at FROM user_project_meta WHERE user_id = ?1"
  )
    .bind(userId)
    .first();

  if (!metaRow) return null;

  const meta = safeJsonParse<ProjectMeta>(metaRow.data as string, DEFAULT_META);

  const episodesResult = await env.DB.prepare(
    "SELECT episode_id, data FROM user_project_episodes WHERE user_id = ?1 ORDER BY episode_id ASC"
  )
    .bind(userId)
    .all();

  const scenesResult = await env.DB.prepare(
    "SELECT episode_id, scene_id, data FROM user_project_scenes WHERE user_id = ?1 ORDER BY episode_id ASC, scene_id ASC"
  )
    .bind(userId)
    .all();

  const shotsResult = await env.DB.prepare(
    "SELECT episode_id, shot_id, data FROM user_project_shots WHERE user_id = ?1 ORDER BY episode_id ASC, shot_id ASC"
  )
    .bind(userId)
    .all();

  const charactersResult = await env.DB.prepare(
    "SELECT char_id, data FROM user_project_characters WHERE user_id = ?1 ORDER BY char_id ASC"
  )
    .bind(userId)
    .all();

  const locationsResult = await env.DB.prepare(
    "SELECT loc_id, data FROM user_project_locations WHERE user_id = ?1 ORDER BY loc_id ASC"
  )
    .bind(userId)
    .all();

  const episodesMap = new Map<number, any>();
  const getEpisode = (episodeId: number) => {
    if (!episodesMap.has(episodeId)) {
      episodesMap.set(episodeId, {
        id: episodeId,
        title: "",
        content: "",
        scenes: [],
        shots: [],
        status: "pending"
      });
    }
    return episodesMap.get(episodeId);
  };

  (episodesResult?.results || []).forEach((row: any) => {
    const epData = safeJsonParse<Record<string, unknown>>(row.data, {});
    const episodeId = row.episode_id;
    episodesMap.set(episodeId, {
      id: episodeId,
      title: epData.title || "",
      content: epData.content || "",
      summary: epData.summary,
      status: epData.status || "pending",
      errorMsg: epData.errorMsg,
      shotGenUsage: epData.shotGenUsage,
      soraGenUsage: epData.soraGenUsage,
      scenes: [],
      shots: []
    });
  });

  (scenesResult?.results || []).forEach((row: any) => {
    const sceneData = safeJsonParse<Record<string, unknown>>(row.data, {});
    const { episodeId: _episodeId, ...rest } = sceneData as Record<string, unknown>;
    const episode = getEpisode(row.episode_id);
    episode.scenes.push({
      id: row.scene_id,
      title: (rest as any).title || "",
      content: (rest as any).content || ""
    });
  });

  (shotsResult?.results || []).forEach((row: any) => {
    const shotData = safeJsonParse<Record<string, unknown>>(row.data, {});
    const { episodeId: _episodeId, ...rest } = shotData as Record<string, unknown>;
    const episode = getEpisode(row.episode_id);
    episode.shots.push({
      ...rest,
      id: row.shot_id
    });
  });

  const characters = (charactersResult?.results || []).map((row: any) => {
    const data = safeJsonParse<Record<string, unknown>>(row.data, {});
    return { ...data, id: row.char_id };
  });

  const locations = (locationsResult?.results || []).map((row: any) => {
    const data = safeJsonParse<Record<string, unknown>>(row.data, {});
    return { ...data, id: row.loc_id };
  });

  const episodes = Array.from(episodesMap.values()).sort((a, b) => a.id - b.id);

  const projectData = {
    fileName: meta.fileName || "",
    rawScript: meta.rawScript || "",
    episodes,
    context: {
      projectSummary: meta.context?.projectSummary || "",
      episodeSummaries: meta.context?.episodeSummaries || [],
      characters,
      locations
    },
    shotGuide: meta.shotGuide || "",
    soraGuide: meta.soraGuide || "",
    dramaGuide: meta.dramaGuide || "",
    globalStyleGuide: meta.globalStyleGuide || "",
    contextUsage: meta.contextUsage || emptyTokenUsage,
    phase1Usage: meta.phase1Usage || emptyPhase1Usage,
    phase4Usage: meta.phase4Usage || emptyTokenUsage,
    phase5Usage: meta.phase5Usage || emptyTokenUsage,
    stats: meta.stats || emptyStats
  };

  const updatedAt =
    typeof metaRow.updated_at === "number" ? metaRow.updated_at : Number(metaRow.updated_at) || 0;
  return { projectData, updatedAt };
};

async function getUserId(request: Request, env: Env) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\\s+/i, "");

  const rawSecret = typeof env.CLERK_SECRET_KEY === "string" ? env.CLERK_SECRET_KEY : "";
  const rawJwtKey = typeof env.CLERK_JWT_KEY === "string" ? env.CLERK_JWT_KEY : "";
  const asciiCleaned = rawSecret.replace(/[^\x20-\x7E]/g, "");
  let secretKey = asciiCleaned.replace(/\s+/g, "");
  if (
    (secretKey.startsWith("\"") && secretKey.endsWith("\"")) ||
    (secretKey.startsWith("'") && secretKey.endsWith("'"))
  ) {
    secretKey = secretKey.slice(1, -1);
  }
  const normalizeJwtKey = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const header = "-----BEGIN PUBLIC KEY-----";
    const trailer = "-----END PUBLIC KEY-----";
    const body = trimmed
      .replace(/-----BEGIN [^-]+-----/g, "")
      .replace(/-----END [^-]+-----/g, "")
      .replace(/\s+/g, "");
    if (!body) return "";
    return `${header}\n${body}\n${trailer}`;
  };
  const jwtKeyRaw = rawJwtKey;
  const jwtKey = normalizeJwtKey(jwtKeyRaw);
  if (!secretKey && !jwtKey) {
    throw new Response("Missing CLERK_SECRET_KEY on server", { status: 500 });
  }

  if (!token) {
    throw new Response(JSON.stringify({ error: "Unauthorized", detail: "Missing bearer token" }), { status: 401, headers: JSON_HEADERS });
  }

  const decodePart = (part?: string) => {
    if (!part) return null;
    try {
      const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
      const json = atob(padded);
      return JSON.parse(json);
    } catch {
      return null;
    }
  };
  const [headerPart, payloadPart] = token.split(".");
  const tokenHeader = decodePart(headerPart);
  const tokenPayload = decodePart(payloadPart);

  const verifyAttempt = async (options: { jwtKey?: string; secretKey?: string }) => {
    try {
      const payload = await verifyToken(token, options);
      if (payload?.sub) return { sub: payload.sub };
      return { error: new Error("Token payload missing sub") };
    } catch (err) {
      return { error: err };
    }
  };

  const jwtAttempt = jwtKey ? await verifyAttempt({ jwtKey }) : null;
  if (jwtAttempt?.sub) return jwtAttempt.sub;
  const secretAttempt = secretKey ? await verifyAttempt({ secretKey }) : null;
  if (secretAttempt?.sub) return secretAttempt.sub;

  const jwtError = jwtAttempt?.error instanceof Error ? jwtAttempt.error.message : undefined;
  const secretError = secretAttempt?.error instanceof Error ? secretAttempt.error.message : undefined;
  const detail = jwtError || secretError || "Token verification failed";
  const debug = {
    secretKeyLength: secretKey.length,
    secretKeyAsciiCleanedLength: asciiCleaned.length,
    secretKeyNonAsciiRemoved: rawSecret.length - asciiCleaned.length,
    secretKeyHasWhitespace: /\s/.test(rawSecret),
    secretKeyTrimmedLength: rawSecret.trim().length,
    usingJwtKey: Boolean(jwtKey),
    jwtKeyLength: jwtKey.length || undefined,
    jwtKeyRawLength: jwtKeyRaw.length || undefined,
    jwtKeyHasWhitespace: /\s/.test(jwtKeyRaw),
    jwtKeyHasHeader: jwtKeyRaw.includes("BEGIN PUBLIC KEY"),
    jwtKeyNormalizedLength: jwtKey.length || undefined,
    jwtKeyError: jwtError,
    secretKeyError: secretError,
    tokenKid: tokenHeader?.kid,
    tokenAlg: tokenHeader?.alg,
    tokenTyp: tokenHeader?.typ,
    tokenIssuer: tokenPayload?.iss,
    tokenAzp: tokenPayload?.azp,
    tokenIat: tokenPayload?.iat,
    tokenExp: tokenPayload?.exp,
    tokenSub: tokenPayload?.sub
  };
  console.warn("verifyToken failed", { jwtError, secretError });
  console.warn("verifyToken debug", debug);
  throw new Response(JSON.stringify({ error: "Unauthorized", detail, debug }), { status: 401, headers: JSON_HEADERS });
}

export const onRequestGet = async (context: {
  request: Request;
  env: Env;
}) => {
  let userId: string | null = null;
  try {
    userId = await getUserId(context.request, context.env);
    const rollout = getSyncRolloutInfo(userId, context.env);
    if (!rollout.enabled) {
      const deviceId = getDeviceId(context.request);
      if (userId) {
        await logAudit(context.env, userId, "project.get", "disabled", { rolloutPercent: rollout.percent, ...(deviceId ? { deviceId } : {}) });
      }
      return jsonResponse({ error: "Sync disabled for this account", rollout: { percent: rollout.percent } }, { status: 403 });
    }
    await ensureSchema(context.env);

    const data = await loadProjectData(context.env, userId);
    if (!data) {
      return new Response("Not Found", { status: 404 });
    }

    return jsonResponse(
      { projectData: data.projectData, updatedAt: data.updatedAt },
      { headers: { etag: String(data.updatedAt) } }
    );
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("GET /api/project error", err);
    const detail = err?.message || (typeof err === "string" ? err : "Unknown error");
    if (userId) {
      const deviceId = getDeviceId(context.request);
      await logAudit(context.env, userId, "project.get", "error", { error: "Failed to load project", detail, deviceId });
    }
    return jsonResponse({ error: "Failed to load project", detail }, { status: 500 });
  }
};

export const onRequestPut = async (context: {
  request: Request;
  env: Env;
}) => {
  let userId: string | null = null;
  try {
    userId = await getUserId(context.request, context.env);
    const rollout = getSyncRolloutInfo(userId, context.env);
    if (!rollout.enabled) {
      const deviceId = getDeviceId(context.request);
      if (userId) {
        await logAudit(context.env, userId, "project.put", "disabled", { rolloutPercent: rollout.percent, ...(deviceId ? { deviceId } : {}) });
      }
      return jsonResponse({ error: "Sync disabled for this account", rollout: { percent: rollout.percent } }, { status: 403 });
    }
    await ensureSchema(context.env);

    const body = await context.request.json();
    if (!body || typeof body !== "object") {
      const deviceId = getDeviceId(context.request);
      if (userId) await logAudit(context.env, userId, "project.put", "invalid", { error: "Invalid payload", deviceId });
      return jsonResponse({ error: "Invalid payload." }, { status: 400 });
    }

    const deviceId = getDeviceId(context.request, body);
    const auditDevice = deviceId ? { deviceId } : {};
    const delta = (body as any).delta as ProjectDelta | undefined;
    const hasFull = Object.prototype.hasOwnProperty.call(body, "projectData");
    const projectData = hasFull ? (body as any).projectData : delta ? undefined : body;
    const mode = delta ? "delta" : "full";

    if (delta) {
      const deltaValidation = validateProjectDelta(delta);
      if (!deltaValidation.ok) {
        if (userId) await logAudit(context.env, userId, "project.put", "invalid", { error: deltaValidation.error, mode, ...auditDevice });
        return jsonResponse({ error: deltaValidation.error }, { status: 400 });
      }
    } else {
      const validation = validateProjectPayload(projectData);
      if (!validation.ok) {
        if (userId) await logAudit(context.env, userId, "project.put", "invalid", { error: validation.error, mode, ...auditDevice });
        return jsonResponse({ error: validation.error }, { status: 400 });
      }
    }

    const clientUpdatedAt = typeof (body as any).updatedAt === "number" ? (body as any).updatedAt : undefined;
    const opId = typeof (body as any).opId === "string" ? (body as any).opId : undefined;

    const existingMeta = await context.env.DB.prepare(
      "SELECT data, updated_at, last_op_id FROM user_project_meta WHERE user_id = ?1"
    )
      .bind(userId)
      .first();

    if (existingMeta && opId && existingMeta.last_op_id === opId) {
      return jsonResponse(
        { ok: true, updatedAt: existingMeta.updated_at },
        { headers: { etag: String(existingMeta.updated_at) } }
      );
    }

    if (existingMeta) {
      if (typeof clientUpdatedAt !== "number") {
        if (userId) await logAudit(context.env, userId, "project.put", "conflict", { reason: "missing_version", updatedAt: existingMeta.updated_at, mode, ...auditDevice });
        const remoteData = await loadProjectData(context.env, userId);
        return jsonResponse(
          { error: "Conflict", projectData: remoteData?.projectData, updatedAt: existingMeta.updated_at },
          { status: 409 }
        );
      }
      if (clientUpdatedAt !== existingMeta.updated_at) {
        if (userId) await logAudit(context.env, userId, "project.put", "conflict", { reason: "version_mismatch", updatedAt: existingMeta.updated_at, mode, ...auditDevice });
        const remoteData = await loadProjectData(context.env, userId);
        return jsonResponse(
          { error: "Conflict", projectData: remoteData?.projectData, updatedAt: existingMeta.updated_at },
          { status: 409 }
        );
      }
    }

    if (existingMeta) {
      const snapshotData = await loadProjectData(context.env, userId);
      if (snapshotData) {
        await context.env.DB.prepare(
          "INSERT OR IGNORE INTO user_project_snapshots (user_id, version, data, created_at) VALUES (?1, ?2, ?3, ?4)"
        )
          .bind(userId, snapshotData.updatedAt, JSON.stringify({ projectData: snapshotData.projectData }), Date.now())
          .run();

        await context.env.DB.prepare(
          "DELETE FROM user_project_snapshots WHERE user_id = ?1 AND version NOT IN (SELECT version FROM user_project_snapshots WHERE user_id = ?1 ORDER BY version DESC LIMIT ?2)"
        )
          .bind(userId, SNAPSHOT_LIMIT)
          .run();
      }
    }

    let meta = existingMeta
      ? safeJsonParse<ProjectMeta>(existingMeta.data as string, DEFAULT_META)
      : DEFAULT_META;
    let hasChanges = false;
    const updatedAt = Date.now();

    if (delta?.meta) {
      meta = {
        ...meta,
        ...delta.meta,
        context: {
          ...meta.context,
          ...(delta.meta.context || {})
        }
      };
      hasChanges = true;
    }

    if (!delta) {
      meta = buildMetaFromProject(projectData);
      hasChanges = true;
    }

    const metaSerialized = JSON.stringify(meta);
    const metaBytes = new TextEncoder().encode(metaSerialized).length;
    if (metaBytes > MAX_PROJECT_BYTES) {
      if (userId) {
        await logAudit(context.env, userId, "project.put", "invalid", {
          error: "Meta payload too large",
          bytes: metaBytes,
          mode,
          ...auditDevice
        });
      }
      return jsonResponse({ error: "Project meta payload too large", detail: `size=${metaBytes}` }, { status: 413 });
    }

    if (delta) {
      const episodes = delta.episodes || [];
      const scenes = delta.scenes || [];
      const shots = delta.shots || [];
      const characters = delta.characters || [];
      const locations = delta.locations || [];

      for (const episode of episodes) {
        const { scenes: _scenes, shots: _shots, ...episodeData } = episode;
        await context.env.DB.prepare(
          "INSERT INTO user_project_episodes (user_id, episode_id, data, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(user_id, episode_id) DO UPDATE SET data=?3, updated_at=?4"
        )
          .bind(userId, episode.id, JSON.stringify(episodeData), updatedAt)
          .run();
        hasChanges = true;
      }

      for (const scene of scenes) {
        const { episodeId: _episodeId, ...sceneData } = scene as Record<string, unknown>;
        await context.env.DB.prepare(
          "INSERT INTO user_project_scenes (user_id, episode_id, scene_id, data, updated_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(user_id, episode_id, scene_id) DO UPDATE SET data=?4, updated_at=?5"
        )
          .bind(userId, (scene as any).episodeId, (scene as any).id, JSON.stringify(sceneData), updatedAt)
          .run();
        hasChanges = true;
      }

      for (const shot of shots) {
        const { episodeId: _episodeId, ...shotData } = shot as Record<string, unknown>;
        await context.env.DB.prepare(
          "INSERT INTO user_project_shots (user_id, episode_id, shot_id, data, updated_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(user_id, episode_id, shot_id) DO UPDATE SET data=?4, updated_at=?5"
        )
          .bind(userId, (shot as any).episodeId, (shot as any).id, JSON.stringify(shotData), updatedAt)
          .run();
        hasChanges = true;
      }

      for (const character of characters) {
        await context.env.DB.prepare(
          "INSERT INTO user_project_characters (user_id, char_id, data, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(user_id, char_id) DO UPDATE SET data=?3, updated_at=?4"
        )
          .bind(userId, character.id, JSON.stringify(character), updatedAt)
          .run();
        hasChanges = true;
      }

      for (const location of locations) {
        await context.env.DB.prepare(
          "INSERT INTO user_project_locations (user_id, loc_id, data, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(user_id, loc_id) DO UPDATE SET data=?3, updated_at=?4"
        )
          .bind(userId, location.id, JSON.stringify(location), updatedAt)
          .run();
        hasChanges = true;
      }

      const deleted = delta.deleted || {};
      if (deleted.episodes && deleted.episodes.length > 0) {
        for (const episodeId of deleted.episodes) {
          await context.env.DB.prepare(
            "DELETE FROM user_project_episodes WHERE user_id = ?1 AND episode_id = ?2"
          )
            .bind(userId, episodeId)
            .run();
          await context.env.DB.prepare(
            "DELETE FROM user_project_scenes WHERE user_id = ?1 AND episode_id = ?2"
          )
            .bind(userId, episodeId)
            .run();
          await context.env.DB.prepare(
            "DELETE FROM user_project_shots WHERE user_id = ?1 AND episode_id = ?2"
          )
            .bind(userId, episodeId)
            .run();
        }
        hasChanges = true;
      }
      if (deleted.scenes && deleted.scenes.length > 0) {
        for (const scene of deleted.scenes) {
          await context.env.DB.prepare(
            "DELETE FROM user_project_scenes WHERE user_id = ?1 AND episode_id = ?2 AND scene_id = ?3"
          )
            .bind(userId, scene.episodeId, scene.sceneId)
            .run();
        }
        hasChanges = true;
      }
      if (deleted.shots && deleted.shots.length > 0) {
        for (const shot of deleted.shots) {
          await context.env.DB.prepare(
            "DELETE FROM user_project_shots WHERE user_id = ?1 AND episode_id = ?2 AND shot_id = ?3"
          )
            .bind(userId, shot.episodeId, shot.shotId)
            .run();
        }
        hasChanges = true;
      }
      if (deleted.characters && deleted.characters.length > 0) {
        for (const charId of deleted.characters) {
          await context.env.DB.prepare(
            "DELETE FROM user_project_characters WHERE user_id = ?1 AND char_id = ?2"
          )
            .bind(userId, charId)
            .run();
        }
        hasChanges = true;
      }
      if (deleted.locations && deleted.locations.length > 0) {
        for (const locId of deleted.locations) {
          await context.env.DB.prepare(
            "DELETE FROM user_project_locations WHERE user_id = ?1 AND loc_id = ?2"
          )
            .bind(userId, locId)
            .run();
        }
        hasChanges = true;
      }
    } else {
      const parts = collectProjectParts(projectData);

      await context.env.DB.prepare("DELETE FROM user_project_episodes WHERE user_id = ?1").bind(userId).run();
      await context.env.DB.prepare("DELETE FROM user_project_scenes WHERE user_id = ?1").bind(userId).run();
      await context.env.DB.prepare("DELETE FROM user_project_shots WHERE user_id = ?1").bind(userId).run();
      await context.env.DB.prepare("DELETE FROM user_project_characters WHERE user_id = ?1").bind(userId).run();
      await context.env.DB.prepare("DELETE FROM user_project_locations WHERE user_id = ?1").bind(userId).run();

      for (const episode of parts.episodes) {
        await context.env.DB.prepare(
          "INSERT INTO user_project_episodes (user_id, episode_id, data, updated_at) VALUES (?1, ?2, ?3, ?4)"
        )
          .bind(userId, episode.id, JSON.stringify(episode), updatedAt)
          .run();
      }

      for (const scene of parts.scenes) {
        await context.env.DB.prepare(
          "INSERT INTO user_project_scenes (user_id, episode_id, scene_id, data, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)"
        )
          .bind(userId, scene.episodeId, scene.scene.id, JSON.stringify(scene.scene), updatedAt)
          .run();
      }

      for (const shot of parts.shots) {
        await context.env.DB.prepare(
          "INSERT INTO user_project_shots (user_id, episode_id, shot_id, data, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)"
        )
          .bind(userId, shot.episodeId, shot.shot.id, JSON.stringify(shot.shot), updatedAt)
          .run();
      }

      for (const character of parts.characters) {
        await context.env.DB.prepare(
          "INSERT INTO user_project_characters (user_id, char_id, data, updated_at) VALUES (?1, ?2, ?3, ?4)"
        )
          .bind(userId, character.id, JSON.stringify(character), updatedAt)
          .run();
      }

      for (const location of parts.locations) {
        await context.env.DB.prepare(
          "INSERT INTO user_project_locations (user_id, loc_id, data, updated_at) VALUES (?1, ?2, ?3, ?4)"
        )
          .bind(userId, location.id, JSON.stringify(location), updatedAt)
          .run();
      }
    }

    if (hasChanges) {
      await context.env.DB.prepare(
        "INSERT INTO user_project_meta (user_id, data, updated_at, last_op_id) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(user_id) DO UPDATE SET data=?2, updated_at=?3, last_op_id=?4"
      )
        .bind(userId, metaSerialized, updatedAt, opId || null)
        .run();
    }

    if (userId) {
      await logAudit(context.env, userId, "project.put", "ok", {
        updatedAt,
        opId,
        mode,
        ...auditDevice
      });
    }
    return jsonResponse(
      { ok: true, updatedAt },
      { headers: { etag: String(updatedAt) } }
    );
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("PUT /api/project error", err);
    const detail = err?.message || (typeof err === "string" ? err : "Unknown error");
    if (userId) {
      const deviceId = getDeviceId(context.request);
      await logAudit(context.env, userId, "project.put", "error", { error: "Failed to save project", detail, deviceId });
    }
    return jsonResponse({ error: "Failed to save project", detail }, { status: 500 });
  }
};
