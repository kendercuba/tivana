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

/** @returns {{ ok: boolean, message: string|null, rowCount?: number }} */
export async function validateZmPurchaseOrdersFile({ file }) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${API_URL}/finance/purchase-orders/validate-format`,
    {
      method: "POST",
      body: formData,
      credentials: "include",
    }
  );

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "No se pudo validar el archivo.");
  }
  return data.data;
}

export async function importZmPurchaseOrdersFile({ file }) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/finance/purchase-orders/import`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error importando órdenes de compra.");
  }
  return data;
}

export async function fetchZmPurchaseOrderMeta() {
  const response = await fetch(`${API_URL}/finance/purchase-orders/meta`, {
    credentials: "include",
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando metadatos.");
  }
  return data;
}

export async function fetchZmPurchaseOrderBatches({ limit = 100 } = {}) {
  const q = limit != null ? `?limit=${encodeURIComponent(String(limit))}` : "";
  const response = await fetch(
    `${API_URL}/finance/purchase-orders/batches${q}`,
    { credentials: "include" }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando historial.");
  }
  return data;
}

export async function fetchZmPurchaseOrderBatchLines(batchId, { limit = 500 } = {}) {
  const q =
    limit != null ? `?limit=${encodeURIComponent(String(limit))}` : "";
  const response = await fetch(
    `${API_URL}/finance/purchase-orders/batches/${batchId}/lines${q}`,
    { credentials: "include" }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando el lote.");
  }
  return data;
}

export async function fetchZmPurchaseOrderLinesInRange(startYmd, endYmd, { limit = 20000 } = {}) {
  const q = new URLSearchParams();
  q.set("start", String(startYmd || "").slice(0, 10));
  q.set("end", String(endYmd || "").slice(0, 10));
  if (limit != null) q.set("limit", String(limit));
  const response = await fetch(
    `${API_URL}/finance/purchase-orders/lines?${q.toString()}`,
    { credentials: "include" }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error cargando líneas de compra.");
  }
  return data;
}

export async function deleteZmPurchaseOrderBatch(batchId) {
  const response = await fetch(
    `${API_URL}/finance/purchase-orders/batches/${batchId}`,
    { method: "DELETE", credentials: "include" }
  );
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Error eliminando el lote.");
  }
  return data;
}
