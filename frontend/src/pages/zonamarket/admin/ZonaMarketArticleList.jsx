import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Search, Upload } from "lucide-react";
import ZonaMarketArticlesImportHistory from "../../../components/zonamarket/ZonaMarketArticlesImportHistory.jsx";
import {
  fetchZmLoyverseItems,
  importZmLoyverseItemsFile,
} from "../../../api/zonamarket/zmLoyverseItemsApi.js";
import { filesFromFileList } from "../../../utils/filesFromFileList.js";

const LOYVERSE_ITEMS_UPLOAD_ACCEPT =
  ".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function formatPrice(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-VE", {
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

function escapeCsvCell(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const INVENTORY_ALERT_ALL = "all";
const INVENTORY_ALERT_LOW = "low";
const INVENTORY_ALERT_UNAVAILABLE = "unavailable";

const TOP_TAB_LISTA = "lista";
const TOP_TAB_HISTORIAL = "historial";

function articleListSubTabClass(active) {
  return [
    "px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors",
    active
      ? "bg-zm-cream/70 border-zm-green/45 text-zm-sidebar shadow-sm"
      : "bg-transparent border-transparent text-gray-600 hover:text-zm-sidebar hover:bg-zm-cream/40",
  ].join(" ");
}

/** Provisional: inventario bajo = existencias actuales ≤ umbral de existencias bajas (cuando ambos existen). */
function matchesInventoryLow(p) {
  const qoh = Number(p.quantity_on_hand);
  const low = Number(p.low_stock_threshold);
  if (!Number.isFinite(low) || !Number.isFinite(qoh)) return false;
  return qoh <= low;
}

/** Provisional: no disponible = sin cantidad en mano o cantidad ≤ 0. */
function matchesInventoryUnavailable(p) {
  if (p.quantity_on_hand == null || p.quantity_on_hand === "") return true;
  const n = Number(p.quantity_on_hand);
  return !Number.isFinite(n) || n <= 0;
}

const CSV_HEADER = [
  "REF",
  "Nombre",
  "Categoría",
  "Por peso",
  "Precio venta",
  "Coste",
  "Inventario",
  "Existencias bajas",
  "Stock óptimo",
  "Código de barras",
];

function buildCsvRows(rows) {
  const lines = [CSV_HEADER.join(",")];
  for (const p of rows) {
    lines.push(
      [
        escapeCsvCell(p.ref),
        escapeCsvCell(p.name),
        escapeCsvCell(p.category),
        escapeCsvCell(p.sold_by_weight ? "Sí" : "No"),
        escapeCsvCell(p.price),
        escapeCsvCell(p.purchase_cost),
        escapeCsvCell(p.quantity_on_hand),
        escapeCsvCell(p.low_stock_threshold),
        escapeCsvCell(p.optimal_stock),
        escapeCsvCell(p.barcode),
      ].join(",")
    );
  }
  return lines.join("\r\n");
}

export default function ZonaMarketArticleList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [uploadFiles, setUploadFiles] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importOk, setImportOk] = useState(null);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [highlightLastImportId, setHighlightLastImportId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [inventoryAlertFilter, setInventoryAlertFilter] = useState(
    INVENTORY_ALERT_ALL
  );
  const [topTab, setTopTab] = useState(TOP_TAB_LISTA);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchZmLoyverseItems();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load Loyverse items", e);
      setError(
        e?.message ||
          "No se pudieron cargar los artículos. Aplica las migraciones SQL (incluida la de esquema reducido) y reinicia el backend."
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categoryOptions = useMemo(() => {
    const set = new Set();
    for (const p of items) {
      const c = p.category?.trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = items;

    if (categoryFilter) {
      rows = rows.filter((p) => (p.category || "").trim() === categoryFilter);
    }

    if (inventoryAlertFilter === INVENTORY_ALERT_LOW) {
      rows = rows.filter(matchesInventoryLow);
    } else if (inventoryAlertFilter === INVENTORY_ALERT_UNAVAILABLE) {
      rows = rows.filter(matchesInventoryUnavailable);
    }

    if (!q) return rows;
    return rows.filter((p) => {
      const hay = [p.ref, p.name, p.category, p.barcode]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, categoryFilter, inventoryAlertFilter]);

  const selectClass =
    "min-w-[11rem] max-w-[14rem] rounded-lg border border-zm-green/25 bg-white py-2 pl-2.5 pr-8 text-sm text-zm-sidebar shadow-sm focus:border-zm-green/50 focus:outline-none focus:ring-2 focus:ring-zm-green/30";

  function exportCsv() {
    const csv = buildCsvRows(filtered);
    const blob = new Blob(["\ufeff", csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `articulos-loyverse-zona-market-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportSubmit(e) {
    e.preventDefault();
    if (uploadFiles.length === 0) return;
    setImportLoading(true);
    setImportError(null);
    setImportOk(null);
    try {
      let lastImportId = null;
      let totalRows = 0;
      for (const f of uploadFiles) {
        try {
          const data = await importZmLoyverseItemsFile(f);
          const iid = data?.importId ?? data?.import_id;
          if (iid != null && Number.isFinite(Number(iid))) {
            lastImportId = Number(iid);
          }
          totalRows += Number(data?.rowCount ?? data?.row_count ?? 0) || 0;
        } catch (inner) {
          const msg = inner?.message || "Error al importar.";
          throw new Error(
            uploadFiles.length > 1 ? `${f.name}: ${msg}` : msg
          );
        }
      }
      setHighlightLastImportId(lastImportId);
      setImportOk(
        uploadFiles.length > 1
          ? `Importación correcta: ${uploadFiles.length} archivos, ${totalRows} filas procesadas en total.`
          : `Importación correcta: ${totalRows} artículos actualizados.`
      );
      setUploadFiles([]);
      setUploadInputKey((k) => k + 1);
      await load();
      setHistoryRefresh((n) => n + 1);
    } catch (err) {
      setHighlightLastImportId(null);
      setImportError(err?.message || "No se pudo importar el archivo.");
    } finally {
      setImportLoading(false);
    }
  }

  return (
    <div className="w-full font-zm">
      <div className="w-full max-w-7xl">
        <div className="flex items-center bg-zm-green px-4 sm:px-6 py-3 text-white shadow-sm rounded-b-xl">
          <h1 className="text-sm sm:text-base font-semibold tracking-tight">
            Lista de artículos
          </h1>
        </div>
        <div className="border-b border-zm-green/20 px-4 sm:px-6">
          <div className="flex flex-wrap gap-1 py-1">
            <button
              type="button"
              onClick={() => setTopTab(TOP_TAB_LISTA)}
              className={articleListSubTabClass(topTab === TOP_TAB_LISTA)}
            >
              Artículos
            </button>
            <button
              type="button"
              onClick={() => setTopTab(TOP_TAB_HISTORIAL)}
              className={articleListSubTabClass(topTab === TOP_TAB_HISTORIAL)}
            >
              Historial de cargas
            </button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-7xl px-4 sm:px-6 pb-8 pt-3">
        {topTab === TOP_TAB_HISTORIAL && (
          <ZonaMarketArticlesImportHistory
            refreshToken={historyRefresh}
            highlightImportId={highlightLastImportId}
            onDeleted={() => {
              void load();
              setHistoryRefresh((n) => n + 1);
            }}
          />
        )}

        {topTab === TOP_TAB_LISTA && (
          <section className="rounded-xl border border-zm-green/20 bg-white p-3 sm:p-4 shadow-sm space-y-3">
          <form
            onSubmit={handleImportSubmit}
            className="flex flex-wrap items-center gap-2 min-w-0"
          >
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
                accept={LOYVERSE_ITEMS_UPLOAD_ACCEPT}
                className="sr-only"
                aria-label="Seleccionar uno o varios archivos de artículos Loyverse (CSV o Excel)"
                disabled={importLoading}
                onChange={(ev) => {
                  setUploadFiles(filesFromFileList(ev.target.files));
                  setImportError(null);
                  setImportOk(null);
                }}
              />
            </label>
            {uploadFiles.length > 0 && (
              <>
                <span
                  className="text-xs text-gray-700 truncate min-w-0 max-w-[10rem] sm:max-w-[18rem] font-medium"
                  title={uploadFiles.map((f) => f.name).join("\n")}
                >
                  {uploadFiles.length === 1
                    ? uploadFiles[0].name
                    : `${uploadFiles.length} archivos seleccionados`}
                </span>
                <button
                  type="submit"
                  disabled={importLoading}
                  className="shrink-0 rounded-lg bg-zm-green px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zm-green-dark focus-visible:outline focus-visible:ring-2 focus-visible:ring-zm-green/45 disabled:opacity-50"
                >
                  {importLoading ? "Importando…" : "Importar"}
                </button>
              </>
            )}
          </form>
          {importError && (
            <p className="text-sm text-zm-red" role="alert">
              {importError}
            </p>
          )}
          {importOk && (
            <p className="text-sm text-zm-green-dark font-medium">{importOk}</p>
          )}

          <div className="flex flex-col gap-3 border-t border-zm-green/15 pt-3 lg:flex-row lg:items-end lg:justify-between lg:gap-4 min-w-0">
            <div className="relative min-w-0 flex-1 lg:max-w-md">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden
                strokeWidth={2.25}
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por REF, nombre, categoría, código de barras…"
                className="w-full rounded-lg border border-zm-green/25 bg-zm-cream/30 py-2 pl-9 pr-3 text-sm text-zm-sidebar placeholder:text-gray-500 focus:border-zm-green/50 focus:outline-none focus:ring-2 focus:ring-zm-green/30"
                aria-label="Buscar artículos"
              />
            </div>
            <div className="flex flex-wrap items-end justify-start gap-3 sm:gap-4 lg:ml-auto lg:justify-end shrink-0">
              <div className="flex min-w-0 flex-col gap-0.5">
                <label
                  htmlFor="zm-articles-filter-category"
                  className="text-[10px] font-semibold uppercase tracking-wide text-gray-500"
                >
                  Categoría
                </label>
                <select
                  id="zm-articles-filter-category"
                  className={selectClass}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">Todos los artículos</option>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <label
                  htmlFor="zm-articles-filter-alert"
                  className="text-[10px] font-semibold uppercase tracking-wide text-gray-500"
                >
                  Alerta de inventario
                </label>
                <select
                  id="zm-articles-filter-alert"
                  className={selectClass}
                  value={inventoryAlertFilter}
                  onChange={(e) => setInventoryAlertFilter(e.target.value)}
                >
                  <option value={INVENTORY_ALERT_ALL}>
                    Todos los artículos
                  </option>
                  <option value={INVENTORY_ALERT_LOW}>Inventario bajo</option>
                  <option value={INVENTORY_ALERT_UNAVAILABLE}>
                    No disponible en inventario
                  </option>
                </select>
              </div>
              <button
                type="button"
                onClick={exportCsv}
                disabled={loading || filtered.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zm-green/40 bg-white px-3 py-2 text-xs font-semibold text-zm-green shadow-sm hover:bg-zm-green/5 disabled:pointer-events-none disabled:opacity-50 lg:mb-px"
              >
                <Download
                  className="h-4 w-4 shrink-0"
                  aria-hidden
                  strokeWidth={2.25}
                />
                Exportar CSV
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-zm-red" role="alert">
              {error}
            </p>
          )}
          {loading && (
            <p className="text-sm text-gray-600">Cargando artículos…</p>
          )}
          {!loading && !error && items.length === 0 && (
            <p className="text-sm text-gray-600">
              Aún no hay datos. Sube el archivo «Artículos» exportado desde
              Loyverse Back Office (CSV o Excel) con el botón de arriba.
            </p>
          )}
          {!loading && items.length > 0 && filtered.length === 0 && (
            <p className="text-sm text-gray-600">
              Ningún artículo coincide con la búsqueda o los filtros seleccionados.
            </p>
          )}

          {!loading && filtered.length > 0 && (
            <div className="max-h-[min(65vh,36rem)] sm:max-h-[min(70vh,42rem)] w-full overflow-y-auto overflow-x-auto rounded-lg border border-zm-green/15 bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[1000px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 border-b border-zm-green/25 bg-zm-cream text-left text-zm-sidebar [&_th]:bg-zm-cream">
                  <tr>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">
                      REF
                    </th>
                    <th className="px-3 py-2 font-semibold">Nombre</th>
                    <th className="px-3 py-2 font-semibold">Categoría</th>
                    <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">
                      Por peso
                    </th>
                    <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                      Precio venta
                    </th>
                    <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                      Coste
                    </th>
                    <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                      Inventario
                    </th>
                    <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                      Exist. bajas
                    </th>
                    <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                      Stock óptimo
                    </th>
                    <th className="px-3 py-2 font-semibold">Código barras</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const rowHighlight =
                      highlightLastImportId != null &&
                      p.last_import_id != null &&
                      Number(p.last_import_id) ===
                        Number(highlightLastImportId);
                    return (
                    <tr
                      key={p.handle}
                      className={`border-t border-gray-100 hover:bg-gray-50 ${
                        rowHighlight
                          ? "border-zm-green/10 bg-zm-yellow/30 hover:bg-zm-yellow/40"
                          : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                        {p.ref || "—"}
                      </td>
                      <td className="max-w-[16rem] px-3 py-2 sm:max-w-md">
                        <span
                          className="line-clamp-2 font-medium text-gray-900"
                          title={p.name}
                        >
                          {p.name || "—"}
                        </span>
                      </td>
                      <td className="max-w-[10rem] overflow-hidden px-3 py-2 text-gray-700">
                        <span className="truncate block" title={p.category || ""}>
                          {p.category || "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-center text-gray-900 tabular-nums">
                        {p.sold_by_weight === true ? "Sí" : "No"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-900">
                        {formatPrice(p.price)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-900">
                        {formatPrice(p.purchase_cost)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-900">
                        {formatQty(p.quantity_on_hand)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-900">
                        {formatQty(p.low_stock_threshold)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-900">
                        {formatQty(p.optimal_stock)}
                      </td>
                      <td className="max-w-[11rem] min-w-0 overflow-hidden px-3 py-2 text-sm text-gray-800">
                        <span
                          className="truncate block font-mono"
                          title={p.barcode || ""}
                        >
                          {p.barcode || "—"}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </section>
        )}
      </div>
    </div>
  );
}
