import { useCallback, useState } from "react";
import { Navigate, useSearchParams, useLocation } from "react-router-dom";
import {
  LoyverseResumenVentas,
  LoyverseVentasPorArticulo,
  LoyverseVentasPorPago,
} from "./LoyverseVentasTablas.jsx";
import ZmPurchaseOrders from "./ZmPurchaseOrders.jsx";

const LOYVERSE_HIGHLIGHT_BATCH_STORAGE_KEY = "zm-loyverse-import-highlight-batch";
const ZM_PO_HIGHLIGHT_BATCH_STORAGE_KEY = "zm-purchase-orders-highlight-batch";

function readStoredHighlightBatchId() {
  try {
    const raw = sessionStorage.getItem(LOYVERSE_HIGHLIGHT_BATCH_STORAGE_KEY);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function readStoredPoHighlightBatchId() {
  try {
    const raw = sessionStorage.getItem(ZM_PO_HIGHLIGHT_BATCH_STORAGE_KEY);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function mainTabFromSearch(searchParams) {
  return searchParams.get("tab") === "compras" ? "compras" : "ventas";
}

function ventasSubFromSearch(searchParams) {
  const s = searchParams.get("ventasSub");
  if (s === "resumen") return "resumen";
  if (s === "pago") return "pago";
  if (s === "articulos") return "articulos";
  return "resumen";
}

export default function LoyverseImport() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const mainTab = mainTabFromSearch(searchParams);
  const ventasSub = ventasSubFromSearch(searchParams);

  const [highlightBatchId, setHighlightBatchIdState] = useState(() =>
    readStoredHighlightBatchId()
  );

  const [poHighlightBatchId, setPoHighlightBatchIdState] = useState(() =>
    readStoredPoHighlightBatchId()
  );

  const setHighlightBatchId = useCallback((next) => {
    setHighlightBatchIdState(next);
    try {
      if (next == null || next === "") {
        sessionStorage.removeItem(LOYVERSE_HIGHLIGHT_BATCH_STORAGE_KEY);
      } else {
        sessionStorage.setItem(
          LOYVERSE_HIGHLIGHT_BATCH_STORAGE_KEY,
          String(next)
        );
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setPoHighlightBatchId = useCallback((next) => {
    setPoHighlightBatchIdState(next);
    try {
      if (next == null || next === "") {
        sessionStorage.removeItem(ZM_PO_HIGHLIGHT_BATCH_STORAGE_KEY);
      } else {
        sessionStorage.setItem(
          ZM_PO_HIGHLIGHT_BATCH_STORAGE_KEY,
          String(next)
        );
      }
    } catch {
      /* ignore */
    }
  }, []);

  const isZonaMarketAdmin = location.pathname.startsWith("/zonamarket/admin");

  if (searchParams.get("ventasSub") === "cargar") {
    return (
      <Navigate
        to={`${location.pathname}?tab=ventas&ventasSub=resumen`}
        replace
      />
    );
  }

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
                {ventasSubBtn("articulos", "Ventas por artículo")}
              </div>
            </div>
          )}
        </>
      )}

      {mainTab === "ventas" && ventasSub === "resumen" && (
        <LoyverseResumenVentas
          highlightBatchId={highlightBatchId}
          onHighlightBatchIdChange={setHighlightBatchId}
        />
      )}

      {mainTab === "ventas" && ventasSub === "pago" && (
        <LoyverseVentasPorPago
          highlightBatchId={highlightBatchId}
          onHighlightBatchIdChange={setHighlightBatchId}
        />
      )}

      {mainTab === "ventas" && ventasSub === "articulos" && (
        <LoyverseVentasPorArticulo
          highlightBatchId={highlightBatchId}
          onHighlightBatchIdChange={setHighlightBatchId}
        />
      )}

      {mainTab === "compras" && (
        <ZmPurchaseOrders
          highlightBatchId={poHighlightBatchId}
          onHighlightBatchIdChange={setPoHighlightBatchId}
        />
      )}
    </div>
  );
}
