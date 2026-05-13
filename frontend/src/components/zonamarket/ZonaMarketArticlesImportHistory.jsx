import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  deleteZmLoyverseItemImport,
  fetchZmLoyverseItemImports,
} from "../../api/zonamarket/zmLoyverseItemsApi.js";

function formatImportDateTime(value) {
  if (value == null || value === "") return "—";
  try {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat("es-VE", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(d);
  } catch {
    return String(value);
  }
}

/**
 * @param {object} props
 * @param {number} [props.refreshToken]
 * @param {number|null} [props.highlightImportId] — last import id to highlight in the table
 * @param {() => void} [props.onDeleted]
 */
export default function ZonaMarketArticlesImportHistory({
  refreshToken = 0,
  highlightImportId = null,
  onDeleted,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchZmLoyverseItemImports({ limit: 100 });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "No se pudo cargar el historial.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  async function handleDelete(row) {
    const name = row.source_filename || `importación #${row.id}`;
    const msg =
      `¿Eliminar la carga «${name}» (#${row.id})? ` +
      "Se borrarán del catálogo los artículos que solo tenían esta importación como última actualización. No se puede deshacer.";
    if (!window.confirm(msg)) return;
    setDeletingId(row.id);
    try {
      await deleteZmLoyverseItemImport(row.id);
      await load();
      onDeleted?.();
    } catch (e) {
      window.alert(e?.message || "No se pudo eliminar.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="rounded-xl border border-zm-green/20 bg-white p-3 sm:p-4 shadow-sm space-y-3">
      {error && (
        <p className="text-sm text-zm-red" role="alert">
          {error}
        </p>
      )}
      {loading && (
        <p className="text-sm text-gray-600">Cargando historial…</p>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="text-sm text-gray-600">
          Aún no hay importaciones registradas.
        </p>
      )}

      {!loading && rows.length > 0 && (
        <div className="max-h-[min(65vh,36rem)] sm:max-h-[min(70vh,42rem)] w-full overflow-y-auto overflow-x-auto rounded-lg border border-zm-green/15 bg-white [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[720px] border-collapse text-xs sm:text-sm">
            <thead className="sticky top-0 z-10 border-b border-zm-green/25 bg-zm-cream text-left text-zm-sidebar [&_th]:bg-zm-cream">
              <tr>
                <th className="border-b border-zm-green/20 px-2 py-2 font-semibold sm:px-3">
                  ID
                </th>
                <th className="border-b border-zm-green/20 px-2 py-2 font-semibold sm:px-3">
                  Fecha
                </th>
                <th className="border-b border-zm-green/20 px-2 py-2 font-semibold sm:px-3">
                  Archivo
                </th>
                <th className="border-b border-zm-green/20 px-2 py-2 font-semibold sm:px-3 text-right">
                  Filas
                </th>
                <th className="border-b border-zm-green/20 px-2 py-2 font-semibold sm:px-3">
                  Tienda (cabecera)
                </th>
                <th className="border-b border-zm-green/20 px-2 py-2 font-semibold sm:px-3 text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              {rows.map((r) => {
                const isNewImport =
                  highlightImportId != null &&
                  Number(r.id) === Number(highlightImportId);
                return (
                <tr
                  key={r.id}
                  className={`border-b border-gray-100 hover:bg-zm-cream/40 ${
                    isNewImport
                      ? "border-zm-green/10 bg-zm-yellow/30 hover:bg-zm-yellow/40"
                      : ""
                  }`}
                >
                  <td className="whitespace-nowrap px-2 py-2 text-gray-600 sm:px-3">
                    {r.id}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 sm:px-3">
                    {formatImportDateTime(r.imported_at)}
                  </td>
                  <td className="max-w-[14rem] min-w-0 overflow-hidden px-2 py-2 sm:max-w-xs sm:px-3">
                    <span
                      className="truncate block font-medium text-zm-sidebar"
                      title={r.source_filename || ""}
                    >
                      {r.source_filename || "—"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums sm:px-3">
                    {r.row_count ?? "—"}
                  </td>
                  <td className="max-w-[10rem] overflow-hidden px-2 py-2 sm:px-3">
                    <span className="truncate block" title={r.store_suffix || ""}>
                      {r.store_suffix || "—"}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right sm:px-3">
                    <button
                      type="button"
                      onClick={() => void handleDelete(r)}
                      disabled={deletingId === r.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-zm-red/40 bg-white px-2.5 py-1.5 text-xs font-semibold text-zm-red hover:bg-zm-red/5 disabled:opacity-50"
                      aria-label={`Eliminar importación ${r.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden strokeWidth={2.25} />
                      Eliminar
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
