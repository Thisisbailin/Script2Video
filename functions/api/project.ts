import { createClerkClient, verifyToken } from "@clerk/backend";
import { validateProjectPatch, validateProjectPayload } from "./validation";
import { logAudit } from "./audit";
import { getSyncRolloutInfo, RolloutEnv } from "./rollout";

type Env = {
  DB: any; // D1 binding injected by Cloudflare Pages
  CLERK_SECRET_KEY: string;
} & RolloutEnv;

const JSON_HEADERS = { "content-type": "application/json" };
const SNAPSHOT_LIMIT = 10;
const CHANGELOG_LIMIT = 200;
const MAX_PROJECT_BYTES = 1_800_000;

const jsonResponse = (body: unknown, init: ResponseInit = {}) => {
  const headers = { ...JSON_HEADERS, ...(init.headers || {}) };
  return new Response(JSON.stringify(body), { ...init, headers });
};

async function ensureTable(env: Env) {
  // Create table on first write/read; inexpensive no-op if already exists
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS user_projects (user_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)"
  ).run();
}

async function ensureSnapshotsTable(env: Env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS user_project_snapshots (user_id TEXT NOT NULL, version INTEGER NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (user_id, version))"
  ).run();
}

async function ensureChangesTable(env: Env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS user_project_changes (user_id TEXT NOT NULL, version INTEGER NOT NULL, patch TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (user_id, version))"
  ).run();
}

function unwrapStoredProject(stored: any): { projectData: any; meta: { lastOpId?: string } } {
  if (stored && typeof stored === "object" && "projectData" in stored) {
    return { projectData: (stored as any).projectData, meta: (stored as any).meta || {} };
  }
  return { projectData: stored, meta: {} };
}

const isProjectEmpty = (data: any) => {
  const episodes = Array.isArray(data?.episodes) ? data.episodes : [];
  const hasEps = episodes.length > 0;
  const rawScript = typeof data?.rawScript === "string" ? data.rawScript : "";
  const hasScript = rawScript.trim().length > 0;
  return !hasEps && !hasScript;
};

type ProjectPatch = { set: Record<string, unknown>; unset: string[] };

const getDeviceId = (request: Request, body?: any) => {
  const headerId = request.headers.get("x-device-id") || request.headers.get("X-Device-Id");
  const bodyId = body && typeof body.deviceId === "string" ? body.deviceId : undefined;
  return headerId || bodyId || undefined;
};

const PROJECT_PATCH_KEYS = [
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
] as const;

const stableStringify = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
};

const computeProjectPatch = (current: any, base: any): ProjectPatch => {
  if (!base) {
    const set: Record<string, unknown> = {};
    PROJECT_PATCH_KEYS.forEach((key) => {
      set[key] = current ? current[key] : undefined;
    });
    return { set, unset: [] };
  }

  const set: Record<string, unknown> = {};
  const unset: string[] = [];

  PROJECT_PATCH_KEYS.forEach((key) => {
    const currentValue = current ? current[key] : undefined;
    const baseValue = base ? base[key] : undefined;
    const currentMissing = typeof currentValue === "undefined";
    const baseMissing = typeof baseValue === "undefined";

    if (currentMissing && !baseMissing) {
      unset.push(key);
      return;
    }
    if (!currentMissing && baseMissing) {
      set[key] = currentValue;
      return;
    }
    if (stableStringify(currentValue) !== stableStringify(baseValue)) {
      set[key] = currentValue;
    }
  });

  return { set, unset };
};

const applyProjectPatch = (base: any, patch: ProjectPatch) => {
  const baseData = base && typeof base === "object" ? base : {};
  const next = { ...baseData };
  for (const [key, value] of Object.entries(patch.set)) {
    (next as any)[key] = value;
  }
  for (const key of patch.unset) {
    delete (next as any)[key];
  }
  return next;
};

async function getUserId(request: Request, env: Env) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!env.CLERK_SECRET_KEY) {
    throw new Response("Missing CLERK_SECRET_KEY on server", { status: 500 });
  }

  // Prefer Bearer token if provided
  if (token) {
    try {
      const payload = await verifyToken(token, {
        secretKey: env.CLERK_SECRET_KEY,
      });
      if (payload?.sub) return payload.sub;
    } catch (err) {
      console.warn("verifyToken failed, falling back to cookie auth", err);
    }
  }

  // Fallback to cookie-based auth (no JWT template required)
  const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
  const auth = await clerkClient.authenticateRequest({ request, loadSession: true });
  if (!auth?.session?.userId) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return auth.session.userId;
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
    await ensureTable(context.env);
    await ensureSnapshotsTable(context.env);
    await ensureChangesTable(context.env);

    const row = await context.env.DB.prepare(
      "SELECT data, updated_at FROM user_projects WHERE user_id = ?1"
    )
      .bind(userId)
      .first();

    if (!row) {
      return new Response("Not Found", { status: 404 });
    }

    const parsed = JSON.parse(row.data as string);
    const { projectData } = unwrapStoredProject(parsed);
    return jsonResponse(
      { projectData, updatedAt: row.updated_at },
      { headers: { etag: String(row.updated_at) } }
    );
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("GET /api/project error", err);
    if (userId) {
      const deviceId = getDeviceId(context.request);
      await logAudit(context.env, userId, "project.get", "error", { error: "Failed to load project", deviceId });
    }
    return jsonResponse({ error: "Failed to load project" }, { status: 500 });
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
    await ensureTable(context.env);
    await ensureSnapshotsTable(context.env);
    await ensureChangesTable(context.env);

    const body = await context.request.json();
    if (!body || typeof body !== "object") {
      const deviceId = getDeviceId(context.request);
      if (userId) await logAudit(context.env, userId, "project.put", "invalid", { error: "Invalid payload", deviceId });
      return jsonResponse({ error: "Invalid payload." }, { status: 400 });
    }

    const deviceId = getDeviceId(context.request, body);
    const auditDevice = deviceId ? { deviceId } : {};

    const hasPatch = Object.prototype.hasOwnProperty.call(body, "patch");
    const patch = hasPatch ? (body as any).patch : undefined;
    const mode = hasPatch ? "patch" : "full";
    if (hasPatch) {
      const patchValidation = validateProjectPatch(patch);
      if (!patchValidation.ok) {
        if (userId) await logAudit(context.env, userId, "project.put", "invalid", { error: patchValidation.error, mode, ...auditDevice });
        return jsonResponse({ error: patchValidation.error }, { status: 400 });
      }
    }

    const clientUpdatedAt = typeof body.updatedAt === "number" ? body.updatedAt : undefined;
    const opId = typeof body.opId === "string" ? body.opId : undefined;

    // Fetch current to support conflict detection
    const existing = await context.env.DB.prepare(
      "SELECT data, updated_at FROM user_projects WHERE user_id = ?1"
    )
      .bind(userId)
      .first();

    let remoteData: any = null;
    let remoteMeta: { lastOpId?: string } = {};
    if (existing) {
      const parsed = JSON.parse(existing.data as string);
      const unwrapped = unwrapStoredProject(parsed);
      remoteData = unwrapped.projectData;
      remoteMeta = unwrapped.meta;
      if (opId && remoteMeta?.lastOpId === opId) {
        return jsonResponse(
          { ok: true, updatedAt: existing.updated_at },
          { headers: { etag: String(existing.updated_at) } }
        );
      }
      if (typeof clientUpdatedAt !== "number") {
        if (userId) await logAudit(context.env, userId, "project.put", "conflict", { reason: "missing_version", updatedAt: existing.updated_at, mode, ...auditDevice });
        return jsonResponse(
          { error: "Conflict", projectData: remoteData, updatedAt: existing.updated_at },
          { status: 409 }
        );
      }
      if (clientUpdatedAt !== existing.updated_at) {
        if (userId) await logAudit(context.env, userId, "project.put", "conflict", { reason: "version_mismatch", updatedAt: existing.updated_at, mode, ...auditDevice });
        return jsonResponse(
          { error: "Conflict", projectData: remoteData, updatedAt: existing.updated_at },
          { status: 409 }
        );
      }
    }

    const projectData = hasPatch
      ? applyProjectPatch(remoteData, patch as ProjectPatch)
      : ("projectData" in body ? body.projectData : body);

    const validation = validateProjectPayload(projectData);
    if (!validation.ok) {
      if (userId) await logAudit(context.env, userId, "project.put", "invalid", { error: validation.error, mode, ...auditDevice });
      return jsonResponse({ error: validation.error }, { status: 400 });
    }

    const episodesCount = Array.isArray(projectData.episodes) ? projectData.episodes.length : 0;
    const shotsCount = Array.isArray(projectData.episodes)
      ? projectData.episodes.reduce((acc: number, ep: any) => acc + (Array.isArray(ep.shots) ? ep.shots.length : 0), 0)
      : 0;

    if (existing && !isProjectEmpty(remoteData) && isProjectEmpty(projectData)) {
      if (userId) await logAudit(context.env, userId, "project.put", "conflict", { reason: "empty_overwrite", updatedAt: existing.updated_at, mode, ...auditDevice });
      return jsonResponse(
        { error: "Conflict", projectData: remoteData, updatedAt: existing.updated_at },
        { status: 409 }
      );
    }

    if (existing) {
      await context.env.DB.prepare(
        "INSERT OR IGNORE INTO user_project_snapshots (user_id, version, data, created_at) VALUES (?1, ?2, ?3, ?4)"
      )
        .bind(userId, existing.updated_at, existing.data as string, Date.now())
        .run();

      await context.env.DB.prepare(
        "DELETE FROM user_project_snapshots WHERE user_id = ?1 AND version NOT IN (SELECT version FROM user_project_snapshots WHERE user_id = ?1 ORDER BY version DESC LIMIT ?2)"
      )
        .bind(userId, SNAPSHOT_LIMIT)
        .run();
    }

    const payload = { projectData, meta: { lastOpId: opId } };
    const serialized = JSON.stringify(payload, (_, value) => {
      // Drop File/blob-like values to keep payload JSON-safe
      if (
        typeof File !== "undefined" &&
        value instanceof File
      ) {
        return undefined;
      }
      return value;
    });

    const payloadBytes = new TextEncoder().encode(serialized).length;
    if (payloadBytes > MAX_PROJECT_BYTES) {
      if (userId) {
        await logAudit(context.env, userId, "project.put", "invalid", {
          error: "Payload too large",
          bytes: payloadBytes,
          mode,
          ...auditDevice
        });
      }
      return jsonResponse({ error: "Project payload too large", detail: `size=${payloadBytes}` }, { status: 413 });
    }

    const updatedAt = Date.now();
    await context.env.DB.prepare(
      "INSERT INTO user_projects (user_id, data, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(user_id) DO UPDATE SET data=?2, updated_at=?3"
    )
      .bind(userId, serialized, updatedAt)
      .run();

    const changePatch = hasPatch ? (patch as ProjectPatch) : computeProjectPatch(projectData, remoteData);
    const patchSerialized = JSON.stringify(changePatch, (_, value) => {
      if (
        typeof File !== "undefined" &&
        value instanceof File
      ) {
        return undefined;
      }
      return value;
    });
    await context.env.DB.prepare(
      "INSERT INTO user_project_changes (user_id, version, patch, created_at) VALUES (?1, ?2, ?3, ?4)"
    )
      .bind(userId, updatedAt, patchSerialized, Date.now())
      .run();
    await context.env.DB.prepare(
      "DELETE FROM user_project_changes WHERE user_id = ?1 AND version NOT IN (SELECT version FROM user_project_changes WHERE user_id = ?1 ORDER BY version DESC LIMIT ?2)"
    )
      .bind(userId, CHANGELOG_LIMIT)
      .run();

    if (userId) {
      await logAudit(context.env, userId, "project.put", "ok", {
        updatedAt,
        opId,
        episodes: episodesCount,
        shots: shotsCount,
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
