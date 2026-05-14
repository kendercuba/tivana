import { useEffect, useMemo, useRef, useState } from "react";
import { format, startOfDay, subDays } from "date-fns";
import { Link } from "react-router-dom";
import { Settings2, Upload, Link2 } from "lucide-react";
import BankMovementsTableBlock, { RefreshIcon } from "./BankMovementsTableBlock.jsx";
import LoyversePorPagoDateRange from "./LoyversePorPagoDateRange.jsx";
import {
  fetchBankAccounts,
  fetchBankMovementsByAccount,
  reclassifyBankMovementsForAccount,
} from "../../../api/admin/finance/bankApi";
import useBankImport from "../../../hooks/admin/finance/useBankImport";
import { filesFromFileList } from "../../../utils/filesFromFileList.js";
import { useFinanceBasePath } from "../../../contexts/FinanceBasePathContext.jsx";

function movementDateKey(m) {
  const raw = m.movement_date;
  if (raw == null || raw === "") return "";
  const s = String(raw).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function defaultLast30YmdRange() {
  const end = startOfDay(new Date());
  const start = startOfDay(subDays(new Date(), 30));
  return {
    startYmd: format(start, "yyyy-MM-dd"),
    endYmd: format(end, "yyyy-MM-dd"),
  };
}

function filterByYmdRange(movements, rangeStartYmd, rangeEndYmd) {
  if (!rangeStartYmd || !rangeEndYmd) return movements;
  const from = rangeStartYmd <= rangeEndYmd ? rangeStartYmd : rangeEndYmd;
  const to = rangeStartYmd <= rangeEndYmd ? rangeEndYmd : rangeStartYmd;
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
  onImportSuccess,
  highlightImportBatchId = null,
  onHighlightImportBatchIdChange,
}) {
  const [rows, setRows] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  const [monitorAccountId, setMonitorAccountId] = useState(null);
  const [monitorMovements, setMonitorMovements] = useState([]);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorError, setMonitorError] = useState(null);
  const [monitorRefreshTick, setMonitorRefreshTick] = useState(0);
  const [filtersResetTick, setFiltersResetTick] = useState(0);
  const [reclassifyLoading, setReclassifyLoading] = useState(false);
  const movementsTableRef = useRef(null);
  const columnPickerAnchorRef = useRef(null);
  /** When import returns no inserted rows with dates, widen range after movements reload. */
  const pendingBankImportRangeFallbackRef = useRef(false);

  const [rangeStart, setRangeStart] = useState(() => defaultLast30YmdRange().startYmd);
  const [rangeEnd, setRangeEnd] = useState(() => defaultLast30YmdRange().endYmd);

  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  /** Shown when the server skipped every row as duplicate (nothing new to highlight). */
  const [importDedupeHint, setImportDedupeHint] = useState(null);
  const {
    loading: importLoading,
    error: importError,
    result: importResult,
    handleImport,
  } = useBankImport();

  const movementDateBounds = useMemo(() => {
    const keys = monitorMovements
      .map((m) => movementDateKey(m))
      .filter(Boolean)
      .sort();
    if (keys.length === 0) return { min: "", max: "" };
    return { min: keys[0], max: keys[keys.length - 1] };
  }, [monitorMovements]);

  const filteredMovements = useMemo(
    () => filterByYmdRange(monitorMovements, rangeStart, rangeEnd),
    [monitorMovements, rangeStart, rangeEnd]
  );

  const financeBase = useFinanceBasePath();
  const reconDateYmd = useMemo(() => {
    if (!rangeStart || !rangeEnd) return "";
    const from = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
    const to = rangeStart <= rangeEnd ? rangeEnd : rangeStart;
    return to;
  }, [rangeStart, rangeEnd]);

  const reconLoyverseHref = useMemo(() => {
    if (!reconDateYmd || monitorAccountId == null) return "";
    const q = new URLSearchParams({
      date: reconDateYmd,
      bankAccountId: String(monitorAccountId),
      paymentMethod: "pago_movil",
    });
    return `${financeBase}/conciliacion?${q.toString()}`;
  }, [financeBase, reconDateYmd, monitorAccountId]);

  useEffect(() => {
    if (!pendingBankImportRangeFallbackRef.current) return;
    if (monitorLoading) return;
    const min = movementDateBounds.min;
    const max = movementDateBounds.max;
    if (min && max) {
      setRangeStart(min);
      setRangeEnd(max);
    }
    pendingBankImportRangeFallbackRef.current = false;
  }, [
    monitorMovements,
    monitorLoading,
    movementDateBounds.min,
    movementDateBounds.max,
  ]);

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
    if (!importResult?.success || importResult?.data == null) {
      return;
    }
    const data = importResult.data;
    const inserted = data.movements || [];
    /** Top-level camelCase from Node; tolerate snake_case if encoding differs. */
    const highlightBatchRaw =
      data.importBatchId ??
      data.import_batch_id ??
      inserted[0]?.import_batch_id ??
      inserted[0]?.importBatchId;
    const highlightBatchNum =
      highlightBatchRaw != null && highlightBatchRaw !== ""
        ? Number(highlightBatchRaw)
        : null;

    const resolvedAccountIdRaw =
      data.accountResolution?.usedBankAccountId ??
      inserted[0]?.bank_account_id;
    const resolvedAccountId =
      resolvedAccountIdRaw != null && resolvedAccountIdRaw !== ""
        ? Number(resolvedAccountIdRaw)
        : null;

    if (resolvedAccountId != null && Number.isFinite(resolvedAccountId)) {
      setMonitorAccountId(resolvedAccountId);
    }

    if (Number.isFinite(highlightBatchNum)) {
      onHighlightImportBatchIdChange?.(highlightBatchNum);
    } else {
      onHighlightImportBatchIdChange?.(null);
    }

    const insertedCount =
      typeof data.inserted === "number" ? data.inserted : inserted.length;
    const skippedDup = Number(data.skippedDuplicate ?? 0);
    if (insertedCount === 0 && skippedDup > 0) {
      setImportDedupeHint(
        "No hay movimientos nuevos: todas las filas ya estaban guardadas (deduplicación). Borra ese lote en Historial de cargas y vuelve a importar para poder ver el resaltado en la tabla."
      );
    } else {
      setImportDedupeHint(null);
    }

    const dateKeys = inserted
      .map((m) => movementDateKey(m))
      .filter(Boolean)
      .sort();
    if (dateKeys.length > 0) {
      setRangeStart(dateKeys[0]);
      setRangeEnd(dateKeys[dateKeys.length - 1]);
      pendingBankImportRangeFallbackRef.current = false;
    } else {
      pendingBankImportRangeFallbackRef.current = true;
    }

    setUploadFiles([]);
    setUploadInputKey((k) => k + 1);
    setMonitorRefreshTick((n) => n + 1);
    onImportSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per import completion; omit parent callbacks
  }, [
    importResult?.success,
    importResult?.data?.importBatchId,
    importResult?.data?.import_batch_id,
  ]);

  async function handleBankFilesChosen(ev) {
    const picked = filesFromFileList(ev.target.files);
    setImportDedupeHint(null);
    if (picked.length === 0) {
      setUploadFiles([]);
      return;
    }
    if (rows.length === 0) {
      window.alert(
        "No hay cuentas bancarias. Crea una en Gestionar cuentas antes de importar."
      );
      setUploadInputKey((k) => k + 1);
      return;
    }
    setUploadFiles(picked);
    await handleImport({
      files: picked,
      bankAccountId:
        monitorAccountId != null ? monitorAccountId : undefined,
    });
  }

  async function handleActualizar() {
    const { startYmd, endYmd } = defaultLast30YmdRange();
    setRangeStart(startYmd);
    setRangeEnd(endYmd);
    setFiltersResetTick((n) => n + 1);
    if (monitorAccountId != null && !accountsLoading) {
      try {
        setReclassifyLoading(true);
        await reclassifyBankMovementsForAccount(monitorAccountId);
      } catch (e) {
        window.alert(
          e.message ||
            "No se pudieron aplicar las reglas de clasificación. Revisa la consola del servidor."
        );
      } finally {
        setReclassifyLoading(false);
      }
    }
    setMonitorRefreshTick((n) => n + 1);
  }

  return (
    <div className="mx-auto w-full max-w-full min-w-0 space-y-4 px-0 sm:px-1">
      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-4 lg:gap-y-3">
            <div className="min-w-0 w-full flex-1 lg:max-w-md">
              <label className="mb-1 block text-sm font-medium text-zm-sidebar">
                Cuenta
              </label>
              <select
                value={monitorAccountId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setMonitorAccountId(v === "" ? null : Number(v));
                  onHighlightImportBatchIdChange?.(null);
                  setImportDedupeHint(null);
                }}
                disabled={accountsLoading || rows.length === 0}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm outline-none transition hover:border-gray-400 focus:border-zm-green focus:ring-2 focus:ring-zm-green/30 disabled:bg-gray-50 disabled:text-gray-400"
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
              <span className="mb-1 block text-sm font-medium text-zm-sidebar">
                Período
              </span>
              <LoyversePorPagoDateRange
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                dataMinYmd={movementDateBounds.min}
                dataMaxYmd={movementDateBounds.max}
                onApplyRange={(startYmd, endYmd) => {
                  setRangeStart(startYmd);
                  setRangeEnd(endYmd);
                }}
              />
            </div>

            <div className="w-full min-w-0 lg:flex-1 lg:max-w-md">
              <span className="mb-1 block text-sm font-medium text-zm-sidebar">
                Importar Excel
              </span>
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <label
                  className={`cursor-pointer inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-zm-green/40 bg-white px-3 py-2 text-xs font-semibold text-zm-green hover:bg-zm-green/5 focus-within:ring-2 focus-within:ring-zm-green/40 ${
                    importLoading ? "pointer-events-none opacity-60" : ""
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
                    accept=".xls,.xlsx"
                    className="sr-only"
                    aria-label="Seleccionar uno o varios archivos Excel del estado de cuenta"
                    disabled={importLoading}
                    onChange={handleBankFilesChosen}
                  />
                </label>
                {uploadFiles.length > 0 && (
                  <span
                    className="text-xs text-gray-700 truncate min-w-0 max-w-[10rem] sm:max-w-[18rem] font-medium"
                    title={uploadFiles.map((f) => f.name).join("\n")}
                  >
                    {uploadFiles.length === 1
                      ? uploadFiles[0].name
                      : `${uploadFiles.length} archivos seleccionados`}
                  </span>
                )}
              </div>
              {importError && (
                <p className="mt-1 text-xs text-zm-red">{importError}</p>
              )}
              {importDedupeHint && (
                <p
                  className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs leading-snug text-amber-950"
                  role="status"
                >
                  {importDedupeHint}
                </p>
              )}
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-stretch sm:gap-2 lg:pb-0.5">
              <button
                type="button"
                disabled={
                  monitorAccountId == null ||
                  accountsLoading ||
                  reclassifyLoading ||
                  monitorLoading
                }
                onClick={handleActualizar}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400 sm:w-auto"
                title="Aplica reglas de clasificación actuales, últimos 30 días, recarga movimientos y quita filtros de tabla"
                aria-label="Actualizar movimientos y restablecer filtros"
              >
                <RefreshIcon className="h-4 w-4 shrink-0 text-zm-green" />
                Actualizar
              </button>
              <button
                ref={columnPickerAnchorRef}
                type="button"
                disabled={monitorAccountId == null || accountsLoading}
                onClick={() => movementsTableRef.current?.toggleColumnPicker?.()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zm-green/40 bg-white px-3 py-2 text-sm font-semibold text-zm-green shadow-sm transition hover:bg-zm-green/5 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400 sm:w-auto"
                aria-label="Elegir columnas visibles"
                aria-haspopup="menu"
              >
                <Settings2 className="h-4 w-4 shrink-0 text-zm-green" aria-hidden />
                Columnas
              </button>
              {reconLoyverseHref ? (
                <Link
                  to={reconLoyverseHref}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zm-green/40 bg-white px-3 py-2 text-sm font-semibold text-zm-green shadow-sm transition hover:bg-zm-green/5 sm:w-auto"
                >
                  <Link2 className="h-4 w-4 shrink-0 text-zm-green" aria-hidden />
                  Conciliar con Loyverse
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Elegí cuenta y rango de fechas para abrir el panel"
                  className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-400 sm:w-auto"
                >
                  <Link2 className="h-4 w-4 shrink-0" aria-hidden />
                  Conciliar con Loyverse
                </button>
              )}
            </div>
          </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm min-w-0">
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
        highlightImportBatchId={highlightImportBatchId}
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
          <p className="rounded-xl border border-dashed border-zm-green/25 bg-zm-cream/60 p-6 text-center text-sm text-gray-700">
            Esta cuenta no tiene movimientos en el período elegido, o aún no hay
            datos importados.
          </p>
        }
      />
      </div>
    </div>
  );
}
