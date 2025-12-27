import { verifyToken } from "@clerk/backend";
import { getSyncRolloutInfo, RolloutEnv } from "./rollout";

type Env = {
  DB: any;
  CLERK_SECRET_KEY: string;
  CLERK_JWT_KEY?: string;
} & RolloutEnv;

const JSON_HEADERS = { "content-type": "application/json" };
const CHANGE_LIMIT = 50;

const jsonResponse = (body: unknown, init: ResponseInit = {}) => {
  const headers = { ...JSON_HEADERS, ...(init.headers || {}) };
  return new Response(JSON.stringify(body), { ...init, headers });
};

const stripOuterQuotes = (value: string) => {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
};

const normalizeJwtKey = (value: string) => {
  const unescaped = value.replace(/\\r\\n|\\n|\\r/g, "\n");
  const trimmed = stripOuterQuotes(unescaped.trim());
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

const extractBearerToken = (authHeader: string) => {
  const match = authHeader.match(/Bearer\s+([^,]+)/i);
  const raw = match ? match[1] : authHeader;
  const trimmed = stripOuterQuotes(raw.trim());
  const whitespaceStripped = trimmed.replace(/\s+/g, "");
  return whitespaceStripped.replace(/[^A-Za-z0-9._-]/g, "");
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
  const token = extractBearerToken(authHeader);

  const rawSecret = typeof env.CLERK_SECRET_KEY === "string" ? env.CLERK_SECRET_KEY : "";
  const rawJwtKey = typeof env.CLERK_JWT_KEY === "string" ? env.CLERK_JWT_KEY : "";
  const asciiCleaned = rawSecret.replace(/[^\x20-\x7E]/g, "");
  let secretKey = stripOuterQuotes(asciiCleaned.replace(/\s+/g, ""));
  const jwtKey = normalizeJwtKey(rawJwtKey);
  if (!secretKey && !jwtKey) {
    throw new Response("Missing CLERK_SECRET_KEY on server", { status: 500 });
  }

  if (!token) {
    throw new Response(JSON.stringify({ error: "Unauthorized", detail: "Missing bearer token" }), { status: 401, headers: JSON_HEADERS });
  }

  try {
    const payload = await verifyToken(token, jwtKey ? { jwtKey } : { secretKey });
    if (payload?.sub) return payload.sub;
    throw new Error("Token payload missing sub");
  } catch (err: any) {
    const detail = err?.message || "Token verification failed";
    console.warn("verifyToken failed", err);
    throw new Response(JSON.stringify({ error: "Unauthorized", detail }), { status: 401, headers: JSON_HEADERS });
  }
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
