import { useCallback, useEffect, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import {
  fetchZmPurchaseOrderLinesInRange,
  fetchZmPurchaseOrderMeta,
  validateZmPurchaseOrdersFile,
} from "../../../api/admin/finance/purchaseOrdersApi";
import { filesFromFileList } from "../../../utils/filesFromFileList.js";
import LoyversePorPagoDateRange from "../../../components/admin/finance/LoyversePorPagoDateRange.jsx";
import ZmPurchaseOrderBatchHistory from "../../../components/admin/finance/ZmPurchaseOrderBatchHistory.jsx";
import useZmPurchaseOrdersImport from "../../../hooks/admin/finance/useZmPurchaseOrdersImport";
import { formatDateLikeExcel } from "../../../components/admin/finance/loyverseImportFormatters.js";

const ZM_PO_UPLOAD_ACCEPT =
  ".xls,.xlsx,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function localTodayYmd() {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function minYmd(a, b) {
  if (!a || !b) return a || b || "";
  return a <= b ? a : b;
}

function maxYmd(a, b) {
  if (!a || !b) return a || b || "";
  return a >= b ? a : b;
}

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

/** Cruce con catálogo Loyverse (REF): kg = vendido por peso, ud = unidad, — = sin artículo. */
function quantityMeasureLabel(articleSoldByWeight) {
  if (articleSoldByWeight === true) return "kg";
  if (articleSoldByWeight === false) return "ud";
  return "—";
}

/**
 * Órdenes de compra Zona Market (CSV/Excel con columnas FECHA, FACTURA, REF, …).
 *
 * @param {object} [props]
 * @param {number|string|null} [props.highlightBatchId]
 * @param {(id: number|null) => void} [props.onHighlightBatchIdChange]
 */
export default function ZmPurchaseOrders({
  highlightBatchId = null,
  onHighlightBatchIdChange,
} = {}) {
  const [topTab, setTopTab] = useState("tabla");
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [fileHintError, setFileHintError] = useState(null);
  const [fileHintValidating, setFileHintValidating] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [rows, setRows] = useState([]);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeBootstrapped, setRangeBootstrapped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [dataMinYmd, setDataMinYmd] = useState("");
  const [dataMaxYmd, setDataMaxYmd] = useState("");

  const {
    loading: importLoading,
    error: importError,
    result: importResult,
    handleImport,
  } = useZmPurchaseOrdersImport();

  const loadMetaBounds = useCallback(async () => {
    try {
      const res = await fetchZmPurchaseOrderMeta();
      const d = res.data || {};
      const min = String(d.data_date_min || "").slice(0, 10);
      const max = String(d.data_date_max || "").slice(0, 10);
      setDataMinYmd(min);
      setDataMaxYmd(max);
      return { min, max };
    } catch {
      setDataMinYmd("");
      setDataMaxYmd("");
      return { min: "", max: "" };
    }
  }, []);

  const refreshLines = useCallback(async () => {
    if (!rangeStart || !rangeEnd) return null;
    try {
      setLoading(true);
      setErr(null);
      const lo = minYmd(rangeStart, rangeEnd);
      const hi = maxYmd(rangeStart, rangeEnd);
      const res = await fetchZmPurchaseOrderLinesInRange(lo, hi, {
        limit: 25000,
      });
      const data = res.data || [];
      setRows(data);
      return data;
    } catch (e) {
      setErr(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const bounds = await loadMetaBounds();
      if (cancelled) return;
      const t = localTodayYmd();
      if (bounds.min && bounds.max) {
        if (!rangeBootstrapped) {
          setRangeStart(bounds.min);
          setRangeEnd(bounds.max);
          setRangeBootstrapped(true);
        }
      } else if (!rangeBootstrapped) {
        setRangeStart(t);
        setRangeEnd(t);
        setRangeBootstrapped(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMetaBounds, rangeBootstrapped]);

  useEffect(() => {
    if (!rangeBootstrapped || !rangeStart || !rangeEnd) return;
    void refreshLines();
  }, [rangeBootstrapped, rangeStart, rangeEnd, refreshLines]);

  useEffect(() => {
    if (!importResult?.success || importResult?.data?.importBatchId == null) {
      return;
    }
    const batchId = importResult.data.importBatchId;
    onHighlightBatchIdChange?.(batchId);
    setHistoryRefresh((n) => n + 1);
    setUploadFiles([]);
    setUploadInputKey((k) => k + 1);

    let cancelled = false;
    void (async () => {
      const bounds = await loadMetaBounds();
      if (cancelled) return;
      if (bounds.min && bounds.max) {
        setRangeStart(bounds.min);
        setRangeEnd(bounds.max);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    importResult?.data?.importBatchId,
    importResult?.success,
    loadMetaBounds,
    onHighlightBatchIdChange,
  ]);

  async function handleFileSelected(e) {
    const picked = filesFromFileList(e.target.files);
    setFileHintError(null);
    if (picked.length === 0) {
      setUploadFiles([]);
      return;
    }
    setFileHintValidating(true);
    try {
      for (const file of picked) {
        const v = await validateZmPurchaseOrdersFile({ file });
        if (!v.ok) {
          setFileHintError(
            `${file.name}: ${v.message || "El archivo no coincide con el formato de órdenes de compra."}`
          );
          setUploadFiles([]);
          setUploadInputKey((k) => k + 1);
          return;
        }
      }
      setUploadFiles(picked);
    } catch (err) {
      setFileHintError(err.message || "No se pudo validar el archivo.");
      setUploadFiles([]);
      setUploadInputKey((k) => k + 1);
      return;
    } finally {
      setFileHintValidating(false);
    }
    await handleImport({ files: picked });
  }

  const filteredRows = useMemo(() => {
    if (!rangeStart || !rangeEnd) return rows;
    const lo = minYmd(rangeStart, rangeEnd);
    const hi = maxYmd(rangeStart, rangeEnd);
    return rows.filter((r) => {
      const d = String(r.business_date || "").slice(0, 10);
      return d && d >= lo && d <= hi;
    });
  }, [rows, rangeStart, rangeEnd]);

  const totals = useMemo(() => {
    let t = 0;
    for (const r of filteredRows) {
      const n = Number(r.line_total);
      if (Number.isFinite(n)) t += n;
    }
    return t;
  }, [filteredRows]);

  const subBtn = (key, label) => (
    <button
      type="button"
      onClick={() => setTopTab(key)}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
        topTab === key
          ? "bg-zm-cream/70 border-zm-green/45 text-zm-sidebar shadow-sm"
          : "bg-transparent border-transparent text-gray-600 hover:text-zm-sidebar hover:bg-zm-cream/40"
      }`}
    >
      {label}
    </button>
  );

  const highlightNum = Number(highlightBatchId);
  const hasHighlight = Number.isFinite(highlightNum) && highlightNum > 0;

  return (
    <div className="w-full max-w-7xl font-zm">
      <div className="flex items-center bg-zm-green px-4 sm:px-6 py-3 text-white shadow-sm rounded-b-xl">
        <h1 className="text-sm sm:text-base font-semibold tracking-tight">
          Órdenes de compra
        </h1>
      </div>
      <div className="px-4 pt-3 pb-6 space-y-3">
        <div className="border-b border-zm-green/20">
          <div className="flex flex-wrap gap-1 py-1">
            {subBtn("tabla", "Tabla")}
            {subBtn("historial", "Historial de cargas")}
          </div>
        </div>

        {topTab === "historial" ? (
          <ZmPurchaseOrderBatchHistory
            refreshToken={historyRefresh}
            preferredSelectBatchId={importResult?.data?.importBatchId ?? null}
            onDeleted={() => {
              void loadMetaBounds();
              void refreshLines();
            }}
          />
        ) : (
          <>
            {err && <p className="text-sm text-zm-red">{err}</p>}
            {loading && <p className="text-sm text-gray-500">Cargando…</p>}
            {!loading && rows.length === 0 && !err && (
              <p className="text-sm text-gray-600">
                No hay líneas en el rango seleccionado.
              </p>
            )}

            <section className="rounded-xl border border-zm-green/20 bg-white p-3 sm:p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <LoyversePorPagoDateRange
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  dataMinYmd={dataMinYmd || undefined}
                  dataMaxYmd={dataMaxYmd || undefined}
                  onApplyRange={(startYmd, endYmd) => {
                    setRangeStart(startYmd);
                    setRangeEnd(endYmd);
                  }}
                />

                <div className="flex flex-wrap items-center gap-2 min-w-0 w-full sm:w-auto sm:ml-auto sm:justify-end">
                  <label
                    className={`cursor-pointer inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-zm-green/40 bg-white px-3 py-2 text-xs font-semibold text-zm-green hover:bg-zm-green/5 focus-within:ring-2 focus-within:ring-zm-green/40 ${
                      fileHintValidating || importLoading
                        ? "pointer-events-none opacity-60"
                        : ""
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
                      accept={ZM_PO_UPLOAD_ACCEPT}
                      className="sr-only"
                      aria-label="Seleccionar uno o varios archivos CSV o Excel de órdenes de compra"
                      disabled={fileHintValidating || importLoading}
                      onChange={handleFileSelected}
                    />
                  </label>
                  {uploadFiles.length > 0 && (
                    <span
                      className="text-xs text-gray-700 truncate min-w-0 max-w-[10rem] sm:max-w-[18rem] font-medium"
                      title={uploadFiles.map((f) => f.name).join(", ")}
                    >
                      {uploadFiles.length === 1
                        ? uploadFiles[0].name
                        : `${uploadFiles.length} archivos seleccionados`}
                    </span>
                  )}
                </div>
              </div>
              {fileHintError && (
                <p className="text-sm text-zm-red">{fileHintError}</p>
              )}
              {importError && (
                <p className="text-sm text-zm-red">{importError}</p>
              )}
            </section>

            {!loading && filteredRows.length > 0 && (
              <div className="max-h-[min(65vh,36rem)] sm:max-h-[min(70vh,42rem)] overflow-y-auto overflow-x-auto border border-zm-green/15 rounded-lg bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
                <table className="min-w-[940px] w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10 border-b border-zm-green/25 bg-zm-cream [&_th]:bg-zm-cream">
                    <tr>
                      <th className="text-left px-3 py-2 whitespace-nowrap">Fecha</th>
                      <th className="text-left px-3 py-2 whitespace-nowrap">Orden</th>
                      <th className="text-right px-3 py-2 whitespace-nowrap">Lote</th>
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
                    {filteredRows.map((r) => {
                      const isHi =
                        hasHighlight &&
                        Number(r.import_batch_id) === highlightNum;
                      return (
                        <tr
                          key={r.id}
                          className={`border-t border-gray-100 ${
                            isHi
                              ? "border-zm-green/10 bg-zm-yellow/30 hover:bg-zm-yellow/40"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <td className="px-3 py-2 whitespace-nowrap tabular-nums text-gray-900">
                            {formatDateLikeExcel(r.business_date)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                            {r.po_number || "—"}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-gray-900">
                            {r.import_batch_id ?? "—"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap tabular-nums text-gray-900">
                            {r.ref_code != null && r.ref_code !== ""
                              ? String(r.ref_code)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-gray-900 min-w-0 max-w-[14rem] overflow-hidden">
                            <span
                              className="block truncate font-medium"
                              title={r.item_name}
                            >
                              {r.item_name}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-900">
                            {formatQty(r.quantity)}
                          </td>
                          <td className="px-3 py-2 text-center whitespace-nowrap tabular-nums text-gray-900">
                            {quantityMeasureLabel(r.article_sold_by_weight)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-900 font-semibold">
                            {formatUsd(r.unit_cost)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-900 font-semibold">
                            {formatUsd(r.line_total)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t border-zm-green/25 bg-zm-green/10">
                      <td
                        colSpan={8}
                        className="px-3 py-2 text-right text-sm font-semibold text-zm-sidebar"
                      >
                        Total período (USD)
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-semibold text-zm-sidebar tabular-nums">
                        {formatUsd(totals)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
