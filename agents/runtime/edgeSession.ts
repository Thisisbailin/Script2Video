import type { AgentInputItem, Session, SessionInputCallback } from "@openai/agents";

type EdgeSessionRecord = {
  id: string;
  items: AgentInputItem[];
  updatedAt: number;
};

const EDGE_SESSION_MAX_ITEMS = 48;
const EDGE_SESSION_HISTORY_WINDOW = 24;
const EDGE_SESSION_TEXT_LIMIT = 2400;
const EDGE_SESSION_TOOL_OUTPUT_LIMIT = 1200;

const getEdgeSessionMap = () => {
  const scope = globalThis as typeof globalThis & {
    __SCRIPT2VIDEO_EDGE_AGENT_SESSIONS__?: Map<string, EdgeSessionRecord>;
  };
  if (!scope.__SCRIPT2VIDEO_EDGE_AGENT_SESSIONS__) {
    scope.__SCRIPT2VIDEO_EDGE_AGENT_SESSIONS__ = new Map<string, EdgeSessionRecord>();
  }
  return scope.__SCRIPT2VIDEO_EDGE_AGENT_SESSIONS__;
};

const cloneItem = <T,>(value: T): T => structuredClone(value);

const isReplayableSessionItem = (item: AgentInputItem) => {
  if (!item || typeof item !== "object") return false;
  const role = (item as any).role;
  return role === "user" || role === "assistant";
};

const trimReplayableItems = (items: AgentInputItem[], limit?: number) => {
  const replayable = items.filter(isReplayableSessionItem);
  if (limit === undefined) return replayable.map(cloneItem);
  if (limit <= 0) return [];
  return replayable.slice(Math.max(replayable.length - limit, 0)).map(cloneItem);
};

const clipText = (value: string, limit: number) => {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}...`;
};

const compactToolOutput = (output: unknown) => {
  if (typeof output !== "string") return output;
  try {
    const parsed = JSON.parse(output);
    if (parsed && typeof parsed === "object") {
      return JSON.stringify({
        status: parsed.status,
        tool: parsed.tool,
        summary: typeof parsed.summary === "string" ? clipText(parsed.summary, 300) : undefined,
      });
    }
  } catch {
    return clipText(output, EDGE_SESSION_TOOL_OUTPUT_LIMIT);
  }
  return clipText(output, EDGE_SESSION_TOOL_OUTPUT_LIMIT);
};

const compactContentParts = (content: unknown) => {
  if (!Array.isArray(content)) return content;
  return content.map((part) => {
    if (!part || typeof part !== "object") return part;
    const cloned = { ...(part as any) };
    if (typeof cloned.text === "string") cloned.text = clipText(cloned.text, EDGE_SESSION_TEXT_LIMIT);
    if (typeof cloned.transcript === "string") cloned.transcript = clipText(cloned.transcript, EDGE_SESSION_TEXT_LIMIT);
    return cloned;
  });
};

const compactAgentItem = (item: AgentInputItem): AgentInputItem => {
  if (!item || typeof item !== "object") return item;
  const cloned = cloneItem(item);
  if ((cloned as any).role === "user" || (cloned as any).role === "assistant") {
    (cloned as any).content = compactContentParts((cloned as any).content);
    return cloned;
  }
  if ((cloned as any).type === "function_call_result") {
    (cloned as any).output = compactToolOutput((cloned as any).output);
    return cloned;
  }
  return cloned;
};

const compactAgentItems = (items: AgentInputItem[], maxItems = EDGE_SESSION_MAX_ITEMS) =>
  items.map(compactAgentItem).slice(-maxItems);

export class EdgeMemorySession implements Session {
  constructor(private readonly sessionId: string) {}

  async getSessionId(): Promise<string> {
    return this.sessionId;
  }

  async getItems(limit?: number): Promise<AgentInputItem[]> {
    const record = getEdgeSessionMap().get(this.sessionId);
    const items = record?.items || [];
    return trimReplayableItems(items, limit);
  }

  async addItems(items: AgentInputItem[]): Promise<void> {
    if (!items.length) return;
    const sessions = getEdgeSessionMap();
    const existing = sessions.get(this.sessionId);
    const merged = [...(existing?.items || []), ...items.map(cloneItem)];
    sessions.set(this.sessionId, {
      id: this.sessionId,
      items: compactAgentItems(merged),
      updatedAt: Date.now(),
    });
  }

  async popItem(): Promise<AgentInputItem | undefined> {
    const sessions = getEdgeSessionMap();
    const existing = sessions.get(this.sessionId);
    if (!existing?.items.length) return undefined;
    const next = existing.items.slice(0, -1);
    const removed = existing.items[existing.items.length - 1];
    sessions.set(this.sessionId, {
      id: this.sessionId,
      items: next,
      updatedAt: Date.now(),
    });
    return cloneItem(removed);
  }

  async clearSession(): Promise<void> {
    getEdgeSessionMap().delete(this.sessionId);
  }
}

export const createEdgeSessionInputCallback =
  (historyWindow = EDGE_SESSION_HISTORY_WINDOW): SessionInputCallback =>
  async (historyItems, newItems) => {
    const trimmedHistory = compactAgentItems(historyItems, historyWindow);
    return [...trimmedHistory, ...newItems];
  };
