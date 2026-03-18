import type { CodexConnectionState } from "../types";

export type StoredCodexAuth = {
  source: "local_auth_json" | "manual_json";
  connectedAt: number;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  apiKey?: string;
  accountId?: string;
  email?: string;
  expiresAt?: number;
  lastError?: string;
};

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const readNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const normalizeEpochMillis = (value?: number) => {
  if (!value || !Number.isFinite(value)) return undefined;
  return value > 10_000_000_000 ? value : value * 1000;
};

const parseJwtPayload = (token?: string) => {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const parseStoredCodexAuth = (
  input: unknown,
  source: StoredCodexAuth["source"] = "manual_json"
): StoredCodexAuth => {
  const payload =
    typeof input === "string"
      ? JSON.parse(input)
      : input && typeof input === "object"
        ? (input as Record<string, unknown>)
        : {};
  const tokens =
    payload.tokens && typeof payload.tokens === "object"
      ? (payload.tokens as Record<string, unknown>)
      : payload.session && typeof payload.session === "object"
        ? (payload.session as Record<string, unknown>)
        : payload;

  const accessToken = readString(
    tokens.access_token,
    tokens.accessToken,
    payload.access_token,
    payload.accessToken
  );
  const refreshToken = readString(
    tokens.refresh_token,
    tokens.refreshToken,
    payload.refresh_token,
    payload.refreshToken
  );
  const idToken = readString(tokens.id_token, tokens.idToken, payload.id_token, payload.idToken);
  const apiKey = readString(payload.api_key, payload.apiKey, payload.OPENAI_API_KEY);
  const accountId = readString(
    tokens.account_id,
    tokens.accountId,
    payload.account_id,
    payload.accountId
  );
  const expiresAt = normalizeEpochMillis(
    readNumber(tokens.expires_at, tokens.expiresAt, payload.expires_at, payload.expiresAt)
  );
  const jwt = parseJwtPayload(idToken);
  const email = readString(
    tokens.email,
    payload.email,
    jwt?.email,
    payload.user && typeof payload.user === "object" ? (payload.user as Record<string, unknown>).email : undefined
  );

  if (!accessToken && !apiKey) {
    throw new Error("未在 auth.json 中找到可用的 access_token 或 api_key。");
  }

  return {
    source,
    connectedAt: Date.now(),
    accessToken: accessToken || undefined,
    refreshToken: refreshToken || undefined,
    idToken: idToken || undefined,
    apiKey: apiKey || undefined,
    accountId: accountId || undefined,
    email: email || undefined,
    expiresAt,
  };
};

export const getCodexConnectionState = (auth?: StoredCodexAuth | null): CodexConnectionState => {
  if (!auth) return { status: "disconnected" };
  const expiresSoon = auth.expiresAt && auth.expiresAt <= Date.now() + 60_000;
  return {
    status: expiresSoon ? "expired" : "connected",
    source: auth.source,
    connectedAt: auth.connectedAt,
    expiresAt: auth.expiresAt,
    accountId: auth.accountId,
    email: auth.email,
    hasRefreshToken: Boolean(auth.refreshToken),
    lastError: auth.lastError,
  };
};

