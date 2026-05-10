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

export async function fetchFinanceCategories() {
  const response = await fetch(`${API_URL}/finance/categories`, {
    credentials: "include",
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando categorías.");
  }
  return data;
}

export async function createFinanceCategory(body) {
  const response = await fetch(`${API_URL}/finance/categories`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error creando categoría.");
  }
  return data;
}

export async function updateFinanceCategory(id, patch) {
  const response = await fetch(`${API_URL}/finance/categories/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error actualizando categoría.");
  }
  return data;
}

export async function deleteFinanceCategory(id) {
  const response = await fetch(`${API_URL}/finance/categories/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error eliminando categoría.");
  }
  return data;
}
