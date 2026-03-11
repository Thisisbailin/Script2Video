export const createStableId = (prefix: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const ensureStableId = (value: unknown, prefix: string) => {
  if (typeof value === "string" && value.trim()) return value;
  return createStableId(prefix);
};

export const ensureTypedStableId = (value: unknown, prefix: string) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith(`${prefix}-`)) return trimmed;
  }
  return createStableId(prefix);
};
