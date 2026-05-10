import { getApiBaseUrl } from "../../apiBase.js";

const API_URL = getApiBaseUrl();

async function parseJsonResponse(response) {
  const ct = response.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    await response.text();
    throw new Error(`Respuesta no JSON (${response.status}).`);
  }
  return response.json();
}

export async function fetchClassificationRules() {
  const response = await fetch(`${API_URL}/finance/classification-rules`, {
    credentials: "include",
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando reglas.");
  }
  return data;
}

export async function createClassificationRule(body) {
  const response = await fetch(`${API_URL}/finance/classification-rules`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error creando regla.");
  }
  return data;
}

export async function updateClassificationRule(id, patch) {
  const response = await fetch(
    `${API_URL}/finance/classification-rules/${id}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error guardando regla.");
  }
  return data;
}

export async function deleteClassificationRule(id) {
  const response = await fetch(
    `${API_URL}/finance/classification-rules/${id}`,
    {
      method: "DELETE",
      credentials: "include",
    }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error eliminando regla.");
  }
  return data;
}
