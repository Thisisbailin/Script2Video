import type { CodexConnectionState } from "../types";
import { buildApiUrl } from "../utils/api";

type AuthTokenGetter = () => Promise<string | null>;

type CodexTokenResponse = {
  accessToken: string;
  baseUrl: string;
  accountId?: string;
  expiresAt?: number;
  authType: "oauth" | "api_key";
};

const buildHeaders = async (getAuthToken?: AuthTokenGetter) => {
  const token = await getAuthToken?.();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
};

const parseResponse = async (response: Response) => {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((data as any)?.error || `Request failed: ${response.status}`);
  }
  return data;
};

export const getCodexConnectionStatus = async (getAuthToken?: AuthTokenGetter): Promise<CodexConnectionState> => {
  const response = await fetch(buildApiUrl("/api/codex-connect"), {
    headers: await buildHeaders(getAuthToken),
  });
  const data = await parseResponse(response);
  return (data?.connection || { status: "disconnected" }) as CodexConnectionState;
};

export const saveCodexAuthJson = async (
  authJson: string | Record<string, unknown>,
  getAuthToken?: AuthTokenGetter
): Promise<CodexConnectionState> => {
  const response = await fetch(buildApiUrl("/api/codex-connect"), {
    method: "POST",
    headers: await buildHeaders(getAuthToken),
    body: JSON.stringify({ action: "save_auth_json", authJson }),
  });
  const data = await parseResponse(response);
  return data.connection as CodexConnectionState;
};

export const disconnectCodexAuth = async (getAuthToken?: AuthTokenGetter): Promise<CodexConnectionState> => {
  const response = await fetch(buildApiUrl("/api/codex-connect"), {
    method: "POST",
    headers: await buildHeaders(getAuthToken),
    body: JSON.stringify({ action: "disconnect" }),
  });
  const data = await parseResponse(response);
  return data.connection as CodexConnectionState;
};

export const getCodexRuntimeToken = async (getAuthToken?: AuthTokenGetter): Promise<CodexTokenResponse> => {
  const response = await fetch(buildApiUrl("/api/codex-token"), {
    headers: await buildHeaders(getAuthToken),
  });
  const data = await parseResponse(response);
  return data as CodexTokenResponse;
};
