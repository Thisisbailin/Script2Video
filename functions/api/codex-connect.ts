import { getUserId, jsonResponse } from "./_auth";
import { readUserSecrets, writeUserSecrets } from "./_userSecrets";
import { getCodexConnectionState, parseStoredCodexAuth } from "../../utils/codexAuth";

type Env = {
  DB: any;
  CLERK_SECRET_KEY: string;
  CLERK_JWT_KEY?: string;
};

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  try {
    const userId = await getUserId(context.request, context.env);
    const { secrets } = await readUserSecrets(context.env, userId);
    return jsonResponse({
      connection: getCodexConnectionState(secrets.codexAuth || null),
    });
  } catch (err: any) {
    if (err instanceof Response) return err;
    return jsonResponse({ error: err?.message || "Failed to load Codex connection." }, { status: 500 });
  }
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const userId = await getUserId(context.request, context.env);
    const body = await context.request.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "";
    const current = await readUserSecrets(context.env, userId);

    if (action === "disconnect") {
      const nextSecrets = { ...current.secrets, codexAuth: null };
      await writeUserSecrets(context.env, userId, nextSecrets);
      return jsonResponse({ ok: true, connection: getCodexConnectionState(null) });
    }

    if (action === "save_auth_json") {
      const nextAuth = parseStoredCodexAuth(body?.authJson ?? body?.auth, "manual_json");
      const nextSecrets = { ...current.secrets, codexAuth: nextAuth };
      await writeUserSecrets(context.env, userId, nextSecrets);
      return jsonResponse({ ok: true, connection: getCodexConnectionState(nextAuth) });
    }

    if (action === "import_local_auth_json") {
      return jsonResponse(
        {
          error: "Cloudflare Pages 部署不支持读取服务器本机 ~/.codex/auth.json，请在浏览器中上传或粘贴 auth.json。",
        },
        { status: 400 }
      );
    }

    return jsonResponse({ error: "Unsupported action." }, { status: 400 });
  } catch (err: any) {
    if (err instanceof Response) return err;
    return jsonResponse({ error: err?.message || "Failed to update Codex connection." }, { status: 500 });
  }
};
