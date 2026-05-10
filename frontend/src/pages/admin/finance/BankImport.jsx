import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useBankImport from "../../../hooks/admin/finance/useBankImport";
import BankMovementsTableBlock from "../../../components/admin/finance/BankMovementsTableBlock";
import {
  fetchBankImportBatches,
  fetchBankBatchMovements,
  fetchBankAccounts,
  deleteBankImportBatch,
  patchBankImportBatchAccount,
} from "../../../api/admin/finance/bankApi";
import { useFinanceBasePath } from "../../../contexts/FinanceBasePathContext.jsx";

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

export default function BankImport({
  accountsRefreshToken = 0,
  categoriesRefreshToken = 0,
}) {
  const financeBase = useFinanceBasePath();
  const isZonaMarket = financeBase.startsWith("/zonamarket");
  const [file, setFile] = useState(null);
  const [bankAccountsAll, setBankAccountsAll] = useState([]);

  const [batches, setBatches] = useState([]);
  const [batchesError, setBatchesError] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [batchMovements, setBatchMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementsError, setMovementsError] = useState(null);

  const [reassigningBatchId, setReassigningBatchId] = useState(null);

  const { loading, error, result, handleImport } = useBankImport();

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
  }, []);

  useEffect(() => {
    loadBankAccounts();
  }, [accountsRefreshToken]);

  useEffect(() => {
    if (result?.success) {
      loadBatches();
    }
  }, [result?.data?.importBatchId]);

  /** Tras importar, abre el lote nuevo en «Movimientos del lote seleccionado» (sin tabla duplicada arriba). */
  useEffect(() => {
    const id = result?.data?.importBatchId;
    if (result?.success && id != null && id !== "") {
      setSelectedBatchId(id);
    }
  }, [result?.success, result?.data?.importBatchId]);

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
      if (selectedBatchId === b.id) {
        setSelectedBatchId(null);
      }
      await loadBatches();
    } catch (e) {
      alert(e.message);
    }
  }

  /** Opciones del desplegable de cuenta por fila (incluye cuenta actual si está inactiva). */
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

  function handleSubmit(e) {
    e.preventDefault();

    if (activeAccounts.length === 0) {
      alert(
        "Agrega o activa al menos una cuenta: menú lateral → Cuentas bancarias → Gestionar cuentas."
      );
      return;
    }

    if (!file) {
      alert("Debes seleccionar un archivo Excel del banco.");
      return;
    }

    const fallbackAccountId = activeAccounts[0]?.id;
    handleImport({
      file,
      bankAccountId: fallbackAccountId,
    });
  }

  return (
    <div
      className={`px-4 pt-4 pb-6 space-y-4 ${isZonaMarket ? "font-zm" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1
            className={
              isZonaMarket
                ? "text-xl font-bold text-zm-sidebar"
                : "text-xl font-bold text-gray-800"
            }
          >
            Subir excel
          </h1>
        </div>
        <Link
          to={`${financeBase}/dashboard`}
          className={
            isZonaMarket
              ? "text-xs font-medium text-zm-green hover:text-zm-green-dark hover:underline whitespace-nowrap pt-0.5"
              : "text-xs text-blue-600 hover:underline whitespace-nowrap pt-0.5"
          }
        >
          Ver resúmenes (panel) →
        </Link>
      </div>

      <div
        className={
          isZonaMarket
            ? "bg-white rounded-lg shadow-md shadow-zm-sidebar/5 border border-zm-yellow/55 ring-1 ring-zm-green/10 p-3 max-w-4xl"
            : "bg-white rounded-lg shadow-sm border border-gray-200 p-3 max-w-4xl"
        }
      >
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <span className="sr-only">Archivo Excel del banco</span>
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className={
                    isZonaMarket
                      ? "inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-zm-green/35 bg-zm-cream text-sm text-zm-sidebar cursor-pointer hover:bg-zm-yellow/25 focus-within:ring-2 focus-within:ring-zm-yellow"
                      : "inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-300 bg-gray-50 text-sm text-gray-800 cursor-pointer hover:bg-gray-100 focus-within:ring-2 focus-within:ring-blue-500"
                  }
                >
                  <input
                    type="file"
                    accept=".xls,.xlsx"
                    className="sr-only"
                    onChange={(e) =>
                      setFile(e.target.files?.[0] ?? null)
                    }
                  />
                  Seleccionar archivo
                </label>
                <span
                  className="text-xs text-gray-600 truncate max-w-[min(100%,280px)]"
                  title={file?.name ?? undefined}
                >
                  {file ? file.name : "Ningún archivo seleccionado"}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={
                isZonaMarket
                  ? "shrink-0 bg-zm-red hover:bg-zm-red/90 disabled:bg-zm-red/40 text-white px-4 py-1.5 rounded-md text-sm font-semibold"
                  : "shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-1.5 rounded-md text-sm font-medium"
              }
            >
              {loading ? "Importando..." : "Importar archivo"}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div
          className={
            isZonaMarket
              ? "bg-zm-cream border border-zm-green/40 rounded-lg p-3 ring-1 ring-zm-yellow/40"
              : "bg-green-50 border border-green-200 rounded-lg p-3"
          }
        >
          <h2
            className={
              isZonaMarket
                ? "text-zm-sidebar font-semibold"
                : "text-green-800 font-semibold"
            }
          >
            Importación completada
          </h2>
          <p
            className={
              isZonaMarket
                ? "text-sm text-zm-green mt-1 space-y-1"
                : "text-sm text-green-700 mt-1 space-y-1"
            }
          >
            <span className="block">
              Filas leídas en el Excel:{" "}
              <span className="font-bold">{result?.data?.totalInFile ?? 0}</span>
            </span>
            <span className="block">
              Movimientos nuevos guardados:{" "}
              <span className="font-bold">{result?.data?.inserted ?? 0}</span>
            </span>
            <span className="block">
              Duplicados omitidos (ya estaban en el sistema):{" "}
              <span className="font-bold">{result?.data?.skippedDuplicate ?? 0}</span>
            </span>
            {result?.data?.importBatchId != null && (
              <span
                className={
                  isZonaMarket ? "block text-zm-sidebar" : "block text-green-900"
                }
              >
                Lote guardado: <span className="font-mono font-bold">#{result.data.importBatchId}</span>
                {" "}
                — ya está seleccionado abajo para ver sus movimientos.
              </span>
            )}
            {result?.data?.accountResolution?.fromExcel &&
              result.data.accountResolution.lastFour &&
              !result.data.accountResolution.excelDigitsUnmatched && (
              <span
                className={
                  isZonaMarket
                    ? "block text-zm-sidebar pt-2 border-t border-zm-green/25 mt-2"
                    : "block text-green-900 pt-2 border-t border-green-200 mt-2"
                }
              >
                Cuenta según el Excel (terminación …{result.data.accountResolution.lastFour}
                ):{" "}
                <span className="font-semibold">
                  {result.data.accountResolution.matchedAccountName}
                </span>
                {result.data.accountResolution.overridden && (
                  <span className="block text-amber-800 text-xs mt-1">
                    La cuenta aplicada es la detectada en el Excel (no la cuenta de
                    respaldo).
                  </span>
                )}
              </span>
            )}
            {result?.data?.accountResolution?.bncFieldUnsetReminder && (
              <span
                className={
                  isZonaMarket
                    ? "block text-zm-green/80 text-xs pt-2 mt-2 border-t border-zm-green/20"
                    : "block text-gray-600 text-xs pt-2 mt-2 border-t border-green-200"
                }
              >
                {result.data.accountResolution.bncFieldUnsetReminder}
              </span>
            )}
            {result?.data?.accountResolution?.excelDigitsUnmatched && (
              <span className="block text-amber-900 text-sm pt-2 mt-2 border-t border-amber-200">
                {result.data.accountResolution.hint}
              </span>
            )}
            {result?.data?.accountResolution &&
              !result.data.accountResolution.fromExcel && (
              <span
                className={
                  isZonaMarket
                    ? "block text-zm-green/80 text-xs pt-2 mt-2 border-t border-zm-green/20"
                    : "block text-gray-600 text-xs pt-2 mt-2 border-t border-green-200"
                }
              >
                No se detectó ***XXXX en el encabezado del Excel; se usó la primera
                cuenta activa como respaldo. Puedes ajustar la cuenta en el
                historial de importaciones.
              </span>
            )}
          </p>
        </div>
      )}

      <section
        className={
          isZonaMarket
            ? "bg-white rounded-xl border border-zm-yellow/50 shadow-md shadow-zm-sidebar/5 ring-1 ring-zm-green/10 p-4"
            : "bg-white rounded-xl border border-gray-200 shadow-sm p-4"
        }
      >
        <h2
          className={
            isZonaMarket
              ? "text-base font-semibold text-zm-sidebar mb-3"
              : "text-base font-semibold text-gray-800 mb-3"
          }
        >
          Historial de importaciones BNC
        </h2>
        {batchesError && (
          <p className="text-sm text-red-600 mb-2">{batchesError}</p>
        )}
        <div className="overflow-x-auto max-h-[min(17rem,42vh)] overflow-y-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead
              className={
                isZonaMarket
                  ? "bg-zm-yellow/35 text-zm-sidebar sticky top-0"
                  : "bg-gray-100 sticky top-0"
              }
            >
              <tr>
                <th className="text-left px-3 py-2">Fecha carga</th>
                <th className="text-left px-3 py-2">Archivo</th>
                <th className="text-left px-3 py-2">Cuenta</th>
                <th className="text-right px-3 py-2">En archivo</th>
                <th className="text-right px-3 py-2">Nuevos</th>
                <th className="text-right px-3 py-2">Dup.</th>
                <th className="text-left px-3 py-2">Ver</th>
                <th className="w-12 px-2 py-2 text-center" scope="col">
                  <span className="sr-only">Eliminar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr
                  key={b.id}
                  className={
                    isZonaMarket
                      ? `border-t cursor-pointer border-zm-green/10 hover:bg-zm-yellow/20 ${
                          selectedBatchId === b.id ? "bg-zm-yellow/30" : ""
                        }`
                      : `border-t cursor-pointer hover:bg-blue-50 ${
                          selectedBatchId === b.id ? "bg-blue-50" : ""
                        }`
                  }
                  onClick={() => setSelectedBatchId(b.id)}
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDateShort(b.created_at)}
                  </td>
                  <td className="px-3 py-2 max-w-xs truncate" title={b.original_filename}>
                    {b.original_filename}
                  </td>
                  <td
                    className="px-2 py-1 align-middle"
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
                      className="max-w-[min(240px,48vw)] border border-gray-300 rounded px-1 py-0.5 text-xs bg-white disabled:opacity-60"
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
                  <td className="px-3 py-2 text-right">{b.rows_in_file}</td>
                  <td
                    className={
                      isZonaMarket
                        ? "px-3 py-2 text-right text-zm-green font-semibold"
                        : "px-3 py-2 text-right text-green-700 font-medium"
                    }
                  >
                    {b.rows_inserted}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500">
                    {b.rows_skipped_duplicate}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className={
                        isZonaMarket
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
                  <td className="px-2 py-2 text-center">
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
              ))}
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
