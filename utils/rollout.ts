export const normalizeRolloutPercent = (value?: number | string) => {
  if (typeof value === "number") {
    if (Number.isFinite(value)) return Math.min(Math.max(value, 0), 100);
    return 100;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.min(Math.max(parsed, 0), 100);
  }
  return 100;
};

export const hashToBucket = (id: string, salt = "") => {
  const input = salt ? `${salt}:${id}` : id;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
};

export const isInRollout = (id: string, percent: number, salt = "") => {
  const normalized = normalizeRolloutPercent(percent);
  if (normalized >= 100) return true;
  if (normalized <= 0) return false;
  return hashToBucket(id, salt) < normalized;
};
