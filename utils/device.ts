const DEVICE_ID_KEY = "syncDeviceId";

const generateDeviceId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try {
      return (crypto as Crypto).randomUUID();
    } catch {
      // Fallback below
    }
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const getDeviceId = () => {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
  } catch {
    // Storage might be blocked; continue with ephemeral ID.
  }
  const id = generateDeviceId();
  try {
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  } catch {
    // Ignore storage failures.
  }
  return id;
};
