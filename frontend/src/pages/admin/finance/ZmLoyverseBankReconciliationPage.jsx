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
  postPurchaseReconciliationLinksBatch,
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

/** Matches `finance_categories` seed used for OC reconciliation. */
const PURCHASE_INVENTORY_CATEGORY = "Compra inventario";

const PURCHASE_BANK_DEBIT_VIEWS = {
  all: "all",
  hidePmFee751: "hide_pm_fee_751",
};

const PM_PURCHASE_TX_CODE = "487";
const PM_COMMISSION_TX_CODE = "751";

function normalizePurchaseBankDescription(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Hides BNC-style PM commission rows (751) when the same day list includes
 * a paired purchase debit (487) with the same normalized description.
 */
function filterPurchaseBankHidePairedPmCommission751(movements) {
  const codesByDesc = new Map();
  for (const m of movements) {
    const desc = normalizePurchaseBankDescription(m.description);
    const code = String(m.transaction_code ?? "").trim();
    if (!codesByDesc.has(desc)) codesByDesc.set(desc, new Set());
    codesByDesc.get(desc).add(code);
  }
  return movements.filter((m) => {
    const code = String(m.transaction_code ?? "").trim();
    if (code !== PM_COMMISSION_TX_CODE) return true;
    const desc = normalizePurchaseBankDescription(m.description);
    const set = codesByDesc.get(desc);
    return !set || !set.has(PM_PURCHASE_TX_CODE);
  });
}

function matchesSubstringFilter(haystack, needle) {
  const n = String(needle || "").trim().toLowerCase();
  if (!n) return true;
  return String(haystack ?? "")
    .toLowerCase()
    .includes(n);
}

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
  const [selectedPoLineIds, setSelectedPoLineIds] = useState([]);
  const [selectedBankMovementIds, setSelectedBankMovementIds] = useState([]);
  const [includeReconciledPurchases, setIncludeReconciledPurchases] = useState(false);
  const [purchaseBankDebitView, setPurchaseBankDebitView] = useState(
    PURCHASE_BANK_DEBIT_VIEWS.all
  );
  const [linkBusyId, setLinkBusyId] = useState(null);
  const [reconcileSelectionBusy, setReconcileSelectionBusy] = useState(false);
  const [poFilterOc, setPoFilterOc] = useState("");
  const [poFilterItem, setPoFilterItem] = useState("");
  const [purchaseBankFilterCategory, setPurchaseBankFilterCategory] = useState("");
  const [purchaseBankFilterCode, setPurchaseBankFilterCode] = useState("");
  const [purchaseBankFilterRef, setPurchaseBankFilterRef] = useState("");
  const [purchaseBankFilterDesc, setPurchaseBankFilterDesc] = useState("");
  const [purchaseBankFilterAccount, setPurchaseBankFilterAccount] = useState("");
  const [purchaseBankFilterTxnType, setPurchaseBankFilterTxnType] = useState("");
  const [purchaseBankFilterOpType, setPurchaseBankFilterOpType] = useState("");

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
          setSelectedPoLineIds([]);
          setSelectedBankMovementIds([]);
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

  const poLinesForTable = useMemo(() => {
    return poLinesFiltered.filter(
      (r) =>
        matchesSubstringFilter(r.po_number, poFilterOc) &&
        matchesSubstringFilter(r.item_name, poFilterItem)
    );
  }, [poLinesFiltered, poFilterOc, poFilterItem]);

  const purchaseBankMovementsDisplayed = useMemo(() => {
    const raw = purchaseDay?.bank_movements || [];
    if (purchaseBankDebitView === PURCHASE_BANK_DEBIT_VIEWS.hidePmFee751) {
      return filterPurchaseBankHidePairedPmCommission751(raw);
    }
    return raw;
  }, [purchaseDay?.bank_movements, purchaseBankDebitView]);

  const purchaseBankCategoryOptions = useMemo(() => {
    const set = new Set(
      (purchaseDay?.bank_movements || [])
        .map((m) => String(m.category || "").trim())
        .filter(Boolean)
    );
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [purchaseDay?.bank_movements]);

  const purchaseBankRowsFinal = useMemo(() => {
    return purchaseBankMovementsDisplayed.filter((m) => {
      if (
        purchaseBankFilterCategory &&
        String(m.category || "").trim() !== purchaseBankFilterCategory
      ) {
        return false;
      }
      if (!matchesSubstringFilter(m.transaction_code, purchaseBankFilterCode)) {
        return false;
      }
      if (!matchesSubstringFilter(m.reference, purchaseBankFilterRef)) {
        return false;
      }
      if (!matchesSubstringFilter(m.description, purchaseBankFilterDesc)) {
        return false;
      }
      if (!matchesSubstringFilter(m.bank_account_name, purchaseBankFilterAccount)) {
        return false;
      }
      if (!matchesSubstringFilter(m.transaction_type, purchaseBankFilterTxnType)) {
        return false;
      }
      if (!matchesSubstringFilter(m.operation_type, purchaseBankFilterOpType)) {
        return false;
      }
      return true;
    });
  }, [
    purchaseBankMovementsDisplayed,
    purchaseBankFilterAccount,
    purchaseBankFilterCategory,
    purchaseBankFilterCode,
    purchaseBankFilterDesc,
    purchaseBankFilterOpType,
    purchaseBankFilterRef,
    purchaseBankFilterTxnType,
  ]);

  const purchaseBankColFiltersActive = useMemo(() => {
    return (
      Boolean(String(purchaseBankFilterCategory || "").trim()) ||
      Boolean(String(purchaseBankFilterCode || "").trim()) ||
      Boolean(String(purchaseBankFilterRef || "").trim()) ||
      Boolean(String(purchaseBankFilterDesc || "").trim()) ||
      Boolean(String(purchaseBankFilterAccount || "").trim()) ||
      Boolean(String(purchaseBankFilterTxnType || "").trim()) ||
      Boolean(String(purchaseBankFilterOpType || "").trim())
    );
  }, [
    purchaseBankFilterAccount,
    purchaseBankFilterCategory,
    purchaseBankFilterCode,
    purchaseBankFilterDesc,
    purchaseBankFilterOpType,
    purchaseBankFilterRef,
    purchaseBankFilterTxnType,
  ]);

  function clearPurchaseBankColumnFilters() {
    setPurchaseBankFilterCategory("");
    setPurchaseBankFilterCode("");
    setPurchaseBankFilterRef("");
    setPurchaseBankFilterDesc("");
    setPurchaseBankFilterAccount("");
    setPurchaseBankFilterTxnType("");
    setPurchaseBankFilterOpType("");
  }

  function toggleSelectedPoLine(id, reconciled) {
    if (reconciled) return;
    setSelectedPoLineIds((prev) => {
      const i = prev.indexOf(id);
      if (i >= 0) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }

  function toggleSelectedBankMovement(id, reconciled) {
    if (reconciled) return;
    setSelectedBankMovementIds((prev) => {
      const i = prev.indexOf(id);
      if (i >= 0) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }

  async function runReconcileSelection() {
    if (selectedPoLineIds.length === 0 || selectedBankMovementIds.length === 0) {
      setPurchaseError("Seleccioná líneas de orden de compra y movimientos del banco.");
      return;
    }
    if (selectedPoLineIds.length !== selectedBankMovementIds.length) {
      setPurchaseError(
        `La cantidad debe coincidir: ${selectedPoLineIds.length} línea(s) OC y ${selectedBankMovementIds.length} movimiento(s) banco.`
      );
      return;
    }
    const poById = new Map((purchaseDay?.po_lines || []).map((r) => [r.id, r]));
    const bankById = new Map((purchaseDay?.bank_movements || []).map((m) => [m.id, m]));
    const pairs = selectedPoLineIds.map((zmPoLineId, idx) => ({
      zmPoLineId,
      bankMovementId: selectedBankMovementIds[idx],
    }));
    for (const p of pairs) {
      const row = poById.get(p.zmPoLineId);
      const bm = bankById.get(p.bankMovementId);
      if (!row || !bm) {
        setPurchaseError("Selección inválida (datos desactualizados). Recargá la vista.");
        return;
      }
      if (row.reconciled || bm.reconciled) {
        setPurchaseError("No podés conciliar filas ya conciliadas.");
        return;
      }
    }
    const needsCategoryChange = pairs.some((p) => {
      const bm = bankById.get(p.bankMovementId);
      return bm && String(bm.category || "").trim() !== PURCHASE_INVENTORY_CATEGORY;
    });
    if (needsCategoryChange) {
      const ok = window.confirm(
        "Uno o más movimientos del banco no están en «Compra inventario». Al aceptar, la categoría pasará a «Compra inventario» para cada vínculo. ¿Continuar?"
      );
      if (!ok) return;
    }
    setReconcileSelectionBusy(true);
    setPurchaseError(null);
    try {
      await postPurchaseReconciliationLinksBatch({ pairs });
      const data = await fetchPurchaseReconciliationDay(dateYmd, {
        includeReconciled: includeReconciledPurchases,
      });
      setPurchaseDay(data);
      setSelectedPoLineIds([]);
      setSelectedBankMovementIds([]);
    } catch (e) {
      setPurchaseError(e.message || "No se pudieron guardar los vínculos.");
    } finally {
      setReconcileSelectionBusy(false);
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
        {reconMode === RECON_MODES.ventas && (
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
        )}

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
          <>
            <section className="rounded-xl border border-zm-green/25 bg-zm-cream/60 p-3 shadow-sm sm:p-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  title="Empareja en orden: primera OC seleccionada con primer movimiento banco seleccionado, y así sucesivamente."
                  disabled={
                    reconcileSelectionBusy ||
                    selectedPoLineIds.length === 0 ||
                    selectedPoLineIds.length !== selectedBankMovementIds.length
                  }
                  onClick={() => void runReconcileSelection()}
                  className="shrink-0 rounded-lg bg-zm-green px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zm-green-dark focus-visible:outline focus-visible:ring-2 focus-visible:ring-zm-green/45 disabled:opacity-50 sm:text-sm"
                >
                  {reconcileSelectionBusy ? "Guardando…" : "Conciliar selección"}
                </button>
                <span className="text-xs text-gray-700 tabular-nums">
                  {selectedPoLineIds.length} OC · {selectedBankMovementIds.length} banco
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPoLineIds([]);
                    setSelectedBankMovementIds([]);
                  }}
                  className="ml-auto shrink-0 rounded-lg border border-zm-green/40 bg-white px-3 py-1.5 text-xs font-semibold text-zm-green hover:bg-zm-green/5"
                >
                  Limpiar selección
                </button>
              </div>
            </section>
            <div className={`grid gap-3 items-stretch ${gridColsClass}`}>
            <section className="flex min-h-[min(42vh,22rem)] min-w-0 flex-col rounded-xl border border-zm-green/20 bg-white p-3 shadow-sm sm:p-4">
              <div className="min-h-0 flex-1 overflow-hidden">
                <div className="max-h-[min(58vh,32rem)] overflow-y-auto overflow-x-hidden rounded-lg border border-zm-green/15 bg-white shadow-sm">
                  {purchaseLoading && !purchaseDay ? (
                    <p className="p-4 text-sm text-gray-500">Cargando…</p>
                  ) : (
                    <table className="w-full table-fixed border-collapse text-[11px] sm:text-xs">
                      <thead className="sticky top-0 z-10 border-b border-zm-green/25 bg-zm-cream [&_th]:bg-zm-cream">
                        <tr>
                          <th className="w-8 px-1 py-1.5 text-center align-top font-medium"> </th>
                          <th className="px-1 py-1.5 text-left align-top font-medium">
                            <span className="mb-0.5 block text-[10px] font-normal text-gray-500">
                              OC
                            </span>
                            <input
                              type="search"
                              value={poFilterOc}
                              onChange={(e) => setPoFilterOc(e.target.value)}
                              placeholder="Filtrar…"
                              className="w-full min-w-0 rounded border border-gray-200 bg-white px-1 py-1 text-[11px] text-gray-900"
                              aria-label="Filtrar por orden de compra"
                            />
                          </th>
                          <th className="px-1 py-1.5 text-left align-top font-medium">
                            <span className="mb-0.5 block text-[10px] font-normal text-gray-500">
                              Artículo
                            </span>
                            <input
                              type="search"
                              value={poFilterItem}
                              onChange={(e) => setPoFilterItem(e.target.value)}
                              placeholder="Filtrar…"
                              className="w-full min-w-0 rounded border border-gray-200 bg-white px-1 py-1 text-[11px] text-gray-900"
                              aria-label="Filtrar por artículo"
                            />
                          </th>
                          <th className="px-1 py-1.5 text-right align-bottom font-medium">USD</th>
                          <th className="px-1 py-1.5 text-right align-bottom font-medium">Bs~</th>
                        </tr>
                      </thead>
                      <tbody>
                        {poLinesFiltered.length === 0 ? (
                          <tr className="border-t border-gray-100">
                            <td colSpan={5} className="px-2 py-6 text-center text-sm text-gray-600">
                              No hay líneas pendientes para esta fecha.
                            </td>
                          </tr>
                        ) : poLinesForTable.length === 0 ? (
                          <tr className="border-t border-gray-100">
                            <td colSpan={5} className="px-2 py-6 text-center text-sm text-gray-600">
                              Ninguna línea coincide con el filtro.
                            </td>
                          </tr>
                        ) : (
                          poLinesForTable.map((row) => {
                            const selected = selectedPoLineIds.includes(row.id);
                            return (
                              <tr
                                key={row.id}
                                className={`border-t border-gray-100 hover:bg-gray-50 ${
                                  selected ? "bg-zm-cream/60 ring-1 ring-inset ring-zm-green/30" : ""
                                } ${
                                  row.reconciled
                                    ? "border-l-4 border-zm-green bg-emerald-50/50"
                                    : ""
                                }`}
                              >
                                <td className="px-1 py-1.5 text-center">
                                  {row.reconciled ? (
                                    <span
                                      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zm-green/20 text-zm-green"
                                      title="Conciliada con banco"
                                    >
                                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                                    </span>
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      disabled={row.reconciled}
                                      onChange={() => toggleSelectedPoLine(row.id, row.reconciled)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="h-4 w-4 rounded-full border-gray-300 text-zm-green focus:ring-zm-green/40"
                                      aria-label={`Seleccionar línea OC ${row.po_number || row.id}`}
                                    />
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
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </section>

            <section className="flex min-h-[min(42vh,22rem)] min-w-0 flex-col rounded-xl border border-zm-green/20 bg-white p-3 shadow-sm sm:p-4">
              <div className="mb-2 flex justify-end border-b border-zm-green/15 pb-2">
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
              <div className="min-h-0 flex-1 overflow-hidden">
                {purchaseLoading && !purchaseDay ? (
                  <p className="p-3 text-sm text-gray-500">Cargando…</p>
                ) : purchaseDay ? (
                  <div className="max-h-[min(58vh,32rem)] overflow-y-auto overflow-x-auto rounded-lg border border-zm-green/15 bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
                    <table className="w-full min-w-[1080px] table-fixed border-collapse text-xs sm:text-sm">
                      <colgroup>
                        <col className="w-[5%]" />
                        <col className="w-[12%]" />
                        <col className="w-[9%]" />
                        <col className="w-[7%]" />
                        <col className="w-[9%]" />
                        <col className="w-[20%]" />
                        <col className="w-[9%]" />
                        <col className="w-[5%]" />
                        <col className="w-[12%]" />
                        <col className="w-[7%]" />
                        <col className="w-[5%]" />
                      </colgroup>
                      <thead className="sticky top-0 z-10 border-b border-zm-green/25 bg-zm-cream [&_th]:bg-zm-cream">
                        <tr>
                          <th className="min-w-0 px-1 py-2 align-top sm:px-1.5">
                            <div className="flex min-h-[3.5rem] flex-col justify-end gap-1">
                              <span className="text-center text-[10px] font-semibold leading-tight text-gray-700">
                                Vista
                              </span>
                              <label htmlFor="zm-recon-bank-debit-view" className="sr-only">
                                Vista de débitos
                              </label>
                              <select
                                id="zm-recon-bank-debit-view"
                                value={purchaseBankDebitView}
                                onChange={(e) => setPurchaseBankDebitView(e.target.value)}
                                className="h-7 w-full min-w-0 rounded border border-gray-200 bg-white px-0.5 text-[10px] font-semibold text-gray-800"
                                title="Todos los débitos u ocultar comisión 751 emparejada con 487"
                              >
                                <option value={PURCHASE_BANK_DEBIT_VIEWS.all}>Todos</option>
                                <option value={PURCHASE_BANK_DEBIT_VIEWS.hidePmFee751}>Sin 751</option>
                              </select>
                            </div>
                          </th>
                          <th className="min-w-0 px-1 py-2 text-left align-top sm:px-1.5">
                            <div className="flex min-h-[3.5rem] flex-col justify-end gap-1">
                              <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-gray-700">
                                Cuenta
                              </span>
                              <input
                                type="search"
                                value={purchaseBankFilterAccount}
                                onChange={(e) => setPurchaseBankFilterAccount(e.target.value)}
                                placeholder="Filtrar…"
                                className="h-7 w-full min-w-0 rounded border border-gray-200 bg-white px-1 text-[10px] text-gray-900"
                                aria-label="Filtrar por cuenta"
                              />
                            </div>
                          </th>
                          <th className="min-w-0 px-1 py-2 text-left align-top sm:px-1.5">
                            <div className="flex min-h-[3.5rem] flex-col justify-end gap-1">
                              <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-gray-700">
                                Tipo mov.
                              </span>
                              <input
                                type="search"
                                value={purchaseBankFilterTxnType}
                                onChange={(e) => setPurchaseBankFilterTxnType(e.target.value)}
                                placeholder="Filtrar…"
                                className="h-7 w-full min-w-0 rounded border border-gray-200 bg-white px-1 text-[10px] text-gray-900"
                                aria-label="Filtrar por tipo de movimiento"
                              />
                            </div>
                          </th>
                          <th className="min-w-0 px-1 py-2 text-left align-top sm:px-1.5">
                            <div className="flex min-h-[3.5rem] flex-col justify-end gap-1">
                              <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-gray-700">
                                Fecha
                              </span>
                              <div className="h-7 shrink-0" aria-hidden />
                            </div>
                          </th>
                          <th className="min-w-0 px-1 py-2 text-left align-top sm:px-1.5">
                            <div className="flex min-h-[3.5rem] flex-col justify-end gap-1">
                              <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-gray-700">
                                Ref.
                              </span>
                              <input
                                type="search"
                                value={purchaseBankFilterRef}
                                onChange={(e) => setPurchaseBankFilterRef(e.target.value)}
                                placeholder="Filtrar…"
                                className="h-7 w-full min-w-0 rounded border border-gray-200 bg-white px-1 text-[10px] text-gray-900"
                                aria-label="Filtrar por referencia"
                              />
                            </div>
                          </th>
                          <th className="min-w-0 px-1 py-2 text-left align-top sm:px-1.5">
                            <div className="flex min-h-[3.5rem] flex-col justify-end gap-1">
                              <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-gray-700">
                                Desc.
                              </span>
                              <input
                                type="search"
                                value={purchaseBankFilterDesc}
                                onChange={(e) => setPurchaseBankFilterDesc(e.target.value)}
                                placeholder="Filtrar…"
                                className="h-7 w-full min-w-0 rounded border border-gray-200 bg-white px-1 text-[10px] text-gray-900"
                                aria-label="Filtrar por descripción"
                              />
                            </div>
                          </th>
                          <th className="min-w-0 px-1 py-2 text-left align-top sm:px-1.5">
                            <div className="flex min-h-[3.5rem] flex-col justify-end gap-1">
                              <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-gray-700">
                                Tipo op.
                              </span>
                              <input
                                type="search"
                                value={purchaseBankFilterOpType}
                                onChange={(e) => setPurchaseBankFilterOpType(e.target.value)}
                                placeholder="Filtrar…"
                                className="h-7 w-full min-w-0 rounded border border-gray-200 bg-white px-1 text-[10px] text-gray-900"
                                aria-label="Filtrar por tipo de operación"
                              />
                            </div>
                          </th>
                          <th className="min-w-0 px-1 py-2 text-left align-top sm:px-1.5">
                            <div className="flex min-h-[3.5rem] flex-col justify-end gap-1">
                              <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-gray-700">
                                Cód.
                              </span>
                              <input
                                type="search"
                                value={purchaseBankFilterCode}
                                onChange={(e) => setPurchaseBankFilterCode(e.target.value)}
                                placeholder="Filtrar…"
                                className="h-7 w-full min-w-0 rounded border border-gray-200 bg-white px-1 text-[10px] text-gray-900"
                                aria-label="Filtrar por código"
                              />
                            </div>
                          </th>
                          <th className="min-w-0 px-1 py-2 text-left align-top sm:px-1.5">
                            <div className="flex min-h-[3.5rem] flex-col justify-end gap-1">
                              <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-gray-700">
                                Categoría
                              </span>
                              <select
                                value={purchaseBankFilterCategory}
                                onChange={(e) => setPurchaseBankFilterCategory(e.target.value)}
                                className="h-7 w-full min-w-0 rounded border border-gray-200 bg-white px-0.5 text-[10px] text-gray-900"
                                aria-label="Filtrar por categoría"
                              >
                                <option value="">Todas</option>
                                {purchaseBankCategoryOptions.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </th>
                          <th className="min-w-0 px-1 py-2 text-right align-top sm:px-1.5">
                            <div className="flex min-h-[3.5rem] flex-col items-end justify-end gap-1">
                              <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-gray-700">
                                Débito
                              </span>
                              <div className="h-7 w-full shrink-0" aria-hidden />
                            </div>
                          </th>
                          <th className="min-w-0 px-1 py-2 text-right align-top sm:px-1.5">
                            <div className="flex min-h-[3.5rem] flex-col items-stretch justify-end gap-1">
                              <span className="text-right text-[10px] font-semibold leading-tight text-gray-700">
                                Acción
                              </span>
                              <button
                                type="button"
                                disabled={!purchaseBankColFiltersActive}
                                onClick={clearPurchaseBankColumnFilters}
                                className="h-7 w-full rounded border border-zm-green/35 bg-white px-1 text-[10px] font-semibold text-zm-green hover:bg-zm-green/5 disabled:opacity-40"
                                title="Quitar filtros de columnas"
                              >
                                Limpiar
                              </button>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchaseBankRowsFinal.length === 0 ? (
                          <tr className="border-t border-gray-100">
                            <td colSpan={11} className="px-3 py-8 text-center text-sm text-gray-600">
                              No hay movimientos con este criterio.
                            </td>
                          </tr>
                        ) : (
                          purchaseBankRowsFinal.map((m) => {
                            const busy = linkBusyId === m.id;
                            const selected = selectedBankMovementIds.includes(m.id);
                            return (
                              <tr
                                key={m.id}
                                className={`border-t border-gray-100 hover:bg-gray-50 ${
                                  m.reconciled
                                    ? "border-l-4 border-zm-green bg-emerald-50/55"
                                    : ""
                                } ${selected && !m.reconciled ? "bg-zm-cream/50 ring-1 ring-inset ring-zm-green/25" : ""}`}
                              >
                                <td className="px-1 py-2 text-center sm:px-2">
                                  {m.reconciled ? (
                                    <span
                                      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zm-green/20 text-zm-green"
                                      title="Conciliado con orden de compra"
                                    >
                                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                                    </span>
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      disabled={m.reconciled}
                                      onChange={() =>
                                        toggleSelectedBankMovement(m.id, m.reconciled)
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                      className="h-4 w-4 rounded-full border-gray-300 text-zm-green focus:ring-zm-green/40"
                                      aria-label={`Seleccionar movimiento banco ${m.id}`}
                                    />
                                  )}
                                </td>
                                <td
                                  className="truncate px-1 py-2 text-[11px] sm:px-2 sm:text-xs"
                                  title={m.bank_account_name || ""}
                                >
                                  {m.bank_account_name || "—"}
                                </td>
                                <td
                                  className="truncate px-1 py-2 text-[11px] sm:px-2 sm:text-xs"
                                  title={m.transaction_type || ""}
                                >
                                  {m.transaction_type?.trim() ? m.transaction_type : "—"}
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
                                <td
                                  className="truncate px-1 py-2 text-[11px] sm:px-2 sm:text-xs"
                                  title={m.operation_type || ""}
                                >
                                  {m.operation_type?.trim() ? m.operation_type : "—"}
                                </td>
                                <td className="whitespace-nowrap px-1 py-2 font-mono text-[10px] text-gray-600 sm:px-2 sm:text-xs">
                                  {m.transaction_code || "—"}
                                </td>
                                <td
                                  className={`truncate px-1 py-2 text-[10px] sm:px-2 sm:text-xs ${
                                    String(m.category || "").trim() ===
                                    PURCHASE_INVENTORY_CATEGORY
                                      ? "text-gray-700"
                                      : "font-medium text-amber-800"
                                  }`}
                                  title={
                                    m.category
                                      ? `${m.category}${m.subcategory && m.subcategory !== "—" ? ` · ${m.subcategory}` : ""}`
                                      : ""
                                  }
                                >
                                  {m.category?.trim() ? m.category : "—"}
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
          </>
        )}
      </div>
    </div>
  );
}
