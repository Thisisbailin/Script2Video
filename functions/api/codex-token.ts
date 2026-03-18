import { getUserId, jsonResponse } from "./_auth";
import { readUserSecrets } from "./_userSecrets";
import { CODEX_RESPONSES_BASE_URL } from "../../constants";

type Env = {
  DB: any;
  CLERK_SECRET_KEY: string;
  CLERK_JWT_KEY?: string;
};

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  try {
    const userId = await getUserId(context.request, context.env);
    const { secrets } = await readUserSecrets(context.env, userId);
    const codexAuth = secrets.codexAuth;

    if (!codexAuth) {
      return jsonResponse({ error: "Codex is not connected." }, { status: 404 });
    }

    if (codexAuth.apiKey) {
      return jsonResponse({
        authType: "api_key",
        accessToken: codexAuth.apiKey,
        baseUrl: "https://api.openai.com/v1",
        expiresAt: codexAuth.expiresAt,
      });
    }

    if (!codexAuth.accessToken) {
      return jsonResponse({ error: "Codex connection is missing access_token." }, { status: 409 });
    }

    if (codexAuth.expiresAt && codexAuth.expiresAt <= Date.now() + 60_000) {
      return jsonResponse({ error: "Codex access token expired. Please reconnect." }, { status: 401 });
    }

    return jsonResponse({
      authType: "oauth",
      accessToken: codexAuth.accessToken,
      accountId: codexAuth.accountId,
      baseUrl: CODEX_RESPONSES_BASE_URL,
      expiresAt: codexAuth.expiresAt,
    });
  } catch (err: any) {
    if (err instanceof Response) return err;
    return jsonResponse({ error: err?.message || "Failed to resolve Codex token." }, { status: 500 });
  }
};

