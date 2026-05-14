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

export async function fetchZmManualExpenses({ monthYyyyMm } = {}) {
  const q =
    monthYyyyMm != null && String(monthYyyyMm).trim() !== ""
      ? `?month=${encodeURIComponent(String(monthYyyyMm).slice(0, 7))}`
      : "";
  const response = await fetch(`${API_URL}/finance/zm-manual-expenses${q}`, {
    credentials: "include",
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando gastos.");
  }
  return data.data;
}

export async function createZmManualExpense(body) {
  const response = await fetch(`${API_URL}/finance/zm-manual-expenses`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error guardando gasto.");
  }
  return data.data;
}

export async function updateZmManualExpense(id, body) {
  const response = await fetch(
    `${API_URL}/finance/zm-manual-expenses/${encodeURIComponent(String(id))}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error actualizando gasto.");
  }
  return data.data;
}

export async function deleteZmManualExpense(id) {
  const response = await fetch(
    `${API_URL}/finance/zm-manual-expenses/${encodeURIComponent(String(id))}`,
    { method: "DELETE", credentials: "include" }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error eliminando gasto.");
  }
  return data;
}

export async function rematchZmManualExpense(id) {
  const response = await fetch(
    `${API_URL}/finance/zm-manual-expenses/${encodeURIComponent(String(id))}/rematch`,
    { method: "POST", credentials: "include" }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error re-emparejando.");
  }
  return data.data;
}
