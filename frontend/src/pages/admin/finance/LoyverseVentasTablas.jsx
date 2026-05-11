import { useEffect, useMemo, useState } from "react";
import {
  fetchLoyverseFactsByTypes,
  fetchLoyverseDailyRates,
  saveLoyverseDailyRate,
} from "../../../api/admin/finance/loyverseApi";

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

function formatRangeLabelEs(startYmd, endYmd) {
  if (!startYmd || !endYmd) return "";
  const o = { day: "numeric", month: "short", year: "numeric" };
  const a = new Date(`${startYmd}T12:00:00`);
  const b = new Date(`${endYmd}T12:00:00`);
  return `${new Intl.DateTimeFormat("es-VE", o).format(a)} — ${new Intl.DateTimeFormat("es-VE", o).format(b)}`;
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

/** USD arriba; equivalente en Bs abajo (naranja, tamaño cercano al USD si hay tasa). */
function UsdDualCell({ usdValue, rateBs, variant = "default" }) {
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
          ? "font-medium text-gray-900"
          : "text-gray-900";

  const usdText = formatUsd(usdValue);

  return (
    <td className={`px-3 py-2 text-right align-middle ${line1Class}`}>
      <div className="flex flex-col items-end justify-center gap-1">
        <span className="tabular-nums text-[15px] leading-snug">{usdText}</span>
        {bsLine != null && (
          <span className="tabular-nums text-[14px] sm:text-[15px] leading-snug text-orange-600 font-semibold">
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
function UsdBsAggregateCell({ usdValue, bsSum, variant = "default" }) {
  const line1Class =
    variant === "emphasis"
      ? "font-medium text-gray-900"
      : "text-gray-900";
  const usdText = formatUsd(usdValue);
  const showBs =
    bsSum != null &&
    Number.isFinite(bsSum) &&
    Math.abs(Number(bsSum)) > 1e-6;

  return (
    <td className={`px-3 py-2 text-right align-middle ${line1Class}`}>
      <div className="flex flex-col items-end justify-center gap-1">
        <span className="tabular-nums text-[15px] leading-snug">{usdText}</span>
        {showBs && (
          <span className="tabular-nums text-[14px] sm:text-[15px] leading-snug text-orange-600 font-semibold">
            Bs {formatBs(bsSum)}
          </span>
        )}
      </div>
    </td>
  );
}

/** Resumen de ventas (filas daily_summary importadas). */
export function LoyverseResumenVentas() {
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
        if (cancelled) return;
        setRows(factsRes.data || []);
        const map = {};
        for (const row of ratesData) {
          if (row.business_date != null && row.rate_bs != null) {
            map[row.business_date] = Number(row.rate_bs);
          }
        }
        setRatesByDate(map);
      } catch (e) {
        if (!cancelled) setErr(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (rows.length === 0 || rangeBootstrapped) return;
    const uniq = [
      ...new Set(rows.map((r) => String(r.business_date || "").slice(0, 10))),
    ]
      .filter(Boolean)
      .sort();
    if (uniq.length === 0) return;
    setRangeStart(uniq[0]);
    setRangeEnd(uniq[uniq.length - 1]);
    setRangeBootstrapped(true);
  }, [rows, rangeBootstrapped]);

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

  function presetLast7() {
    const uniq = [
      ...new Set(rows.map((r) => String(r.business_date || "").slice(0, 10))),
    ]
      .filter(Boolean)
      .sort();
    if (uniq.length === 0) return;
    const end = uniq[uniq.length - 1];
    const start = addDaysYmd(end, -6);
    const lo = uniq[0];
    setRangeStart(start < lo ? lo : start);
    setRangeEnd(end);
  }

  function presetAll() {
    const uniq = [
      ...new Set(rows.map((r) => String(r.business_date || "").slice(0, 10))),
    ]
      .filter(Boolean)
      .sort();
    if (uniq.length === 0) return;
    setRangeStart(uniq[0]);
    setRangeEnd(uniq[uniq.length - 1]);
  }

  function onChangeRangeStart(v) {
    setRangeStart(v);
    if (rangeEnd && v > rangeEnd) setRangeEnd(v);
  }

  function onChangeRangeEnd(v) {
    setRangeEnd(v);
    if (rangeStart && v < rangeStart) setRangeStart(v);
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

  return (
    <div className="px-4 pt-2 pb-6 space-y-3 w-full max-w-7xl">
      <p className="text-[11px] text-gray-500 leading-snug">
        USD arriba; Bs en naranja (USD × tasa del día). Costos netos = ventas netas
        − beneficio bruto.
      </p>
      {err && (
        <p className="text-sm text-red-600">{err}</p>
      )}
      {loading && (
        <p className="text-sm text-gray-500">Cargando…</p>
      )}
      {!loading && rows.length === 0 && !err && (
        <p className="text-sm text-gray-500">
          No hay resúmenes importados. Usa «Ventas → Cargar reporte Ventas» y elije tipo
          «Resumen de ventas» o detección automática.
        </p>
      )}
      {rows.length > 0 && (
        <>
          <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4 shadow-sm space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-gray-700 hover:bg-gray-50"
                  title="Periodo anterior"
                  aria-label="Periodo anterior"
                  onClick={() => shiftRange(-1)}
                >
                  ‹
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={rangeStart}
                    onChange={(e) => onChangeRangeStart(e.target.value)}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-800"
                  />
                  <span className="text-gray-400 text-sm">—</span>
                  <input
                    type="date"
                    value={rangeEnd}
                    onChange={(e) => onChangeRangeEnd(e.target.value)}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-800"
                  />
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-gray-700 hover:bg-gray-50"
                  title="Periodo siguiente"
                  aria-label="Periodo siguiente"
                  onClick={() => shiftRange(1)}
                >
                  ›
                </button>
                <span className="text-sm text-gray-600 hidden sm:inline tabular-nums">
                  {formatRangeLabelEs(rangeStart, rangeEnd)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  onClick={presetLast7}
                >
                  Últimos 7 días
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  onClick={presetAll}
                >
                  Todo el historial
                </button>
              </div>
            </div>

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

          <p className="text-[10px] text-gray-400">
            Los totales arriba siguen solo el rango elegido. La tabla añade filas en
            blanco hasta hoy si aún no llegó el Excel, para poder registrar la tasa
            cada día.
          </p>

        <div className="overflow-x-auto border rounded-lg bg-white shadow-sm">
          <table className="min-w-[920px] w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2">Fecha</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">
                  <span className="block">Tasa del día</span>
                  <span className="block text-[10px] font-normal text-gray-500">
                    (Bs)
                  </span>
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

                return (
                  <tr
                    key={r?.id ?? `placeholder-${dateStr}`}
                    className={`border-t border-gray-100 hover:bg-gray-50 ${
                      isPlaceholder ? "bg-gray-50/90" : ""
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
                          className="w-full min-w-[6.5rem] max-w-[9rem] ml-auto rounded border border-gray-200 px-2 py-1 text-right text-sm tabular-nums focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                      {r?.import_batch_id != null ? `#${r.import_batch_id}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}

/** Ventas por tipo de pago — misma estructura que Loyverse Back Office + Excel. */
export function LoyverseVentasPorPago() {
  const [rows, setRows] = useState([]);
  const [ratesByDate, setRatesByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeBootstrapped, setRangeBootstrapped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
        if (cancelled) return;
        setRows(res.data || []);
        const map = {};
        for (const row of ratesData) {
          const dk = String(row.business_date || "").slice(0, 10);
          if (dk && row.rate_bs != null) {
            map[dk] = Number(row.rate_bs);
          }
        }
        setRatesByDate(map);
      } catch (e) {
        if (!cancelled) setErr(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (rows.length === 0 || rangeBootstrapped) return;
    const uniq = [
      ...new Set(rows.map((r) => String(r.business_date || "").slice(0, 10))),
    ]
      .filter(Boolean)
      .sort();
    if (uniq.length === 0) return;
    setRangeStart(uniq[0]);
    setRangeEnd(uniq[uniq.length - 1]);
    setRangeBootstrapped(true);
  }, [rows, rangeBootstrapped]);

  const filteredRows = useMemo(() => {
    if (!rangeStart || !rangeEnd) return rows;
    const lo = minYmd(rangeStart, rangeEnd);
    const hi = maxYmd(rangeStart, rangeEnd);
    return rows.filter((r) => {
      const d = String(r.business_date || "").slice(0, 10);
      return d && d >= lo && d <= hi;
    });
  }, [rows, rangeStart, rangeEnd]);

  const { byMethod, total, rowsMissingRate } = useMemo(() => {
    const map = new Map();
    let missing = 0;

    for (const r of filteredRows) {
      const pm = String(r.payment_method || "desconocido");
      const d = String(r.business_date || "").slice(0, 10);
      const rateRaw = d ? ratesByDate[d] : null;
      const rateNum =
        rateRaw != null && Number.isFinite(Number(rateRaw))
          ? Number(rateRaw)
          : null;

      const cur = map.get(pm) || {
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

      map.set(pm, cur);
    }

    let sumTx = 0;
    let sumPago = 0;
    let sumPagoBs = 0;
    let sumRefTx = 0;
    let sumRefAmt = 0;
    let sumRefAmtBs = 0;
    let sumNet = 0;
    let sumNetBs = 0;
    for (const v of map.values()) {
      sumTx += v.txns;
      sumPago += v.importePago;
      sumPagoBs += v.importePagoBs;
      sumRefTx += v.reembolsoTxns;
      sumRefAmt += v.importeReembolso;
      sumRefAmtBs += v.importeReembolsoBs;
      sumNet += v.montoNeto;
      sumNetBs += v.montoNetoBs;
    }

    const sorted = [...map.values()].sort((a, b) => {
      const da = paymentMethodSortKey(a.payment_method);
      const db = paymentMethodSortKey(b.payment_method);
      if (da !== db) return da - db;
      return formatPaymentMethodLabel(a.payment_method).localeCompare(
        formatPaymentMethodLabel(b.payment_method),
        "es"
      );
    });

    return {
      byMethod: sorted,
      rowsMissingRate: missing,
      total: {
        txns: sumTx,
        importePago: sumPago,
        importePagoBs: sumPagoBs,
        reembolsoTxns: sumRefTx,
        importeReembolso: sumRefAmt,
        importeReembolsoBs: sumRefAmtBs,
        montoNeto: sumNet,
        montoNetoBs: sumNetBs,
      },
    };
  }, [filteredRows, ratesByDate]);

  function shiftRange(direction) {
    if (!rangeStart || !rangeEnd) return;
    const step = daysInclusive(rangeStart, rangeEnd);
    setRangeStart(addDaysYmd(rangeStart, direction * step));
    setRangeEnd(addDaysYmd(rangeEnd, direction * step));
  }

  function presetLast7() {
    const uniq = [
      ...new Set(rows.map((r) => String(r.business_date || "").slice(0, 10))),
    ]
      .filter(Boolean)
      .sort();
    if (uniq.length === 0) return;
    const end = uniq[uniq.length - 1];
    const start = addDaysYmd(end, -6);
    const lo = uniq[0];
    setRangeStart(start < lo ? lo : start);
    setRangeEnd(end);
  }

  function presetAll() {
    const uniq = [
      ...new Set(rows.map((r) => String(r.business_date || "").slice(0, 10))),
    ]
      .filter(Boolean)
      .sort();
    if (uniq.length === 0) return;
    setRangeStart(uniq[0]);
    setRangeEnd(uniq[uniq.length - 1]);
  }

  function onChangeRangeStart(v) {
    setRangeStart(v);
    if (rangeEnd && v > rangeEnd) setRangeEnd(v);
  }

  function onChangeRangeEnd(v) {
    setRangeEnd(v);
    if (rangeStart && v < rangeStart) setRangeStart(v);
  }

  function exportCsv() {
    const header = [
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
    for (const r of byMethod) {
      lines.push(
        [
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
    lines.push(
      [
        "Total",
        total.txns,
        total.importePago.toFixed(2),
        total.importePagoBs.toFixed(2),
        total.reembolsoTxns,
        total.importeReembolso.toFixed(2),
        total.importeReembolsoBs.toFixed(2),
        total.montoNeto.toFixed(2),
        total.montoNetoBs.toFixed(2),
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

  return (
    <div className="px-4 pt-2 pb-8 space-y-3 w-full max-w-6xl">
      <p className="text-[11px] text-gray-500 leading-snug max-w-3xl">
        Estructura alineada con Loyverse y el Excel. USD arriba; Bs en naranja
        usando la misma tasa del día que guardas en «Resumen de ventas» para
        cada fecha de cada fila importada (USD × tasa de ese día). Si el archivo
        no trae fecha por fila, se usa la del nombre del archivo.
      </p>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {loading && <p className="text-sm text-gray-500">Cargando…</p>}
      {!loading && rows.length === 0 && !err && (
        <p className="text-sm text-gray-500">
          No hay datos por tipo de pago. Importa desde «Cargar reporte Ventas» con tipo
          «Ventas por tipo de pago» o detección automática.
        </p>
      )}
      {rows.length > 0 && (
        <>
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 bg-zm-green px-4 py-3 text-white">
              <h2 className="text-sm font-semibold tracking-tight">
                Ventas por tipo de pago
              </h2>
            </div>
            <div className="p-3 sm:p-4 space-y-3 border-b border-gray-100">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-gray-700 hover:bg-gray-50"
                    title="Periodo anterior"
                    aria-label="Periodo anterior"
                    onClick={() => shiftRange(-1)}
                  >
                    ‹
                  </button>
                  <input
                    type="date"
                    value={rangeStart}
                    onChange={(e) => onChangeRangeStart(e.target.value)}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-800"
                  />
                  <span className="text-gray-400 text-sm">—</span>
                  <input
                    type="date"
                    value={rangeEnd}
                    onChange={(e) => onChangeRangeEnd(e.target.value)}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-800"
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-gray-700 hover:bg-gray-50"
                    title="Periodo siguiente"
                    aria-label="Periodo siguiente"
                    onClick={() => shiftRange(1)}
                  >
                    ›
                  </button>
                  <span className="text-sm text-gray-600 hidden sm:inline tabular-nums">
                    {formatRangeLabelEs(rangeStart, rangeEnd)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                    onClick={presetLast7}
                  >
                    Últimos 7 días
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                    onClick={presetAll}
                  >
                    Todo el historial
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-zm-green/40 bg-white px-3 py-1.5 text-xs font-semibold text-zm-green hover:bg-zm-green/5"
                    onClick={exportCsv}
                  >
                    EXPORTAR
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">
                      Tipo de pago
                    </th>
                    <th className="text-right px-3 py-2 font-medium whitespace-nowrap">
                      Transacciones de pago
                    </th>
                    <th className="text-right px-3 py-2 font-medium whitespace-nowrap">
                      <span className="block">Importe del pago</span>
                      <span className="block text-[10px] font-normal text-gray-500">
                        (USD / Bs)
                      </span>
                    </th>
                    <th className="text-right px-3 py-2 font-medium whitespace-nowrap">
                      Reembolso de transacciones
                    </th>
                    <th className="text-right px-3 py-2 font-medium whitespace-nowrap">
                      <span className="block">Importe de reembolsos</span>
                      <span className="block text-[10px] font-normal text-gray-500">
                        (USD / Bs)
                      </span>
                    </th>
                    <th className="text-right px-3 py-2 font-medium whitespace-nowrap">
                      <span className="block">Monto neto</span>
                      <span className="block text-[10px] font-normal text-gray-500">
                        (USD / Bs)
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {byMethod.map((r) => (
                    <tr
                      key={r.payment_method}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-3 py-2">
                        {formatPaymentMethodLabel(r.payment_method)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.txns}
                      </td>
                      <UsdBsAggregateCell
                        usdValue={r.importePago}
                        bsSum={r.importePagoBs}
                      />
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.reembolsoTxns}
                      </td>
                      <UsdBsAggregateCell
                        usdValue={r.importeReembolso}
                        bsSum={r.importeReembolsoBs}
                      />
                      <UsdBsAggregateCell
                        usdValue={r.montoNeto}
                        bsSum={r.montoNetoBs}
                        variant="emphasis"
                      />
                    </tr>
                  ))}
                  {byMethod.length > 0 && (
                    <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                      <td className="px-3 py-2">Total</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {total.txns}
                      </td>
                      <UsdBsAggregateCell
                        usdValue={total.importePago}
                        bsSum={total.importePagoBs}
                      />
                      <td className="px-3 py-2 text-right tabular-nums">
                        {total.reembolsoTxns}
                      </td>
                      <UsdBsAggregateCell
                        usdValue={total.importeReembolso}
                        bsSum={total.importeReembolsoBs}
                      />
                      <UsdBsAggregateCell
                        usdValue={total.montoNeto}
                        bsSum={total.montoNetoBs}
                        variant="emphasis"
                      />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <p className="text-[10px] text-gray-400">
            La tabla resume todas las filas importadas en el rango (puede haber
            varias por método y día). Los Bs suman (USD de cada fila × tasa del
            día de esa fila en Resumen de ventas).
            {rowsMissingRate > 0 && (
              <span className="block mt-0.5 text-amber-700/90">
                {rowsMissingRate} fila(s) con montos en USD no tienen tasa guardada
                para su fecha: complete la tasa en Resumen de ventas para
                incluirlas en los totales Bs.
              </span>
            )}
          </p>
        </>
      )}
    </div>
  );
}
