import { useEffect, useMemo, useState } from "react";
import {
  fetchLoyverseBatches,
  fetchLoyverseBatchFacts,
  deleteLoyverseBatch,
} from "../../../api/admin/finance/loyverseApi";
import {
  formatBs,
  formatDateLikeExcel,
  formatImportDateTime,
  formatIntCell,
  formatLoyverseReportKind,
  formatPercent,
  paymentTipoFromRow,
  formatBatchDataDateRange,
} from "./loyverseImportFormatters.js";

/**
 * Loyverse import history table + batch preview (same UX as «Cargar reporte ventas»).
 *
 * @param {object} props
 * @param {string | null} [props.detectedFormatFilter] — e.g. `daily_summary` to only list resumen batches
 * @param {number | string} [props.refreshToken] — change to reload batch list (e.g. after import)
 * @param {number | null} [props.preferredSelectBatchId] — select this batch when set (e.g. last import)
 * @param {(batch: object) => void} [props.onDeleted]
 */
export default function LoyverseImportBatchHistory({
  detectedFormatFilter = null,
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

  const filteredBatches = useMemo(() => {
    if (!detectedFormatFilter) return batches;
    return batches.filter(
      (b) => String(b.loyverse_detected_format || "") === detectedFormatFilter
    );
  }, [batches, detectedFormatFilter]);

  const preferredBatchNum = useMemo(() => {
    const n = Number(preferredSelectBatchId);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [preferredSelectBatchId]);

  const highlightPreviewRows =
    preferredBatchNum != null &&
    selectedBatchId != null &&
    Number(selectedBatchId) === preferredBatchNum;

  async function loadBatches() {
    try {
      setBatchesError(null);
      const res = await fetchLoyverseBatches({ limit: 100 });
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
        const res = await fetchLoyverseBatchFacts(selectedBatchId, {
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
      "Se borrarán los registros Loyverse asociados. No se puede deshacer.";
    if (!window.confirm(msg)) return;
    try {
      await deleteLoyverseBatch(b.id);
      if (selectedBatchId === b.id) setSelectedBatchId(null);
      await loadBatches();
      onDeleted?.(b);
    } catch (e) {
      alert(e.message);
    }
  }

  const previewKind =
    previewRows.length > 0 ? previewRows[0]?.fact_type : null;

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 font-zm">
      <section className="w-full min-w-0 bg-white rounded-xl border border-zm-green/20 shadow-sm p-4">
        <h2 className="text-base font-semibold text-zm-sidebar mb-3">
          Historial de importaciones Loyverse
        </h2>
        {batchesError && (
          <p className="text-sm text-zm-red mb-2">{batchesError}</p>
        )}
        <div className="max-h-[min(17rem,42vh)] overflow-y-auto overflow-x-auto border border-zm-green/15 rounded-lg [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[1120px] border-collapse text-xs sm:text-sm">
            <thead className="sticky top-0 z-10 border-b border-zm-green/25 bg-zm-cream [&_th]:bg-zm-cream">
              <tr>
                <th className="text-left px-2 py-1.5 sm:px-3 whitespace-nowrap">
                  Fecha carga
                </th>
                <th className="text-left px-2 py-1.5 sm:px-3 min-w-[10rem]">
                  Tipo
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
              {filteredBatches.map((b) => {
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
                        ? "bg-zm-yellow/25 hover:bg-zm-yellow/35"
                        : "hover:bg-zm-green/5"
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
                    className="min-w-[11rem] max-w-[16rem] px-2 py-1.5 sm:px-3 text-gray-700 text-xs align-top overflow-hidden"
                    title={formatLoyverseReportKind(b.loyverse_detected_format)}
                  >
                    <span className="line-clamp-2 break-words leading-snug">
                      {formatLoyverseReportKind(b.loyverse_detected_format)}
                    </span>
                  </td>
                  <td
                    className="min-w-[14rem] max-w-[24rem] px-2 py-1.5 sm:px-3 align-top overflow-hidden"
                    title={b.original_filename}
                  >
                    <span className="block truncate">{b.original_filename}</span>
                  </td>
                  <td
                    className="max-w-[9rem] px-2 py-1.5 sm:px-3 text-xs text-gray-800 tabular-nums align-top overflow-hidden"
                    title={
                      b.data_date_min && b.data_date_max
                        ? `Datos nuevos guardados: ${b.data_date_min} … ${b.data_date_max}`
                        : undefined
                    }
                  >
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
          {filteredBatches.length === 0 && !batchesError && (
            <p className="text-sm text-gray-500 p-4">
              {detectedFormatFilter
                ? "No hay importaciones de este tipo registradas."
                : "Aún no hay importaciones registradas."}
            </p>
          )}
        </div>
      </section>

      {selectedBatchId && (
        <section className="w-full bg-white rounded-xl border border-zm-green/20 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zm-green/15 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-zm-sidebar">
              Previsualización — lote #{selectedBatchId}
            </h2>
            {previewLoading && (
              <span className="text-xs text-gray-500">Cargando…</span>
            )}
          </div>
          {previewError && (
            <p className="text-sm text-zm-red px-4 py-2">{previewError}</p>
          )}
          {!previewLoading && previewRows.length === 0 && !previewError && (
            <p className="text-sm text-gray-500 p-4">
              Este lote no tiene filas guardadas. Si el historial muestra 0 nuevos y todo
              duplicado, ejecuta la migración{" "}
              <code className="text-xs bg-gray-100 px-1 rounded">
                2026-05-11_finance_import_batches_preview_payload.sql
              </code>{" "}
              y vuelve a importar para ver la instantánea del archivo.
            </p>
          )}
          {previewRows.length > 0 && previewRows[0]?._previewFromFileSnapshot && (
            <p className="text-xs text-amber-900 bg-amber-50 border-b border-amber-100 px-4 py-2">
              Vista del archivo en este lote. Si hubo duplicados respecto a importaciones
              anteriores, esas filas no se duplican en la base de datos, pero siguen
              apareciendo aquí.
            </p>
          )}
          {previewRows.length > 0 && previewKind === "payment_breakdown" && (
            <div className="overflow-x-auto max-h-[min(420px,52vh)] overflow-y-auto">
              <table className="min-w-[880px] w-full text-sm">
                <thead className="sticky top-0 z-10 border-b border-zm-green/25 bg-zm-cream [&_th]:bg-zm-cream">
                  <tr>
                    <th className="text-left px-3 py-2 whitespace-nowrap">
                      Tipo de pago
                    </th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">
                      Transacciones de pago
                    </th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">
                      Monto de pagos
                    </th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">
                      Reembolso de transacciones
                    </th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">
                      Importe del reembolsos
                    </th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">
                      Monto neto
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr
                      key={
                        row.id != null ? row.id : `snap-pay-${selectedBatchId}-${idx}`
                      }
                      className={
                        highlightPreviewRows
                          ? "border-t border-zm-green/10 bg-zm-yellow/30 hover:bg-zm-yellow/40"
                          : "border-t border-gray-100"
                      }
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {paymentTipoFromRow(row)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        {formatIntCell(row.transactions_count)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        {row.gross_sales != null
                          ? formatBs(row.gross_sales)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        {formatIntCell(
                          row.payment_refund_txn_count ??
                            row.raw_row?._loyverse_refund_txn_count
                        )}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        {row.payment_refund_amount != null
                          ? formatBs(row.payment_refund_amount)
                          : row.raw_row?._loyverse_refund_amount != null
                            ? formatBs(row.raw_row._loyverse_refund_amount)
                            : "—"}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        {row.net_sales != null ? formatBs(row.net_sales) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {previewRows.length > 0 && previewKind === "daily_summary" && (
            <div className="overflow-x-auto max-h-[min(420px,52vh)] overflow-y-auto">
              <table className="min-w-[920px] w-full text-sm">
                <thead className="sticky top-0 z-10 border-b border-zm-green/25 bg-zm-cream [&_th]:bg-zm-cream">
                  <tr>
                    <th className="text-left px-3 py-2 whitespace-nowrap">
                      Fecha
                    </th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">
                      Ventas brutas
                    </th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">
                      Reembolsos
                    </th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">
                      Descuentos
                    </th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">
                      Ventas netas
                    </th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">
                      Costo de los bienes
                    </th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">
                      Beneficio bruto
                    </th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">
                      Margen
                    </th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">
                      Impuestos
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr
                      key={row.id != null ? row.id : `snap-${selectedBatchId}-${idx}`}
                      className={
                        highlightPreviewRows
                          ? "border-t border-zm-green/10 bg-zm-yellow/30 hover:bg-zm-yellow/40"
                          : "border-t border-gray-100"
                      }
                    >
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                        {formatDateLikeExcel(row.business_date)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        {row.gross_sales != null ? formatBs(row.gross_sales) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        {row.refunds != null ? formatBs(row.refunds) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        {row.discounts != null ? formatBs(row.discounts) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        {row.net_sales != null ? formatBs(row.net_sales) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        {row.cost_goods != null ? formatBs(row.cost_goods) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        {row.gross_profit != null
                          ? formatBs(row.gross_profit)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        {formatPercent(row.margin_pct)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        {row.taxes != null ? formatBs(row.taxes) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {previewRows.length > 0 &&
            previewKind !== "daily_summary" &&
            previewKind !== "payment_breakdown" && (
            <div className="overflow-x-auto max-h-[min(320px,40vh)] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 border-b border-zm-green/25 bg-zm-cream [&_th]:bg-zm-cream">
                  <tr>
                    <th className="text-left px-3 py-2">Tipo</th>
                    <th className="text-left px-3 py-2">Fecha</th>
                    <th className="text-left px-3 py-2">Detalle</th>
                    <th className="text-right px-3 py-2">Neto</th>
                    <th className="text-right px-3 py-2">Bruto / benef.</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr
                      key={row.id != null ? row.id : `snap-${selectedBatchId}-${idx}`}
                      className={
                        highlightPreviewRows
                          ? "border-t border-zm-green/10 bg-zm-yellow/30 hover:bg-zm-yellow/40"
                          : "border-t border-gray-100"
                      }
                    >
                      <td className="px-3 py-2 capitalize whitespace-nowrap">
                        {String(row.fact_type || "").replace(/_/g, " ")}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.business_date
                          ? formatImportDateTime(`${row.business_date}T12:00:00`)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 max-w-md">
                        {row.payment_method ||
                          row.item_name ||
                          row.sku ||
                          "—"}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {row.net_sales != null
                          ? `Bs ${formatBs(row.net_sales)}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-700">
                        {row.gross_sales != null && (
                          <span className="block">
                            Bruto Bs {formatBs(row.gross_sales)}
                          </span>
                        )}
                        {row.gross_profit != null && (
                          <span className="block">
                            Benef. Bs {formatBs(row.gross_profit)}
                          </span>
                        )}
                        {row.gross_sales == null && row.gross_profit == null && "—"}
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
