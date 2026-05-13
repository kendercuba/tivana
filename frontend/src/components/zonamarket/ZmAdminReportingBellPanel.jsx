import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, RefreshCw } from "lucide-react";

function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function ReportingGapNumberBadge({ value, className }) {
  if (value == null || value <= 0) return null;
  const label = value > 99 ? "99+" : String(value);
  return (
    <span
      className={cn(
        "inline-flex min-h-[1.125rem] min-w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white shadow-sm",
        className
      )}
      aria-hidden
    >
      {label}
    </span>
  );
}

function formatEsDate(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || "—";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("es-VE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function rowMessage(missing) {
  if (missing == null) {
    return "Aún no hay datos importados.";
  }
  if (missing <= 0) {
    return "Al día hasta ayer.";
  }
  return `Faltan ${missing} día${missing === 1 ? "" : "s"} de reporte hasta ayer.`;
}

export default function ZmAdminReportingBellPanel({
  yesterdayYmd,
  loading,
  error,
  onRefresh,
  bellAlertCount,
  loyverseResumenMissing,
  loyversePagoMissing,
  bankAccountsWithGaps,
  bankMenuMaxMissing,
  loyverseResumenTo,
  loyversePagoTo,
  bankCuentasTo,
  compact,
  variant = "sidebar",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const bellLabel =
    bellAlertCount > 0
      ? `Avisos de reportes: ${bellAlertCount} tema${bellAlertCount === 1 ? "" : "s"} pendiente${bellAlertCount === 1 ? "" : "s"}`
      : "Avisos de reportes";

  const bellBtnClass =
    variant === "light"
      ? "relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zm-green/35 bg-white text-zm-sidebar shadow-sm hover:bg-zm-cream/80 focus-visible:outline focus-visible:ring-2 focus-visible:ring-zm-green/40"
      : "relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/90 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:ring-2 focus-visible:ring-zm-yellow/70";

  return (
    <div className={cn("relative shrink-0", compact && "flex justify-end")} ref={rootRef}>
      <button
        type="button"
        className={bellBtnClass}
        aria-label={bellLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5 stroke-[2.25]" aria-hidden />
        {bellAlertCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white shadow">
            {bellAlertCount > 9 ? "9+" : bellAlertCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className={cn(
            "absolute z-[60] max-h-[min(70vh,24rem)] w-[min(22rem,calc(100vw-0.75rem))] overflow-y-auto rounded-xl border border-zm-green/20 bg-white py-2 text-sm text-gray-900 shadow-lg",
            compact || variant !== "sidebar"
              ? "right-0 top-full mt-2"
              : "left-full top-0 ml-2"
          )}
          role="dialog"
          aria-label="Panel de avisos de reportes"
        >
          <div className="flex items-center justify-between gap-2 border-b border-zm-green/15 px-3 pb-2">
            <span className="font-semibold text-zm-sidebar">Reportes</span>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-zm-green/35 px-2 py-1 text-xs font-semibold text-zm-green hover:bg-zm-green/5"
              onClick={() => onRefresh?.()}
              disabled={loading}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", loading && "animate-spin")}
                aria-hidden
              />
              Actualizar
            </button>
          </div>
          {error ? (
            <p className="px-3 py-2 text-sm text-zm-red">{error}</p>
          ) : null}

          <p className="sr-only">
            Referencia de cierre: {formatEsDate(yesterdayYmd)}.
          </p>

          <ul className="mt-1 space-y-1 px-2 pb-1">
            <li className="rounded-lg border border-transparent hover:bg-zm-cream/60">
              <Link
                to={loyverseResumenTo}
                className="flex flex-col gap-0.5 px-2 py-2"
                onClick={() => setOpen(false)}
              >
                <span className="flex items-center justify-between gap-2 font-semibold text-zm-sidebar">
                  Resumen de ventas
                  <ReportingGapNumberBadge value={loyverseResumenMissing} />
                </span>
                <span className="text-xs text-gray-600">
                  {loading && !error ? "Cargando…" : rowMessage(loyverseResumenMissing)}
                </span>
              </Link>
            </li>
            <li className="rounded-lg border border-transparent hover:bg-zm-cream/60">
              <Link
                to={loyversePagoTo}
                className="flex flex-col gap-0.5 px-2 py-2"
                onClick={() => setOpen(false)}
              >
                <span className="flex items-center justify-between gap-2 font-semibold text-zm-sidebar">
                  Ventas por tipo de pago
                  <ReportingGapNumberBadge value={loyversePagoMissing} />
                </span>
                <span className="text-xs text-gray-600">
                  {loading && !error ? "Cargando…" : rowMessage(loyversePagoMissing)}
                </span>
              </Link>
            </li>
            <li className="rounded-lg border border-transparent hover:bg-zm-cream/60">
              <Link
                to={bankCuentasTo}
                className="flex flex-col gap-1 px-2 py-2"
                onClick={() => setOpen(false)}
              >
                <span className="flex items-center justify-between gap-2 font-semibold text-zm-sidebar">
                  <span>Cuentas bancarias</span>
                  <ReportingGapNumberBadge value={bankMenuMaxMissing} />
                </span>
                {bankAccountsWithGaps.length === 0 ? (
                  <span className="text-xs text-gray-600">
                    {loading && !error ? "Cargando…" : "Sin cuentas activas."}
                  </span>
                ) : (
                  <ul className="space-y-1 border-t border-zm-green/10 pt-1">
                    {bankAccountsWithGaps.map((a) => (
                      <li
                        key={a.bankAccountId}
                        className="flex items-start justify-between gap-2 text-xs text-gray-700"
                      >
                        <span className="min-w-0 flex-1 truncate" title={a.bankAccountName}>
                          {a.bankAccountName}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          {a.maxMovementDate ? (
                            <span className="text-gray-500">
                              últ.: {formatEsDate(a.maxMovementDate)}
                            </span>
                          ) : (
                            <span className="text-gray-500">sin movimientos</span>
                          )}
                          <ReportingGapNumberBadge value={a.missingDays} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Link>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
