import type { Script2VideoSessionRecord, Script2VideoSessionStore } from "./types";

export const DEFAULT_AGENT_SESSION_STORAGE_KEY = "script2video_agent_sessions_v1";

const readLocalStorageSessions = (storageKey: string): Record<string, Script2VideoSessionRecord> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeLocalStorageSessions = (storageKey: string, records: Record<string, Script2VideoSessionRecord>) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(records));
};

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
