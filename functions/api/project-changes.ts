import { createClerkClient, verifyToken } from "@clerk/backend";
import { getSyncRolloutInfo, RolloutEnv } from "./rollout";

type Env = {
  DB: any;
  CLERK_SECRET_KEY: string;
} & RolloutEnv;

const JSON_HEADERS = { "content-type": "application/json" };
const CHANGE_LIMIT = 50;

const jsonResponse = (body: unknown, init: ResponseInit = {}) => {
  const headers = { ...JSON_HEADERS, ...(init.headers || {}) };
  return new Response(JSON.stringify(body), { ...init, headers });
};

async function ensureChangesTable(env: Env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS user_project_changes (user_id TEXT NOT NULL, version INTEGER NOT NULL, patch TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (user_id, version))"
  ).run();
}

async function ensureProjectTable(env: Env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS user_projects (user_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)"
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

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  try {
    const userId = await getUserId(context.request, context.env);
    const rollout = getSyncRolloutInfo(userId, context.env);
    if (!rollout.enabled) {
      return jsonResponse({ error: "Sync disabled for this account", rollout: { percent: rollout.percent } }, { status: 403 });
    }
    await ensureChangesTable(context.env);
    await ensureProjectTable(context.env);

    const url = new URL(context.request.url);
    const sinceParam = url.searchParams.get("since");
    const since = sinceParam ? Number(sinceParam) : NaN;
    if (!Number.isFinite(since)) {
      return jsonResponse({ error: "Missing or invalid 'since' parameter" }, { status: 400 });
    }

    const rows = await context.env.DB.prepare(
      "SELECT version, patch, created_at FROM user_project_changes WHERE user_id = ?1 AND version > ?2 ORDER BY version ASC LIMIT ?3"
    )
      .bind(userId, since, CHANGE_LIMIT)
      .all();

    const latestRow = await context.env.DB.prepare(
      "SELECT updated_at FROM user_projects WHERE user_id = ?1"
    )
      .bind(userId)
      .first();

    const changes = (rows?.results || []).map((row: any) => {
      let patch: any = null;
      try {
        patch = JSON.parse(row.patch as string);
      } catch {
        patch = null;
      }
      return {
        version: row.version,
        createdAt: row.created_at,
        patch
      };
    });

    return jsonResponse({
      changes,
      latestVersion: latestRow?.updated_at ?? since,
      hasMore: (rows?.results || []).length >= CHANGE_LIMIT
    });
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("GET /api/project-changes error", err);
    return jsonResponse({ error: "Failed to load project changes" }, { status: 500 });
  }
};
