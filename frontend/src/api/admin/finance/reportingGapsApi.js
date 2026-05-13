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
 * @returns {Promise<{
 *   loyverseDailySummaryMaxBusinessDate: string|null,
 *   loyversePaymentBreakdownMaxBusinessDate: string|null,
 *   bankGlobalMaxMovementDate: string|null,
 *   bankAccounts: Array<{ bankAccountId: number, bankAccountName: string, maxMovementDate: string|null }>
 * }>}
 */
export async function fetchReportingGapsSnapshot() {
  const response = await fetch(`${API_URL}/finance/reporting-gaps`, {
    credentials: "include",
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando avisos de reportes.");
  }
  return data.data;
}
