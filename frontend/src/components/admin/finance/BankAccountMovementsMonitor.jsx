import { useCallback, useEffect, useMemo, useState } from "react";
import { format, startOfDay, subDays } from "date-fns";
import BankMovementsTableBlock, {
  ToolbarVisibleRowsCard,
  COMFY_TOOLBAR_STAT_CARD,
  COMFY_TOOLBAR_STAT_LABEL,
  COMFY_TOOLBAR_STAT_VALUE,
  comfyToolbarCellPaddingClass,
  comfyToolbarCellAlignClass,
} from "./BankMovementsTableBlock.jsx";
import DateRangeFilter from "./DateRangeFilter.jsx";
import {
  fetchBankAccounts,
  fetchBankMovementsByAccount,
} from "../../../api/admin/finance/bankApi";

function movementDateKey(m) {
  const raw = m.movement_date;
  if (raw == null || raw === "") return "";
  const s = String(raw).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function formatBs(value) {
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function filterByDateRange(movements, range) {
  if (!range?.from) return movements;
  const from = format(startOfDay(range.from), "yyyy-MM-dd");
  const to = format(startOfDay(range.to ?? range.from), "yyyy-MM-dd");
  return movements.filter((m) => {
    const k = movementDateKey(m);
    if (!k) return false;
    return k >= from && k <= to;
  });
}

/**
 * Bloque para ver movimientos de una cuenta (layout centrado, rango de fechas y tabla legible).
 */
export default function BankAccountMovementsMonitor({
  categoriesRefreshToken = 0,
  accountsRefreshToken = 0,
}) {
  const [rows, setRows] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  const [monitorAccountId, setMonitorAccountId] = useState(null);
  const [monitorMovements, setMonitorMovements] = useState([]);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorError, setMonitorError] = useState(null);
  const [monitorRefreshTick, setMonitorRefreshTick] = useState(0);
  const [externalSummary, setExternalSummary] = useState(null);

  const [dateRange, setDateRange] = useState(() => ({
    from: startOfDay(subDays(new Date(), 30)),
    to: startOfDay(new Date()),
  }));

  const filteredMovements = useMemo(
    () => filterByDateRange(monitorMovements, dateRange),
    [monitorMovements, dateRange]
  );

  async function loadAccounts() {
    try {
      setAccountsLoading(true);
      const res = await fetchBankAccounts({ includeInactive: true });
      setRows(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setAccountsLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, [accountsRefreshToken]);

  useEffect(() => {
    if (rows.length === 0) {
      setMonitorAccountId(null);
      return;
    }
    setMonitorAccountId((prev) => {
      if (prev != null && rows.some((r) => r.id === prev)) return prev;
      return rows[0].id;
    });
  }, [rows]);

  useEffect(() => {
    if (monitorAccountId == null) {
      setMonitorMovements([]);
      setMonitorError(null);
      setMonitorLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setMonitorLoading(true);
        setMonitorError(null);
        const res = await fetchBankMovementsByAccount(monitorAccountId, {
          limit: 25000,
        });
        if (!cancelled) setMonitorMovements(res.data || []);
      } catch (e) {
        if (!cancelled) setMonitorError(e.message);
      } finally {
        if (!cancelled) setMonitorLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [monitorAccountId, accountsRefreshToken, monitorRefreshTick]);

  useEffect(() => {
    if (monitorAccountId == null) setExternalSummary(null);
  }, [monitorAccountId]);

  const handleExternalSummaryChange = useCallback((payload) => {
    setExternalSummary(payload);
  }, []);

  return (
    <div className="mx-auto w-full max-w-[min(88rem,100%)] min-w-0 space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 shadow-md shadow-slate-900/10">
        <div className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-4 lg:gap-y-3">
            <div className="min-w-0 flex-1 lg:max-w-md">
              <label className="mb-1 block text-sm font-medium text-slate-800">
                Cuenta
              </label>
              <select
                value={monitorAccountId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setMonitorAccountId(v === "" ? null : Number(v));
                }}
                disabled={accountsLoading || rows.length === 0}
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-inner shadow-slate-900/5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-100 disabled:text-slate-400"
              >
                {rows.length === 0 ? (
                  <option value="">
                    {accountsLoading ? "Cargando cuentas…" : "Sin cuentas"}
                  </option>
                ) : (
                  rows.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {!a.is_active ? " (inactiva)" : ""}
                    </option>
                  ))
                )}
              </select>
            </div>

            <DateRangeFilter value={dateRange} onChange={setDateRange} />

            <div className="flex items-center lg:pb-0.5">
              <button
                type="button"
                disabled={monitorAccountId == null || accountsLoading}
                onClick={() => setMonitorRefreshTick((n) => n + 1)}
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800 shadow-sm transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                Recargar movimientos
              </button>
            </div>
          </div>
        </div>

        {externalSummary &&
          monitorAccountId != null &&
          externalSummary.fractions?.length > 0 && (
            <div className="border-t border-slate-200 bg-white">
              <div className="overflow-x-auto w-full min-w-0">
                <div
                  className="grid w-full min-w-0 items-end gap-x-0 gap-y-1 pb-3 pt-2"
                  style={{
                    gridTemplateColumns: externalSummary.fractions
                      .map((f) => `${f.pct}fr`)
                      .join(" "),
                  }}
                >
                  {externalSummary.fractions.map(({ id }) => (
                    <div
                      key={id}
                      className={`min-w-0 flex flex-col justify-end gap-1.5 ${comfyToolbarCellPaddingClass(id)} ${comfyToolbarCellAlignClass(id)}`}
                    >
                      {id === "movement_date" &&
                        !externalSummary.showVisibleOnReference && (
                          <ToolbarVisibleRowsCard
                            count={externalSummary.visibleRows}
                          />
                        )}
                      {id === "reference" &&
                        externalSummary.showVisibleOnReference && (
                          <ToolbarVisibleRowsCard
                            count={externalSummary.visibleRows}
                          />
                        )}
                      {id === "debit_bs" && (
                        <div
                          className={`${COMFY_TOOLBAR_STAT_CARD} border-red-100 bg-gradient-to-br from-red-50/95 to-white ring-1 ring-red-900/5`}
                        >
                          <p
                            className={`${COMFY_TOOLBAR_STAT_LABEL} text-right text-red-800/90`}
                          >
                            Total debe
                          </p>
                          <p
                            className={`${COMFY_TOOLBAR_STAT_VALUE} text-red-900`}
                          >
                            Bs {formatBs(externalSummary.totals.debit)}
                          </p>
                        </div>
                      )}
                      {id === "credit_bs" && (
                        <div
                          className={`${COMFY_TOOLBAR_STAT_CARD} border-emerald-100 bg-gradient-to-br from-emerald-50/95 to-white ring-1 ring-emerald-900/5`}
                        >
                          <p
                            className={`${COMFY_TOOLBAR_STAT_LABEL} text-right text-emerald-800/90`}
                          >
                            Total haber
                          </p>
                          <p
                            className={`${COMFY_TOOLBAR_STAT_VALUE} text-emerald-900`}
                          >
                            Bs {formatBs(externalSummary.totals.credit)}
                          </p>
                        </div>
                      )}
                      {id === "balance_bs" && (
                        <div
                          className={`${COMFY_TOOLBAR_STAT_CARD} border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white ring-1 ring-indigo-900/5`}
                          title="Saldo según el último movimiento en orden de fecha (no es la suma de la columna)."
                        >
                          <p
                            className={`${COMFY_TOOLBAR_STAT_LABEL} text-right text-indigo-800/85`}
                          >
                            Saldo final
                          </p>
                          <p
                            className={`${COMFY_TOOLBAR_STAT_VALUE} text-slate-900`}
                          >
                            Bs {formatBs(externalSummary.totals.balance)}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
      </div>

      <BankMovementsTableBlock
        movements={filteredMovements}
        loading={monitorLoading}
        error={monitorError}
        resetKey={monitorAccountId != null ? String(monitorAccountId) : ""}
        categoriesRefreshToken={categoriesRefreshToken}
        maxHeightClass="max-h-[calc(100dvh-13rem)]"
        hideTitleBar
        appearance="comfortable"
        columnVisibilityStorageKey="tivana-admin.bank-movements.columns.v1"
        hideInlineSummaryTotals={monitorAccountId != null}
        externalSummaryStrip={monitorAccountId != null}
        onExternalSummaryChange={handleExternalSummaryChange}
        onMovementUpdated={(updated) => {
          if (!updated?.id) return;
          setMonitorMovements((prev) =>
            prev.map((x) =>
              x.id === updated.id ? { ...x, ...updated } : x
            )
          );
        }}
        hintNoContext={
          rows.length === 0
            ? "Agrega una cuenta en Gestionar cuentas para poder monitorear movimientos."
            : "Selecciona una cuenta en el desplegable."
        }
        emptyLoadedMessage={
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center text-sm text-slate-600">
            Esta cuenta no tiene movimientos en el período elegido, o aún no hay
            datos importados.
          </p>
        }
      />
    </div>
  );
}
