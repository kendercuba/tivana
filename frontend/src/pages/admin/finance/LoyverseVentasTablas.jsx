import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Banknote, CreditCard, Smartphone, Send, Upload } from "lucide-react";
import {
  fetchLoyverseFactsByTypes,
  fetchLoyverseDailyRates,
  saveLoyverseDailyRate,
  validateLoyverseReportHint,
} from "../../../api/admin/finance/loyverseApi";
import { filesFromFileList } from "../../../utils/filesFromFileList.js";
import LoyversePorPagoDateRange from "../../../components/admin/finance/LoyversePorPagoDateRange.jsx";
import LoyverseImportBatchHistory from "../../../components/admin/finance/LoyverseImportBatchHistory.jsx";
import useLoyverseImport from "../../../hooks/admin/finance/useLoyverseImport";
import { useFinanceBasePath } from "../../../contexts/FinanceBasePathContext.jsx";

/** Excel/CSV Loyverse; el sistema distingue el reporte por cabeceras, no por extensión. */
const LOYVERSE_UPLOAD_ACCEPT =
  ".xls,.xlsx,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Local draft for POS batch / lote number per business day (card sales ↔ bank later). */
const LOYVERSE_CARD_POS_BATCH_STORAGE_KEY = "zm_loyverse_card_pos_batch_by_date";

function formatDateShort(value) {
  if (!value) return "—";
  const d = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-VE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function formatBs(value) {
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

/** Montos Loyverse en USD (precios fijados en dólares en el POS). */
function formatUsd(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatQtySold(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(n);
}

/** Costos netos (USD) = ventas netas − beneficio bruto. */
function costosNetosUsd(row) {
  const net = row.net_sales != null ? Number(row.net_sales) : NaN;
  const profit = row.gross_profit != null ? Number(row.gross_profit) : NaN;
  if (!Number.isFinite(net) || !Number.isFinite(profit)) return null;
  return net - profit;
}

/** @returns {null} vacío / borrar; {number} valor; {undefined} inválido */
function parseRateInput(str) {
  const t = String(str ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

function addDaysYmd(ymdStr, deltaDays) {
  const d = new Date(`${ymdStr}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function daysInclusive(rangeStart, rangeEnd) {
  const a = new Date(`${rangeStart}T12:00:00`);
  const b = new Date(`${rangeEnd}T12:00:00`);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

/** Fecha local del navegador en YYYY-MM-DD (para filas “hasta hoy”). */
function localTodayYmd() {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function minYmd(a, b) {
  if (!a || !b) return a || b || "";
  return a <= b ? a : b;
}

function maxYmd(a, b) {
  if (!a || !b) return a || b || "";
  return a >= b ? a : b;
}

/**
 * Focus calendar on imported batch dates after refresh; fallback to full data span.
 * @param {Array<{ business_date?: string, import_batch_id?: unknown }>} rows
 * @param {number|string} batchId
 * @returns {{ start: string, end: string } | null}
 */
function dateRangeForImportedLoyverseBatch(rows, batchId) {
  const bid = Number(batchId);
  if (!Number.isFinite(bid)) return null;
  const batchDates = rows
    .filter((r) => Number(r.import_batch_id) === bid)
    .map((r) => String(r.business_date || "").slice(0, 10))
    .filter(Boolean)
    .sort();
  if (batchDates.length > 0) {
    return { start: batchDates[0], end: batchDates[batchDates.length - 1] };
  }
  const all = [
    ...new Set(rows.map((r) => String(r.business_date || "").slice(0, 10))),
  ]
    .filter(Boolean)
    .sort();
  if (all.length > 0) {
    return { start: all[0], end: all[all.length - 1] };
  }
  return null;
}

/** Etiqueta como en Loyverse / Excel (Tarjeta, Pago Móvil, Efectivo). */
function formatPaymentMethodLabel(pm) {
  const key = String(pm || "").trim().toLowerCase();
  if (key === "efectivo") return "Efectivo";
  if (key === "pago_movil") return "Pago Móvil";
  if (key === "pos") return "Tarjeta";
  if (key === "zelle") return "Zelle";
  const s = String(pm || "").replace(/_/g, " ");
  if (!s) return "—";
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function refundTxnFromRow(r) {
  const j = r.raw_row;
  if (!j || typeof j !== "object") return 0;
  const v = j._loyverse_refund_txn_count ?? j._refund_txn_count;
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** Importe de reembolsos: columnas del Excel; si no hay, gross − net por fila. */
function refundAmtFromRow(r) {
  const j = r.raw_row;
  if (j && typeof j === "object") {
    const v = j._loyverse_refund_amount ?? j._refund_amount;
    if (v != null && v !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) return Math.max(0, n);
    }
  }
  const g = Number(r.gross_sales);
  const net = Number(r.net_sales);
  if (Number.isFinite(g) && Number.isFinite(net)) {
    const d = g - net;
    return d > 0 ? d : 0;
  }
  return 0;
}

const PAYMENT_SORT_ORDER = ["efectivo", "pago_movil", "pos", "zelle"];

function paymentMethodSortKey(pm) {
  const i = PAYMENT_SORT_ORDER.indexOf(String(pm || ""));
  return i === -1 ? 100 : i;
}

const paymentNumericCellClass =
  "text-right tabular-nums text-base sm:text-lg font-semibold text-gray-900";

/** Wrapper for txn / refund count cells: right-aligned block, balanced padding (Ventas por tipo de pago). */
const paymentCountInnerClass =
  "flex w-full min-h-[1.25rem] items-center justify-end tabular-nums text-base sm:text-lg font-semibold text-gray-900";

/** Icon + label for payment breakdown rows (icons only, no framed boxes; aligned on one line). */
function PaymentMethodWithIcon({ paymentMethod }) {
  const key = String(paymentMethod || "").trim().toLowerCase();
  const label = formatPaymentMethodLabel(paymentMethod);

  const row =
    "flex min-h-[1.75rem] w-full min-w-0 items-center justify-start gap-2.5 text-left text-sm sm:text-base font-semibold text-gray-900";
  const iconClass = "h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]";

  if (key === "efectivo") {
    return (
      <span className={row}>
        <Banknote
          className={`${iconClass} text-amber-800`}
          strokeWidth={2.25}
          aria-hidden
        />
        <span className="min-w-0 leading-snug">{label}</span>
      </span>
    );
  }
  if (key === "pago_movil") {
    return (
      <span className={row}>
        <Smartphone
          className={`${iconClass} text-zm-green`}
          strokeWidth={2.25}
          aria-hidden
        />
        <span className="min-w-0 leading-snug">{label}</span>
      </span>
    );
  }
  if (key === "pos") {
    return (
      <span className={row}>
        <CreditCard
          className={`${iconClass} text-zm-sidebar`}
          strokeWidth={2.25}
          aria-hidden
        />
        <span className="min-w-0 leading-snug">{label}</span>
      </span>
    );
  }
  if (key === "zelle") {
    return (
      <span className={row}>
        <Send
          className={`${iconClass} text-zm-red`}
          strokeWidth={2.25}
          aria-hidden
        />
        <span className="min-w-0 leading-snug">{label}</span>
      </span>
    );
  }

  return (
    <span className={row}>
      <span className="min-w-0 leading-snug">{label}</span>
    </span>
  );
}

/** Tarjeta tipo Loyverse: total USD + total Bs opcional */
function SummaryTotalCard({ title, usdSum, bsSum, accent }) {
  const showBs = bsSum != null && Number.isFinite(bsSum);
  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        accent ? "border-emerald-200 ring-1 ring-emerald-100" : "border-gray-200"
      }`}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {title}
      </p>
      <p className="mt-1 text-xl font-semibold text-gray-900 tabular-nums">
        {formatUsd(usdSum)}
      </p>
      {showBs && (
        <p className="mt-1.5 text-lg sm:text-xl font-semibold text-orange-600 tabular-nums tracking-tight">
          Bs {formatBs(bsSum)}
        </p>
      )}
    </div>
  );
}

/**
 * USD on top, Bs below (orange).
 * `numericSize`: comfort = resumen; large = payment table (bigger, easier to read).
 */
function UsdDualCell({
  usdValue,
  rateBs,
  variant = "default",
  numericSize = "comfort",
  tightPad = false,
}) {
  const usdNum =
    usdValue != null && Number.isFinite(Number(usdValue))
      ? Number(usdValue)
      : null;
  const rateNum =
    rateBs != null && Number.isFinite(Number(rateBs)) ? Number(rateBs) : null;
  const bsLine =
    usdNum != null && rateNum != null ? usdNum * rateNum : null;

  const line1Class =
    variant === "profit"
      ? "text-green-800"
      : variant === "cost"
        ? "text-gray-800"
        : variant === "emphasis"
          ? "font-semibold text-gray-900"
          : "font-semibold text-gray-900";

  const usdText = formatUsd(usdValue);

  const pad = tightPad
    ? "px-1.5 py-2 sm:px-2 min-w-0 max-w-full"
    : "px-3 py-2";
  const usdSize =
    numericSize === "large"
      ? "text-base sm:text-lg font-semibold tabular-nums leading-tight tracking-tight"
      : "text-[15px] leading-snug tabular-nums";
  const bsSize =
    numericSize === "large"
      ? "text-sm sm:text-base font-semibold tabular-nums leading-tight text-orange-600"
      : "text-[14px] sm:text-[15px] leading-snug text-orange-600 font-semibold tabular-nums";

  const bsWrapClass =
    numericSize === "large"
      ? "whitespace-nowrap"
      : "break-all sm:break-normal";

  const innerFlexClass =
    numericSize === "large"
      ? "flex w-full flex-col items-end justify-center gap-0.5 text-right sm:gap-1 whitespace-nowrap"
      : "flex min-w-0 flex-col items-end justify-center gap-0.5 sm:gap-1";

  return (
    <td className={`${pad} text-right align-middle ${line1Class}`}>
      <div className={innerFlexClass}>
        <span className={usdSize}>{usdText}</span>
        {bsLine != null && (
          <span className={`${bsSize} ${bsWrapClass}`}>
            Bs {formatBs(bsLine)}
          </span>
        )}
      </div>
    </td>
  );
}

/**
 * Totales USD + Bs ya convertidos (cada fila importada × tasa de su día).
 * Las tasas vienen de «Resumen de ventas» (API daily-rates).
 */
function UsdBsAggregateCell({
  usdValue,
  bsSum,
  variant = "default",
  numericSize = "comfort",
  tightPad = false,
}) {
  const line1Class =
    variant === "emphasis"
      ? "font-semibold text-gray-900"
      : "font-semibold text-gray-900";
  const usdText = formatUsd(usdValue);
  const showBs =
    bsSum != null &&
    Number.isFinite(bsSum) &&
    Math.abs(Number(bsSum)) > 1e-6;

  const pad = tightPad
    ? "px-1.5 py-2 sm:px-2 min-w-0 max-w-full"
    : "px-3 py-2";
  const usdSize =
    numericSize === "large"
      ? "text-base sm:text-lg font-semibold tabular-nums leading-tight tracking-tight"
      : "text-[15px] leading-snug tabular-nums";
  const bsSize =
    numericSize === "large"
      ? "text-sm sm:text-base font-semibold tabular-nums leading-tight text-orange-600"
      : "text-[14px] sm:text-[15px] leading-snug text-orange-600 font-semibold tabular-nums";

  const bsWrapClass =
    numericSize === "large"
      ? "whitespace-nowrap"
      : "break-all sm:break-normal";

  const innerFlexClass =
    numericSize === "large"
      ? "flex w-full flex-col items-end justify-center gap-0.5 text-right sm:gap-1 whitespace-nowrap"
      : "flex min-w-0 flex-col items-end justify-center gap-0.5 sm:gap-1";

  return (
    <td className={`${pad} text-right align-middle ${line1Class}`}>
      <div className={innerFlexClass}>
        <span className={usdSize}>{usdText}</span>
        {showBs && (
          <span className={`${bsSize} ${bsWrapClass}`}>
            Bs {formatBs(bsSum)}
          </span>
        )}
      </div>
    </td>
  );
}

/** Resumen de ventas (filas daily_summary importadas). */
export function LoyverseResumenVentas({
  highlightBatchId = null,
  onHighlightBatchIdChange,
} = {}) {
  const [topTab, setTopTab] = useState("tabla");
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [fileHintError, setFileHintError] = useState(null);
  const [fileHintValidating, setFileHintValidating] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const {
    loading: importLoading,
    error: importError,
    result: importResult,
    handleImport,
  } = useLoyverseImport();

  const [rows, setRows] = useState([]);
  const [ratesByDate, setRatesByDate] = useState({});
  const [drafts, setDrafts] = useState({});
  /** Solo una fecha en edición: con tasa guardada se muestra texto fijo hasta clic. */
  const [editingRateDate, setEditingRateDate] = useState(null);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeBootstrapped, setRangeBootstrapped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const refreshFacts = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);
      const factsRes = await fetchLoyverseFactsByTypes(["daily_summary"], {
        limit: 15000,
      });
      let ratesData = [];
      try {
        const ratesRes = await fetchLoyverseDailyRates();
        ratesData = ratesRes.data || [];
      } catch {
        ratesData = [];
      }
      const data = factsRes.data || [];
      setRows(data);
      const map = {};
      for (const row of ratesData) {
        if (row.business_date != null && row.rate_bs != null) {
          map[row.business_date] = Number(row.rate_bs);
        }
      }
      setRatesByDate(map);
      return data;
    } catch (e) {
      setErr(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFacts();
  }, [refreshFacts]);

  useEffect(() => {
    if (!importResult?.success || importResult?.data?.importBatchId == null) {
      return;
    }
    const batchId = importResult.data.importBatchId;
    onHighlightBatchIdChange?.(batchId);
    setHistoryRefresh((n) => n + 1);
    setUploadFiles([]);
    setUploadInputKey((k) => k + 1);

    let cancelled = false;
    void (async () => {
      const data = await refreshFacts();
      if (cancelled || !data) return;
      const span = dateRangeForImportedLoyverseBatch(data, batchId);
      if (span) {
        setRangeStart(span.start);
        setRangeEnd(span.end);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    importResult?.data?.importBatchId,
    importResult?.success,
    onHighlightBatchIdChange,
    refreshFacts,
  ]);

  useEffect(() => {
    if (rangeBootstrapped || loading) return;
    if (rows.length > 0) {
      const uniq = [
        ...new Set(rows.map((r) => String(r.business_date || "").slice(0, 10))),
      ]
        .filter(Boolean)
        .sort();
      if (uniq.length === 0) return;
      setRangeStart(uniq[0]);
      setRangeEnd(uniq[uniq.length - 1]);
      setRangeBootstrapped(true);
      return;
    }
    const t = localTodayYmd();
    setRangeStart(t);
    setRangeEnd(t);
    setRangeBootstrapped(true);
  }, [rows, rangeBootstrapped, loading]);

  const filteredRows = useMemo(() => {
    if (!rangeStart || !rangeEnd) return rows;
    const lo = minYmd(rangeStart, rangeEnd);
    const hi = maxYmd(rangeStart, rangeEnd);
    return rows.filter((r) => {
      const d = String(r.business_date || "").slice(0, 10);
      return d && d >= lo && d <= hi;
    });
  }, [rows, rangeStart, rangeEnd]);

  /** Una fila importada por día (si hay varios lotes, gana el de mayor batch). */
  const rowsByDate = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      const d = String(r.business_date || "").slice(0, 10);
      if (!d) continue;
      const prev = m.get(d);
      const prevBatch = prev?.import_batch_id ?? 0;
      const curBatch = r.import_batch_id ?? 0;
      if (!prev || curBatch > prevBatch) m.set(d, r);
    }
    return m;
  }, [rows]);

  /** Fechas mín/máx con datos importados (presets y «Todo el historial» del calendario). */
  const importDateBounds = useMemo(() => {
    const uniq = [
      ...new Set(rows.map((r) => String(r.business_date || "").slice(0, 10))),
    ]
      .filter(Boolean)
      .sort();
    if (uniq.length === 0) return { min: "", max: "" };
    return { min: uniq[0], max: uniq[uniq.length - 1] };
  }, [rows]);

  /**
   * Días a mostrar (descendente): todo el rango elegido y, si hoy pasó del fin del rango,
   * filas vacías hasta la fecha actual para poder cargar la tasa antes del próximo Excel.
   */
  const resumenDisplayDates = useMemo(() => {
    if (!rangeStart || !rangeEnd) return [];
    const todayStr = localTodayYmd();
    const rangeLo = minYmd(rangeStart, rangeEnd);
    const rangeHi = maxYmd(rangeStart, rangeEnd);
    const tableHi =
      todayStr > rangeHi ? todayStr : minYmd(rangeHi, todayStr);
    const tableLo = rangeLo;
    if (!tableLo || !tableHi || tableLo > tableHi) return [];

    const out = [];
    let d = tableLo;
    let guard = 0;
    while (d <= tableHi && guard < 400) {
      out.push(d);
      const next = addDaysYmd(d, 1);
      if (next <= d) break;
      d = next;
      guard += 1;
    }
    out.sort((a, b) => b.localeCompare(a));
    return out;
  }, [rangeStart, rangeEnd]);

  const totals = useMemo(() => {
    const rateFn = (dateStr) => {
      if (!dateStr) return null;
      if (Object.prototype.hasOwnProperty.call(drafts, dateStr)) {
        const p = parseRateInput(drafts[dateStr]);
        if (p === undefined || p === null) return null;
        return p;
      }
      const v = ratesByDate[dateStr];
      return v != null && Number.isFinite(Number(v)) ? Number(v) : null;
    };

    let gross = 0;
    let net = 0;
    let profit = 0;
    let cost = 0;
    let bsGross = 0;
    let bsNet = 0;
    let bsProfit = 0;
    let bsCost = 0;
    let nGrossBs = 0;
    let nNetBs = 0;
    let nProfitBs = 0;
    let nCostBs = 0;

    for (const r of filteredRows) {
      const d = String(r.business_date || "").slice(0, 10);
      const rate = rateFn(d);
      const g = Number(r.gross_sales);
      const n = Number(r.net_sales);
      const pr = Number(r.gross_profit);
      const co = costosNetosUsd(r);

      if (Number.isFinite(g)) gross += g;
      if (Number.isFinite(n)) net += n;
      if (Number.isFinite(pr)) profit += pr;
      if (co != null && Number.isFinite(co)) cost += co;

      if (rate != null) {
        if (Number.isFinite(g)) {
          bsGross += g * rate;
          nGrossBs += 1;
        }
        if (Number.isFinite(n)) {
          bsNet += n * rate;
          nNetBs += 1;
        }
        if (Number.isFinite(pr)) {
          bsProfit += pr * rate;
          nProfitBs += 1;
        }
        if (co != null && Number.isFinite(co)) {
          bsCost += co * rate;
          nCostBs += 1;
        }
      }
    }

    return {
      gross,
      net,
      profit,
      cost,
      bsGross: nGrossBs > 0 ? bsGross : null,
      bsNet: nNetBs > 0 ? bsNet : null,
      bsProfit: nProfitBs > 0 ? bsProfit : null,
      bsCost: nCostBs > 0 ? bsCost : null,
    };
  }, [filteredRows, drafts, ratesByDate]);

  function shiftRange(direction) {
    if (!rangeStart || !rangeEnd) return;
    const step = daysInclusive(rangeStart, rangeEnd);
    setRangeStart(addDaysYmd(rangeStart, direction * step));
    setRangeEnd(addDaysYmd(rangeEnd, direction * step));
  }

  function rateDisplay(dateStr) {
    if (!dateStr) return "";
    if (Object.prototype.hasOwnProperty.call(drafts, dateStr)) {
      return drafts[dateStr];
    }
    const v = ratesByDate[dateStr];
    return v != null && Number.isFinite(Number(v)) ? String(v) : "";
  }

  /**
   * Tasa usada para USD→Bs en cada fila: borrador (mientras escribes) o valor guardado.
   * Así la línea naranja aparece en todas las filas en cuanto la tasa es válida,
   * no solo en la primera guardada en servidor.
   */
  function effectiveRateForBsConversion(dateStr) {
    if (!dateStr) return null;
    if (Object.prototype.hasOwnProperty.call(drafts, dateStr)) {
      const p = parseRateInput(drafts[dateStr]);
      if (p === undefined || p === null) return null;
      return p;
    }
    const v = ratesByDate[dateStr];
    return v != null && Number.isFinite(Number(v)) ? Number(v) : null;
  }

  async function handleResumenFileSelected(e) {
    const picked = filesFromFileList(e.target.files);
    setFileHintError(null);
    if (picked.length === 0) {
      setUploadFiles([]);
      return;
    }
    setFileHintValidating(true);
    try {
      for (const file of picked) {
        const v = await validateLoyverseReportHint({
          file,
          reportHint: "daily_summary",
        });
        if (!v.ok) {
          setFileHintError(
            `${file.name}: ${v.message || "No corresponde al resumen de ventas."}`
          );
          setUploadFiles([]);
          setUploadInputKey((k) => k + 1);
          return;
        }
      }
      setUploadFiles(picked);
    } catch (err) {
      setFileHintError(err.message || "No se pudo validar el archivo.");
      setUploadFiles([]);
      setUploadInputKey((k) => k + 1);
    } finally {
      setFileHintValidating(false);
    }
  }

  function handleResumenExcelSubmit(e) {
    e.preventDefault();
    if (uploadFiles.length === 0) {
      window.alert("Selecciona un archivo Excel o CSV exportado desde Loyverse.");
      return;
    }
    handleImport({ files: uploadFiles, reportHint: "daily_summary" });
  }

  async function commitRate(dateStr) {
    const raw = drafts[dateStr] !== undefined ? drafts[dateStr] : rateDisplay(dateStr);
    const parsed = parseRateInput(raw);
    if (parsed === undefined) {
      window.alert(
        "Introduce un número válido para la tasa (usa punto o coma decimal)."
      );
      return;
    }
    try {
      if (parsed === null) {
        await saveLoyverseDailyRate(dateStr, null);
        setRatesByDate((prev) => {
          const n = { ...prev };
          delete n[dateStr];
          return n;
        });
      } else {
        await saveLoyverseDailyRate(dateStr, parsed);
        setRatesByDate((prev) => ({ ...prev, [dateStr]: parsed }));
      }
      setDrafts((d) => {
        const n = { ...d };
        delete n[dateStr];
        return n;
      });
      setEditingRateDate(null);
    } catch (e) {
      window.alert(e.message || "No se pudo guardar la tasa.");
    }
  }

  const resumenSubBtn = (key, label) => (
    <button
      type="button"
      onClick={() => setTopTab(key)}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
        topTab === key
          ? "bg-zm-cream/70 border-zm-green/45 text-zm-sidebar shadow-sm"
          : "bg-transparent border-transparent text-gray-600 hover:text-zm-sidebar hover:bg-zm-cream/40"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full max-w-7xl font-zm">
      <div className="flex items-center bg-zm-green px-4 sm:px-6 py-3 text-white shadow-sm rounded-b-xl">
        <h1 className="text-sm sm:text-base font-semibold tracking-tight">
          Resumen de ventas
        </h1>
      </div>
      <div className="px-4 pt-3 pb-6 space-y-3">
      <div className="border-b border-zm-green/20">
        <div className="flex flex-wrap gap-1 py-1">
          {resumenSubBtn("tabla", "Tabla resumen")}
          {resumenSubBtn("historial", "Historial de cargas")}
        </div>
      </div>

      {topTab === "historial" ? (
        <LoyverseImportBatchHistory
          detectedFormatFilter="daily_summary"
          refreshToken={historyRefresh}
          preferredSelectBatchId={importResult?.data?.importBatchId ?? null}
          onDeleted={() => void refreshFacts()}
        />
      ) : (
        <>
          {err && (
            <p className="text-sm text-zm-red">{err}</p>
          )}
          {loading && (
            <p className="text-sm text-gray-500">Cargando…</p>
          )}
          {!loading && rows.length === 0 && !err && (
            <p className="text-sm text-gray-600">
              No hay resúmenes importados. Usa la carga Excel junto al calendario o la pestaña
              «Cargar reporte Ventas» para más opciones de tipo de archivo.
            </p>
          )}
          {!loading && (
            <>
              <section className="rounded-xl border border-zm-green/20 bg-white p-3 sm:p-4 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <button
                    type="button"
                    className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-gray-700 hover:bg-gray-50 shrink-0"
                    title="Periodo anterior"
                    aria-label="Periodo anterior"
                    onClick={() => shiftRange(-1)}
                  >
                    ‹
                  </button>
                  <LoyversePorPagoDateRange
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    dataMinYmd={importDateBounds.min}
                    dataMaxYmd={importDateBounds.max}
                    onApplyRange={(startYmd, endYmd) => {
                      setRangeStart(startYmd);
                      setRangeEnd(endYmd);
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-gray-700 hover:bg-gray-50 shrink-0"
                    title="Periodo siguiente"
                    aria-label="Periodo siguiente"
                    onClick={() => shiftRange(1)}
                  >
                    ›
                  </button>

                  <form
                    onSubmit={handleResumenExcelSubmit}
                    className="flex flex-wrap items-center gap-2 min-w-0 w-full sm:w-auto sm:ml-auto sm:justify-end"
                  >
                    <label
                      className={`cursor-pointer inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-zm-green/40 bg-white px-3 py-2 text-xs font-semibold text-zm-green hover:bg-zm-green/5 focus-within:ring-2 focus-within:ring-zm-green/40 ${
                        fileHintValidating ? "pointer-events-none opacity-60" : ""
                      }`}
                    >
                      <Upload
                        className="h-4 w-4 shrink-0 opacity-90"
                        aria-hidden
                        strokeWidth={2.25}
                      />
                      <span>Seleccionar archivo(s)</span>
                      <input
                        key={uploadInputKey}
                        type="file"
                        multiple
                        accept={LOYVERSE_UPLOAD_ACCEPT}
                        className="sr-only"
                        aria-label="Seleccionar uno o varios archivos del reporte Resumen de ventas Loyverse"
                        disabled={fileHintValidating}
                        onChange={handleResumenFileSelected}
                      />
                    </label>
                    {uploadFiles.length > 0 && (
                      <>
                        <span
                          className="text-xs text-gray-700 truncate min-w-0 max-w-[10rem] sm:max-w-[18rem] font-medium"
                          title={uploadFiles.map((f) => f.name).join("\n")}
                        >
                          {uploadFiles.length === 1
                            ? uploadFiles[0].name
                            : `${uploadFiles.length} archivos seleccionados`}
                        </span>
                        <button
                          type="submit"
                          disabled={importLoading || fileHintValidating}
                          className="shrink-0 rounded-lg bg-zm-green px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zm-green-dark focus-visible:outline focus-visible:ring-2 focus-visible:ring-zm-green/45 disabled:opacity-50"
                        >
                          {importLoading ? "Importando…" : "Importar"}
                        </button>
                      </>
                    )}
                  </form>
                </div>

                {importError && (
                  <p className="text-sm text-zm-red">{importError}</p>
                )}
                {fileHintValidating && (
                  <p className="text-xs text-gray-600">Validando archivos…</p>
                )}
                {fileHintError && (
                  <p className="text-sm text-zm-red" role="alert">
                    {fileHintError}
                  </p>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                  <SummaryTotalCard
                    title="Ventas brutas"
                    usdSum={totals.gross}
                    bsSum={totals.bsGross}
                    accent
                  />
                  <SummaryTotalCard
                    title="Ventas netas"
                    usdSum={totals.net}
                    bsSum={totals.bsNet}
                    accent={false}
                  />
                  <SummaryTotalCard
                    title="Beneficio bruto"
                    usdSum={totals.profit}
                    bsSum={totals.bsProfit}
                    accent={false}
                  />
                  <SummaryTotalCard
                    title="Costos netos"
                    usdSum={totals.cost}
                    bsSum={totals.bsCost}
                    accent={false}
                  />
                </div>
              </section>

              <div className="max-h-[min(65vh,36rem)] sm:max-h-[min(70vh,42rem)] overflow-y-auto overflow-x-auto border border-zm-green/15 rounded-lg bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
                <table className="min-w-[920px] w-full text-sm">
                  <thead className="sticky top-0 z-10 border-b border-zm-green/25 bg-zm-cream [&_th]:bg-zm-cream">
                    <tr>
                      <th className="text-left px-3 py-2">Fecha</th>
                      <th className="text-right px-3 py-2 whitespace-nowrap text-xs sm:text-sm font-medium">
                        Tasa del día (Bs)
                      </th>
                      <th className="text-right px-3 py-2 whitespace-nowrap">
                        <span className="block">Ventas brutas</span>
                        <span className="block text-[10px] font-normal text-gray-500">
                          (USD)
                        </span>
                      </th>
                      <th className="text-right px-3 py-2 whitespace-nowrap">
                        <span className="block">Ventas netas</span>
                        <span className="block text-[10px] font-normal text-gray-500">
                          (USD)
                        </span>
                      </th>
                      <th className="text-right px-3 py-2 whitespace-nowrap">
                        <span className="block">Beneficio bruto</span>
                        <span className="block text-[10px] font-normal text-gray-500">
                          (USD)
                        </span>
                      </th>
                      <th className="text-right px-3 py-2 whitespace-nowrap">
                        <span className="block">Costos netos</span>
                        <span className="block text-[10px] font-normal text-gray-500">
                          (USD)
                        </span>
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-normal text-gray-500">
                        Lote
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumenDisplayDates.map((dateStr) => {
                      const r = rowsByDate.get(dateStr);
                      const isPlaceholder = !r;
                      const cn = r ? costosNetosUsd(r) : null;
                      const savedRate = dateStr ? ratesByDate[dateStr] : null;
                      const hasSavedRate =
                        savedRate != null && Number.isFinite(Number(savedRate));
                      const isEditingRate = editingRateDate === dateStr;
                      const showRateInput =
                        dateStr && (!hasSavedRate || isEditingRate);
                      const rateForUsdBs = effectiveRateForBsConversion(dateStr);
                      const isNewFromUpload =
                        highlightBatchId != null &&
                        r?.import_batch_id != null &&
                        Number(r.import_batch_id) === Number(highlightBatchId);

                      return (
                        <tr
                          key={r?.id ?? `placeholder-${dateStr}`}
                          className={`border-t border-gray-100 hover:bg-gray-50 ${
                            isPlaceholder ? "bg-gray-50/90" : ""
                          } ${
                            isNewFromUpload
                              ? "border-zm-green/10 bg-zm-yellow/30 hover:bg-zm-yellow/40"
                              : ""
                          }`}
                        >
                          <td className="px-3 py-2 whitespace-nowrap">
                            {formatDateShort(dateStr)}
                          </td>
                          <td className="px-3 py-2 text-right align-middle">
                            {dateStr && showRateInput ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="Bs"
                                autoFocus={hasSavedRate && isEditingRate}
                                aria-label={`Tasa del día en Bs para ${dateStr}`}
                                className="w-full min-w-[6.5rem] max-w-[9rem] ml-auto rounded border border-gray-200 px-2 py-1 text-right text-sm tabular-nums focus:border-zm-green focus:outline-none focus:ring-1 focus:ring-zm-green/50"
                                value={rateDisplay(dateStr)}
                                onChange={(e) =>
                                  setDrafts((d) => ({
                                    ...d,
                                    [dateStr]: e.target.value,
                                  }))
                                }
                                onBlur={() => void commitRate(dateStr)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") e.currentTarget.blur();
                                }}
                              />
                            ) : dateStr && hasSavedRate ? (
                              <button
                                type="button"
                                className="w-full max-w-[9rem] ml-auto block rounded px-2 py-1.5 text-right text-sm font-medium tabular-nums text-gray-900 hover:bg-gray-100 border border-transparent hover:border-gray-200"
                                title="Clic para editar la tasa"
                                onClick={() => {
                                  setEditingRateDate(dateStr);
                                  setDrafts((d) => ({
                                    ...d,
                                    [dateStr]: String(savedRate),
                                  }));
                                }}
                              >
                                {formatBs(savedRate)}
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                          <UsdDualCell
                            usdValue={r?.gross_sales}
                            rateBs={rateForUsdBs}
                            variant="default"
                          />
                          <UsdDualCell
                            usdValue={r?.net_sales}
                            rateBs={rateForUsdBs}
                            variant="emphasis"
                          />
                          <UsdDualCell
                            usdValue={r?.gross_profit}
                            rateBs={rateForUsdBs}
                            variant="profit"
                          />
                          <UsdDualCell
                            usdValue={cn}
                            rateBs={rateForUsdBs}
                            variant="cost"
                          />
                          <td className="px-3 py-2 text-right text-xs text-gray-400 font-mono">
                            {r?.import_batch_id != null
                              ? `#${r.import_batch_id}`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
      </div>
    </div>
  );
}

/** Ventas por tipo de pago — misma estructura que Loyverse Back Office + Excel. */
export function LoyverseVentasPorPago({
  highlightBatchId = null,
  onHighlightBatchIdChange,
} = {}) {
  const [topTab, setTopTab] = useState("tabla");
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [fileHintError, setFileHintError] = useState(null);
  const [fileHintValidating, setFileHintValidating] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const {
    loading: importLoading,
    error: importError,
    result: importResult,
    handleImport,
  } = useLoyverseImport();

  const [rows, setRows] = useState([]);
  const [ratesByDate, setRatesByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeBootstrapped, setRangeBootstrapped] = useState(false);
  const financeBase = useFinanceBasePath();
  /** YYYY-MM-DD → lote POS (tarjeta); borrador local hasta cruce con banco. */
  const [posBatchByDate, setPosBatchByDate] = useState(() => {
    try {
      const raw = localStorage.getItem(LOYVERSE_CARD_POS_BATCH_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });

  const persistPosBatchByDate = useCallback((dateYmd, value) => {
    setPosBatchByDate((prev) => {
      const next = { ...prev, [dateYmd]: value };
      try {
        localStorage.setItem(
          LOYVERSE_CARD_POS_BATCH_STORAGE_KEY,
          JSON.stringify(next)
        );
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const refreshFacts = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetchLoyverseFactsByTypes(["payment_breakdown"], {
        limit: 15000,
      });
      let ratesData = [];
      try {
        const ratesRes = await fetchLoyverseDailyRates();
        ratesData = ratesRes.data || [];
      } catch {
        ratesData = [];
      }
      const data = res.data || [];
      setRows(data);
      const map = {};
      for (const row of ratesData) {
        const dk = String(row.business_date || "").slice(0, 10);
        if (dk && row.rate_bs != null) {
          map[dk] = Number(row.rate_bs);
        }
      }
      setRatesByDate(map);
      return data;
    } catch (e) {
      setErr(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFacts();
  }, [refreshFacts]);

  useEffect(() => {
    if (!importResult?.success || importResult?.data?.importBatchId == null) {
      return;
    }
    const batchId = importResult.data.importBatchId;
    onHighlightBatchIdChange?.(batchId);
    setHistoryRefresh((n) => n + 1);
    setUploadFiles([]);
    setUploadInputKey((k) => k + 1);

    let cancelled = false;
    void (async () => {
      const data = await refreshFacts();
      if (cancelled || !data) return;
      const span = dateRangeForImportedLoyverseBatch(data, batchId);
      if (span) {
        setRangeStart(span.start);
        setRangeEnd(span.end);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    importResult?.data?.importBatchId,
    importResult?.success,
    onHighlightBatchIdChange,
    refreshFacts,
  ]);

  useEffect(() => {
    if (rangeBootstrapped || loading) return;
    if (rows.length > 0) {
      const uniq = [
        ...new Set(rows.map((r) => String(r.business_date || "").slice(0, 10))),
      ]
        .filter(Boolean)
        .sort();
      if (uniq.length === 0) return;
      setRangeStart(uniq[0]);
      setRangeEnd(uniq[uniq.length - 1]);
      setRangeBootstrapped(true);
      return;
    }
    const t = localTodayYmd();
    setRangeStart(t);
    setRangeEnd(t);
    setRangeBootstrapped(true);
  }, [rows, rangeBootstrapped, loading]);

  const { dataMinYmd, dataMaxYmd } = useMemo(() => {
    const uniq = [
      ...new Set(rows.map((r) => String(r.business_date || "").slice(0, 10))),
    ]
      .filter(Boolean)
      .sort();
    if (uniq.length === 0) return { dataMinYmd: "", dataMaxYmd: "" };
    return { dataMinYmd: uniq[0], dataMaxYmd: uniq[uniq.length - 1] };
  }, [rows]);

  /** Last day with payment data in the current range (calendar opens on this month on this page). */
  const calendarMonthAnchorYmd = useMemo(() => {
    if (!rangeStart || !rangeEnd || rows.length === 0) {
      return dataMaxYmd || rangeEnd || rangeStart || "";
    }
    const lo = minYmd(rangeStart, rangeEnd);
    const hi = maxYmd(rangeStart, rangeEnd);
    let best = "";
    for (const r of rows) {
      const d = String(r.business_date || "").slice(0, 10);
      if (!d || d < lo || d > hi) continue;
      if (!best || d > best) best = d;
    }
    return best || dataMaxYmd || rangeEnd || rangeStart;
  }, [rows, rangeStart, rangeEnd, dataMaxYmd]);

  const filteredRows = useMemo(() => {
    if (!rangeStart || !rangeEnd) return rows;
    const lo = minYmd(rangeStart, rangeEnd);
    const hi = maxYmd(rangeStart, rangeEnd);
    return rows.filter((r) => {
      const d = String(r.business_date || "").slice(0, 10);
      return d && d >= lo && d <= hi;
    });
  }, [rows, rangeStart, rangeEnd]);

  const pagoHighlightKeys = useMemo(() => {
    if (highlightBatchId == null) return new Set();
    const s = new Set();
    const hid = Number(highlightBatchId);
    for (const r of filteredRows) {
      if (Number(r.import_batch_id) !== hid) continue;
      const d = String(r.business_date || "").slice(0, 10);
      const pm = String(r.payment_method || "desconocido");
      s.add(`${d}|${pm}`);
    }
    return s;
  }, [filteredRows, highlightBatchId]);

  const { paymentDays, grandTotal, rowsMissingRate } = useMemo(() => {
    const dateToPm = new Map();
    let missing = 0;

    for (const r of filteredRows) {
      const d = String(r.business_date || "").slice(0, 10);
      if (!d) continue;

      const rateRaw = ratesByDate[d];
      const rateNum =
        rateRaw != null && Number.isFinite(Number(rateRaw))
          ? Number(rateRaw)
          : null;

      const pm = String(r.payment_method || "desconocido");
      if (!dateToPm.has(d)) dateToPm.set(d, new Map());
      const pmMap = dateToPm.get(d);

      const cur = pmMap.get(pm) || {
        payment_method: pm,
        txns: 0,
        importePago: 0,
        importePagoBs: 0,
        reembolsoTxns: 0,
        importeReembolso: 0,
        importeReembolsoBs: 0,
        montoNeto: 0,
        montoNetoBs: 0,
      };

      const tx = Number(r.transactions_count);
      const gross = Number(r.gross_sales);
      const net = Number(r.net_sales);
      const rt = refundTxnFromRow(r);
      const ra = refundAmtFromRow(r);

      if (Number.isFinite(tx)) cur.txns += tx;
      if (Number.isFinite(gross)) cur.importePago += gross;
      cur.reembolsoTxns += rt;
      if (Number.isFinite(ra)) cur.importeReembolso += ra;
      if (Number.isFinite(net)) cur.montoNeto += net;

      if (rateNum != null) {
        if (Number.isFinite(gross)) cur.importePagoBs += gross * rateNum;
        if (Number.isFinite(ra)) cur.importeReembolsoBs += ra * rateNum;
        if (Number.isFinite(net)) cur.montoNetoBs += net * rateNum;
      } else if (
        (Number.isFinite(gross) && gross !== 0) ||
        (Number.isFinite(net) && net !== 0) ||
        (Number.isFinite(ra) && ra !== 0)
      ) {
        missing += 1;
      }

      pmMap.set(pm, cur);
    }

    const datesSorted = [...dateToPm.keys()].sort().reverse();

    const emptyTotals = () => ({
      txns: 0,
      importePago: 0,
      importePagoBs: 0,
      reembolsoTxns: 0,
      importeReembolso: 0,
      importeReembolsoBs: 0,
      montoNeto: 0,
      montoNetoBs: 0,
    });

    const paymentDaysList = datesSorted
      .map((dateYmd) => {
        const rateRaw = ratesByDate[dateYmd];
        const rateBs =
          rateRaw != null && Number.isFinite(Number(rateRaw))
            ? Number(rateRaw)
            : null;
        const pmMap = dateToPm.get(dateYmd);
        const methods = [...pmMap.values()].sort((a, b) => {
          const da = paymentMethodSortKey(a.payment_method);
          const db = paymentMethodSortKey(b.payment_method);
          if (da !== db) return da - db;
          return formatPaymentMethodLabel(a.payment_method).localeCompare(
            formatPaymentMethodLabel(b.payment_method),
            "es"
          );
        });
        const dayTotals = methods.reduce((acc, m) => {
          acc.txns += m.txns;
          acc.importePago += m.importePago;
          acc.importePagoBs += m.importePagoBs;
          acc.reembolsoTxns += m.reembolsoTxns;
          acc.importeReembolso += m.importeReembolso;
          acc.importeReembolsoBs += m.importeReembolsoBs;
          acc.montoNeto += m.montoNeto;
          acc.montoNetoBs += m.montoNetoBs;
          return acc;
        }, emptyTotals());
        return { dateYmd, rateBs, methods, dayTotals };
      })
      .filter((day) => day.methods.length > 0);

    const grand = paymentDaysList.reduce((acc, day) => {
      acc.txns += day.dayTotals.txns;
      acc.importePago += day.dayTotals.importePago;
      acc.importePagoBs += day.dayTotals.importePagoBs;
      acc.reembolsoTxns += day.dayTotals.reembolsoTxns;
      acc.importeReembolso += day.dayTotals.importeReembolso;
      acc.importeReembolsoBs += day.dayTotals.importeReembolsoBs;
      acc.montoNeto += day.dayTotals.montoNeto;
      acc.montoNetoBs += day.dayTotals.montoNetoBs;
      return acc;
    }, emptyTotals());

    return {
      paymentDays: paymentDaysList,
      grandTotal: grand,
      rowsMissingRate: missing,
    };
  }, [filteredRows, ratesByDate]);

  async function handlePagoFileSelected(e) {
    const picked = filesFromFileList(e.target.files);
    setFileHintError(null);
    if (picked.length === 0) {
      setUploadFiles([]);
      return;
    }
    setFileHintValidating(true);
    try {
      for (const file of picked) {
        const v = await validateLoyverseReportHint({
          file,
          reportHint: "by_payment",
        });
        if (!v.ok) {
          setFileHintError(
            `${file.name}: ${v.message || "No corresponde a ventas por tipo de pago."}`
          );
          setUploadFiles([]);
          setUploadInputKey((k) => k + 1);
          return;
        }
      }
      setUploadFiles(picked);
    } catch (err) {
      setFileHintError(err.message || "No se pudo validar el archivo.");
      setUploadFiles([]);
      setUploadInputKey((k) => k + 1);
    } finally {
      setFileHintValidating(false);
    }
  }

  function handlePagoExcelSubmit(e) {
    e.preventDefault();
    if (uploadFiles.length === 0) {
      window.alert("Selecciona un archivo Excel o CSV exportado desde Loyverse.");
      return;
    }
    handleImport({ files: uploadFiles, reportHint: "by_payment" });
  }

  function shiftRange(direction) {
    if (!rangeStart || !rangeEnd) return;
    const step = daysInclusive(rangeStart, rangeEnd);
    setRangeStart(addDaysYmd(rangeStart, direction * step));
    setRangeEnd(addDaysYmd(rangeEnd, direction * step));
  }

  function exportCsv() {
    const header = [
      "Fecha",
      "Tasa del día (Bs)",
      "Lote punto de venta",
      "Tipo de pago",
      "Transacciones de pago",
      "Importe del pago (USD)",
      "Importe del pago (Bs)",
      "Reembolso de transacciones",
      "Importe de reembolsos (USD)",
      "Importe de reembolsos (Bs)",
      "Monto neto (USD)",
      "Monto neto (Bs)",
    ];
    const lines = [header.join(";")];
    for (const day of paymentDays) {
      const tasa =
        day.rateBs != null && Number.isFinite(day.rateBs)
          ? String(day.rateBs)
          : "";
      for (const r of day.methods) {
        const isPos =
          String(r.payment_method || "").trim().toLowerCase() === "pos";
        const lote =
          isPos ? String(posBatchByDate[day.dateYmd] ?? "").trim() : "";
        lines.push(
          [
            day.dateYmd,
            tasa,
            lote,
            formatPaymentMethodLabel(r.payment_method),
            r.txns,
            r.importePago.toFixed(2),
            r.importePagoBs.toFixed(2),
            r.reembolsoTxns,
            r.importeReembolso.toFixed(2),
            r.importeReembolsoBs.toFixed(2),
            r.montoNeto.toFixed(2),
            r.montoNetoBs.toFixed(2),
          ].join(";")
        );
      }
    }
    lines.push(
      [
        "Total",
        "",
        "",
        "",
        grandTotal.txns,
        grandTotal.importePago.toFixed(2),
        grandTotal.importePagoBs.toFixed(2),
        grandTotal.reembolsoTxns,
        grandTotal.importeReembolso.toFixed(2),
        grandTotal.importeReembolsoBs.toFixed(2),
        grandTotal.montoNeto.toFixed(2),
        grandTotal.montoNetoBs.toFixed(2),
      ].join(";")
    );
    const blob = new Blob(["\ufeff" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ventas-por-tipo-pago_${rangeStart}_${rangeEnd}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const pagoSubBtn = (key, label) => (
    <button
      type="button"
      onClick={() => setTopTab(key)}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
        topTab === key
          ? "bg-zm-cream/70 border-zm-green/45 text-zm-sidebar shadow-sm"
          : "bg-transparent border-transparent text-gray-600 hover:text-zm-sidebar hover:bg-zm-cream/40"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full font-zm">
      {/* Same alignment as Resumen de ventas: max-width without mx-auto (flush left in main). */}
      <div className="w-full max-w-7xl">
        <div className="flex items-center bg-zm-green px-4 sm:px-6 py-3 text-white shadow-sm rounded-b-xl">
          <h1 className="text-sm sm:text-base font-semibold tracking-tight">
            Ventas por tipo de pago
          </h1>
        </div>
        <div className="px-4 pt-3 pb-2 space-y-3">
          <div className="border-b border-zm-green/20">
            <div className="flex flex-wrap gap-1 py-1">
              {pagoSubBtn("tabla", "Tabla")}
              {pagoSubBtn("historial", "Historial de cargas")}
            </div>
          </div>
        </div>
      </div>

      {topTab === "historial" ? (
        <div className="w-full max-w-[1600px] px-4 sm:px-6 pb-8 pt-1">
          <LoyverseImportBatchHistory
            detectedFormatFilter="by_payment"
            refreshToken={historyRefresh}
            preferredSelectBatchId={importResult?.data?.importBatchId ?? null}
            onDeleted={() => void refreshFacts()}
          />
        </div>
      ) : (
        <div className="w-full max-w-7xl px-4 pt-1 pb-8 space-y-3">
          {err && <p className="text-sm text-zm-red">{err}</p>}
          {loading && <p className="text-sm text-gray-500">Cargando…</p>}
          {!loading && rows.length === 0 && !err && (
            <p className="text-sm text-gray-600">
              No hay datos por tipo de pago. Usa «Seleccionar archivo» junto al calendario o
              «Cargar reporte Ventas» con tipo «Ventas por tipo de pago».
            </p>
          )}
          {!loading && (
            <>
              <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="p-3 sm:p-4 space-y-3 border-b border-gray-100">
                  <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center gap-3">
                    <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                      <button
                        type="button"
                        className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-gray-700 hover:bg-gray-50 shrink-0"
                        title="Periodo anterior"
                        aria-label="Periodo anterior"
                        onClick={() => shiftRange(-1)}
                      >
                        ‹
                      </button>
                      <LoyversePorPagoDateRange
                        rangeStart={rangeStart}
                        rangeEnd={rangeEnd}
                        dataMinYmd={dataMinYmd}
                        dataMaxYmd={dataMaxYmd}
                        calendarMonthAnchorYmd={calendarMonthAnchorYmd}
                        onApplyRange={(startYmd, endYmd) => {
                          setRangeStart(startYmd);
                          setRangeEnd(endYmd);
                        }}
                      />
                      <button
                        type="button"
                        className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-gray-700 hover:bg-gray-50 shrink-0"
                        title="Periodo siguiente"
                        aria-label="Periodo siguiente"
                        onClick={() => shiftRange(1)}
                      >
                        ›
                      </button>

                      <form
                        onSubmit={handlePagoExcelSubmit}
                        className="flex flex-wrap items-center gap-2 min-w-0 w-full sm:w-auto lg:ml-auto"
                      >
                        <label
                          className={`cursor-pointer inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-zm-green/40 bg-white px-3 py-2 text-xs font-semibold text-zm-green hover:bg-zm-green/5 focus-within:ring-2 focus-within:ring-zm-green/40 ${
                            fileHintValidating ? "pointer-events-none opacity-60" : ""
                          }`}
                        >
                          <Upload
                            className="h-4 w-4 shrink-0 opacity-90"
                            aria-hidden
                            strokeWidth={2.25}
                          />
                          <span>Seleccionar archivo(s)</span>
                          <input
                            key={uploadInputKey}
                            type="file"
                            multiple
                            accept={LOYVERSE_UPLOAD_ACCEPT}
                            className="sr-only"
                            aria-label="Seleccionar uno o varios archivos del reporte Ventas por tipo de pago Loyverse"
                            disabled={fileHintValidating}
                            onChange={handlePagoFileSelected}
                          />
                        </label>
                        {uploadFiles.length > 0 && (
                          <>
                            <span
                              className="text-xs text-gray-700 truncate min-w-0 max-w-[10rem] sm:max-w-[18rem] font-medium"
                              title={uploadFiles.map((f) => f.name).join("\n")}
                            >
                              {uploadFiles.length === 1
                                ? uploadFiles[0].name
                                : `${uploadFiles.length} archivos seleccionados`}
                            </span>
                            <button
                              type="submit"
                              disabled={importLoading || fileHintValidating}
                              className="shrink-0 rounded-lg bg-zm-green px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zm-green-dark focus-visible:outline focus-visible:ring-2 focus-visible:ring-zm-green/45 disabled:opacity-50"
                            >
                              {importLoading ? "Importando…" : "Importar"}
                            </button>
                          </>
                        )}
                      </form>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0 lg:justify-end">
                      <button
                        type="button"
                        className="rounded-lg border border-zm-green/40 bg-white px-3 py-1.5 text-xs font-semibold text-zm-green hover:bg-zm-green/5"
                        onClick={exportCsv}
                      >
                        EXPORTAR
                      </button>
                    </div>
                  </div>
                  {importError && (
                    <p className="text-sm text-zm-red">{importError}</p>
                  )}
                  {fileHintValidating && (
                    <p className="text-xs text-gray-600">Validando archivos…</p>
                  )}
                  {fileHintError && (
                    <p className="text-sm text-zm-red" role="alert">
                      {fileHintError}
                    </p>
                  )}
                </div>

            <div className="w-full max-w-full max-h-[min(65vh,36rem)] sm:max-h-[min(70vh,42rem)] overflow-y-auto overflow-x-auto rounded-b-xl border border-zm-green/15 bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[1100px] max-w-full table-fixed border-collapse text-sm sm:text-base">
                <colgroup>
                  <col className="w-[10%]" />
                  <col className="w-[9%]" />
                  <col className="w-[15%]" />
                  <col className="w-[10%]" />
                  <col className="w-[6%]" />
                  <col className="w-[17%]" />
                  <col className="w-[6%]" />
                  <col className="w-[15%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead className="sticky top-0 z-10 border-b border-zm-green/25 bg-zm-cream [&_th]:bg-zm-cream text-zm-sidebar">
                  <tr>
                    <th
                      scope="col"
                      className="text-center px-1.5 py-1.5 sm:px-2 sm:py-2 text-xs sm:text-sm font-medium align-bottom"
                    >
                      Fecha
                    </th>
                    <th
                      scope="col"
                      className="text-center px-1.5 py-1.5 sm:px-2 sm:py-2 text-xs sm:text-sm font-medium align-bottom leading-tight whitespace-nowrap"
                      aria-label="Tasa del día en bolívares"
                    >
                      Tasa del día
                    </th>
                    <th
                      scope="col"
                      className="text-center px-1.5 py-1.5 sm:px-2 sm:py-2 text-xs sm:text-sm font-medium align-bottom leading-tight whitespace-nowrap"
                      aria-label="Lote del punto de venta para tarjeta"
                    >
                      Lote punto de venta
                    </th>
                    <th
                      scope="col"
                      className="text-left px-1.5 py-1.5 sm:px-2 sm:py-2 text-xs sm:text-sm font-medium align-bottom leading-tight"
                      aria-label="Tipo de pago"
                    >
                      <span className="hidden min-[400px]:inline">Tipo de pago</span>
                      <span className="min-[400px]:hidden">Tipo</span>
                    </th>
                    <th
                      scope="col"
                      className="text-right px-1.5 py-1.5 sm:px-2 sm:py-2 text-xs sm:text-sm font-medium align-bottom leading-tight"
                      aria-label="Transacciones de pago"
                    >
                      <span className="hidden sm:inline">Transacciones</span>
                      <span className="sm:hidden">Txns</span>
                    </th>
                    <th
                      scope="col"
                      className="text-right px-1.5 py-1.5 sm:px-2 sm:py-2 text-xs sm:text-sm font-medium align-bottom leading-tight whitespace-nowrap"
                      aria-label="Importe del pago en dólares y bolívares"
                    >
                      Imp. pago
                    </th>
                    <th
                      scope="col"
                      className="text-right px-1.5 py-1.5 sm:px-2 sm:py-2 text-xs sm:text-sm font-medium align-bottom leading-tight"
                      aria-label="Reembolso de transacciones"
                    >
                      <span className="hidden sm:inline">Reembolsos</span>
                      <span className="sm:hidden">Reemb.</span>
                    </th>
                    <th
                      scope="col"
                      className="text-right px-1.5 py-1.5 sm:px-2 sm:py-2 text-xs sm:text-sm font-medium align-bottom leading-tight whitespace-nowrap"
                      aria-label="Importe de reembolsos en dólares y bolívares"
                    >
                      Imp. reemb.
                    </th>
                    <th
                      scope="col"
                      className="text-right px-1.5 py-1.5 sm:px-2 sm:py-2 text-xs sm:text-sm font-medium align-bottom leading-tight whitespace-nowrap"
                      aria-label="Monto neto en dólares y bolívares"
                    >
                      Monto neto
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paymentDays.length === 0 ? (
                    <tr className="border-t border-gray-100">
                      <td
                        colSpan={9}
                        className="min-h-[16rem] px-4 py-14 align-middle text-center text-sm leading-relaxed text-gray-600 bg-gray-50/50"
                      >
                        No hay datos en este rango de fechas. Amplía el período en el
                        calendario o usa «Todo el historial» si hay datos importados.
                      </td>
                    </tr>
                  ) : null}
                  {paymentDays.map((day) => (
                    <Fragment key={day.dateYmd}>
                      {day.methods.map((r, idx) => {
                        const rowHighlight = pagoHighlightKeys.has(
                          `${day.dateYmd}|${r.payment_method}`
                        );
                        return (
                        <tr
                          key={`${day.dateYmd}-${r.payment_method}`}
                          className={`border-t border-gray-100 hover:bg-gray-50 ${
                            rowHighlight
                              ? "border-zm-green/10 bg-zm-yellow/30 hover:bg-zm-yellow/40"
                              : ""
                          }`}
                        >
                          {idx === 0 && (
                            <td
                              rowSpan={Math.max(1, day.methods.length)}
                              className="px-1.5 py-2 sm:px-2 align-top border-r border-gray-100 text-center"
                            >
                              <span className="block min-w-0 text-sm sm:text-base font-semibold leading-snug text-gray-900">
                                {formatDateShort(day.dateYmd)}
                              </span>
                            </td>
                          )}
                          {idx === 0 && (
                            <td
                              rowSpan={Math.max(1, day.methods.length)}
                              className="px-1.5 py-2 sm:px-2 align-top text-center border-r border-gray-100"
                            >
                              {day.rateBs != null &&
                              Number.isFinite(day.rateBs) ? (
                                <span className="text-base sm:text-lg font-semibold tabular-nums text-gray-900 leading-none">
                                  {formatBs(day.rateBs)}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-lg leading-none">
                                  —
                                </span>
                              )}
                            </td>
                          )}
                          {idx === 0 && (
                            <td
                              rowSpan={Math.max(1, day.methods.length)}
                              className="px-1.5 py-2 sm:px-2 align-top text-center border-r border-gray-100"
                            >
                              <input
                                type="text"
                                autoComplete="off"
                                placeholder=""
                                maxLength={32}
                                value={posBatchByDate[day.dateYmd] ?? ""}
                                onChange={(e) => {
                                  persistPosBatchByDate(
                                    day.dateYmd,
                                    e.target.value
                                  );
                                }}
                                className="w-full min-w-0 rounded-md border border-zm-green/35 bg-white px-2 py-1 text-center text-base font-semibold tabular-nums leading-none text-gray-900 shadow-sm placeholder:text-gray-400 placeholder:font-semibold focus:border-zm-green focus:outline-none focus:ring-1 focus:ring-zm-green/40 sm:text-lg sm:py-1.5"
                                aria-label={`Número de lote del punto de venta (tarjeta), ${day.dateYmd}`}
                              />
                            </td>
                          )}
                          <td className="px-1.5 py-2 sm:px-2 min-w-0 align-middle text-left border-r border-gray-100">
                            <div className="flex min-h-[2.25rem] w-full min-w-0 items-center justify-between gap-1.5 pl-0.5 sm:pl-1 pr-0.5">
                              <div className="min-w-0 shrink">
                                <PaymentMethodWithIcon paymentMethod={r.payment_method} />
                              </div>
                              {(() => {
                                const pm = String(r.payment_method || "").toLowerCase();
                                if (pm !== "pago_movil" && pm !== "pos") return null;
                                const q = new URLSearchParams({
                                  date: day.dateYmd,
                                  paymentMethod: pm,
                                });
                                if (pm === "pos") {
                                  const lot = String(
                                    posBatchByDate[day.dateYmd] ?? ""
                                  ).trim();
                                  if (lot) q.set("posBatch", lot);
                                }
                                return (
                                  <Link
                                    to={`${financeBase}/conciliacion?${q.toString()}`}
                                    className="shrink-0 text-xs font-semibold text-zm-green hover:underline"
                                  >
                                    Conciliar
                                  </Link>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="px-1.5 py-2 sm:px-2 align-middle text-right">
                            <div className={paymentCountInnerClass}>{r.txns}</div>
                          </td>
                          <UsdDualCell
                            usdValue={r.importePago}
                            rateBs={day.rateBs}
                            numericSize="large"
                            tightPad
                          />
                          <td className="px-1.5 py-2 sm:px-2 align-middle text-right">
                            <div className={paymentCountInnerClass}>
                              {r.reembolsoTxns}
                            </div>
                          </td>
                          <UsdDualCell
                            usdValue={r.importeReembolso}
                            rateBs={day.rateBs}
                            numericSize="large"
                            tightPad
                          />
                          <UsdDualCell
                            usdValue={r.montoNeto}
                            rateBs={day.rateBs}
                            variant="emphasis"
                            numericSize="large"
                            tightPad
                          />
                        </tr>
                        );
                      })}
                      <tr className="border-t border-gray-200 bg-zm-cream/70 text-gray-900">
                        <td
                          colSpan={4}
                          className="px-1.5 py-2 sm:px-2 text-center text-sm sm:text-base font-semibold leading-snug text-zm-sidebar"
                        >
                          Subtotal {formatDateShort(day.dateYmd)}
                        </td>
                        <td className="px-1.5 py-2 sm:px-2 align-middle text-right">
                          <div className={paymentCountInnerClass}>
                            {day.dayTotals.txns}
                          </div>
                        </td>
                        <UsdBsAggregateCell
                          usdValue={day.dayTotals.importePago}
                          bsSum={day.dayTotals.importePagoBs}
                          numericSize="large"
                          tightPad
                        />
                        <td className="px-1.5 py-2 sm:px-2 align-middle text-right">
                          <div className={paymentCountInnerClass}>
                            {day.dayTotals.reembolsoTxns}
                          </div>
                        </td>
                        <UsdBsAggregateCell
                          usdValue={day.dayTotals.importeReembolso}
                          bsSum={day.dayTotals.importeReembolsoBs}
                          numericSize="large"
                          tightPad
                        />
                        <UsdBsAggregateCell
                          usdValue={day.dayTotals.montoNeto}
                          bsSum={day.dayTotals.montoNetoBs}
                          variant="emphasis"
                          numericSize="large"
                          tightPad
                        />
                      </tr>
                    </Fragment>
                  ))}
                  {paymentDays.length > 0 && (
                    <tr className="border-t-2 border-zm-green/25 bg-zm-green/10 text-gray-900">
                      <td
                        colSpan={4}
                        className="px-1.5 py-2.5 sm:px-2 text-center text-sm sm:text-base font-bold text-zm-sidebar"
                      >
                        Total del rango
                      </td>
                      <td className="px-1.5 py-2.5 sm:px-2 align-middle text-right">
                        <div className={paymentCountInnerClass}>{grandTotal.txns}</div>
                      </td>
                      <UsdBsAggregateCell
                        usdValue={grandTotal.importePago}
                        bsSum={grandTotal.importePagoBs}
                        numericSize="large"
                        tightPad
                      />
                      <td className="px-1.5 py-2.5 sm:px-2 align-middle text-right">
                        <div className={paymentCountInnerClass}>
                          {grandTotal.reembolsoTxns}
                        </div>
                      </td>
                      <UsdBsAggregateCell
                        usdValue={grandTotal.importeReembolso}
                        bsSum={grandTotal.importeReembolsoBs}
                        numericSize="large"
                        tightPad
                      />
                      <UsdBsAggregateCell
                        usdValue={grandTotal.montoNeto}
                        bsSum={grandTotal.montoNetoBs}
                        variant="emphasis"
                        numericSize="large"
                        tightPad
                      />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          {rowsMissingRate > 0 && (
            <p className="text-sm text-amber-800" role="status">
              {rowsMissingRate} fila(s) importada(s) con montos en USD no tienen
              tasa guardada para su fecha: complete la tasa en Resumen de ventas
              para incluirlas en los totales Bs.
            </p>
          )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function escapeCsvSemicolonCell(value) {
  const s = String(value ?? "");
  if (/[;\n\r"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Ventas por artículo (Loyverse: cantidad vendida, ventas netas, beneficio por SKU/producto). */
export function LoyverseVentasPorArticulo({
  highlightBatchId = null,
  onHighlightBatchIdChange,
} = {}) {
  const [topTab, setTopTab] = useState("tabla");
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [fileHintError, setFileHintError] = useState(null);
  const [fileHintValidating, setFileHintValidating] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const {
    loading: importLoading,
    error: importError,
    result: importResult,
    handleImport,
  } = useLoyverseImport();

  const [rows, setRows] = useState([]);
  const [ratesByDate, setRatesByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeBootstrapped, setRangeBootstrapped] = useState(false);

  const refreshFacts = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetchLoyverseFactsByTypes(["item_line"], {
        limit: 25000,
      });
      let ratesData = [];
      try {
        const ratesRes = await fetchLoyverseDailyRates();
        ratesData = ratesRes.data || [];
      } catch {
        ratesData = [];
      }
      const data = res.data || [];
      setRows(data);
      const map = {};
      for (const row of ratesData) {
        const dk = String(row.business_date || "").slice(0, 10);
        if (dk && row.rate_bs != null) {
          map[dk] = Number(row.rate_bs);
        }
      }
      setRatesByDate(map);
      return data;
    } catch (e) {
      setErr(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshFacts();
  }, [refreshFacts]);

  useEffect(() => {
    if (!importResult?.success || importResult?.data?.importBatchId == null) {
      return;
    }
    const batchId = importResult.data.importBatchId;
    onHighlightBatchIdChange?.(batchId);
    setHistoryRefresh((n) => n + 1);
    setUploadFiles([]);
    setUploadInputKey((k) => k + 1);

    let cancelled = false;
    void (async () => {
      const data = await refreshFacts();
      if (cancelled || !data) return;
      const span = dateRangeForImportedLoyverseBatch(data, batchId);
      if (span) {
        setRangeStart(span.start);
        setRangeEnd(span.end);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    importResult?.data?.importBatchId,
    importResult?.success,
    onHighlightBatchIdChange,
    refreshFacts,
  ]);

  useEffect(() => {
    if (rangeBootstrapped || loading) return;
    if (rows.length > 0) {
      const uniq = [
        ...new Set(rows.map((r) => String(r.business_date || "").slice(0, 10))),
      ]
        .filter(Boolean)
        .sort();
      if (uniq.length === 0) return;
      setRangeStart(uniq[0]);
      setRangeEnd(uniq[uniq.length - 1]);
      setRangeBootstrapped(true);
      return;
    }
    const t = localTodayYmd();
    setRangeStart(t);
    setRangeEnd(t);
    setRangeBootstrapped(true);
  }, [rows, rangeBootstrapped, loading]);

  const { dataMinYmd, dataMaxYmd } = useMemo(() => {
    const uniq = [
      ...new Set(rows.map((r) => String(r.business_date || "").slice(0, 10))),
    ]
      .filter(Boolean)
      .sort();
    if (uniq.length === 0) return { dataMinYmd: "", dataMaxYmd: "" };
    return { dataMinYmd: uniq[0], dataMaxYmd: uniq[uniq.length - 1] };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!rangeStart || !rangeEnd) return rows;
    const lo = minYmd(rangeStart, rangeEnd);
    const hi = maxYmd(rangeStart, rangeEnd);
    return rows.filter((r) => {
      const d = String(r.business_date || "").slice(0, 10);
      return d && d >= lo && d <= hi;
    });
  }, [rows, rangeStart, rangeEnd]);

  const sortedItemRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const da = String(a.business_date || "").slice(0, 10);
      const db = String(b.business_date || "").slice(0, 10);
      if (da !== db) return db.localeCompare(da);
      const na = String(a.item_name || a.sku || "");
      const nb = String(b.item_name || b.sku || "");
      return na.localeCompare(nb, "es");
    });
  }, [filteredRows]);

  const itemRangeTotals = useMemo(() => {
    let qty = 0;
    let net = 0;
    let profit = 0;
    let costUsd = 0;
    let netBs = 0;
    let profitBs = 0;
    let costBs = 0;
    let missing = 0;

    for (const r of filteredRows) {
      const d = String(r.business_date || "").slice(0, 10);
      const rateRaw = ratesByDate[d];
      const rateNum =
        rateRaw != null && Number.isFinite(Number(rateRaw))
          ? Number(rateRaw)
          : null;

      const q = Number(r.qty_sold);
      const n = Number(r.net_sales);
      const p = Number(r.gross_profit);
      const c = costosNetosUsd(r);

      if (Number.isFinite(q)) qty += q;
      if (Number.isFinite(n)) net += n;
      if (Number.isFinite(p)) profit += p;
      if (c != null && Number.isFinite(c)) costUsd += c;

      if (rateNum != null) {
        if (Number.isFinite(n)) netBs += n * rateNum;
        if (Number.isFinite(p)) profitBs += p * rateNum;
        if (c != null && Number.isFinite(c)) costBs += c * rateNum;
      } else if (
        (Number.isFinite(n) && n !== 0) ||
        (Number.isFinite(p) && p !== 0) ||
        (c != null && c !== 0)
      ) {
        missing += 1;
      }
    }

    return {
      qty,
      net,
      profit,
      costUsd,
      netBs,
      profitBs,
      costBs,
      rowsMissingRate: missing,
    };
  }, [filteredRows, ratesByDate]);

  async function handleArticuloFileSelected(e) {
    const picked = filesFromFileList(e.target.files);
    setFileHintError(null);
    if (picked.length === 0) {
      setUploadFiles([]);
      return;
    }
    setFileHintValidating(true);
    try {
      for (const file of picked) {
        const v = await validateLoyverseReportHint({
          file,
          reportHint: "by_item",
        });
        if (!v.ok) {
          setFileHintError(
            `${file.name}: ${v.message || "No corresponde a ventas por artículo."}`
          );
          setUploadFiles([]);
          setUploadInputKey((k) => k + 1);
          return;
        }
      }
      setUploadFiles(picked);
    } catch (err2) {
      setFileHintError(err2.message || "No se pudo validar el archivo.");
      setUploadFiles([]);
      setUploadInputKey((k) => k + 1);
    } finally {
      setFileHintValidating(false);
    }
  }

  function handleArticuloExcelSubmit(e) {
    e.preventDefault();
    if (uploadFiles.length === 0) {
      window.alert(
        "Selecciona un archivo Excel o CSV exportado desde Loyverse."
      );
      return;
    }
    handleImport({ files: uploadFiles, reportHint: "by_item" });
  }

  function shiftRange(direction) {
    if (!rangeStart || !rangeEnd) return;
    const step = daysInclusive(rangeStart, rangeEnd);
    setRangeStart(addDaysYmd(rangeStart, direction * step));
    setRangeEnd(addDaysYmd(rangeEnd, direction * step));
  }

  function exportCsv() {
    const header = [
      "Fecha",
      "Tasa del día (Bs)",
      "Artículo",
      "Código",
      "Cantidad vendida",
      "Ventas netas (USD)",
      "Ventas netas (Bs)",
      "Beneficio bruto (USD)",
      "Beneficio bruto (Bs)",
      "Costo neto (USD)",
      "Costo neto (Bs)",
      "Lote",
    ];
    const lines = [header.join(";")];
    for (const r of sortedItemRows) {
      const d = String(r.business_date || "").slice(0, 10);
      const rateRaw = ratesByDate[d];
      const rateNum =
        rateRaw != null && Number.isFinite(Number(rateRaw))
          ? Number(rateRaw)
          : null;
      const n = Number(r.net_sales);
      const p = Number(r.gross_profit);
      const c = costosNetosUsd(r);
      const netBs =
        rateNum != null && Number.isFinite(n) ? (n * rateNum).toFixed(2) : "";
      const profitBs =
        rateNum != null && Number.isFinite(p) ? (p * rateNum).toFixed(2) : "";
      const costBs =
        rateNum != null && c != null && Number.isFinite(c)
          ? (c * rateNum).toFixed(2)
          : "";
      lines.push(
        [
          d,
          rateNum != null ? String(rateNum) : "",
          escapeCsvSemicolonCell(r.item_name),
          escapeCsvSemicolonCell(r.sku),
          Number.isFinite(Number(r.qty_sold)) ? String(r.qty_sold) : "",
          Number.isFinite(n) ? n.toFixed(2) : "",
          netBs,
          Number.isFinite(p) ? p.toFixed(2) : "",
          profitBs,
          c != null && Number.isFinite(c) ? c.toFixed(2) : "",
          costBs,
          r.import_batch_id != null ? `#${r.import_batch_id}` : "",
        ].join(";")
      );
    }
    lines.push(
      [
        "Total",
        "",
        "",
        "",
        Number.isFinite(itemRangeTotals.qty)
          ? String(itemRangeTotals.qty)
          : "",
        Number.isFinite(itemRangeTotals.net)
          ? itemRangeTotals.net.toFixed(2)
          : "",
        itemRangeTotals.netBs.toFixed(2),
        Number.isFinite(itemRangeTotals.profit)
          ? itemRangeTotals.profit.toFixed(2)
          : "",
        itemRangeTotals.profitBs.toFixed(2),
        Number.isFinite(itemRangeTotals.costUsd)
          ? itemRangeTotals.costUsd.toFixed(2)
          : "",
        itemRangeTotals.costBs.toFixed(2),
        "",
      ].join(";")
    );
    const blob = new Blob(["\ufeff" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ventas-por-articulo_${rangeStart}_${rangeEnd}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const articuloSubBtn = (key, label) => (
    <button
      type="button"
      onClick={() => setTopTab(key)}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
        topTab === key
          ? "bg-zm-cream/70 border-zm-green/45 text-zm-sidebar shadow-sm"
          : "bg-transparent border-transparent text-gray-600 hover:text-zm-sidebar hover:bg-zm-cream/40"
      }`}
    >
      {label}
    </button>
  );

  const hid =
    highlightBatchId != null && Number.isFinite(Number(highlightBatchId))
      ? Number(highlightBatchId)
      : null;

  return (
    <div className="w-full font-zm">
      <div className="w-full max-w-7xl">
        <div className="flex items-center bg-zm-green px-4 sm:px-6 py-3 text-white shadow-sm rounded-b-xl">
          <h1 className="text-sm sm:text-base font-semibold tracking-tight">
            Ventas por artículo
          </h1>
        </div>
        <div className="px-4 pt-3 pb-2 space-y-3">
          <div className="border-b border-zm-green/20">
            <div className="flex flex-wrap gap-1 py-1">
              {articuloSubBtn("tabla", "Tabla")}
              {articuloSubBtn("historial", "Historial de cargas")}
            </div>
          </div>
        </div>
      </div>

      {topTab === "historial" ? (
        <div className="w-full max-w-[1600px] px-4 sm:px-6 pb-8 pt-1">
          <LoyverseImportBatchHistory
            detectedFormatFilter="by_item"
            refreshToken={historyRefresh}
            preferredSelectBatchId={importResult?.data?.importBatchId ?? null}
            onDeleted={() => void refreshFacts()}
          />
        </div>
      ) : (
        <div className="w-full max-w-7xl px-4 pt-1 pb-8 space-y-3">
          {err && <p className="text-sm text-zm-red">{err}</p>}
          {loading && <p className="text-sm text-gray-500">Cargando…</p>}
          {!loading && rows.length === 0 && !err && (
            <p className="text-sm text-gray-600">
              No hay líneas por artículo. Importa el reporte «Ventas por
              artículo» de Loyverse (Excel o CSV) con el formulario de abajo.
            </p>
          )}
          {!loading && (
            <>
              <section className="rounded-xl border border-zm-green/20 bg-white p-3 sm:p-4 shadow-sm space-y-3">
                <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center gap-3">
                  <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                      <button
                        type="button"
                        className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-gray-700 hover:bg-gray-50 shrink-0"
                        title="Periodo anterior"
                        aria-label="Periodo anterior"
                        onClick={() => shiftRange(-1)}
                      >
                        ‹
                      </button>
                      <LoyversePorPagoDateRange
                        rangeStart={rangeStart}
                        rangeEnd={rangeEnd}
                        dataMinYmd={dataMinYmd}
                        dataMaxYmd={dataMaxYmd}
                        onApplyRange={(startYmd, endYmd) => {
                          setRangeStart(startYmd);
                          setRangeEnd(endYmd);
                        }}
                      />
                      <button
                        type="button"
                        className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-gray-700 hover:bg-gray-50 shrink-0"
                        title="Periodo siguiente"
                        aria-label="Periodo siguiente"
                        onClick={() => shiftRange(1)}
                      >
                        ›
                      </button>

                      <form
                        onSubmit={handleArticuloExcelSubmit}
                        className="flex flex-wrap items-center gap-2 min-w-0 w-full sm:w-auto lg:ml-auto"
                      >
                        <label
                          className={`cursor-pointer inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-zm-green/40 bg-white px-3 py-2 text-xs font-semibold text-zm-green hover:bg-zm-green/5 focus-within:ring-2 focus-within:ring-zm-green/40 ${
                            fileHintValidating
                              ? "pointer-events-none opacity-60"
                              : ""
                          }`}
                        >
                          <Upload
                            className="h-4 w-4 shrink-0 opacity-90"
                            aria-hidden
                            strokeWidth={2.25}
                          />
                          <span>Seleccionar archivo(s)</span>
                          <input
                            key={uploadInputKey}
                            type="file"
                            multiple
                            accept={LOYVERSE_UPLOAD_ACCEPT}
                            className="sr-only"
                            aria-label="Seleccionar uno o varios archivos del reporte Ventas por artículo Loyverse"
                            disabled={fileHintValidating}
                            onChange={handleArticuloFileSelected}
                          />
                        </label>
                        {uploadFiles.length > 0 && (
                          <>
                            <span
                              className="text-xs text-gray-700 truncate min-w-0 max-w-[10rem] sm:max-w-[18rem] font-medium"
                              title={uploadFiles.map((f) => f.name).join("\n")}
                            >
                              {uploadFiles.length === 1
                                ? uploadFiles[0].name
                                : `${uploadFiles.length} archivos seleccionados`}
                            </span>
                            <button
                              type="submit"
                              disabled={importLoading || fileHintValidating}
                              className="shrink-0 rounded-lg bg-zm-green px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zm-green-dark focus-visible:outline focus-visible:ring-2 focus-visible:ring-zm-green/45 disabled:opacity-50"
                            >
                              {importLoading ? "Importando…" : "Importar"}
                            </button>
                          </>
                        )}
                      </form>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0 lg:justify-end">
                      <button
                        type="button"
                        className="rounded-lg border border-zm-green/40 bg-white px-3 py-1.5 text-xs font-semibold text-zm-green hover:bg-zm-green/5"
                        onClick={exportCsv}
                      >
                        EXPORTAR
                      </button>
                    </div>
                  </div>
                  {importError && (
                    <p className="text-sm text-zm-red">{importError}</p>
                  )}
                  {fileHintValidating && (
                    <p className="text-sm text-gray-500">Validando archivos…</p>
                  )}
                  {fileHintError && (
                    <p className="text-sm text-zm-red" role="alert">
                      {fileHintError}
                    </p>
                  )}

                <div className="max-h-[min(65vh,36rem)] sm:max-h-[min(70vh,42rem)] overflow-y-auto overflow-x-auto border border-zm-green/15 rounded-lg bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
                  <table className="min-w-[1040px] w-full text-sm border-collapse">
                    <thead className="sticky top-0 z-10 border-b border-zm-green/25 bg-zm-cream [&_th]:bg-zm-cream">
                      <tr>
                        <th className="text-left px-3 py-2 whitespace-nowrap">
                          Fecha
                        </th>
                        <th className="text-right px-3 py-2 whitespace-nowrap text-xs sm:text-sm font-medium">
                          Tasa del día (Bs)
                        </th>
                        <th className="text-left px-3 py-2">Artículo</th>
                        <th className="text-left px-3 py-2">Código</th>
                        <th className="text-right px-3 py-2 whitespace-nowrap">
                          Cant.
                        </th>
                        <th className="text-right px-3 py-2 whitespace-nowrap">
                          <span className="block">Ventas netas</span>
                          <span className="block text-[10px] font-normal text-gray-500">
                            (USD)
                          </span>
                        </th>
                        <th className="text-right px-3 py-2 whitespace-nowrap">
                          <span className="block">Beneficio bruto</span>
                          <span className="block text-[10px] font-normal text-gray-500">
                            (USD)
                          </span>
                        </th>
                        <th className="text-right px-3 py-2 whitespace-nowrap">
                          <span className="block">Costo neto</span>
                          <span className="block text-[10px] font-normal text-gray-500">
                            (USD)
                          </span>
                        </th>
                        <th className="text-right px-3 py-2 text-xs font-normal text-gray-500 whitespace-nowrap">
                          Lote
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedItemRows.map((r, idx) => {
                        const d = String(r.business_date || "").slice(0, 10);
                        const rateForRow = ratesByDate[d];
                        const rateNum =
                          rateForRow != null &&
                          Number.isFinite(Number(rateForRow))
                            ? Number(rateForRow)
                            : null;
                        const cn = costosNetosUsd(r);
                        const batchHit =
                          hid != null && Number(r.import_batch_id) === hid;
                        return (
                          <tr
                            key={`loyverse-item-${idx}-${r.import_batch_id ?? "x"}-${d}-${String(r.sku ?? "").slice(0, 40)}`}
                            className={`border-t border-gray-100 hover:bg-gray-50 ${
                              batchHit
                                ? "border-zm-green/10 bg-zm-yellow/30 hover:bg-zm-yellow/40"
                                : ""
                            }`}
                          >
                            <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                              {formatDateShort(r.business_date)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                              {rateNum != null ? formatBs(rateNum) : "—"}
                            </td>
                            <td className="max-w-[14rem] min-w-0 overflow-hidden px-3 py-2 sm:max-w-xs">
                              <span
                                className="line-clamp-2 font-medium text-gray-900"
                                title={r.item_name || ""}
                              >
                                {r.item_name || "—"}
                              </span>
                            </td>
                            <td className="max-w-[9rem] min-w-0 overflow-hidden px-3 py-2">
                              <span
                                className="truncate block font-mono text-sm text-gray-800"
                                title={r.sku || ""}
                              >
                                {r.sku || "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                              {formatQtySold(r.qty_sold)}
                            </td>
                            <UsdDualCell
                              usdValue={r.net_sales}
                              rateBs={rateNum}
                              variant="emphasis"
                            />
                            <UsdDualCell
                              usdValue={r.gross_profit}
                              rateBs={rateNum}
                              variant="profit"
                            />
                            <UsdDualCell
                              usdValue={cn}
                              rateBs={rateNum}
                              variant="cost"
                            />
                            <td className="px-3 py-2 text-right text-xs text-gray-400 font-mono">
                              {r.import_batch_id != null
                                ? `#${r.import_batch_id}`
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                      {sortedItemRows.length > 0 && (
                        <tr className="border-t-2 border-zm-green/25 bg-zm-green/10 text-gray-900">
                          <td
                            colSpan={4}
                            className="px-3 py-2 text-center text-sm font-bold"
                          >
                            Total del rango
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-bold tabular-nums whitespace-nowrap">
                            {formatQtySold(itemRangeTotals.qty)}
                          </td>
                          <UsdBsAggregateCell
                            usdValue={itemRangeTotals.net}
                            bsSum={itemRangeTotals.netBs}
                            variant="emphasis"
                          />
                          <UsdBsAggregateCell
                            usdValue={itemRangeTotals.profit}
                            bsSum={itemRangeTotals.profitBs}
                          />
                          <UsdBsAggregateCell
                            usdValue={itemRangeTotals.costUsd}
                            bsSum={itemRangeTotals.costBs}
                          />
                          <td className="px-3 py-2" />
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
              {itemRangeTotals.rowsMissingRate > 0 && (
                <p className="text-sm text-amber-800" role="status">
                  {itemRangeTotals.rowsMissingRate} fila(s) con montos en USD sin
                  tasa para su fecha: complétala en Resumen de ventas para ver Bs y
                  totales completos.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
