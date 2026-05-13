import { getApiBaseUrl } from "../apiBase.js";

const API_URL = getApiBaseUrl();
const BASE = `${API_URL}/zonamarket/loyverse-items`;

export async function fetchZmLoyverseItems() {
  const res = await fetch(`${BASE}/`, { credentials: "include" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || `Error ${res.status}`);
  }
  return body.data ?? [];
}

export async function fetchZmLoyverseItemCategories() {
  const res = await fetch(`${BASE}/categories`, { credentials: "include" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || `Error ${res.status}`);
  }
  return body.data ?? [];
}

/**
 * @param {File} file
 */
export async function importZmLoyverseItemsFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE}/import`, {
    method: "POST",
    body: fd,
    credentials: "include",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || `Error ${res.status}`);
  }
  return body.data;
}

export async function fetchZmLoyverseItemImports({ limit = 100 } = {}) {
  const q = new URLSearchParams();
  if (limit) q.set("limit", String(limit));
  const res = await fetch(`${BASE}/imports?${q}`, { credentials: "include" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || `Error ${res.status}`);
  }
  return body.data ?? [];
}

export async function deleteZmLoyverseItemImport(id) {
  const res = await fetch(`${BASE}/imports/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || `Error ${res.status}`);
  }
}
