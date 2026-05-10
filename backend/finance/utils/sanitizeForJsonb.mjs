/**
 * Valores seguros para columnas JSONB en PostgreSQL (evita fallos al serializar).
 */

export function jsonReplacerSafe(_key, value) {
  if (value === undefined) return null;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return value;
}

/** Serializa y valida; lanza si el resultado no es JSON válido. */
export function toJsonbParam(value) {
  const s = JSON.stringify(value, jsonReplacerSafe);
  JSON.parse(s);
  return s;
}

/**
 * Objetos planos desde Excel/CSV: solo claves string y valores JSON-safe.
 * Evita tipos raros que rompen el conversor de `pg` hacia jsonb.
 */
export function sanitizeRawRowForJsonb(raw) {
  if (raw == null || typeof raw !== "object") return null;
  return sanitizeValue(raw, 0);
}

function sanitizeValue(v, depth) {
  if (depth > 40) return null;
  if (v === null || v === undefined) return null;
  const t = typeof v;
  if (t === "string" || t === "boolean") return v;
  if (t === "number") return Number.isFinite(v) ? v : null;
  if (t === "bigint") return Number(v);
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map((x) => sanitizeValue(x, depth + 1));
  if (t !== "object") return String(v);

  const out = {};
  for (const [k, val] of Object.entries(v)) {
    const key = String(k).slice(0, 500);
    if (!key) continue;
    out[key] = sanitizeValue(val, depth + 1);
  }
  return out;
}
