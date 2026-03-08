import type { AgentSessionMessage, Script2VideoSessionRecord, Script2VideoSessionStore } from "./types";

export const DEFAULT_AGENT_SESSION_STORAGE_KEY = "script2video_agent_sessions_v1";
export const AGENT_SESSION_STORAGE_UPDATED_EVENT = "script2video:agent-session-storage-updated";

const normalizeSessionMessage = (message: any): AgentSessionMessage | null => {
  if (!message || typeof message !== "object") return null;
  const createdAt = typeof message.createdAt === "number" ? message.createdAt : Date.now();
  if (message.role === "tool") {
    if (typeof message.toolName !== "string" || typeof message.toolCallId !== "string") return null;
    return {
      role: "tool",
      text: typeof message.text === "string" ? message.text : "",
      createdAt,
      toolName: message.toolName,
      toolCallId: message.toolCallId,
      toolStatus: message.toolStatus === "error" ? "error" : "success",
      toolOutput: message.toolOutput,
    };
  }
  if (message.role === "user" || message.role === "assistant") {
    return {
      role: message.role,
      text: typeof message.text === "string" ? message.text : "",
      createdAt,
    };
  }
  return null;
};

const normalizeSessionRecord = (value: any): Script2VideoSessionRecord | null => {
  if (!value || typeof value !== "object" || typeof value.id !== "string") return null;
  const messages = Array.isArray(value.messages)
    ? value.messages.map(normalizeSessionMessage).filter(Boolean) as AgentSessionMessage[]
    : [];
  return {
    id: value.id,
    messages,
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : Date.now(),
  };
};

const emitStorageUpdated = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AGENT_SESSION_STORAGE_UPDATED_EVENT));
};

const readLocalStorageSessions = (storageKey: string): Record<string, Script2VideoSessionRecord> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, record]) => [key, normalizeSessionRecord(record)])
        .filter((entry): entry is [string, Script2VideoSessionRecord] => !!entry[1])
    );
  } catch {
    return {};
  }
};

const writeLocalStorageSessions = (storageKey: string, records: Record<string, Script2VideoSessionRecord>) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(records));
  emitStorageUpdated();
};

export const listPersistedAgentSessions = (
  storageKey = DEFAULT_AGENT_SESSION_STORAGE_KEY
): Script2VideoSessionRecord[] =>
  Object.values(readLocalStorageSessions(storageKey)).sort((a, b) => b.updatedAt - a.updatedAt);

export const readPersistedAgentSession = (
  sessionId: string,
  storageKey = DEFAULT_AGENT_SESSION_STORAGE_KEY
): Script2VideoSessionRecord | null => readLocalStorageSessions(storageKey)[sessionId] || null;

export const clearPersistedAgentSession = (
  sessionId: string,
  storageKey = DEFAULT_AGENT_SESSION_STORAGE_KEY
) => {
  const sessions = readLocalStorageSessions(storageKey);
  if (!(sessionId in sessions)) return;
  delete sessions[sessionId];
  writeLocalStorageSessions(storageKey, sessions);
};

export class InMemorySessionStore implements Script2VideoSessionStore {
  private readonly sessions = new Map<string, Script2VideoSessionRecord>();

  getSession(sessionId: string): Script2VideoSessionRecord | null {
    return this.sessions.get(sessionId) || null;
  }

  saveSession(record: Script2VideoSessionRecord): void {
    this.sessions.set(record.id, record);
  }
}

export class LocalStorageSessionStore implements Script2VideoSessionStore {
  constructor(private readonly storageKey = DEFAULT_AGENT_SESSION_STORAGE_KEY) {}

  getSession(sessionId: string): Script2VideoSessionRecord | null {
    const sessions = readLocalStorageSessions(this.storageKey);
    return sessions[sessionId] || null;
  }

  saveSession(record: Script2VideoSessionRecord): void {
    const sessions = readLocalStorageSessions(this.storageKey);
    sessions[record.id] = record;
    writeLocalStorageSessions(this.storageKey, sessions);
  }
}
