import { getApiBaseUrl } from "../../apiBase.js";

const API_URL = getApiBaseUrl();

async function parseJsonResponse(response) {
  const ct = response.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    await response.text();
    throw new Error(
      response.status === 404
        ? "Ruta de API no encontrada (404)."
        : `Respuesta no JSON (${response.status}).`
    );
  }
  return response.json();
}

export async function fetchZmWeeklyWeekBounds(dateYmd) {
  const q = dateYmd
    ? `?date=${encodeURIComponent(String(dateYmd).slice(0, 10))}`
    : "";
  const response = await fetch(
    `${API_URL}/finance/zm-weekly-overview/week-bounds${q}`,
    { credentials: "include" }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando semana.");
  }
  return data;
}

/**
 * @param {{ weekStartFriday?: string, bankAccountId?: number|string }} opts
 */
export async function fetchZmWeeklyFinanceOverview(opts = {}) {
  const q = new URLSearchParams();
  if (opts.weekStartFriday) {
    q.set("weekStart", String(opts.weekStartFriday).slice(0, 10));
  }
  if (opts.bankAccountId != null && opts.bankAccountId !== "") {
    q.set("bankAccountId", String(opts.bankAccountId));
  }
  const qs = q.toString();
  const response = await fetch(
    `${API_URL}/finance/zm-weekly-overview${qs ? `?${qs}` : ""}`,
    { credentials: "include" }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando resumen semanal.");
  }
  return data;
}
