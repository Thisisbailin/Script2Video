const rawBase = typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_BASE : "";
const base = typeof rawBase === "string" ? rawBase.replace(/\/+$/, "") : "";

export const buildApiUrl = (path: string) => {
  if (!path.startsWith("/")) {
    return `${base}/${path}`;
  }
  return `${base}${path}`;
};
