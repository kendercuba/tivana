import { getApiBaseUrl } from "../../apiBase.js";

const API_URL = getApiBaseUrl();

async function parseJsonResponse(response) {
  const ct = response.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    await response.text();
    const urlHint = response.url ? ` URL intentada: ${response.url}.` : "";
    throw new Error(
      response.status === 404
        ? `Ruta de API no encontrada (404).${urlHint} El backend debe exponer GET …/api/finance/bank-accounts (prueba …/api/finance/ping). Si el panel está en otro dominio, añade ese origen en CORS del servidor (variable CORS_ORIGINS). Si front y API comparten dominio con proxy /api, puedes construir con VITE_API_URL vacío.`
        : `Respuesta no JSON (${response.status}).${urlHint} ¿Backend encendido y URL correcta?`
    );
  }
  return response.json();
}

export async function fetchBankAccounts({ includeInactive = false } = {}) {
  const q = includeInactive ? "?all=1" : "";
  const response = await fetch(`${API_URL}/finance/bank-accounts${q}`, {
    credentials: "include",
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando cuentas bancarias.");
  }
  return data;
}

export async function createBankAccount({ name, notes, bnc_last_four }) {
  const response = await fetch(`${API_URL}/finance/bank-accounts`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, notes, bnc_last_four }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error creando cuenta.");
  }
  return data;
}

export async function updateBankAccount(id, patch) {
  const response = await fetch(`${API_URL}/finance/bank-accounts/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error actualizando cuenta.");
  }
  return data;
}

export async function deleteBankAccount(id) {
  const response = await fetch(`${API_URL}/finance/bank-accounts/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error eliminando cuenta.");
  }
  return data;
}

export async function fetchBankImportBatches({ limit = 50 } = {}) {
  const q = new URLSearchParams();
  if (limit) q.set("limit", String(limit));

  const response = await fetch(`${API_URL}/finance/bank/batches?${q}`, {
    credentials: "include",
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando historial de importaciones.");
  }
  return data;
}

export async function fetchBankMovementCategories() {
  const response = await fetch(`${API_URL}/finance/bank/movement-categories`, {
    credentials: "include",
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando categorías.");
  }
  return data;
}

export async function patchBankMovementCategory(movementId, category) {
  const response = await fetch(
    `${API_URL}/finance/bank/movements/${movementId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error actualizando la categoría.");
  }
  return data;
}

export async function fetchBankBatchMovements(batchId) {
  const response = await fetch(
    `${API_URL}/finance/bank/batches/${batchId}/movements`,
    { credentials: "include" }
  );

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando movimientos del lote.");
  }
  return data;
}

export async function fetchBankMovementsByAccount(bankAccountId, { limit } = {}) {
  const q = new URLSearchParams();
  if (limit != null) q.set("limit", String(limit));
  const qs = q.toString();
  const url = `${API_URL}/finance/bank/movements/by-account/${bankAccountId}${
    qs ? `?${qs}` : ""
  }`;
  const response = await fetch(url, { credentials: "include" });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando movimientos de la cuenta.");
  }
  return data;
}

export async function patchBankImportBatchAccount(batchId, bankAccountId) {
  const response = await fetch(
    `${API_URL}/finance/bank/batches/${batchId}/account`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankAccountId: Number(bankAccountId) }),
    }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error actualizando la cuenta del lote.");
  }
  return data;
}

export async function deleteBankImportBatch(batchId) {
  const response = await fetch(
    `${API_URL}/finance/bank/batches/${batchId}`,
    {
      method: "DELETE",
      credentials: "include",
    }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error eliminando el lote.");
  }
  return data;
}

export async function fetchBankSummary({ bankAccountId, dateFrom, dateTo } = {}) {
  const q = new URLSearchParams();
  if (bankAccountId != null && bankAccountId !== "") {
    q.set("bankAccountId", String(bankAccountId));
  }
  if (dateFrom) q.set("dateFrom", dateFrom);
  if (dateTo) q.set("dateTo", dateTo);

  const response = await fetch(`${API_URL}/finance/bank/summary?${q}`, {
    credentials: "include",
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando resumen.");
  }
  return data;
}

export async function importBankFile({ file, bankAccountId } = {}) {
  const formData = new FormData();

  formData.append("file", file);
  if (bankAccountId != null && bankAccountId !== "") {
    formData.append("bankAccountId", String(bankAccountId));
  }

  const response = await fetch(`${API_URL}/finance/bank/import`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  const contentType = response.headers.get("content-type");

  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    console.error("Respuesta no JSON:", text);

    throw new Error(
      "El backend no respondió JSON. Revisa VITE_API_URL o la ruta de finance."
    );
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error importando archivo bancario.");
  }

  return data;
}