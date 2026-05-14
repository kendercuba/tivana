import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import LoyversePorPagoDateRange from "../../../components/admin/finance/LoyversePorPagoDateRange.jsx";
import { useFinanceBasePath } from "../../../contexts/FinanceBasePathContext.jsx";
import { fetchBankAccounts } from "../../../api/admin/finance/bankApi.js";
import { fetchLoyverseBankReconciliationSnapshot } from "../../../api/admin/finance/loyverseBankReconciliationApi.js";

const PAYMENT_METHOD_OPTIONS = [
  { value: "pago_movil", label: "Pago móvil" },
  { value: "efectivo", label: "Efectivo" },
  { value: "pos", label: "Tarjeta (POS)" },
  { value: "zelle", label: "Zelle" },
];

function localTodayYmd() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(
    t.getDate()
  ).padStart(2, "0")}`;
}

function formatBs(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatUsd(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatEsShortYmd(ymd) {
  if (!ymd) return "—";
  const [y, m, d] = String(ymd).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("es-VE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function matchBadgeClass(status) {
  if (status === "ok" || status === "ok_sobre") {
    return "border border-zm-green/35 bg-zm-green/10 text-zm-sidebar";
  }
  if (status === "sin_datos") {
    return "border border-gray-200 bg-gray-50 text-gray-700";
  }
  if (status === "sin_loyverse" || status === "sin_banco") {
    return "border border-amber-200 bg-amber-50 text-amber-950";
  }
  return "border border-zm-green/25 bg-zm-cream text-zm-sidebar";
}

function matchStatusTitle(status) {
  switch (status) {
    case "ok":
      return "Alineado";
    case "ok_sobre":
      return "Alineado (banco mayor)";
    case "suma_ok_conteo":
      return "Totales OK, conteo distinto";
    case "sin_datos":
      return "Sin datos";
    case "sin_loyverse":
      return "Sin Loyverse";
    case "sin_banco":
      return "Sin banco";
    case "banco_sin_filtro_pm":
      return "Créditos del día";
    case "banco_bajo":
      return "Banco por debajo";
    case "banco_alto":
      return "Banco por encima";
    default:
      return "Revisar";
  }
}

function minYmd(a, b) {
  return a <= b ? a : b;
}

function maxYmd(a, b) {
  return a >= b ? a : b;
}

export default function ZmLoyverseBankReconciliationPage() {
  const financeBase = useFinanceBasePath();
  const [searchParams, setSearchParams] = useSearchParams();

  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState(null);

  const [dateYmd, setDateYmd] = useState(() => {
    const d = searchParams.get("date") || "";
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : localTodayYmd();
  });

  const [bankAccountId, setBankAccountId] = useState(() => {
    const raw = searchParams.get("bankAccountId");
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  });

  const [paymentMethod, setPaymentMethod] = useState(() => {
    const pm = (searchParams.get("paymentMethod") || "pago_movil").toLowerCase();
    const ok = PAYMENT_METHOD_OPTIONS.some((o) => o.value === pm);
    return ok ? pm : "pago_movil";
  });

  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState(null);
  const [snapshot, setSnapshot] = useState(null);

  const loyversePagoLink = useMemo(
    () => `${financeBase}/loyverse?tab=ventas&ventasSub=pago`,
    [financeBase]
  );
  const bankHubLink = useMemo(
    () => `${financeBase}/cuentas?cuentasSub=movimientos`,
    [financeBase]
  );

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      const res = await fetchBankAccounts({ includeInactive: false });
      setAccounts(res.data || []);
    } catch (e) {
      setAccountsError(e.message || "Error cargando cuentas.");
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (accounts.length === 0) return;
    setBankAccountId((prev) => {
      if (prev != null && accounts.some((a) => a.id === prev)) return prev;
      return accounts[0].id;
    });
  }, [accounts]);

  useEffect(() => {
    const d = searchParams.get("date") || "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setDateYmd((prev) => (prev === d ? prev : d));
    }
    const rawB = searchParams.get("bankAccountId");
    const n = Number(rawB);
    if (Number.isFinite(n) && n > 0) {
      setBankAccountId((prev) => (prev === n ? prev : n));
    }
    const pm = (searchParams.get("paymentMethod") || "").toLowerCase();
    if (pm && PAYMENT_METHOD_OPTIONS.some((o) => o.value === pm)) {
      setPaymentMethod((prev) => (prev === pm ? prev : pm));
    }
  }, [searchParams]);

  useEffect(() => {
    if (!dateYmd || bankAccountId == null) return;
    const next = new URLSearchParams();
    next.set("date", dateYmd);
    next.set("bankAccountId", String(bankAccountId));
    next.set("paymentMethod", paymentMethod);
    const cur = searchParams.toString();
    if (cur !== next.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [bankAccountId, dateYmd, paymentMethod, searchParams, setSearchParams]);

  useEffect(() => {
    if (!dateYmd || bankAccountId == null) {
      setSnapshot(null);
      setSnapshotLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setSnapshotLoading(true);
      setSnapshotError(null);
      try {
        const data = await fetchLoyverseBankReconciliationSnapshot({
          date: dateYmd,
          bankAccountId,
          paymentMethod,
        });
        if (!cancelled) setSnapshot(data);
      } catch (e) {
        if (!cancelled) {
          setSnapshot(null);
          setSnapshotError(e.message || "No se pudo cargar la conciliación.");
        }
      } finally {
        if (!cancelled) setSnapshotLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bankAccountId, dateYmd, paymentMethod]);

  function onApplyCalendarRange(startYmd, endYmd) {
    if (!startYmd || !endYmd) return;
    const lo = minYmd(startYmd, endYmd);
    const hi = maxYmd(startYmd, endYmd);
    const chosen = lo === hi ? lo : hi;
    setDateYmd(chosen);
  }

  const accountName =
    snapshot?.bank_account_name ||
    accounts.find((a) => a.id === bankAccountId)?.name ||
    "";

  return (
    <div className="w-full font-zm px-4 pb-10 pt-3 sm:px-6">
      <div className="w-full max-w-7xl space-y-4">
        <div className="flex w-full items-center rounded-b-xl bg-zm-green px-4 py-3 text-white shadow-sm sm:px-6">
          <h1 className="text-sm font-semibold tracking-tight sm:text-base">
            Conciliación Loyverse ↔ banco
          </h1>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <Link
            to={loyversePagoLink}
            className="rounded-lg border border-zm-green/40 bg-white px-3 py-1.5 text-zm-green hover:bg-zm-green/5"
          >
            Ir a ventas por tipo de pago
          </Link>
          <Link
            to={bankHubLink}
            className="rounded-lg border border-zm-green/40 bg-white px-3 py-1.5 text-zm-green hover:bg-zm-green/5"
          >
            Ir a movimientos bancarios
          </Link>
        </div>

        <section className="rounded-xl border border-zm-green/20 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="min-w-0 w-full lg:flex-1 lg:max-w-md">
              <span className="mb-1 block text-sm font-medium text-zm-sidebar">
                Fecha de negocio
              </span>
              <LoyversePorPagoDateRange
                rangeStart={dateYmd}
                rangeEnd={dateYmd}
                calendarMonthAnchorYmd={dateYmd}
                onApplyRange={onApplyCalendarRange}
              />
            </div>
            <div className="min-w-0 w-full sm:w-56">
              <label
                htmlFor="zm-recon-bank"
                className="mb-1 block text-sm font-medium text-zm-sidebar"
              >
                Cuenta bancaria
              </label>
              <select
                id="zm-recon-bank"
                value={bankAccountId ?? ""}
                disabled={accountsLoading || accounts.length === 0}
                onChange={(e) => {
                  const v = e.target.value;
                  setBankAccountId(v === "" ? null : Number(v));
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm outline-none transition hover:border-gray-400 focus:border-zm-green focus:ring-2 focus:ring-zm-green/30 disabled:bg-gray-50 disabled:text-gray-400"
              >
                {accounts.length === 0 ? (
                  <option value="">
                    {accountsLoading ? "Cargando…" : "Sin cuentas"}
                  </option>
                ) : (
                  accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="min-w-0 w-full sm:w-48">
              <label
                htmlFor="zm-recon-pm"
                className="mb-1 block text-sm font-medium text-zm-sidebar"
              >
                Método Loyverse
              </label>
              <select
                id="zm-recon-pm"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm outline-none transition hover:border-gray-400 focus:border-zm-green focus:ring-2 focus:ring-zm-green/30"
              >
                {PAYMENT_METHOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {accountsError && (
            <p className="mt-3 text-sm text-zm-red" role="alert">
              {accountsError}
            </p>
          )}
        </section>

        {snapshotError && (
          <p className="text-sm text-zm-red" role="alert">
            {snapshotError}
          </p>
        )}
        {snapshotLoading && (
          <p className="text-sm text-gray-500">Cargando conciliación…</p>
        )}

        {!snapshotLoading && snapshot && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-zm-green/20 bg-white p-4 shadow-sm">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Loyverse
                </h2>
                <p className="mt-1 text-sm text-gray-600">{formatEsShortYmd(snapshot.business_date)}</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-600">Transacciones</dt>
                    <dd className="font-semibold tabular-nums text-gray-900">
                      {snapshot.loyverse?.txn_count ?? "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-600">Importe pago (USD)</dt>
                    <dd className="font-semibold tabular-nums text-gray-900">
                      {formatUsd(snapshot.loyverse?.gross_sales_usd)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-600">Importe pago (Bs)</dt>
                    <dd className="font-semibold tabular-nums text-orange-600">
                      Bs. {formatBs(snapshot.loyverse?.importe_pago_bs)}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="rounded-xl border border-zm-green/20 bg-white p-4 shadow-sm">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Banco
                </h2>
                <p className="mt-1 truncate text-sm text-gray-600" title={accountName}>
                  {accountName || "—"}
                </p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-600">Abonos listados</dt>
                    <dd className="font-semibold tabular-nums text-gray-900">
                      {snapshot.bank?.movement_count ?? "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-600">Suma créditos (Bs)</dt>
                    <dd className="font-semibold tabular-nums text-orange-600">
                      Bs. {formatBs(snapshot.bank?.credit_total_bs)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div
              className={`rounded-lg px-3 py-2 text-sm ${matchBadgeClass(snapshot.match?.status)}`}
            >
              <span className="font-semibold">{matchStatusTitle(snapshot.match?.status)}</span>
              {snapshot.match?.hint_es ? (
                <span className="block mt-1 font-normal">{snapshot.match.hint_es}</span>
              ) : null}
              {snapshot.match && (
                <span className="mt-2 block text-xs tabular-nums text-gray-700">
                  Conteo banco − Loyverse: {snapshot.match.diff_txn}; diferencia Bs.:{" "}
                  {formatBs(snapshot.match.diff_bs)}
                </span>
              )}
            </div>

            <section className="rounded-xl border border-zm-green/20 bg-white p-3 shadow-sm sm:p-4">
              <h2 className="text-sm font-semibold text-zm-sidebar">
                Movimientos banco (día seleccionado)
              </h2>
              <div className="mt-3 max-h-[min(65vh,36rem)] sm:max-h-[min(70vh,42rem)] overflow-y-auto overflow-x-auto border border-zm-green/15 rounded-lg bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
                <table className="min-w-[920px] w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10 border-b border-zm-green/25 bg-zm-cream [&_th]:bg-zm-cream">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium whitespace-nowrap">ID</th>
                      <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Fecha</th>
                      <th className="text-left px-3 py-2 font-medium">Referencia</th>
                      <th className="text-left px-3 py-2 font-medium">Descripción</th>
                      <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Cód.</th>
                      <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Crédito Bs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(snapshot.bank?.movements || []).length === 0 ? (
                      <tr className="border-t border-gray-100">
                        <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-600">
                          No hay filas para este filtro.
                        </td>
                      </tr>
                    ) : (
                      snapshot.bank.movements.map((m) => (
                        <tr
                          key={m.id}
                          className="border-t border-gray-100 hover:bg-gray-50"
                        >
                          <td className="px-3 py-2 text-xs text-gray-400 font-mono whitespace-nowrap">
                            #{m.id}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                            {m.movement_date}
                          </td>
                          <td className="px-3 py-2 max-w-[12rem] truncate" title={m.reference || ""}>
                            {m.reference || "—"}
                          </td>
                          <td className="px-3 py-2 max-w-[22rem] truncate" title={m.description || ""}>
                            {m.description || "—"}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-600 whitespace-nowrap">
                            {m.transaction_code || "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">
                            {formatBs(m.credit_bs)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
