import { useEffect, useMemo, useState } from "react";
import BankMovementsTableBlock from "./BankMovementsTableBlock.jsx";
import {
  fetchBankImportBatches,
  fetchBankBatchMovements,
  fetchBankAccounts,
  deleteBankImportBatch,
  patchBankImportBatchAccount,
} from "../../../api/admin/finance/bankApi.js";
import { formatBatchDataDateRange } from "./loyverseImportFormatters.js";

function formatDateShort(value) {
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

/**
 * Historial de lotes BNC + vista previa de movimientos del lote (misma UX que BankImport).
 *
 * @param {object} props
 * @param {number} [props.accountsRefreshToken]
 * @param {number} [props.categoriesRefreshToken]
 * @param {number|string} [props.refreshToken] — change to reload batch list
 * @param {number|null} [props.preferredSelectBatchId]
 * @param {boolean} [props.useZonaMarketStyle]
 * @param {(batchId: number) => void} [props.onImportBatchDeleted] — after successful delete
 */
export default function BankImportBatchHistory({
  accountsRefreshToken = 0,
  categoriesRefreshToken = 0,
  refreshToken = 0,
  preferredSelectBatchId = null,
  useZonaMarketStyle = true,
  onImportBatchDeleted,
}) {
  const isZM = useZonaMarketStyle;

  const [bankAccountsAll, setBankAccountsAll] = useState([]);
  const [batches, setBatches] = useState([]);
  const [batchesError, setBatchesError] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [batchMovements, setBatchMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementsError, setMovementsError] = useState(null);
  const [reassigningBatchId, setReassigningBatchId] = useState(null);

  const activeAccounts = bankAccountsAll.filter((a) => a.is_active);

  const selectedBatchRecord = useMemo(() => {
    if (selectedBatchId == null || selectedBatchId === "") return null;
    const sid = Number(selectedBatchId);
    return batches.find((b) => Number(b.id) === sid) ?? null;
  }, [selectedBatchId, batches]);

  function accountDisplayName(id) {
    return bankAccountsAll.find((a) => a.id === id)?.name ?? `#${id}`;
  }

  async function loadBankAccounts() {
    try {
      const res = await fetchBankAccounts({ includeInactive: true });
      setBankAccountsAll(res.data || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadBatches() {
    try {
      setBatchesError(null);
      const res = await fetchBankImportBatches({ limit: 100 });
      setBatches(res.data || []);
    } catch (e) {
      setBatchesError(e.message);
    }
  }

  useEffect(() => {
    loadBatches();
  }, [refreshToken]);

  useEffect(() => {
    loadBankAccounts();
  }, [accountsRefreshToken]);

  useEffect(() => {
    const id = Number(preferredSelectBatchId);
    if (Number.isFinite(id) && id > 0) {
      setSelectedBatchId(id);
    }
  }, [preferredSelectBatchId]);

  useEffect(() => {
    if (!selectedBatchId) {
      setBatchMovements([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setMovementsLoading(true);
        setMovementsError(null);
        const res = await fetchBankBatchMovements(selectedBatchId);
        if (!cancelled) setBatchMovements(res.data || []);
      } catch (e) {
        if (!cancelled) setMovementsError(e.message);
      } finally {
        if (!cancelled) setMovementsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBatchId]);

  async function handleDeleteBatch(b) {
    const msg =
      `¿Eliminar el lote #${b.id} (${b.original_filename})? ` +
      "Se borrarán de la base de datos los movimientos que se guardaron en esa importación. No se puede deshacer.";
    if (!window.confirm(msg)) return;
    try {
      await deleteBankImportBatch(b.id);
      onImportBatchDeleted?.(Number(b.id));
      if (selectedBatchId === b.id) {
        setSelectedBatchId(null);
      }
      await loadBatches();
    } catch (e) {
      alert(e.message);
    }
  }

  function accountsForBatchSelect(batchAccountId) {
    const idNum = Number(batchAccountId);
    const activeIds = new Set(activeAccounts.map((a) => a.id));
    if (activeIds.has(idNum)) return activeAccounts;
    const current = bankAccountsAll.find((a) => a.id === idNum);
    if (current) return [current, ...activeAccounts];
    return activeAccounts;
  }

  async function handleBatchAccountChange(batch, nextValue) {
    const nextId = Number(nextValue);
    if (
      !Number.isFinite(nextId) ||
      nextId === Number(batch.bank_account_id)
    ) {
      return;
    }
    setReassigningBatchId(batch.id);
    try {
      await patchBankImportBatchAccount(batch.id, nextId);
      await loadBatches();
      if (selectedBatchId === batch.id) {
        const res = await fetchBankBatchMovements(batch.id);
        setBatchMovements(res.data || []);
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setReassigningBatchId(null);
    }
  }

  return (
    <div
      className={`w-full min-w-0 max-w-none space-y-3 ${isZM ? "font-zm" : ""}`}
    >
      <section
        className={
          isZM
            ? "bg-white rounded-xl border border-zm-yellow/50 shadow-md shadow-zm-sidebar/5 ring-1 ring-zm-green/10 p-3"
            : "bg-white rounded-xl border border-gray-200 shadow-sm p-3"
        }
      >
        <h2
          className={
            isZM
              ? "text-sm font-semibold text-zm-sidebar mb-2"
              : "text-sm font-semibold text-gray-800 mb-2"
          }
        >
          Historial de importaciones BNC
        </h2>
        {batchesError && (
          <p className="text-sm text-red-600 mb-2">{batchesError}</p>
        )}
        {/*
          ~3 filas de datos visibles + cabecera; el resto con scroll vertical.
          Altura fija aproximada: thead + 3×tbody (~10rem).
        */}
        <div className="overflow-y-auto overflow-x-auto border rounded-lg max-h-[10rem] sm:max-h-[10.5rem] [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[1120px] border-collapse text-xs sm:text-sm">
            <thead
              className={
                isZM
                  ? "sticky top-0 z-10 border-b border-zm-green/25 bg-zm-cream [&_th]:bg-zm-cream text-zm-sidebar"
                  : "sticky top-0 z-10 border-b border-gray-200 bg-gray-100 [&_th]:bg-gray-100"
              }
            >
              <tr>
                <th className="text-left px-2 py-1.5 sm:px-3 whitespace-nowrap">
                  Fecha carga
                </th>
                <th className="text-left px-2 py-1.5 sm:px-3">Archivo</th>
                <th className="text-left px-2 py-1.5 sm:px-3 whitespace-nowrap">
                  Período cargado
                </th>
                <th className="text-left px-2 py-1.5 sm:px-3">Cuenta</th>
                <th className="text-right px-2 py-1.5 sm:px-3 whitespace-nowrap">
                  En archivo
                </th>
                <th className="text-right px-2 py-1.5 sm:px-3">Nuevos</th>
                <th className="text-right px-2 py-1.5 sm:px-3">Dup.</th>
                <th className="text-left px-2 py-1.5 sm:px-3">Ver</th>
                <th className="w-10 px-1 py-1.5 text-center" scope="col">
                  <span className="sr-only">Eliminar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const bid = Number(b.id);
                const isSelected = selectedBatchId === b.id;
                const preferredId =
                  preferredSelectBatchId != null &&
                  preferredSelectBatchId !== ""
                    ? Number(preferredSelectBatchId)
                    : null;
                const isPreferredNew =
                  Number.isFinite(preferredId) &&
                  preferredId > 0 &&
                  bid === preferredId;
                return (
                <tr
                  key={b.id}
                  className={
                    isZM
                      ? `border-t cursor-pointer border-zm-green/10 transition-colors ${
                          isSelected
                            ? isPreferredNew
                              ? "bg-zm-yellow/40 ring-1 ring-zm-green/30 shadow-sm"
                              : "bg-zm-yellow/30"
                            : isPreferredNew
                              ? "bg-zm-yellow/25 hover:bg-zm-yellow/35"
                              : "hover:bg-zm-yellow/20"
                        }`
                      : `border-t cursor-pointer ${
                          isSelected
                            ? "bg-blue-50"
                            : isPreferredNew
                              ? "bg-amber-50 hover:bg-amber-100/80"
                              : "hover:bg-blue-50"
                        }`
                  }
                  onClick={() => setSelectedBatchId(b.id)}
                >
                  <td className="min-w-[12rem] max-w-[13rem] px-2 py-1.5 sm:px-3 align-top overflow-hidden">
                    <span
                      className="block truncate whitespace-nowrap"
                      title={formatDateShort(b.created_at)}
                    >
                      {formatDateShort(b.created_at)}
                    </span>
                  </td>
                  <td
                    className="min-w-[14rem] max-w-[24rem] px-2 py-1.5 sm:px-3 align-top overflow-hidden"
                    title={b.original_filename}
                  >
                    <span className="block truncate">{b.original_filename}</span>
                  </td>
                  <td
                    className="min-w-[10rem] max-w-[11rem] px-2 py-1.5 sm:px-3 text-xs tabular-nums text-gray-800 align-top overflow-hidden"
                    title={
                      b.data_date_min && b.data_date_max
                        ? `Movimientos nuevos guardados: ${b.data_date_min} … ${b.data_date_max}`
                        : undefined
                    }
                  >
                    <span className="block truncate whitespace-nowrap">
                      {formatBatchDataDateRange(b.data_date_min, b.data_date_max)}
                    </span>
                  </td>
                  <td
                    className="min-w-[11rem] max-w-[18rem] px-2 py-0.5 align-top"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <select
                      value={String(b.bank_account_id)}
                      disabled={
                        reassigningBatchId === b.id ||
                        activeAccounts.length === 0
                      }
                      onChange={(e) =>
                        handleBatchAccountChange(b, e.target.value)
                      }
                      className="w-full max-w-full border border-gray-300 rounded px-1 py-0.5 text-xs bg-white disabled:opacity-60"
                      title="Cambiar cuenta asignada a este lote"
                      aria-label={`Cuenta del lote ${b.id}`}
                    >
                      {accountsForBatchSelect(b.bank_account_id).map((a) => (
                        <option key={a.id} value={String(a.id)}>
                          {!a.is_active ? `${a.name} (inactiva)` : a.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 sm:px-3 text-right tabular-nums align-top">
                    {b.rows_in_file}
                  </td>
                  <td
                    className={
                      isZM
                        ? "px-2 py-1.5 sm:px-3 text-right text-zm-green font-semibold tabular-nums align-top"
                        : "px-2 py-1.5 sm:px-3 text-right text-green-700 font-medium tabular-nums align-top"
                    }
                  >
                    {b.rows_inserted}
                  </td>
                  <td className="px-2 py-1.5 sm:px-3 text-right text-gray-500 tabular-nums align-top">
                    {b.rows_skipped_duplicate}
                  </td>
                  <td className="px-2 py-1.5 sm:px-3 align-top">
                    <button
                      type="button"
                      className={
                        isZM
                          ? "text-zm-green text-xs font-medium hover:underline hover:text-zm-green-dark"
                          : "text-blue-600 text-xs hover:underline"
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBatchId(b.id);
                      }}
                    >
                      Lote #{b.id}
                    </button>
                  </td>
                  <td className="px-1 py-1.5 text-center align-top">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center p-1.5 rounded-md text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200"
                      title="Eliminar este lote y sus movimientos"
                      aria-label="Eliminar lote"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBatch(b);
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          {batches.length === 0 && !batchesError && (
            <p className="text-sm text-gray-500 p-4">
              Aún no hay importaciones registradas.
            </p>
          )}
        </div>
      </section>

      <BankMovementsTableBlock
        movements={batchMovements}
        loading={movementsLoading}
        error={movementsError}
        titleToolbarInline
        resetKey={
          selectedBatchId != null && selectedBatchId !== ""
            ? String(selectedBatchId)
            : ""
        }
        categoriesRefreshToken={categoriesRefreshToken}
        onMovementUpdated={(updated) => {
          if (!updated?.id) return;
          setBatchMovements((prev) =>
            prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x))
          );
        }}
        title={
          <>
            Movimientos del lote seleccionado
            {selectedBatchId ? ` #${selectedBatchId}` : ""}
            {selectedBatchRecord != null && (
              <span className="text-gray-600 font-normal">
                {" "}
                — {accountDisplayName(selectedBatchRecord.bank_account_id)}
              </span>
            )}
          </>
        }
        emptyLoadedMessage={
          <p className="text-sm text-gray-500 p-4">
            Este lote no tiene movimientos guardados.
          </p>
        }
      />
    </div>
  );
}
