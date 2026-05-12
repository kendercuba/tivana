import { useEffect, useState } from "react";
import useLoyverseImport from "../../../hooks/admin/finance/useLoyverseImport";
import {
  fetchLoyverseBatches,
  fetchLoyverseBatchFacts,
  deleteLoyverseBatch,
} from "../../../api/admin/finance/loyverseApi";

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

function formatBs(value) {
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

/** Misma lógica visual que Excel Loyverse (día/mes/año sin hora). */
function formatDateLikeExcel(isoDate) {
  if (!isoDate) return "—";
  const s = String(isoDate).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return String(isoDate);
  return `${Number(d)}/${Number(m)}/${y}`;
}

function formatPercent(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)} %`;
}

/** Enteros como en Excel Loyverse (transacciones, reembolsos). */
function formatIntCell(value) {
  if (value == null || value === "") return "—";
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-VE", { maximumFractionDigits: 0 }).format(
    n
  );
}

/** Etiqueta «Tipo de pago» tal cual el archivo; instantáneas viejas sin campo usan raw_row o código interno. */
function paymentTipoFromRow(row) {
  if (row.payment_type_label) return row.payment_type_label;
  const raw = row.raw_row;
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
      if (String(k).startsWith("_")) continue;
      const nk = String(k)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");
      if (nk.includes("tipo") && nk.includes("pago")) {
        if (v !== "" && v != null) return String(v).trim();
      }
    }
  }
  if (row.payment_method) return String(row.payment_method);
  return "—";
}

/** Etiqueta en español según código guardado en `loyverse_detected_format`. */
function formatLoyverseReportKind(code) {
  if (!code) return "—";
  switch (String(code)) {
    case "daily_summary":
      return "Resumen de ventas";
    case "by_payment":
      return "Ventas por tipo de pago";
    case "by_item":
      return "Ventas por artículo";
    default:
      return String(code);
  }
}

export default function LoyverseVentasCargar() {
  const [file, setFile] = useState(null);
  const [reportHint, setReportHint] = useState("auto");

  const [batches, setBatches] = useState([]);
  const [batchesError, setBatchesError] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const { loading, error, result, handleImport } = useLoyverseImport();

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
  }, []);

  useEffect(() => {
    if (result?.success && result?.data?.importBatchId != null) {
      loadBatches();
      setSelectedBatchId(result.data.importBatchId);
    }
  }, [result?.data?.importBatchId]);

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

  function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      alert("Selecciona un Excel o CSV exportado desde Loyverse.");
      return;
    }
    handleImport({ file, reportHint });
  }

  async function handleDeleteBatch(b) {
    const msg =
      `¿Eliminar el lote #${b.id} (${b.original_filename})? ` +
      "Se borrarán los registros Loyverse asociados. No se puede deshacer.";
    if (!window.confirm(msg)) return;
    try {
      await deleteLoyverseBatch(b.id);
      if (selectedBatchId === b.id) setSelectedBatchId(null);
      await loadBatches();
    } catch (e) {
      alert(e.message);
    }
  }

  const previewKind =
    previewRows.length > 0 ? previewRows[0]?.fact_type : null;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pt-4 pb-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Tipo de reporte (opcional; si eliges automático, se clasifica por
              cabeceras del archivo)
            </label>
            <select
              value={reportHint}
              onChange={(e) => setReportHint(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="auto">Detectar automáticamente</option>
              <option value="daily_summary">
                Resumen de ventas (diario: brutas, netas, beneficio…)
              </option>
              <option value="by_payment">Ventas por tipo de pago</option>
              <option value="by_item">Ventas por artículo</option>
            </select>
          </div>

          {(reportHint === "by_payment" || reportHint === "auto") && (
            <p className="text-[11px] text-amber-950/90 bg-amber-50 border border-amber-100 rounded-md px-2.5 py-2 leading-snug">
              <strong>Ventas por tipo de pago:</strong> el nombre del archivo no puede
              incluir dos fechas distintas (export de rango). Sube un archivo por día.
              Si el nombre repite el mismo día dos veces (p. ej.{" "}
              <span className="font-mono">2026-05-01-2026-05-01</span>), sí se acepta.
            </p>
          )}

          <div>
            <span className="block text-xs font-medium text-gray-600 mb-1">
              Archivo Excel o CSV
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer inline-flex items-center shrink-0 rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 focus-within:ring-2 focus-within:ring-blue-500">
                Seleccionar archivo
                <input
                  type="file"
                  accept=".xls,.xlsx,.csv,text/csv"
                  className="sr-only"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <span
                className="text-xs text-gray-600 truncate min-w-0 flex-1 max-sm:w-full"
                title={file?.name || ""}
              >
                {file ? file.name : "Ningún archivo seleccionado"}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-1.5 rounded-md text-sm font-medium"
          >
            {loading ? "Importando..." : "Importar"}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h2 className="text-green-800 font-semibold">Importación completada</h2>
          <p className="text-sm text-green-700 mt-1 space-y-1">
            <span className="block">
              Filas detectadas:{" "}
              <span className="font-bold">{result?.data?.totalInFile ?? 0}</span>
            </span>
            <span className="block">
              Filas nuevas guardadas:{" "}
              <span className="font-bold">{result?.data?.inserted ?? 0}</span>
            </span>
            <span className="block">
              Duplicados omitidos:{" "}
              <span className="font-bold">{result?.data?.skippedDuplicate ?? 0}</span>
            </span>
            {result?.data?.detectedFormat != null && (
              <span className="block">
                Clasificación detectada:{" "}
                <span className="font-bold">
                  {formatLoyverseReportKind(result.data.detectedFormat)}
                </span>
              </span>
            )}
            {result?.data?.importBatchId != null && (
              <span className="block text-green-900 pt-1">
                Lote <span className="font-mono font-bold">#{result.data.importBatchId}</span>
                {" "}— seleccionado abajo para previsualizar.
              </span>
            )}
          </p>
        </div>
      )}

      <section className="w-full bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h2 className="text-base font-semibold text-gray-800 mb-1">
          Historial de importaciones Loyverse
        </h2>
        <p className="text-[11px] text-gray-500 mb-3 leading-snug">
          Clic en una fila para previsualizar el contenido del lote. La papelera
          borra el lote y todos los registros asociados en base de datos.
        </p>
        {batchesError && (
          <p className="text-sm text-red-600 mb-2">{batchesError}</p>
        )}
        <div className="overflow-x-auto max-h-[min(17rem,42vh)] overflow-y-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2">Fecha carga</th>
                <th className="text-left px-3 py-2 whitespace-nowrap">Tipo</th>
                <th className="text-left px-3 py-2">Archivo</th>
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
                  className={`border-t cursor-pointer hover:bg-blue-50 ${
                    selectedBatchId === b.id ? "bg-blue-50" : ""
                  }`}
                  onClick={() => setSelectedBatchId(b.id)}
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDateShort(b.created_at)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700 text-xs">
                    {formatLoyverseReportKind(b.loyverse_detected_format)}
                  </td>
                  <td
                    className="px-3 py-2 max-w-xs truncate"
                    title={b.original_filename}
                  >
                    {b.original_filename}
                  </td>
                  <td className="px-3 py-2 text-right">{b.rows_in_file}</td>
                  <td className="px-3 py-2 text-right text-green-700 font-medium">
                    {b.rows_inserted}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500">
                    {b.rows_skipped_duplicate}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-blue-600 text-xs hover:underline"
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

      {selectedBatchId && (
        <section className="w-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-800">
              Previsualización — lote #{selectedBatchId}
            </h2>
            {previewLoading && (
              <span className="text-xs text-gray-500">Cargando…</span>
            )}
          </div>
          {previewError && (
            <p className="text-sm text-red-600 px-4 py-2">{previewError}</p>
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
            <p className="text-xs text-amber-800 bg-amber-50 border-b border-amber-100 px-4 py-2">
              Vista del archivo en este lote. Si hubo duplicados respecto a importaciones
              anteriores, esas filas no se duplican en la base de datos, pero siguen
              apareciendo aquí.
            </p>
          )}
          {previewRows.length > 0 && previewKind === "payment_breakdown" && (
            <div className="overflow-x-auto max-h-[min(420px,52vh)] overflow-y-auto">
              <table className="min-w-[880px] w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
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
                      className="border-t border-gray-100"
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
                <thead className="bg-gray-100 sticky top-0">
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
                      className="border-t border-gray-100"
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
                <thead className="bg-gray-100 sticky top-0">
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
                      className="border-t border-gray-100"
                    >
                      <td className="px-3 py-2 capitalize whitespace-nowrap">
                        {String(row.fact_type || "").replace(/_/g, " ")}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.business_date
                          ? formatDateShort(`${row.business_date}T12:00:00`)
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
