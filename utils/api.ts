const rawBase = typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_BASE : "";
const base = typeof rawBase === "string" ? rawBase.replace(/\/+$/, "") : "";

export const buildApiUrl = (path: string) => {
  if (!path.startsWith("/")) {
    return `${base}/${path}`;
  }
  return `${base}${path}`;
};

export const wrapWithProxy = (url: string) => {
  if (!url) return url;
  // If we are on localhost, we might not need proxy, but it's safer to always use in production
  const proxyEndpoint = buildApiUrl("/api/proxy");
  return `${proxyEndpoint}?url=${encodeURIComponent(url)}`;
};
