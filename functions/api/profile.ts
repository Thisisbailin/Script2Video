import { verifyToken } from "@clerk/backend";

type Env = {
  DB: any;
  CLERK_SECRET_KEY: string;
};

const JSON_HEADERS = { "content-type": "application/json" };
const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: JSON_HEADERS, ...init });

async function ensureTable(env: Env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS user_profile (user_id TEXT PRIMARY KEY, avatar_url TEXT)"
  ).run();
}

async function getUserId(request: Request, env: Env) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  const secretKey = typeof env.CLERK_SECRET_KEY === "string" ? env.CLERK_SECRET_KEY.trim() : "";
  if (!secretKey) {
    throw new Response("Missing CLERK_SECRET_KEY on server", { status: 500 });
  }

  if (!token) {
    throw new Response(JSON.stringify({ error: "Unauthorized", detail: "Missing bearer token" }), { status: 401, headers: JSON_HEADERS });
  }

  try {
    const payload = await verifyToken(token, {
      secretKey
    });
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
    await ensureTable(context.env);

    const row = await context.env.DB.prepare(
      "SELECT avatar_url FROM user_profile WHERE user_id = ?1"
    )
      .bind(userId)
      .first();

    if (!row) {
      return new Response("Not Found", { status: 404 });
    }

    return jsonResponse({ avatarUrl: row.avatar_url || null });
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("GET /api/profile error", err);
    return jsonResponse({ error: "Failed to load profile" }, { status: 500 });
  }
};

export const onRequestPut = async (context: { request: Request; env: Env }) => {
  try {
    const userId = await getUserId(context.request, context.env);
    await ensureTable(context.env);

    const body = await context.request.json();
    const avatarUrl = (body && typeof body === "object" && "avatarUrl" in body) ? (body as any).avatarUrl : null;

    await context.env.DB.prepare(
      "INSERT INTO user_profile (user_id, avatar_url) VALUES (?1, ?2) ON CONFLICT(user_id) DO UPDATE SET avatar_url=?2"
    )
      .bind(userId, avatarUrl)
      .run();

    return jsonResponse({ ok: true });
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("PUT /api/profile error", err);
    return jsonResponse({ error: "Failed to save profile" }, { status: 500 });
  }
};
