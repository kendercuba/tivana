import { useEffect, useMemo, useState } from "react";
import {
  fetchZmPurchaseOrderBatches,
  fetchZmPurchaseOrderBatchLines,
  deleteZmPurchaseOrderBatch,
} from "../../../api/admin/finance/purchaseOrdersApi";
import {
  formatDateLikeExcel,
  formatImportDateTime,
  formatBatchDataDateRange,
} from "./loyverseImportFormatters.js";

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

function formatQty(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(n);
}

function quantityMeasureLabel(articleSoldByWeight) {
  if (articleSoldByWeight === true) return "kg";
  if (articleSoldByWeight === false) return "ud";
  return "—";
}

/**
 * @param {object} props
 * @param {number} [props.refreshToken]
 * @param {number|null} [props.preferredSelectBatchId]
 * @param {(batch: object) => void} [props.onDeleted]
 */
export default function ZmPurchaseOrderBatchHistory({
  refreshToken = 0,
  preferredSelectBatchId = null,
  onDeleted,
}) {
  const [batches, setBatches] = useState([]);
  const [batchesError, setBatchesError] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const preferredBatchNum = useMemo(() => {
    const n = Number(preferredSelectBatchId);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [preferredSelectBatchId]);

  async function loadBatches() {
    try {
      setBatchesError(null);
      const res = await fetchZmPurchaseOrderBatches({ limit: 100 });
      setBatches(res.data || []);
    } catch (e) {
      setBatchesError(e.message);
    }
  }

  useEffect(() => {
    loadBatches();
  }, [refreshToken]);

  useEffect(() => {
    const id = Number(preferredSelectBatchId);
    if (Number.isFinite(id) && id > 0) {
      setSelectedBatchId(id);
    }
  }, [preferredSelectBatchId]);

  useEffect(() => {
    if (!selectedBatchId) {
      setPreviewRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setPreviewLoading(true);
        setPreviewError(null);
        const res = await fetchZmPurchaseOrderBatchLines(selectedBatchId, {
          limit: 500,
        });
        if (!cancelled) setPreviewRows(res.data || []);
      } catch (e) {
        if (!cancelled) setPreviewError(e.message);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBatchId]);

  async function handleDeleteBatch(b) {
    const msg =
      `¿Eliminar el lote #${b.id} (${b.original_filename})? ` +
      "Se borrarán las líneas de órdenes de compra asociadas. No se puede deshacer.";
    if (!window.confirm(msg)) return;
    try {
      await deleteZmPurchaseOrderBatch(b.id);
      if (selectedBatchId === b.id) setSelectedBatchId(null);
      await loadBatches();
      onDeleted?.(b);
    } catch (e) {
      window.alert(e.message);
    }
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 font-zm">
      <section className="w-full min-w-0 bg-white rounded-xl border border-zm-green/20 shadow-sm p-4">
        <h2 className="text-base font-semibold text-zm-sidebar mb-3">
          Historial de cargas
        </h2>
        {batchesError && (
          <p className="text-sm text-zm-red mb-2">{batchesError}</p>
        )}
        <div className="max-h-[min(17rem,42vh)] overflow-y-auto overflow-x-auto border border-zm-green/15 rounded-lg [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[960px] border-collapse text-xs sm:text-sm">
            <thead className="sticky top-0 z-10 border-b border-zm-green/25 bg-zm-cream [&_th]:bg-zm-cream">
              <tr>
                <th className="text-left px-2 py-1.5 sm:px-3 whitespace-nowrap">
                  Fecha carga
                </th>
                <th className="text-left px-2 py-1.5 sm:px-3 min-w-[14rem]">
                  Archivo
                </th>
                <th className="text-left px-2 py-1.5 sm:px-3 whitespace-nowrap">
                  Período cargado
                </th>
                <th className="text-right px-2 py-1.5 sm:px-3 whitespace-nowrap">
                  En archivo
                </th>
                <th className="text-right px-2 py-1.5 sm:px-3 whitespace-nowrap">
                  Nuevos
                </th>
                <th className="text-right px-2 py-1.5 sm:px-3 whitespace-nowrap">
                  Dup.
                </th>
                <th className="text-left px-2 py-1.5 sm:px-3 whitespace-nowrap">
                  Ver
                </th>
                <th className="w-12 px-1 py-1.5 text-center" scope="col">
                  <span className="sr-only">Eliminar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const bid = Number(b.id);
                const isSelected = selectedBatchId === b.id;
                const isPreferredNew =
                  preferredBatchNum != null && bid === preferredBatchNum;
                return (
                  <tr
                    key={b.id}
                    className={`border-t border-gray-100 cursor-pointer transition-colors ${
                      isSelected
                        ? isPreferredNew
                          ? "bg-zm-yellow/40 border-zm-green/15 ring-1 ring-zm-green/25 shadow-sm"
                          : "bg-zm-cream/70"
                        : isPreferredNew
                          ? "bg-zm-yellow/30 hover:bg-zm-yellow/40"
                          : "hover:bg-gray-50"
                    }`}
                    onClick={() => setSelectedBatchId(b.id)}
                  >
                    <td className="min-w-[12rem] max-w-[13rem] px-2 py-1.5 sm:px-3 align-top overflow-hidden">
                      <span
                        className="block truncate whitespace-nowrap"
                        title={formatImportDateTime(b.created_at)}
                      >
                        {formatImportDateTime(b.created_at)}
                      </span>
                    </td>
                    <td
                      className="min-w-[14rem] max-w-[24rem] px-2 py-1.5 sm:px-3 align-top overflow-hidden"
                      title={b.original_filename}
                    >
                      <span className="block truncate">{b.original_filename}</span>
                    </td>
                    <td className="max-w-[9rem] px-2 py-1.5 sm:px-3 text-xs text-gray-800 tabular-nums align-top overflow-hidden">
                      <span className="block truncate whitespace-nowrap">
                        {formatBatchDataDateRange(b.data_date_min, b.data_date_max)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 sm:px-3 text-right tabular-nums align-top">
                      {b.rows_in_file}
                    </td>
                    <td className="px-2 py-1.5 sm:px-3 text-right text-zm-green font-medium tabular-nums align-top">
                      {b.rows_inserted}
                    </td>
                    <td className="px-2 py-1.5 sm:px-3 text-right text-gray-500 tabular-nums align-top">
                      {b.rows_skipped_duplicate}
                    </td>
                    <td className="px-2 py-1.5 sm:px-3 align-top">
                      <button
                        type="button"
                        className="text-zm-green text-xs font-medium hover:underline"
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
                        className="inline-flex items-center justify-center p-1.5 rounded-md text-zm-red hover:bg-zm-red/10 border border-transparent hover:border-zm-red/25"
                        title="Eliminar este lote"
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
                          className="w-4 h-4"
                          aria-hidden
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
            <p className="text-sm text-gray-500 p-4">Aún no hay cargas registradas.</p>
          )}
        </div>
      </section>

      {selectedBatchId && (
        <section className="w-full bg-white rounded-xl border border-zm-green/20 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zm-green/15 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-zm-sidebar">
              Previsualización — lote #{selectedBatchId}
            </h2>
            {previewLoading && (
              <span className="text-sm text-gray-500">Cargando…</span>
            )}
          </div>
          {previewError && (
            <p className="text-sm text-zm-red px-4 py-2">{previewError}</p>
          )}
          {!previewLoading && previewRows.length === 0 && !previewError && (
            <p className="text-sm text-gray-500 p-4">No hay filas para este lote.</p>
          )}
          {previewRows.length > 0 && previewRows[0]?._previewFromFileSnapshot && (
            <p className="text-xs text-gray-600 bg-zm-cream/50 border-b border-zm-green/15 px-4 py-2">
              Instantánea del archivo en este lote (incluye filas que pudieron quedar como
              duplicadas respecto a cargas anteriores).
            </p>
          )}
          {previewRows.length > 0 && (
            <div className="max-h-[min(65vh,36rem)] sm:max-h-[min(70vh,42rem)] overflow-y-auto overflow-x-auto border-t border-zm-green/15 [-webkit-overflow-scrolling:touch]">
              <table className="min-w-[940px] w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10 border-b border-zm-green/25 bg-zm-cream [&_th]:bg-zm-cream">
                  <tr>
                    <th className="text-left px-3 py-2 whitespace-nowrap">Fecha</th>
                    <th className="text-left px-3 py-2 whitespace-nowrap">Orden</th>
                    <th className="text-left px-3 py-2 whitespace-nowrap">
                      Referencia
                    </th>
                    <th className="text-left px-3 py-2 min-w-[10rem]">Artículo</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">Cant.</th>
                    <th className="text-center px-3 py-2 whitespace-nowrap">Unidad</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">
                      <span className="block">Costo u.</span>
                      <span className="block text-[10px] font-normal text-gray-500">
                        (USD)
                      </span>
                    </th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">
                      <span className="block">Total</span>
                      <span className="block text-[10px] font-normal text-gray-500">
                        (USD)
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr
                      key={row.id ?? `pv-${idx}`}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums text-gray-900">
                        {formatDateLikeExcel(row.business_date)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                        {row.po_number || "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums text-gray-900">
                        {row.ref_code != null && row.ref_code !== ""
                          ? String(row.ref_code)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-900 min-w-0 max-w-[14rem] overflow-hidden">
                        <span className="block truncate" title={row.item_name}>
                          {row.item_name}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-900">
                        {formatQty(row.quantity)}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap tabular-nums text-gray-900">
                        {quantityMeasureLabel(row.article_sold_by_weight)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-900 font-semibold">
                        {formatUsd(row.unit_cost)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-900 font-semibold">
                        {formatUsd(row.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
