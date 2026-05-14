import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import LoyversePorPagoDateRange from "../../../components/admin/finance/LoyversePorPagoDateRange.jsx";
import { useFinanceBasePath } from "../../../contexts/FinanceBasePathContext.jsx";
import { fetchBankAccounts } from "../../../api/admin/finance/bankApi.js";
import { fetchLoyverseBankReconciliationSnapshot } from "../../../api/admin/finance/loyverseBankReconciliationApi.js";
import {
  deletePurchaseReconciliationLink,
  fetchPurchaseReconciliationDay,
  fetchPurchaseReconciliationSummary,
  postPurchaseReconciliationLink,
} from "../../../api/admin/finance/reconciliationApi.js";

/** Misma clave que en LoyverseVentasTablas (lote POS por día). */
const LOYVERSE_CARD_POS_BATCH_STORAGE_KEY = "zm_loyverse_card_pos_batch_by_date";

function readPosBatchFromStorage(ymd) {
  try {
    const raw = localStorage.getItem(LOYVERSE_CARD_POS_BATCH_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const v = map?.[ymd];
    return typeof v === "string" ? v.trim() : "";
  } catch {
    return "";
  }
}

const PAYMENT_METHOD_OPTIONS = [
  { value: "pago_movil", label: "Pago móvil" },
  { value: "efectivo", label: "Efectivo" },
  { value: "pos", label: "Tarjeta (POS)" },
  { value: "zelle", label: "Zelle" },
];

const RECON_MODES = {
  ventas: "ventas",
  compras: "compras",
};

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

function minYmd(a, b) {
  return a <= b ? a : b;
}

function maxYmd(a, b) {
  return a >= b ? a : b;
}

function clampReconMode(raw) {
  const s = String(raw || "").toLowerCase();
  return s === RECON_MODES.compras ? RECON_MODES.compras : RECON_MODES.ventas;
}

export default function ZmLoyverseBankReconciliationPage() {
  const financeBase = useFinanceBasePath();
  const [searchParams, setSearchParams] = useSearchParams();
  const prevDateRef = useRef(null);
  const prevPmRef = useRef(null);

  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState(null);

  const [reconMode, setReconMode] = useState(() =>
    clampReconMode(searchParams.get("mode"))
  );

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

  const [posBatch, setPosBatch] = useState(() =>
    (searchParams.get("posBatch") || "").trim()
  );

  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState(null);
  const [snapshot, setSnapshot] = useState(null);

  const [purchaseSummary, setPurchaseSummary] = useState(null);
  const [purchaseSummaryLoading, setPurchaseSummaryLoading] = useState(false);
  const [purchaseDay, setPurchaseDay] = useState(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState(null);
  const [selectedPoLineId, setSelectedPoLineId] = useState(null);
  const [includeReconciledPurchases, setIncludeReconciledPurchases] = useState(false);
  const [linkBusyId, setLinkBusyId] = useState(null);

  const loyversePagoLink = useMemo(
    () => `${financeBase}/loyverse?tab=ventas&ventasSub=pago`,
    [financeBase]
  );
  const loyverseComprasLink = useMemo(
    () => `${financeBase}/loyverse?tab=compras`,
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
    const mode = clampReconMode(searchParams.get("mode"));
    setReconMode((prev) => (prev === mode ? prev : mode));
  }, [searchParams]);

  useEffect(() => {
    if (paymentMethod !== "pos") {
      prevDateRef.current = dateYmd;
      prevPmRef.current = paymentMethod;
      return;
    }
    const fromUrl = (searchParams.get("posBatch") || "").trim();
    if (fromUrl) {
      setPosBatch(fromUrl);
      prevDateRef.current = dateYmd;
      prevPmRef.current = paymentMethod;
      return;
    }
    const isFirst = prevDateRef.current === null;
    const dateChanged = !isFirst && prevDateRef.current !== dateYmd;
    const switchedToPos =
      !isFirst && prevPmRef.current !== "pos" && paymentMethod === "pos";
    prevDateRef.current = dateYmd;
    prevPmRef.current = paymentMethod;
    if (isFirst || dateChanged || switchedToPos) {
      setPosBatch(readPosBatchFromStorage(dateYmd));
    }
  }, [dateYmd, paymentMethod, searchParams]);

  useEffect(() => {
    if (!dateYmd) return;
    const next = new URLSearchParams();
    next.set("date", dateYmd);
    if (reconMode === RECON_MODES.compras) {
      next.set("mode", RECON_MODES.compras);
    } else {
      next.delete("mode");
    }
    if (reconMode === RECON_MODES.ventas && bankAccountId != null) {
      next.set("bankAccountId", String(bankAccountId));
      next.set("paymentMethod", paymentMethod);
      if (paymentMethod === "pos" && posBatch.trim()) {
        next.set("posBatch", posBatch.trim());
      }
    }
    const cur = searchParams.toString();
    if (cur !== next.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [
    bankAccountId,
    dateYmd,
    paymentMethod,
    posBatch,
    reconMode,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    if (reconMode !== RECON_MODES.ventas || !dateYmd || bankAccountId == null) {
      if (reconMode !== RECON_MODES.ventas) {
        setSnapshotLoading(false);
      }
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
          posBatch: paymentMethod === "pos" ? posBatch : undefined,
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
  }, [bankAccountId, dateYmd, paymentMethod, posBatch, reconMode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPurchaseSummaryLoading(true);
      try {
        const data = await fetchPurchaseReconciliationSummary({ windowDays: 90 });
        if (!cancelled) setPurchaseSummary(data);
      } catch {
        if (!cancelled) setPurchaseSummary(null);
      } finally {
        if (!cancelled) setPurchaseSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reconMode !== RECON_MODES.compras || !dateYmd) {
      setPurchaseDay(null);
      setPurchaseLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setPurchaseLoading(true);
      setPurchaseError(null);
      try {
        const data = await fetchPurchaseReconciliationDay(dateYmd, {
          includeReconciled: includeReconciledPurchases,
        });
        if (!cancelled) {
          setPurchaseDay(data);
          setSelectedPoLineId(null);
        }
      } catch (e) {
        if (!cancelled) {
          setPurchaseDay(null);
          setPurchaseError(e.message || "No se pudieron cargar las compras.");
        }
      } finally {
        if (!cancelled) setPurchaseLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dateYmd, includeReconciledPurchases, reconMode]);

  function onApplyCalendarRange(startYmd, endYmd) {
    if (!startYmd || !endYmd) return;
    const lo = minYmd(startYmd, endYmd);
    const hi = maxYmd(startYmd, endYmd);
    const chosen = lo === hi ? lo : hi;
    setDateYmd(chosen);
  }

  const businessDateLabel = snapshot?.business_date || dateYmd;

  const canShowVentasPanels = Boolean(
    reconMode === RECON_MODES.ventas && dateYmd && bankAccountId != null
  );
  const canShowComprasPanels = Boolean(reconMode === RECON_MODES.compras && dateYmd);

  const poLinesFiltered = useMemo(() => {
    const rows = purchaseDay?.po_lines || [];
    if (includeReconciledPurchases) return rows;
    return rows.filter((r) => !r.reconciled);
  }, [purchaseDay?.po_lines, includeReconciledPurchases]);

  async function onBankRowClickPurchase(m) {
    if (!selectedPoLineId || m.reconciled) return;
    setLinkBusyId(m.id);
    setPurchaseError(null);
    try {
      await postPurchaseReconciliationLink({
        bankMovementId: m.id,
        zmPoLineId: selectedPoLineId,
      });
      const data = await fetchPurchaseReconciliationDay(dateYmd, {
        includeReconciled: includeReconciledPurchases,
      });
      setPurchaseDay(data);
      setSelectedPoLineId(null);
    } catch (e) {
      setPurchaseError(e.message || "No se pudo vincular.");
    } finally {
      setLinkBusyId(null);
    }
  }

  async function onUnlinkPurchase(bankMovementId) {
    setLinkBusyId(bankMovementId);
    setPurchaseError(null);
    try {
      await deletePurchaseReconciliationLink(bankMovementId);
      const data = await fetchPurchaseReconciliationDay(dateYmd, {
        includeReconciled: includeReconciledPurchases,
      });
      setPurchaseDay(data);
    } catch (e) {
      setPurchaseError(e.message || "No se pudo quitar el vínculo.");
    } finally {
      setLinkBusyId(null);
    }
  }

  const gridColsClass =
    reconMode === RECON_MODES.compras
      ? "lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]"
      : "lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]";

  const purchaseChipSubtitle = purchaseSummaryLoading
    ? "…"
    : purchaseSummary
      ? `${purchaseSummary.pending_lines} pend. · ${purchaseSummary.pending_days} días`
      : "—";

  return (
    <div className="w-full font-zm px-4 pb-10 pt-3 sm:px-6">
      <div className="w-full max-w-[1600px] space-y-4">
        <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-b-xl bg-zm-green px-4 py-3 text-white shadow-sm sm:px-6">
          <h1 className="text-sm font-semibold tracking-tight sm:text-base">
            Conciliación Loyverse ↔ banco
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to={loyversePagoLink}
              className="rounded-md px-2 py-1 text-[11px] font-semibold text-white/95 hover:bg-white/15 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/50"
              title="Ir a ventas por tipo de pago"
            >
              Loyverse
            </Link>
            <Link
              to={loyverseComprasLink}
              className="rounded-md px-2 py-1 text-[11px] font-semibold text-white/95 hover:bg-white/15 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/50"
              title="Ir a órdenes de compra"
            >
              Compras
            </Link>
            <Link
              to={bankHubLink}
              className="rounded-md px-2 py-1 text-[11px] font-semibold text-white/95 hover:bg-white/15 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/50"
              title="Ir a movimientos bancarios"
            >
              Movimientos
            </Link>
          </div>
        </div>

        <section className="rounded-xl border border-zm-green/20 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 w-full max-w-md shrink-0">
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
            <div className="flex min-w-0 flex-1 flex-wrap items-stretch justify-start gap-2 lg:justify-end lg:pl-4">
              <button
                type="button"
                onClick={() => setReconMode(RECON_MODES.ventas)}
                className={`flex min-h-[3.25rem] min-w-[10.5rem] flex-col rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors sm:min-w-[11rem] sm:text-sm ${
                  reconMode === RECON_MODES.ventas
                    ? "border-zm-green/45 bg-zm-cream/70 text-zm-sidebar shadow-sm"
                    : "border-transparent bg-zm-cream/30 text-gray-600 hover:bg-zm-cream/50 hover:text-zm-sidebar"
                }`}
              >
                <span>Ventas Loyverse</span>
                <span className="mt-0.5 text-[10px] font-normal text-gray-500 sm:text-xs">
                  Por método y cuenta
                </span>
              </button>
              <button
                type="button"
                onClick={() => setReconMode(RECON_MODES.compras)}
                className={`flex min-h-[3.25rem] min-w-[10.5rem] flex-col rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors sm:min-w-[11rem] sm:text-sm ${
                  reconMode === RECON_MODES.compras
                    ? "border-zm-green/45 bg-zm-cream/70 text-zm-sidebar shadow-sm"
                    : "border-transparent bg-zm-cream/30 text-gray-600 hover:bg-zm-cream/50 hover:text-zm-sidebar"
                }`}
              >
                <span>Conciliar compras</span>
                <span className="mt-0.5 text-[10px] font-normal text-gray-500 sm:text-xs tabular-nums">
                  {purchaseChipSubtitle}
                </span>
              </button>
            </div>
          </div>
          {accountsError && (
            <p className="mt-3 text-sm text-zm-red" role="alert">
              {accountsError}
            </p>
          )}
        </section>

        {reconMode === RECON_MODES.ventas && snapshotError && (
          <p className="text-sm text-zm-red" role="alert">
            {snapshotError}
          </p>
        )}
        {reconMode === RECON_MODES.compras && purchaseError && (
          <p className="text-sm text-zm-red" role="alert">
            {purchaseError}
          </p>
        )}

        {canShowVentasPanels && (
          <div className={`grid gap-3 items-stretch ${gridColsClass}`}>
            <section className="flex min-h-[min(42vh,22rem)] min-w-0 flex-col rounded-xl border border-zm-green/20 bg-white p-3 shadow-sm sm:p-4">
              <div className="border-b border-zm-green/15 pb-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Loyverse
                </h2>
                <p className="mt-0.5 text-sm font-medium text-zm-sidebar">
                  {formatEsShortYmd(businessDateLabel)}
                </p>
              </div>
              <div className="mt-2 space-y-2">
                <label htmlFor="zm-recon-pm-panel" className="sr-only">
                  Método Loyverse
                </label>
                <select
                  id="zm-recon-pm-panel"
                  value={paymentMethod}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPaymentMethod(v);
                    if (v !== "pos") setPosBatch("");
                  }}
                  className="w-full max-w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-900 shadow-sm outline-none focus:border-zm-green focus:ring-2 focus:ring-zm-green/30 sm:text-sm"
                >
                  {PAYMENT_METHOD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {paymentMethod === "pos" ? (
                  <>
                    <label htmlFor="zm-recon-lote-panel" className="sr-only">
                      Lote POS
                    </label>
                    <input
                      id="zm-recon-lote-panel"
                      type="text"
                      autoComplete="off"
                      maxLength={80}
                      value={posBatch}
                      onChange={(e) => setPosBatch(e.target.value)}
                      className="w-full max-w-full rounded-lg border border-zm-green/35 bg-white px-2 py-1.5 text-xs font-semibold text-gray-900 shadow-sm tabular-nums outline-none focus:border-zm-green focus:ring-2 focus:ring-zm-green/30 sm:text-sm"
                      placeholder="Lote POS"
                    />
                  </>
                ) : null}
              </div>
              <div className="mt-3 min-w-0 flex-1">
                {snapshotLoading && !snapshot ? (
                  <p className="text-sm text-gray-500">Cargando…</p>
                ) : snapshot ? (
                  <dl className="space-y-2.5 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="shrink-0 text-gray-600">Transacciones</dt>
                      <dd className="min-w-0 text-right font-semibold tabular-nums text-gray-900">
                        {snapshot.loyverse?.txn_count ?? "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="shrink-0 text-gray-600">USD</dt>
                      <dd className="min-w-0 text-right font-semibold tabular-nums text-gray-900">
                        {formatUsd(snapshot.loyverse?.gross_sales_usd)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="shrink-0 text-gray-600">Bs</dt>
                      <dd className="min-w-0 text-right font-semibold tabular-nums text-orange-600">
                        {formatBs(snapshot.loyverse?.importe_pago_bs)}
                      </dd>
                    </div>
                  </dl>
                ) : null}
              </div>
            </section>

            <section className="flex min-h-[min(42vh,22rem)] min-w-0 flex-col rounded-xl border border-zm-green/20 bg-white p-3 shadow-sm sm:p-4">
              <div className="border-b border-zm-green/15 pb-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Banco
                </h2>
              </div>
              <div className="mt-2 min-w-0">
                <label htmlFor="zm-recon-bank-panel" className="sr-only">
                  Cuenta bancaria
                </label>
                <select
                  id="zm-recon-bank-panel"
                  value={bankAccountId ?? ""}
                  disabled={accountsLoading || accounts.length === 0}
                  onChange={(e) => {
                    const v = e.target.value;
                    setBankAccountId(v === "" ? null : Number(v));
                  }}
                  className="w-full max-w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-900 shadow-sm outline-none focus:border-zm-green focus:ring-2 focus:ring-zm-green/30 disabled:bg-gray-50 disabled:text-gray-400 sm:text-sm"
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
              {snapshot ? (
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-gray-600">Abonos</dt>
                    <dd className="font-semibold tabular-nums text-gray-900">
                      {snapshot.bank?.movement_count ?? "—"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-gray-600">Suma Bs</dt>
                    <dd className="font-semibold tabular-nums text-orange-600">
                      Bs. {formatBs(snapshot.bank?.credit_total_bs)}
                    </dd>
                  </div>
                </dl>
              ) : snapshotLoading ? (
                <p className="mt-2 text-sm text-gray-500">Cargando movimientos…</p>
              ) : null}
              <div className="mt-3 min-h-0 min-w-0 flex-1 overflow-hidden">
                {snapshot ? (
                  <div className="max-h-[min(58vh,32rem)] overflow-y-auto overflow-x-hidden rounded-lg border border-zm-green/15 bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
                    <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
                      <colgroup>
                        <col className="w-[7%]" />
                        <col className="w-[10%]" />
                        <col className="w-[12%]" />
                        <col className="w-[14%]" />
                        <col className="w-[36%]" />
                        <col className="w-[7%]" />
                        <col className="w-[14%]" />
                      </colgroup>
                      <thead className="sticky top-0 z-10 border-b border-zm-green/25 bg-zm-cream [&_th]:bg-zm-cream">
                        <tr>
                          <th className="px-1.5 py-2 text-left font-medium sm:px-2">ID</th>
                          <th className="px-1.5 py-2 text-left font-medium sm:px-2">Fecha</th>
                          <th className="px-1.5 py-2 text-left font-medium sm:px-2">Tipo</th>
                          <th className="px-1.5 py-2 text-left font-medium sm:px-2">Ref.</th>
                          <th className="px-1.5 py-2 text-left font-medium sm:px-2">Desc.</th>
                          <th className="px-1.5 py-2 text-left font-medium sm:px-2">Cód.</th>
                          <th className="px-1.5 py-2 text-right font-medium sm:px-2">Crédito</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(snapshot.bank?.movements || []).length === 0 ? (
                          <tr className="border-t border-gray-100">
                            <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-600">
                              No hay filas para este filtro.
                            </td>
                          </tr>
                        ) : (
                          snapshot.bank.movements.map((m) => (
                            <tr
                              key={m.id}
                              className="border-t border-gray-100 hover:bg-gray-50"
                            >
                              <td className="px-1.5 py-2 font-mono text-[10px] text-gray-400 sm:px-2 sm:text-xs">
                                #{m.id}
                              </td>
                              <td className="whitespace-nowrap px-1.5 py-2 tabular-nums sm:px-2">
                                {m.movement_date}
                              </td>
                              <td
                                className="break-words px-1.5 py-2 text-[11px] text-gray-700 sm:px-2 sm:text-xs"
                                title={m.transaction_type || m.operation_type || ""}
                              >
                                {m.transaction_type || m.operation_type || "—"}
                              </td>
                              <td
                                className="break-words px-1.5 py-2 text-[11px] sm:px-2 sm:text-xs"
                                title={m.reference || ""}
                              >
                                {m.reference || "—"}
                              </td>
                              <td
                                className="break-words px-1.5 py-2 text-[11px] leading-snug sm:px-2 sm:text-xs"
                                title={m.description || ""}
                              >
                                {m.description || "—"}
                              </td>
                              <td className="whitespace-nowrap px-1.5 py-2 font-mono text-[10px] text-gray-600 sm:px-2 sm:text-xs">
                                {m.transaction_code || "—"}
                              </td>
                              <td className="whitespace-nowrap px-1.5 py-2 text-right font-semibold tabular-nums text-gray-900 sm:px-2">
                                {formatBs(m.credit_bs)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        )}

        {canShowComprasPanels && (
          <div className={`grid gap-3 items-stretch ${gridColsClass}`}>
            <section className="flex min-h-[min(42vh,22rem)] min-w-0 flex-col rounded-xl border border-zm-green/20 bg-white p-3 shadow-sm sm:p-4">
              <div className="border-b border-zm-green/15 pb-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Órdenes de compra
                </h2>
                <p className="mt-0.5 text-sm font-medium text-zm-sidebar">
                  {formatEsShortYmd(dateYmd)}
                </p>
              </div>
              <div className="mt-2 min-h-0 flex-1 overflow-hidden">
                <div className="max-h-[min(58vh,32rem)] overflow-y-auto overflow-x-hidden rounded-lg border border-zm-green/15 bg-white shadow-sm">
                  {purchaseLoading && !purchaseDay ? (
                    <p className="p-4 text-sm text-gray-500">Cargando…</p>
                  ) : (
                    <table className="w-full table-fixed border-collapse text-[11px] sm:text-xs">
                      <thead className="sticky top-0 z-10 border-b border-zm-green/25 bg-zm-cream [&_th]:bg-zm-cream">
                        <tr>
                          <th className="w-8 px-1 py-2 text-center font-medium"> </th>
                          <th className="px-1 py-2 text-left font-medium">OC</th>
                          <th className="px-1 py-2 text-left font-medium">Artículo</th>
                          <th className="px-1 py-2 text-right font-medium">USD</th>
                          <th className="px-1 py-2 text-right font-medium">Bs~</th>
                        </tr>
                      </thead>
                      <tbody>
                        {poLinesFiltered.length === 0 ? (
                          <tr className="border-t border-gray-100">
                            <td colSpan={5} className="px-2 py-6 text-center text-sm text-gray-600">
                              No hay líneas pendientes para esta fecha.
                            </td>
                          </tr>
                        ) : (
                          poLinesFiltered.map((row) => (
                            <tr
                              key={row.id}
                              role="button"
                              tabIndex={0}
                              onClick={() =>
                                setSelectedPoLineId((prev) =>
                                  prev === row.id ? null : row.id
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setSelectedPoLineId((prev) =>
                                    prev === row.id ? null : row.id
                                  );
                                }
                              }}
                              className={`cursor-pointer border-t border-gray-100 hover:bg-gray-50 ${
                                selectedPoLineId === row.id
                                  ? "bg-zm-yellow/30 ring-1 ring-inset ring-zm-green/35"
                                  : ""
                              } ${row.reconciled ? "opacity-70" : ""}`}
                            >
                              <td className="px-1 py-1.5 text-center">
                                {row.reconciled ? (
                                  <span
                                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zm-green/15 text-zm-green"
                                    title="Conciliada"
                                  >
                                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                                  </span>
                                ) : (
                                  <span className="inline-block h-5 w-5 rounded-full border border-gray-200" />
                                )}
                              </td>
                              <td className="truncate px-1 py-1.5 tabular-nums" title={row.po_number || ""}>
                                {row.po_number || "—"}
                              </td>
                              <td className="break-words px-1 py-1.5" title={row.item_name || ""}>
                                {row.item_name || "—"}
                              </td>
                              <td className="whitespace-nowrap px-1 py-1.5 text-right tabular-nums">
                                {formatUsd(row.line_total)}
                              </td>
                              <td className="whitespace-nowrap px-1 py-1.5 text-right tabular-nums text-orange-600">
                                {formatBs(row.line_total_bs_estimated)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </section>

            <section className="flex min-h-[min(42vh,22rem)] min-w-0 flex-col rounded-xl border border-zm-green/20 bg-white p-3 shadow-sm sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zm-green/15 pb-2">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Banco (todas las cuentas)
                  </h2>
                  <p className="mt-0.5 text-sm font-medium text-zm-sidebar">
                    Débitos filtrados · {formatEsShortYmd(dateYmd)}
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={includeReconciledPurchases}
                    onChange={(e) => setIncludeReconciledPurchases(e.target.checked)}
                    className="rounded border-gray-300 text-zm-green focus:ring-zm-green/40"
                  />
                  <span>Ver conciliadas</span>
                </label>
              </div>
              {purchaseDay ? (
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-gray-600">Movimientos</dt>
                    <dd className="font-semibold tabular-nums text-gray-900">
                      {purchaseDay.bank?.movement_count ?? "—"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-gray-600">Suma débitos Bs</dt>
                    <dd className="font-semibold tabular-nums text-orange-600">
                      Bs. {formatBs(purchaseDay.bank?.debit_total_bs)}
                    </dd>
                  </div>
                  {purchaseDay.rate_bs > 0 ? (
                    <div className="flex gap-2 text-xs text-gray-500">
                      <dt>Tasa del día</dt>
                      <dd className="tabular-nums">{formatBs(purchaseDay.rate_bs)}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : purchaseLoading ? (
                <p className="mt-2 text-sm text-gray-500">Cargando movimientos…</p>
              ) : null}
              <div className="mt-3 min-h-0 min-w-0 flex-1 overflow-hidden">
                {purchaseDay ? (
                  <div className="max-h-[min(58vh,32rem)] overflow-y-auto overflow-x-hidden rounded-lg border border-zm-green/15 bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
                    <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
                      <colgroup>
                        <col className="w-[6%]" />
                        <col className="w-[14%]" />
                        <col className="w-[9%]" />
                        <col className="w-[12%]" />
                        <col className="w-[30%]" />
                        <col className="w-[7%]" />
                        <col className="w-[12%]" />
                        <col className="w-[10%]" />
                      </colgroup>
                      <thead className="sticky top-0 z-10 border-b border-zm-green/25 bg-zm-cream [&_th]:bg-zm-cream">
                        <tr>
                          <th className="px-1 py-2 text-center font-medium sm:px-2"> </th>
                          <th className="px-1 py-2 text-left font-medium sm:px-2">Cuenta</th>
                          <th className="px-1 py-2 text-left font-medium sm:px-2">Fecha</th>
                          <th className="px-1 py-2 text-left font-medium sm:px-2">Ref.</th>
                          <th className="px-1 py-2 text-left font-medium sm:px-2">Desc.</th>
                          <th className="px-1 py-2 text-left font-medium sm:px-2">Cód.</th>
                          <th className="px-1 py-2 text-right font-medium sm:px-2">Débito</th>
                          <th className="px-1 py-2 text-right font-medium sm:px-2"> </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(purchaseDay.bank_movements || []).length === 0 ? (
                          <tr className="border-t border-gray-100">
                            <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-600">
                              No hay movimientos con este criterio.
                            </td>
                          </tr>
                        ) : (
                          purchaseDay.bank_movements.map((m) => {
                            const busy = linkBusyId === m.id;
                            const canLink =
                              Boolean(selectedPoLineId) &&
                              !m.reconciled &&
                              !busy;
                            return (
                              <tr
                                key={m.id}
                                className={`border-t border-gray-100 ${
                                  canLink ? "cursor-pointer hover:bg-zm-cream/50" : ""
                                } ${m.reconciled ? "bg-zm-green/5" : ""}`}
                                onClick={() => {
                                  if (canLink) void onBankRowClickPurchase(m);
                                }}
                              >
                                <td className="px-1 py-2 text-center sm:px-2">
                                  {m.reconciled ? (
                                    <span
                                      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zm-green/15 text-zm-green"
                                      title="Conciliado"
                                    >
                                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                                    </span>
                                  ) : (
                                    <span className="inline-block h-5 w-5 rounded-full border border-gray-200" />
                                  )}
                                </td>
                                <td
                                  className="truncate px-1 py-2 text-[11px] sm:px-2 sm:text-xs"
                                  title={m.bank_account_name || ""}
                                >
                                  {m.bank_account_name || "—"}
                                </td>
                                <td className="whitespace-nowrap px-1 py-2 tabular-nums sm:px-2">
                                  {m.movement_date}
                                </td>
                                <td
                                  className="break-words px-1 py-2 text-[11px] sm:px-2 sm:text-xs"
                                  title={m.reference || ""}
                                >
                                  {m.reference || "—"}
                                </td>
                                <td
                                  className="break-words px-1 py-2 text-[11px] leading-snug sm:px-2 sm:text-xs"
                                  title={m.description || ""}
                                >
                                  {m.description || "—"}
                                </td>
                                <td className="whitespace-nowrap px-1 py-2 font-mono text-[10px] text-gray-600 sm:px-2 sm:text-xs">
                                  {m.transaction_code || "—"}
                                </td>
                                <td className="whitespace-nowrap px-1 py-2 text-right font-semibold tabular-nums sm:px-2">
                                  {formatBs(m.debit_bs)}
                                </td>
                                <td className="px-1 py-2 text-right sm:px-2">
                                  {m.reconciled && includeReconciledPurchases ? (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void onUnlinkPurchase(m.id);
                                      }}
                                      className="rounded border border-zm-green/40 px-1.5 py-0.5 text-[10px] font-semibold text-zm-green hover:bg-zm-green/5 disabled:opacity-50 sm:text-xs"
                                    >
                                      Quitar
                                    </button>
                                  ) : null}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
