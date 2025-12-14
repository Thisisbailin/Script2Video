import { createClerkClient, verifyToken } from "@clerk/backend";

type Env = {
  DB: any; // D1 binding injected by Cloudflare Pages
  CLERK_SECRET_KEY: string;
};

const JSON_HEADERS = { "content-type": "application/json" };

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: JSON_HEADERS, ...init });

async function ensureTable(env: Env) {
  // Create table on first write/read; inexpensive no-op if already exists
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

  // Prefer Bearer token if provided
  if (token) {
    const payload = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
      template: "default", // ensure template exists in Clerk
    });
    if (payload?.sub) return payload.sub;
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
  try {
    const userId = await getUserId(context.request, context.env);
    await ensureTable(context.env);

    const row = await context.env.DB.prepare(
      "SELECT data, updated_at FROM user_projects WHERE user_id = ?1"
    )
      .bind(userId)
      .first();

    if (!row) {
      return new Response("Not Found", { status: 404 });
    }

    const parsed = JSON.parse(row.data as string);
    return jsonResponse({ projectData: parsed, updatedAt: row.updated_at });
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("GET /api/project error", err);
    return jsonResponse({ error: "Failed to load project" }, { status: 500 });
  }
};

export const onRequestPut = async (context: {
  request: Request;
  env: Env;
}) => {
  try {
    const userId = await getUserId(context.request, context.env);
    await ensureTable(context.env);

    const body = await context.request.json();
    if (!body || typeof body !== "object" || !("projectData" in body)) {
      return jsonResponse(
        { error: "Invalid payload. Expect { projectData: {...} }" },
        { status: 400 }
      );
    }

    const cleanedPayload = {
      projectData: body.projectData,
    };

    const serialized = JSON.stringify(cleanedPayload, (_, value) => {
      // Drop File/blob-like values to keep payload JSON-safe
      if (
        typeof File !== "undefined" &&
        value instanceof File
      ) {
        return undefined;
      }
      return value;
    });

    const updatedAt = Date.now();
    await context.env.DB.prepare(
      "INSERT INTO user_projects (user_id, data, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(user_id) DO UPDATE SET data=?2, updated_at=?3"
    )
      .bind(userId, serialized, updatedAt)
      .run();

    return jsonResponse({ ok: true, updatedAt });
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("PUT /api/project error", err);
    return jsonResponse({ error: "Failed to save project" }, { status: 500 });
  }
};
