import { useCallback, useEffect, useState } from "react";
import { fetchZmLoyverseItemCategories } from "../../../api/zonamarket/zmLoyverseItemsApi.js";

export default function ZonaMarketArticleCategories() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchZmLoyverseItemCategories();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load ZM Loyverse categories", e);
      setError(
        e?.message ||
          "No se pudieron cargar las categorías. Comprueba la API o la migración SQL."
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="w-full font-zm">
      <div className="flex items-center bg-zm-green px-4 sm:px-6 py-3 text-white shadow-sm rounded-b-xl">
        <h1 className="text-sm sm:text-base font-semibold tracking-tight">
          Categorías
        </h1>
      </div>

      <div className="w-full max-w-7xl px-4 sm:px-6 pb-8 pt-3">
        <section className="rounded-xl border border-zm-green/20 bg-white p-3 sm:p-4 shadow-sm">
          <p className="mb-4 text-sm text-gray-600">
            Categorías deducidas del último import Loyverse (columna «Categoría»
            del export de artículos). No están enlazadas con la taxonomía de la
            tienda Tivana.
          </p>

          {error && (
            <p className="mb-3 text-sm text-zm-red" role="alert">
              {error}
            </p>
          )}
          {loading && (
            <p className="text-sm text-gray-600">Cargando…</p>
          )}
          {!loading && !error && rows.length === 0 && (
            <p className="text-sm text-gray-600">
              No hay categorías hasta que importes al menos un reporte de
              artículos en{" "}
              <strong className="font-medium text-zm-sidebar">
                Lista de artículos
              </strong>
              .
            </p>
          )}

          {!loading && rows.length > 0 && (
            <div className="max-h-[min(50vh,28rem)] w-full overflow-y-auto overflow-x-auto rounded-lg border border-zm-green/15 bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[480px] border-collapse text-xs sm:text-sm">
                <thead className="sticky top-0 z-10 border-b border-zm-green/25 bg-zm-cream text-left text-zm-sidebar [&_th]:bg-zm-cream">
                  <tr>
                    <th className="border-b border-zm-green/20 px-2 py-2 font-semibold sm:px-3">
                      Categoría (Loyverse)
                    </th>
                    <th className="border-b border-zm-green/20 px-2 py-2 font-semibold sm:px-3 text-right">
                      Artículos
                    </th>
                  </tr>
                </thead>
                <tbody className="text-gray-800">
                  {rows.map((r) => (
                    <tr
                      key={r.category}
                      className="border-b border-gray-100 hover:bg-zm-cream/40"
                    >
                      <td className="px-2 py-2 sm:px-3">
                        <span className="font-medium text-zm-sidebar">
                          {r.category}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums sm:px-3">
                        {r.item_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-zm-green/10 border-t-2 border-zm-green/25 text-zm-sidebar">
                    <td className="px-2 py-2 font-semibold sm:px-3">Total</td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums sm:px-3">
                      {rows.reduce((a, r) => a + (r.item_count || 0), 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
