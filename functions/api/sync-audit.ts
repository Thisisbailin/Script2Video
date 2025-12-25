import { createClerkClient, verifyToken } from "@clerk/backend";
import { ensureAuditTable } from "./audit";
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

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  try {
    const userId = await getUserId(context.request, context.env);
    const rollout = getSyncRolloutInfo(userId, context.env);
    if (!rollout.enabled) {
      return jsonResponse({ error: "Sync disabled for this account", rollout: { percent: rollout.percent } }, { status: 403 });
    }
    await ensureAuditTable(context.env);

    const rows = await context.env.DB.prepare(
      "SELECT id, action, status, detail, created_at FROM user_sync_audit WHERE user_id = ?1 ORDER BY id DESC LIMIT 50"
    )
      .bind(userId)
      .all();

    const entries = (rows?.results || []).map((row: any) => {
      let detail: any = {};
      try {
        detail = JSON.parse(row.detail as string);
      } catch {
        detail = {};
      }
      return {
        id: row.id,
        action: row.action,
        status: row.status,
        createdAt: row.created_at,
        detail
      };
    });

    return jsonResponse({ entries });
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("GET /api/sync-audit error", err);
    return jsonResponse({ error: "Failed to load audit logs" }, { status: 500 });
  }
};
