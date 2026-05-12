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

/**
 * Dry-run: compares strict reportHint with inferred workbook shape (same rules as import).
 * @returns {{ contentShape: string, ok: boolean, message: string|null }}
 */
export async function validateLoyverseReportHint({ file, reportHint }) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("reportHint", reportHint || "auto");

  const response = await fetch(`${API_URL}/finance/loyverse/validate-report-hint`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "No se pudo validar el archivo.");
  }
  return data.data;
}

export async function importLoyverseFile({ file, reportHint }) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("reportHint", reportHint || "auto");

  const response = await fetch(`${API_URL}/finance/loyverse/import`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error importando Loyverse.");
  }
  return data;
}

export async function fetchLoyverseBatches({ limit = 100 } = {}) {
  const q = limit != null ? `?limit=${encodeURIComponent(String(limit))}` : "";
  const response = await fetch(`${API_URL}/finance/loyverse/batches${q}`, {
    credentials: "include",
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando historial Loyverse.");
  }
  return data;
}

export async function fetchLoyverseBatchFacts(batchId, { limit = 500 } = {}) {
  const q =
    limit != null ? `?limit=${encodeURIComponent(String(limit))}` : "";
  const response = await fetch(
    `${API_URL}/finance/loyverse/batches/${batchId}/facts${q}`,
    { credentials: "include" }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando el lote.");
  }
  return data;
}

export async function deleteLoyverseBatch(batchId) {
  const response = await fetch(
    `${API_URL}/finance/loyverse/batches/${batchId}`,
    { method: "DELETE", credentials: "include" }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error eliminando el lote.");
  }
  return data;
}

/**
 * @param {string[]} factTypes — ej. ['daily_summary'] o ['payment_breakdown']
 */
export async function fetchLoyverseFactsByTypes(factTypes, { limit = 15000 } = {}) {
  const types = (factTypes || []).filter(Boolean).join(",");
  const q = new URLSearchParams();
  q.set("types", types);
  if (limit != null) q.set("limit", String(limit));
  const response = await fetch(
    `${API_URL}/finance/loyverse/facts?${q.toString()}`,
    { credentials: "include" }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando datos.");
  }
  return data;
}

export async function fetchLoyverseDailyRates() {
  const response = await fetch(`${API_URL}/finance/loyverse/daily-rates`, {
    credentials: "include",
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando tasas del día.");
  }
  return data;
}

/** @param {string|null|undefined} rateBs — vacío borra la tasa del día */
export async function saveLoyverseDailyRate(dateStr, rateBs) {
  const response = await fetch(
    `${API_URL}/finance/loyverse/daily-rates/${encodeURIComponent(dateStr)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ rate_bs: rateBs }),
    }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error guardando la tasa.");
  }
  return data;
}
