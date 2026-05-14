import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchZmWeeklyFinanceOverview,
  fetchZmWeeklyWeekBounds,
} from "../../../api/admin/finance/zmWeeklyOverviewApi";
import { fetchBankAccounts } from "../../../api/admin/finance/bankApi";
import { useFinanceBasePath } from "../../../contexts/FinanceBasePathContext.jsx";

function formatBs(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Monto en bolívares con prefijo visible (símbolo Bs.). */
function formatBsWithSymbol(value) {
  const core = formatBs(value);
  if (core === "—") return "—";
  return `Bs.\u00A0${core}`;
}

function formatUsd(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function addDaysYmd(ymd, delta) {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function formatWeekRangeLabel(weekStartFriday, weekEndThursday) {
  const a = new Date(`${weekStartFriday}T12:00:00`);
  const b = new Date(`${weekEndThursday}T12:00:00`);
  const fmt = new Intl.DateTimeFormat("es-VE", {
    day: "numeric",
    month: "short",
  });
  return `${fmt.format(a)} – ${fmt.format(b)} ${a.getFullYear()}`;
}

function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

/** Monto USD en columna derecha; si es deducción, entre paréntesis (estilo estado de resultados). */
function StatementUsdAmount({ value, isDeduction }) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) {
    return <span className="tabular-nums text-gray-400">—</span>;
  }
  const t = formatUsd(Math.abs(n));
  if (isDeduction) {
    return <span className="tabular-nums text-zm-sidebar">({t})</span>;
  }
  return <span className="tabular-nums font-semibold text-zm-sidebar">{t}</span>;
}

/** Monto Bs; deducciones entre paréntesis. */
function StatementBsAmount({ value, isDeduction }) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) {
    return <span className="tabular-nums text-gray-400">—</span>;
  }
  const core = formatBs(Math.abs(n));
  const inner = `Bs.\u00A0${core}`;
  if (isDeduction) {
    return <span className="tabular-nums font-semibold text-orange-600">({inner})</span>;
  }
  return <span className="tabular-nums font-semibold text-orange-600">{inner}</span>;
}

function StatementDualLine({ usd, bs, isDeduction }) {
  return (
    <div className="flex flex-col items-end gap-0.5 text-sm leading-tight sm:text-base">
      <StatementUsdAmount value={usd} isDeduction={isDeduction} />
      <StatementBsAmount value={bs} isDeduction={isDeduction} />
    </div>
  );
}

function StatementBsOnlyLine({ value, isDeduction }) {
  return (
    <div className="flex flex-col items-end gap-0.5 text-sm leading-tight sm:text-base">
      <span className="tabular-nums text-xs text-gray-400 sm:text-sm">—</span>
      <StatementBsAmount value={value} isDeduction={isDeduction} />
    </div>
  );
}

function StatementLeaderRow({ label, children }) {
  return (
    <div className="flex min-h-[2.5rem] items-end gap-2">
      <span className="min-w-0 max-w-[58%] shrink text-left text-sm font-medium leading-snug text-gray-900 sm:max-w-[65%] sm:text-base">
        {label}
      </span>
      <span
        className="mb-1.5 h-px min-w-[0.75rem] flex-1 border-b border-dotted border-gray-300"
        aria-hidden
      />
      <div className="shrink-0 text-right">{children}</div>
    </div>
  );
}

/**
 * Resumen semanal Zona Market (corte viernes → jueves): ventas Loyverse, órdenes de compra, banco.
 */
export default function ZmWeeklyFinancePanel() {
  const financeBase = useFinanceBasePath();
  const [weekStartFriday, setWeekStartFriday] = useState("");
  const [weekEndThursday, setWeekEndThursday] = useState("");
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankAccountId, setBankAccountId] = useState("");
  const [viewMode, setViewMode] = useState("cards");

  const bootstrapWeek = useCallback(async () => {
    const res = await fetchZmWeeklyWeekBounds();
    const d = res.data || {};
    setWeekStartFriday(String(d.weekStartFriday || "").slice(0, 10));
    setWeekEndThursday(String(d.weekEndThursday || "").slice(0, 10));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const acc = await fetchBankAccounts({ includeInactive: false });
        if (!cancelled) setBankAccounts(acc.data || []);
      } catch {
        if (!cancelled) setBankAccounts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void bootstrapWeek();
  }, [bootstrapWeek]);

  const loadOverview = useCallback(async () => {
    if (!weekStartFriday) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchZmWeeklyFinanceOverview({
        weekStartFriday,
        bankAccountId: bankAccountId || undefined,
      });
      setOverview(res.data || null);
      if (res.data?.week_end_thursday) {
        setWeekEndThursday(String(res.data.week_end_thursday).slice(0, 10));
      }
    } catch (e) {
      setError(e.message || "Error cargando datos.");
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [weekStartFriday, bankAccountId]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const weekLabel = useMemo(() => {
    if (!weekStartFriday || !weekEndThursday) return "";
    return formatWeekRangeLabel(weekStartFriday, weekEndThursday);
  }, [weekStartFriday, weekEndThursday]);

  function goPrevWeek() {
    if (!weekStartFriday) return;
    setWeekStartFriday(addDaysYmd(weekStartFriday, -7));
  }

  function goNextWeek() {
    if (!weekStartFriday) return;
    setWeekStartFriday(addDaysYmd(weekStartFriday, 7));
  }

  const flow = overview ? Number(overview.indicative_flow_bs) : NaN;
  const flowPositive = Number.isFinite(flow) && flow >= 0;

  const usdApproxNet = useMemo(() => {
    if (!overview) return NaN;
    return (
      Number(overview.sales_usd_total || 0) -
      Number(overview.purchase_orders_usd_total || 0)
    );
  }, [overview]);

  /** Tarjeta con USD arriba y Bs debajo (mismo recuadro); solo montos, sin micro-etiquetas. */
  function kpiCardDualCurrency({ title, usd, bs }) {
    return (
      <div className="rounded-xl border border-zm-green/20 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {title}
        </p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-zm-sidebar sm:text-3xl">
          {formatUsd(usd)}
        </p>
        <p className="mt-3 text-xl font-bold tabular-nums text-orange-600 sm:text-2xl">
          {formatBsWithSymbol(bs)}
        </p>
      </div>
    );
  }

  const kpiCard = (title, value) => (
    <div className="rounded-xl border border-zm-green/20 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-zm-sidebar sm:text-3xl">
        {value}
      </p>
    </div>
  );

  return (
    <div className="w-full max-w-7xl font-zm px-4 sm:px-6 pb-10 pt-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zm-green">
            Zona Market · Finanzas
          </p>
          <h1 className="mt-1 text-lg font-bold tracking-tight text-zm-sidebar sm:text-xl">
            Resumen por semana de trabajo
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Cada semana va de <strong className="text-zm-sidebar">viernes</strong> a{" "}
            <strong className="text-zm-sidebar">jueves</strong> (corte operativo).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goPrevWeek}
            className="rounded-lg border border-zm-green/30 bg-white px-3 py-2 text-sm font-semibold text-zm-green hover:bg-zm-cream/50"
            aria-label="Semana anterior"
          >
            ‹ Semana anterior
          </button>
          <button
            type="button"
            onClick={goNextWeek}
            className="rounded-lg border border-zm-green/30 bg-white px-3 py-2 text-sm font-semibold text-zm-green hover:bg-zm-cream/50"
            aria-label="Semana siguiente"
          >
            Semana siguiente ›
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-zm-green/25 bg-zm-cream/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500">Semana seleccionada</p>
          <p className="text-base font-semibold text-zm-sidebar">{weekLabel}</p>
          <p className="text-xs text-gray-500 tabular-nums">
            {weekStartFriday} → {weekEndThursday}
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-1 sm:items-end">
          <label
            htmlFor="zm-week-bank-filter"
            className="text-[10px] font-semibold uppercase tracking-wide text-gray-500"
          >
            Cuenta banco (opcional)
          </label>
          <select
            id="zm-week-bank-filter"
            className="max-w-full rounded-lg border border-zm-green/30 bg-white py-2 pl-2 pr-8 text-sm text-zm-sidebar"
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
          >
            <option value="">Todas las cuentas</option>
            {bankAccounts.map((a) => (
              <option key={a.id} value={String(a.id)}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1 border-b border-zm-green/15 pb-3">
        <button
          type="button"
          onClick={() => setViewMode("cards")}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors",
            viewMode === "cards"
              ? "bg-zm-cream/70 border-zm-green/45 text-zm-sidebar shadow-sm"
              : "bg-transparent border-transparent text-gray-600 hover:text-zm-sidebar hover:bg-zm-cream/40"
          )}
        >
          Vista tarjetas
        </button>
        <button
          type="button"
          onClick={() => setViewMode("statement")}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors",
            viewMode === "statement"
              ? "bg-zm-cream/70 border-zm-green/45 text-zm-sidebar shadow-sm"
              : "bg-transparent border-transparent text-gray-600 hover:text-zm-sidebar hover:bg-zm-cream/40"
          )}
        >
          Estado de resultados
        </button>
      </div>

      {error && (
        <p className="mt-4 text-sm text-zm-red" role="alert">
          {error}
        </p>
      )}
      {loading && (
        <p className="mt-4 text-sm text-gray-600">Cargando…</p>
      )}

      {!loading && overview && (
        <>
          {viewMode === "cards" && (
            <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {kpiCardDualCurrency({
              title: "Ventas",
              usd: overview.sales_usd_total,
              bs: overview.sales_bs_estimated,
            })}
            {kpiCardDualCurrency({
              title: "Órdenes de compra",
              usd: overview.purchase_orders_usd_total,
              bs: overview.purchase_orders_bs_estimated,
            })}
            {kpiCard(
              "Nómina (banco, Bs)",
              formatBsWithSymbol(overview.bank_nomina_debit_bs)
            )}
            {kpiCard(
              "Comisiones (banco, Bs)",
              formatBsWithSymbol(overview.bank_comision_debit_bs)
            )}
            {kpiCard(
              "Compra inventario (banco, Bs)",
              formatBsWithSymbol(overview.bank_compra_inventario_debit_bs)
            )}
          </div>

          <div
            className={`mt-6 rounded-2xl border px-5 py-5 shadow-md ${
              flowPositive
                ? "border-zm-green/35 bg-zm-green/10"
                : "border-zm-red/30 bg-zm-red/5"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Resultado indicativo (Bs)
            </p>
            <p
              className={`mt-2 text-3xl font-bold tabular-nums sm:text-4xl ${
                flowPositive ? "text-zm-sidebar" : "text-zm-red"
              }`}
            >
              {formatBsWithSymbol(overview.indicative_flow_bs)}
            </p>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              Fórmula: ventas Bs − órdenes Bs − nómina − comisiones − compra inventario (banco). Puede
              solaparse órdenes con movimientos bancarios si registrás lo mismo dos veces.
            </p>
          </div>
            </>
          )}

          {viewMode === "statement" && (
            <section className="mt-6 max-w-2xl rounded-xl border border-zm-green/20 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="border-b border-zm-green/25 pb-2 text-center text-sm font-bold uppercase tracking-wide text-zm-sidebar sm:text-base">
                Estado de resultados
              </h2>
              <p className="mt-1 text-center text-sm text-gray-600">{weekLabel}</p>

              <div className="mt-6 space-y-3">
                <StatementLeaderRow label="Ventas netas">
                  <StatementDualLine
                    usd={overview.sales_usd_total}
                    bs={overview.sales_bs_estimated}
                    isDeduction={false}
                  />
                </StatementLeaderRow>
                <StatementLeaderRow label="Menos: órdenes de compra (mercancía)">
                  <StatementDualLine
                    usd={overview.purchase_orders_usd_total}
                    bs={overview.purchase_orders_bs_estimated}
                    isDeduction
                  />
                </StatementLeaderRow>
                <StatementLeaderRow label="Menos: nómina (banco)">
                  <StatementBsOnlyLine
                    value={overview.bank_nomina_debit_bs}
                    isDeduction
                  />
                </StatementLeaderRow>
                <StatementLeaderRow label="Menos: comisiones bancarias">
                  <StatementBsOnlyLine
                    value={overview.bank_comision_debit_bs}
                    isDeduction
                  />
                </StatementLeaderRow>
                <StatementLeaderRow label="Menos: compra inventario (banco)">
                  <StatementBsOnlyLine
                    value={overview.bank_compra_inventario_debit_bs}
                    isDeduction
                  />
                </StatementLeaderRow>
              </div>

              <div
                className={cn(
                  "mt-6 rounded-xl border-2 px-4 py-4 sm:px-5 sm:py-5",
                  flowPositive
                    ? "border-zm-green/45 bg-zm-green/10"
                    : "border-zm-red/40 bg-zm-red/5"
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Ganancia neta indicativa
                </p>
                <p
                  className={cn(
                    "mt-2 text-2xl font-bold tabular-nums sm:text-3xl",
                    flowPositive ? "text-zm-sidebar" : "text-zm-red"
                  )}
                >
                  {formatBsWithSymbol(overview.indicative_flow_bs)}
                </p>
                <p className="mt-2 text-sm font-semibold tabular-nums text-zm-sidebar">
                  {Number.isFinite(usdApproxNet) ? formatUsd(usdApproxNet) : "—"}{" "}
                  <span className="text-xs font-normal text-gray-500">(USD aprox.: ventas − órdenes)</span>
                </p>
              </div>
            </section>
          )}

          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <Link
              to={`${financeBase}/loyverse?tab=ventas&ventasSub=resumen`}
              className="font-semibold text-zm-green hover:underline"
            >
              Ir a ventas Loyverse
            </Link>
            <span className="text-gray-300" aria-hidden>
              |
            </span>
            <Link
              to={`${financeBase}/loyverse?tab=compras`}
              className="font-semibold text-zm-green hover:underline"
            >
              Ir a órdenes de compra
            </Link>
            <span className="text-gray-300" aria-hidden>
              |
            </span>
            <Link
              to={`${financeBase}/cuentas?cuentasSub=movimientos`}
              className="font-semibold text-zm-green hover:underline"
            >
              Ir a movimientos bancarios
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
