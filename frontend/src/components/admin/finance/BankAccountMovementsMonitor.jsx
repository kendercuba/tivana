import { useEffect, useMemo, useRef, useState } from "react";
import { format, startOfDay, subDays } from "date-fns";
import { Settings2 } from "lucide-react";
import BankMovementsTableBlock, { RefreshIcon } from "./BankMovementsTableBlock.jsx";
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
  const [filtersResetTick, setFiltersResetTick] = useState(0);
  const movementsTableRef = useRef(null);
  const columnPickerAnchorRef = useRef(null);

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

  function handleActualizar() {
    setDateRange({
      from: startOfDay(subDays(new Date(), 30)),
      to: startOfDay(new Date()),
    });
    setMonitorRefreshTick((n) => n + 1);
    setFiltersResetTick((n) => n + 1);
  }

  return (
    <div className="mx-auto w-full max-w-[min(88rem,100%)] min-w-0 space-y-4 px-0 sm:px-1">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 shadow-md shadow-slate-900/10">
        <div className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-4 lg:gap-y-3">
            <div className="min-w-0 w-full flex-1 lg:max-w-md">
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

            <div className="w-full min-w-0 lg:flex-1 lg:max-w-md">
              <DateRangeFilter value={dateRange} onChange={setDateRange} />
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-stretch sm:gap-2 lg:pb-0.5">
              <button
                type="button"
                disabled={monitorAccountId == null || accountsLoading}
                onClick={handleActualizar}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:w-auto"
                title="Período últimos 30 días, actualizar datos y quitar filtros de tabla"
                aria-label="Actualizar movimientos y restablecer filtros"
              >
                <RefreshIcon className="h-4 w-4 shrink-0 text-slate-600" />
                Actualizar
              </button>
              <button
                ref={columnPickerAnchorRef}
                type="button"
                disabled={monitorAccountId == null || accountsLoading}
                onClick={() => movementsTableRef.current?.toggleColumnPicker?.()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:w-auto"
                aria-label="Elegir columnas visibles"
                aria-haspopup="menu"
              >
                <Settings2 className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
                Columnas
              </button>
            </div>
          </div>
        </div>
      </div>

      <BankMovementsTableBlock
        ref={movementsTableRef}
        movements={filteredMovements}
        loading={monitorLoading}
        error={monitorError}
        resetKey={monitorAccountId != null ? String(monitorAccountId) : ""}
        categoriesRefreshToken={categoriesRefreshToken}
        maxHeightClass="max-h-[calc(100dvh-10.5rem)] sm:max-h-[calc(100dvh-12rem)] lg:max-h-[calc(100dvh-13rem)]"
        hideTitleBar
        appearance="comfortable"
        columnVisibilityStorageKey="tivana-admin.bank-movements.columns.v1"
        hideInlineSummaryTotals={monitorAccountId != null}
        externalSummaryStrip={false}
        hideComfortableStatCards={monitorAccountId != null}
        resetFiltersKey={filtersResetTick}
        suppressTopToolbar
        columnPickerAnchorRef={columnPickerAnchorRef}
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
