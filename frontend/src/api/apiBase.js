/**
 * Base para llamadas al backend Express (rutas bajo /api/...).
 * En localhost siempre "/api" → proxy Vite al backend (vite.config.js).
 * Sin esto, `vite preview` o build en localhost usarían solo VITE_API_URL de producción
 * y rutas nuevas (ej. DELETE cuentas) devolverían 404 en el API remoto.
 */
export function getApiBaseUrl() {
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") {
      return "/api";
    }
  }

  if (import.meta.env.DEV) {
    return "/api";
  }

  let raw = import.meta.env.VITE_API_URL;
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    // En Hostinger solo hay estático: /api relativo devuelve index.html (HTML ≠ JSON).
    if (typeof window !== "undefined") {
      const h = window.location.hostname;
      if (h === "tivana.me" || h === "www.tivana.me") {
        raw = "https://api.tivana.me";
      }
    }
  }
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return "/api";
  }
  let b = String(raw).trim();
  while (b.endsWith("/")) {
    b = b.slice(0, -1);
  }
  if (!b.endsWith("/api")) {
    b = `${b}/api`;
  }
  return b;
}
