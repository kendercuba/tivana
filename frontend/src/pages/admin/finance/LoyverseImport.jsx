import { useSearchParams, useLocation } from "react-router-dom";
import LoyverseVentasCargar from "./LoyverseVentasCargar.jsx";
import {
  LoyverseResumenVentas,
  LoyverseVentasPorPago,
} from "./LoyverseVentasTablas.jsx";

function mainTabFromSearch(searchParams) {
  return searchParams.get("tab") === "compras" ? "compras" : "ventas";
}

function ventasSubFromSearch(searchParams) {
  const s = searchParams.get("ventasSub");
  if (s === "cargar") return "cargar";
  if (s === "resumen") return "resumen";
  if (s === "pago") return "pago";
  return "resumen";
}

export default function LoyverseImport() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const mainTab = mainTabFromSearch(searchParams);
  const ventasSub = ventasSubFromSearch(searchParams);

  const isZonaMarketAdmin = location.pathname.startsWith("/zonamarket/admin");

  function setMainTab(next) {
    if (next === "compras") {
      setSearchParams({ tab: "compras" });
    } else {
      setSearchParams({
        tab: "ventas",
        ventasSub: searchParams.get("ventasSub") ?? "resumen",
      });
    }
  }

  function setVentasSub(sub) {
    setSearchParams({ tab: "ventas", ventasSub: sub });
  }

  const mainTabBtn = (key, label) => (
    <button
      type="button"
      onClick={() => setMainTab(key)}
      className={`px-6 py-2.5 text-sm font-semibold rounded-t-lg border border-b-0 -mb-px transition-colors ${
        mainTab === key
          ? "bg-white border-gray-200 text-gray-900 shadow-sm"
          : "bg-transparent border-transparent text-gray-500 hover:text-gray-800"
      }`}
    >
      {label}
    </button>
  );

  const ventasSubBtn = (sub, label) => (
    <button
      type="button"
      onClick={() => setVentasSub(sub)}
      className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
        ventasSub === sub
          ? "bg-white border-gray-300 text-gray-900 shadow-sm"
          : "bg-transparent border-transparent text-gray-600 hover:text-gray-900 hover:bg-white/60"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      {!isZonaMarketAdmin && (
        <>
          <div className="px-4 sm:px-6 lg:px-8 pt-2 pb-0 w-full max-w-[1600px]">
            <div className="flex flex-wrap gap-1 border-b border-gray-200">
              {mainTabBtn("ventas", "Ventas")}
              {mainTabBtn("compras", "Compras")}
            </div>
          </div>

          {mainTab === "ventas" && (
            <div className="border-b border-gray-200 bg-gray-100/90 px-4 sm:px-6 lg:px-8">
              <div className="w-full max-w-[1600px] flex flex-wrap gap-1.5 py-1.5">
                {ventasSubBtn("resumen", "Resumen de ventas")}
                {ventasSubBtn("pago", "Ventas por tipo de pago")}
                {ventasSubBtn("cargar", "Cargar excel")}
              </div>
            </div>
          )}
        </>
      )}

      {mainTab === "ventas" && ventasSub === "cargar" && <LoyverseVentasCargar />}

      {mainTab === "ventas" && ventasSub === "resumen" && (
        <LoyverseResumenVentas />
      )}

      {mainTab === "ventas" && ventasSub === "pago" && (
        <LoyverseVentasPorPago />
      )}

      {mainTab === "compras" && (
        <div className="px-4 pt-4 pb-8 max-w-4xl w-full">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800">Compras</h2>
            <p className="text-sm text-gray-500 mt-2">
              Esta sección está preparada para cuando importemos o consultemos
              compras relacionadas con Loyverse.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
