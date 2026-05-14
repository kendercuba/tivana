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
 * @param {{ date: string, bankAccountId: number|string, paymentMethod?: string, posBatch?: string }} params
 */
export async function fetchLoyverseBankReconciliationSnapshot(params) {
  const q = new URLSearchParams();
  q.set("date", String(params.date || "").slice(0, 10));
  q.set("bankAccountId", String(params.bankAccountId ?? ""));
  if (params.paymentMethod) {
    q.set("paymentMethod", String(params.paymentMethod));
  }
  if (params.posBatch != null && String(params.posBatch).trim() !== "") {
    q.set("posBatch", String(params.posBatch).trim());
  }
  const response = await fetch(
    `${API_URL}/finance/loyverse-bank-reconciliation?${q.toString()}`,
    { credentials: "include" }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando conciliación.");
  }
  return data.data;
}
