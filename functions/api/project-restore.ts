import { createClerkClient, verifyToken } from "@clerk/backend";
import { validateProjectPayload } from "./validation";
import { logAudit } from "./audit";
import { getSyncRolloutInfo, RolloutEnv } from "./rollout";

type Env = {
  DB: any;
  CLERK_SECRET_KEY: string;
} & RolloutEnv;

const JSON_HEADERS = { "content-type": "application/json" };
const jsonResponse = (body: unknown, init: ResponseInit = {}) => {
  const headers = { ...JSON_HEADERS, ...(init.headers || {}) };
  return new Response(JSON.stringify(body), { ...init, headers });
};

const getDeviceId = (request: Request, body?: any) => {
  const headerId = request.headers.get("x-device-id") || request.headers.get("X-Device-Id");
  const bodyId = body && typeof body.deviceId === "string" ? body.deviceId : undefined;
  return headerId || bodyId || undefined;
};

const CHANGELOG_LIMIT = 200;

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

const computeProjectPatch = (current: any, base: any) => {
  if (!base) {
    const set: Record<string, unknown> = {};
    PROJECT_PATCH_KEYS.forEach((key) => {
      set[key] = current ? current[key] : undefined;
    });
    return { set, unset: [] as string[] };
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

async function ensureTables(env: Env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS user_projects (user_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)"
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS user_project_snapshots (user_id TEXT NOT NULL, version INTEGER NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (user_id, version))"
  ).run();
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS user_project_changes (user_id TEXT NOT NULL, version INTEGER NOT NULL, patch TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (user_id, version))"
  ).run();
}

async function getUserId(request: Request, env: Env) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!env.CLERK_SECRET_KEY) {
    throw new Response("Missing CLERK_SECRET_KEY on server", { status: 500 });
  }

  if (token) {
    try {
      const payload = await verifyToken(token, {
        secretKey: env.CLERK_SECRET_KEY,
        template: "default",
      });
      if (payload?.sub) return payload.sub;
    } catch (err) {
      console.warn("verifyToken failed, falling back to cookie auth", err);
    }
  }

  const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
  const auth = await clerkClient.authenticateRequest({ request, loadSession: true });
  if (!auth?.session?.userId) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return auth.session.userId;
}

const unwrapStoredProject = (payload: any): { projectData: any; meta: any } => {
  if (payload && typeof payload === "object" && "projectData" in payload) {
    return { projectData: (payload as any).projectData, meta: (payload as any).meta || {} };
  }
  return { projectData: payload, meta: {} };
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  let userId: string | null = null;
  try {
    userId = await getUserId(context.request, context.env);
    const rollout = getSyncRolloutInfo(userId, context.env);
    if (!rollout.enabled) {
      const deviceId = getDeviceId(context.request);
      if (userId) {
        await logAudit(context.env, userId, "project.restore", "disabled", { rolloutPercent: rollout.percent, ...(deviceId ? { deviceId } : {}) });
      }
      return jsonResponse({ error: "Sync disabled for this account", rollout: { percent: rollout.percent } }, { status: 403 });
    }
    await ensureTables(context.env);

    const body = await context.request.json();
    const deviceId = getDeviceId(context.request, body);
    const auditDevice = deviceId ? { deviceId } : {};
    const version = typeof body?.version === "number" ? body.version : undefined;
    if (!version) {
      if (userId) await logAudit(context.env, userId, "project.restore", "invalid", { error: "Missing version", ...auditDevice });
      return jsonResponse({ error: "Missing version" }, { status: 400 });
    }

    const snapshot = await context.env.DB.prepare(
      "SELECT data FROM user_project_snapshots WHERE user_id = ?1 AND version = ?2"
    )
      .bind(userId, version)
      .first();

    if (!snapshot) {
      if (userId) await logAudit(context.env, userId, "project.restore", "invalid", { error: "Snapshot not found", version, ...auditDevice });
      return jsonResponse({ error: "Snapshot not found" }, { status: 404 });
    }

    const current = await context.env.DB.prepare(
      "SELECT data, updated_at FROM user_projects WHERE user_id = ?1"
    )
      .bind(userId)
      .first();
    let remoteData: any = null;

    if (current) {
      try {
        const parsed = JSON.parse(current.data as string);
        const unwrapped = unwrapStoredProject(parsed);
        remoteData = unwrapped.projectData;
      } catch {
        remoteData = null;
      }
      await context.env.DB.prepare(
        "INSERT INTO user_project_snapshots (user_id, version, data, created_at) VALUES (?1, ?2, ?3, ?4)"
      )
        .bind(userId, current.updated_at, current.data as string, Date.now())
        .run();
    }

    const parsed = JSON.parse(snapshot.data as string);
    const { projectData } = unwrapStoredProject(parsed);
    const validation = validateProjectPayload(projectData);
    if (!validation.ok) {
      if (userId) await logAudit(context.env, userId, "project.restore", "invalid", { error: validation.error, version, ...auditDevice });
      return jsonResponse({ error: `Snapshot invalid: ${validation.error}` }, { status: 400 });
    }
    const payload = { projectData, meta: {} };
    const serialized = JSON.stringify(payload);
    const updatedAt = Date.now();

    await context.env.DB.prepare(
      "INSERT INTO user_projects (user_id, data, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(user_id) DO UPDATE SET data=?2, updated_at=?3"
    )
      .bind(userId, serialized, updatedAt)
      .run();

    const changePatch = computeProjectPatch(projectData, remoteData);
    const patchSerialized = JSON.stringify(changePatch);
    await context.env.DB.prepare(
      "INSERT INTO user_project_changes (user_id, version, patch, created_at) VALUES (?1, ?2, ?3, ?4)"
    )
      .bind(userId, updatedAt, patchSerialized, Date.now())
      .run();
    await context.env.DB.prepare(
      "DELETE FROM user_project_changes WHERE user_id = ?1 AND version NOT IN (SELECT version FROM user_project_changes WHERE user_id = ?1 ORDER BY version DESC LIMIT ?2)"
    )
      .bind(userId, userId, CHANGELOG_LIMIT)
      .run();

    if (userId) {
      await logAudit(context.env, userId, "project.restore", "ok", { updatedAt, version, ...auditDevice });
    }
    return jsonResponse(
      { ok: true, updatedAt },
      { headers: { etag: String(updatedAt) } }
    );
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("POST /api/project-restore error", err);
    if (userId) {
      const deviceId = getDeviceId(context.request);
      await logAudit(context.env, userId, "project.restore", "error", { error: "Failed to restore snapshot", deviceId });
    }
    return jsonResponse({ error: "Failed to restore snapshot" }, { status: 500 });
  }
};
