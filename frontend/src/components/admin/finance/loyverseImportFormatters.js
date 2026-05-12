/** Shared Loyverse import UI formatters (Spanish copy via parent labels). */

export function formatImportDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-VE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatBs(value) {
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

/** Same visual logic as Loyverse Excel (day/month/year, no time). */
export function formatDateLikeExcel(isoDate) {
  if (!isoDate) return "—";
  const s = String(isoDate).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return String(isoDate);
  return `${Number(d)}/${Number(m)}/${y}`;
}

/** Range of calendar dates covered by rows stored for an import batch (YYYY-MM-DD from API). */
export function formatBatchDataDateRange(minYmd, maxYmd) {
  const a = minYmd ? formatDateLikeExcel(minYmd) : null;
  const b = maxYmd ? formatDateLikeExcel(maxYmd) : null;
  if ((!a || a === "—") && (!b || b === "—")) return "—";
  if (!a || a === "—") return b;
  if (!b || b === "—") return a;
  if (a === b) return a;
  return `${a} – ${b}`;
}

export function formatPercent(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)} %`;
}

/** Integers like Loyverse Excel (transactions, refunds). */
export function formatIntCell(value) {
  if (value == null || value === "") return "—";
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-VE", { maximumFractionDigits: 0 }).format(n);
}

/** Payment type label from row / raw snapshot. */
export function paymentTipoFromRow(row) {
  if (row.payment_type_label) return row.payment_type_label;
  const raw = row.raw_row;
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
      if (String(k).startsWith("_")) continue;
      const nk = String(k)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");
      if (nk.includes("tipo") && nk.includes("pago")) {
        if (v !== "" && v != null) return String(v).trim();
      }
    }
  }
  if (row.payment_method) return String(row.payment_method);
  return "—";
}

/** Spanish label for `loyverse_detected_format`. */
export function formatLoyverseReportKind(code) {
  if (!code) return "—";
  switch (String(code)) {
    case "daily_summary":
      return "Resumen de ventas";
    case "by_payment":
      return "Ventas por tipo de pago";
    case "by_item":
      return "Ventas por artículo";
    default:
      return String(code);
  }
}
