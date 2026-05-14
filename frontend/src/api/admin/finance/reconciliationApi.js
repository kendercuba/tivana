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

export async function fetchPurchaseReconciliationSummary({ windowDays = 90 } = {}) {
  const q = new URLSearchParams();
  if (windowDays != null) q.set("windowDays", String(windowDays));
  const response = await fetch(
    `${API_URL}/finance/reconciliation/purchase-summary?${q.toString()}`,
    { credentials: "include" }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando resumen de compras.");
  }
  return data.data;
}

export async function fetchPurchaseReconciliationDay(dateYmd, { includeReconciled = false } = {}) {
  const q = new URLSearchParams();
  q.set("date", String(dateYmd || "").slice(0, 10));
  if (includeReconciled) q.set("includeReconciled", "1");
  const response = await fetch(
    `${API_URL}/finance/reconciliation/purchase-day?${q.toString()}`,
    { credentials: "include" }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando conciliación de compras.");
  }
  return data.data;
}

export async function postPurchaseReconciliationLink({ bankMovementId, zmPoLineId }) {
  const response = await fetch(`${API_URL}/finance/reconciliation/purchase-links`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bankMovementId,
      zmPoLineId,
    }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "No se pudo guardar el vínculo.");
  }
  return data.data;
}

export async function deletePurchaseReconciliationLink(bankMovementId) {
  const response = await fetch(
    `${API_URL}/finance/reconciliation/purchase-links/${encodeURIComponent(String(bankMovementId))}`,
    { method: "DELETE", credentials: "include" }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "No se pudo quitar el vínculo.");
  }
  return data.data;
}
