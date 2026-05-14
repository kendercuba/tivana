import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Building2,
  Home,
  LayoutDashboard,
  PieChart,
  ShoppingBasket,
  Store,
  Wallet,
  Link2,
} from "lucide-react";
import { useReportingGaps } from "../../hooks/admin/finance/useReportingGaps.js";
import ZmAdminReportingBellPanel, {
  ReportingGapNumberBadge,
} from "./ZmAdminReportingBellPanel.jsx";

const ZM_FINANCE_BASE = "/zonamarket/admin/finance";
const ZM_GASTOS_PATH = `${ZM_FINANCE_BASE}/gastos`;
const ZM_CONCILIACION_PATH = `${ZM_FINANCE_BASE}/conciliacion`;
const LOYVERSE_PATH = `${ZM_FINANCE_BASE}/loyverse`;
const ZM_ARTICLES_BASE = "/zonamarket/admin/articles";
const ARTICLES_LIST_PATH = `${ZM_ARTICLES_BASE}/list`;
const ARTICLES_CATEGORIES_PATH = `${ZM_ARTICLES_BASE}/categories`;

const LS_LOYVERSE_EXPANDED = "zm-admin-loyverse-expanded";
const LS_ARTICLES_EXPANDED = "zm-admin-articles-expanded";

function readLoyverseExpandedFromStorage() {
  try {
    const v = localStorage.getItem(LS_LOYVERSE_EXPANDED);
    if (v === "false") return false;
    if (v === "true") return true;
  } catch {
    /* ignore */
  }
  return true;
}

function readArticlesExpandedFromStorage() {
  try {
    const v = localStorage.getItem(LS_ARTICLES_EXPANDED);
    if (v === "false") return false;
    if (v === "true") return true;
  } catch {
    /* ignore */
  }
  return true;
}

function loyverseQs(tab, ventasSub) {
  const q = new URLSearchParams();
  q.set("tab", tab);
  if (ventasSub != null && ventasSub !== "") q.set("ventasSub", ventasSub);
  return `?${q.toString()}`;
}

function financeNavClass({ isActive }) {
  return [
    "block rounded-lg px-2 py-2 text-base transition-colors",
    isActive
      ? "font-semibold text-white bg-zm-red/35 ring-1 ring-zm-yellow/50"
      : "font-medium text-white/95 hover:bg-white/10 hover:text-white",
  ].join(" ");
}

const BANK_CUENTAS_SECTION = `${ZM_FINANCE_BASE}/cuentas`;

/** Solo hub de cuentas (Loyverse va aparte, mismo nivel en el menú). */
function isUnderZmBanking(pathname) {
  return pathname === BANK_CUENTAS_SECTION;
}

/** Lucide icons on dark sidebar: distinct tints + shared size. */
const NAV_ICON_LG = "h-5 w-5 shrink-0 stroke-[2.25]";
const NAV_ICON_RAIL = "h-6 w-6 shrink-0 stroke-[2.25]";

const STORE_LINKS = [
  {
    to: "/zonamarket",
    label: "Zona Market",
    icon: Home,
    end: true,
    iconClass: "text-sky-300",
  },
];

function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

/** Misma base visual que filas con caret + icono (Cuentas bancarias / Loyverse). */
function financePanelNavClass({ isActive }) {
  return cn(
    "flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-base transition-colors",
    isActive
      ? "font-semibold text-white bg-zm-red/35 ring-1 ring-zm-yellow/50"
      : "font-medium text-white/95 hover:bg-white/10 hover:text-white"
  );
}

export default function ZonaMarketAdminLayout() {
  const location = useLocation();
  const isUnderBanking = isUnderZmBanking(location.pathname);
  const [bankingOpen, setBankingOpen] = useState(isUnderBanking);
  const [financeFlyoutOpen, setFinanceFlyoutOpen] = useState(false);

  const onLoyverseRoute = location.pathname === LOYVERSE_PATH;
  const lv = new URLSearchParams(location.search);
  const lvTab = lv.get("tab") === "compras" ? "compras" : "ventas";
  const lvVentasSub = (() => {
    const s = lv.get("ventasSub");
    if (s === "pago") return "pago";
    if (s === "articulos") return "articulos";
    return "resumen";
  })();

  const isUnderLoyverseVentasTabs =
    onLoyverseRoute &&
    lvTab === "ventas" &&
    (lvVentasSub === "resumen" ||
      lvVentasSub === "pago" ||
      lvVentasSub === "articulos");
  const [loyverseVentasOpen, setLoyverseVentasOpen] = useState(
    isUnderLoyverseVentasTabs
  );

  const isUnderLoyverseComprasTab =
    onLoyverseRoute && lvTab === "compras";
  const [loyverseComprasOpen, setLoyverseComprasOpen] = useState(
    isUnderLoyverseComprasTab
  );

  /** Abrir/cerrar Loyverse; se guarda en localStorage entre visitas y clics. */
  const [loyverseRootOpen, setLoyverseRootOpen] = useState(
    readLoyverseExpandedFromStorage
  );

  const isUnderArticles = location.pathname.startsWith(ZM_ARTICLES_BASE);

  const [articlesRootOpen, setArticlesRootOpen] = useState(
    readArticlesExpandedFromStorage
  );

  useEffect(() => {
    try {
      localStorage.setItem(LS_LOYVERSE_EXPANDED, String(loyverseRootOpen));
    } catch {
      /* ignore */
    }
  }, [loyverseRootOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_ARTICLES_EXPANDED, String(articlesRootOpen));
    } catch {
      /* ignore */
    }
  }, [articlesRootOpen]);

  useEffect(() => {
    if (!isUnderLoyverseVentasTabs) setLoyverseVentasOpen(false);
  }, [isUnderLoyverseVentasTabs]);

  useEffect(() => {
    if (!isUnderLoyverseComprasTab) setLoyverseComprasOpen(false);
  }, [isUnderLoyverseComprasTab]);

  const loyverseVentasExpanded =
    isUnderLoyverseVentasTabs || loyverseVentasOpen;
  const loyverseComprasExpanded =
    isUnderLoyverseComprasTab || loyverseComprasOpen;

  function loyverseItemClass(active) {
    return financeNavClass({ isActive: active });
  }

  useEffect(() => {
    if (!isUnderBanking) setBankingOpen(false);
  }, [location.pathname, isUnderBanking]);

  useEffect(() => {
    setFinanceFlyoutOpen(false);
  }, [location.pathname]);

  const bankingExpanded = isUnderBanking || bankingOpen;
  const isFinanceRoute = location.pathname.startsWith(ZM_FINANCE_BASE);
  const isAdminMenuRoute = isFinanceRoute || isUnderArticles;

  const {
    yesterdayYmd,
    loading: gapsLoading,
    error: gapsError,
    refresh: refreshGaps,
    bellAlertCount,
    loyverseResumenMissing,
    loyversePagoMissing,
    bankAccountsWithGaps,
    bankMenuMaxMissing,
  } = useReportingGaps();

  const loyverseResumenTo = useMemo(
    () => `${LOYVERSE_PATH}${loyverseQs("ventas", "resumen")}`,
    []
  );
  const loyversePagoTo = useMemo(
    () => `${LOYVERSE_PATH}${loyverseQs("ventas", "pago")}`,
    []
  );

  const reportingBellSharedProps = {
    yesterdayYmd,
    loading: gapsLoading,
    error: gapsError,
    onRefresh: refreshGaps,
    bellAlertCount,
    loyverseResumenMissing,
    loyversePagoMissing,
    bankAccountsWithGaps,
    bankMenuMaxMissing,
    loyverseResumenTo,
    loyversePagoTo,
    bankCuentasTo: BANK_CUENTAS_SECTION,
  };

  function toggleBanking() {
    setBankingOpen((prev) => !prev);
  }

  const railLinkClass = ({ isActive }) =>
    cn(
      "group flex items-center justify-center gap-3 rounded-xl p-2.5 text-base font-semibold tracking-tight transition-colors lg:w-full lg:justify-start lg:px-3",
      isActive
        ? "bg-white/10 text-white shadow-inner ring-2 ring-zm-yellow/90"
        : "text-white/95 hover:bg-white/10 hover:text-white"
    );

  return (
    <div className="font-zm flex min-h-screen bg-zm-cream">
      <aside
        className={cn(
          "zm-admin-aside fixed inset-y-0 left-0 z-40 flex min-h-0 w-[3.75rem] flex-col border-r border-white/15 bg-zm-sidebar text-white shadow-lg shadow-black/25",
          "lg:static lg:z-0 lg:min-h-screen lg:w-64 lg:shrink-0 lg:self-stretch lg:p-5 lg:space-y-4"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-zm-green/40 px-2 lg:h-auto lg:border-0 lg:px-0">
          <Link
            to="/zonamarket/admin"
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg p-1 font-bold text-white hover:opacity-95 lg:flex-row lg:items-center lg:justify-start lg:p-0"
            title="Zona Market Admin"
          >
            <span className="flex h-9 w-9 flex-col overflow-hidden rounded-lg shadow-md ring-1 ring-white/25 lg:hidden">
              <span className="flex flex-1 items-center justify-center bg-zm-red text-[10px] font-bold leading-none">
                Z
              </span>
              <span className="flex flex-1 items-center justify-center bg-zm-green text-[10px] font-bold leading-none">
                M
              </span>
            </span>
            <img
              src="/branding/zonamarket-wordmark.svg?v=4"
              alt="Zona Market"
              className="hidden h-12 w-auto max-w-[220px] object-contain object-left lg:block"
              width={220}
              height={54}
              decoding="async"
            />
          </Link>
          <div className="hidden shrink-0 lg:block">
            <ZmAdminReportingBellPanel {...reportingBellSharedProps} variant="sidebar" />
          </div>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2 lg:gap-2 lg:overflow-visible lg:p-0">
          {STORE_LINKS.map(({ to, label, icon: Icon, end, iconClass }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={railLinkClass}
              title={label}
            >
              <Icon
                className={cn(NAV_ICON_RAIL, iconClass)}
                aria-hidden
              />
              <span className="hidden lg:inline drop-shadow-sm">{label}</span>
            </NavLink>
          ))}

          <div className="hidden lg:block">
            <button
              type="button"
              onClick={() => setArticlesRootOpen((o) => !o)}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-left text-base font-semibold tracking-tight hover:bg-white/10",
                isUnderArticles ? "text-white" : "text-white/95"
              )}
              aria-expanded={articlesRootOpen}
              aria-controls="zm-articulos-submenu"
            >
              <span
                className="inline-block w-4 text-center text-[10px] text-zm-yellow"
                aria-hidden
              >
                {articlesRootOpen ? "▾" : "▸"}
              </span>
              <ShoppingBasket
                className={cn(NAV_ICON_LG, "text-fuchsia-300")}
                aria-hidden
              />
              <span className="drop-shadow-sm">Artículos</span>
            </button>
            {articlesRootOpen && (
              <ul
                id="zm-articulos-submenu"
                className="mt-1 ml-2 flex flex-col gap-0.5 border-l border-zm-yellow/35 pl-3"
              >
                <li>
                  <NavLink
                    to={ARTICLES_LIST_PATH}
                    className={financeNavClass}
                  >
                    Lista de artículos
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to={ARTICLES_CATEGORIES_PATH}
                    className={financeNavClass}
                  >
                    Categorías
                  </NavLink>
                </li>
              </ul>
            )}
          </div>

          <div className="mt-auto border-t border-zm-green/40 pt-2 lg:mt-0 lg:border-0 lg:pt-0">
            <button
              type="button"
              onClick={() => setFinanceFlyoutOpen(true)}
              className={cn(
                "flex w-full items-center justify-center rounded-xl p-2.5 text-white/90 hover:bg-white/10 hover:text-white lg:hidden",
                isAdminMenuRoute &&
                  "bg-zm-red/40 text-white ring-2 ring-zm-yellow/80"
              )}
              title="Menú admin"
              aria-expanded={financeFlyoutOpen}
            >
              <PieChart
                className={cn(NAV_ICON_RAIL, "text-rose-300")}
                aria-hidden
              />
            </button>

            <div className="hidden lg:block">
              <NavLink
                to={`${ZM_FINANCE_BASE}/dashboard`}
                className={financePanelNavClass}
                end
              >
                <span
                  className="inline-block w-4 shrink-0 text-center text-[10px] text-transparent select-none"
                  aria-hidden
                >
                  ▸
                </span>
                <LayoutDashboard
                  className={cn(NAV_ICON_LG, "text-lime-300")}
                  aria-hidden
                />
                <span className="drop-shadow-sm">Resumen semanal</span>
              </NavLink>

              <NavLink to={ZM_GASTOS_PATH} className={financePanelNavClass}>
                <span
                  className="inline-block w-4 shrink-0 text-center text-[10px] text-transparent select-none"
                  aria-hidden
                >
                  ▸
                </span>
                <Wallet
                  className={cn(NAV_ICON_LG, "text-emerald-300")}
                  aria-hidden
                />
                <span className="drop-shadow-sm">Gastos</span>
              </NavLink>

              <NavLink to={ZM_CONCILIACION_PATH} className={financePanelNavClass}>
                <span
                  className="inline-block w-4 shrink-0 text-center text-[10px] text-transparent select-none"
                  aria-hidden
                >
                  ▸
                </span>
                <Link2
                  className={cn(NAV_ICON_LG, "text-sky-300")}
                  aria-hidden
                />
                <span className="drop-shadow-sm">Conciliación</span>
              </NavLink>

              <div className="mt-1">
                <button
                  type="button"
                  onClick={toggleBanking}
                  className={cn(
                    "flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-left text-base font-semibold tracking-tight hover:bg-white/10",
                    isUnderBanking ? "text-white" : "text-white/95"
                  )}
                  aria-expanded={bankingExpanded}
                  aria-controls="zm-finanzas-cuentas-submenu"
                >
                  <span
                    className="inline-block w-4 text-center text-[10px] text-zm-yellow"
                    aria-hidden
                  >
                    {bankingExpanded ? "▾" : "▸"}
                  </span>
                  <Building2
                    className={cn(NAV_ICON_LG, "text-amber-300")}
                    aria-hidden
                  />
                  <span className="drop-shadow-sm">Cuentas bancarias</span>
                </button>

                {bankingExpanded && (
                  <ul
                    id="zm-finanzas-cuentas-submenu"
                    className="mt-1 ml-2 flex flex-col gap-0.5 border-l border-zm-yellow/35 pl-3"
                  >
                    <li>
                      <NavLink
                        to={BANK_CUENTAS_SECTION}
                        className={(p) =>
                          cn(financeNavClass(p), "flex items-center justify-between gap-2")
                        }
                      >
                        <span>Cuentas</span>
                        <ReportingGapNumberBadge value={bankMenuMaxMissing} />
                      </NavLink>
                    </li>
                  </ul>
                )}
              </div>

              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setLoyverseRootOpen((o) => !o)}
                  className={cn(
                    "flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-left text-base font-semibold tracking-tight hover:bg-white/10",
                    onLoyverseRoute ? "text-white" : "text-white/95"
                  )}
                  aria-expanded={loyverseRootOpen}
                  aria-controls="zm-loyverse-root-submenu"
                >
                  <span
                    className="inline-block w-4 text-center text-[10px] text-zm-yellow"
                    aria-hidden
                  >
                    {loyverseRootOpen ? "▾" : "▸"}
                  </span>
                  <Store
                    className={cn(NAV_ICON_LG, "text-violet-300")}
                    aria-hidden
                  />
                  <span className="drop-shadow-sm">Loyverse</span>
                </button>

                {loyverseRootOpen && (
                <ul
                  id="zm-loyverse-root-submenu"
                  className="mt-1 ml-2 flex flex-col gap-0.5 border-l border-zm-yellow/35 pl-3"
                >
                    <li>
                      <button
                        type="button"
                        onClick={() => setLoyverseVentasOpen((o) => !o)}
                        className={cn(
                          "flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-base font-semibold tracking-tight hover:bg-white/10",
                          isUnderLoyverseVentasTabs
                            ? "text-white"
                            : "text-white/95"
                        )}
                        aria-expanded={loyverseVentasExpanded}
                        aria-controls="zm-loyverse-ventas-nested"
                      >
                        <span
                          className="inline-block w-4 text-center text-[10px] text-zm-yellow"
                          aria-hidden
                        >
                          {loyverseVentasExpanded ? "▾" : "▸"}
                        </span>
                        Ventas
                      </button>
                      {loyverseVentasExpanded && (
                        <ul
                          id="zm-loyverse-ventas-nested"
                          className="mt-0.5 ml-3 flex flex-col gap-0.5 border-l border-white/20 pl-2"
                        >
                          <li>
                            <Link
                              to={loyverseResumenTo}
                              className={cn(
                                loyverseItemClass(
                                  onLoyverseRoute &&
                                    lvTab === "ventas" &&
                                    lvVentasSub === "resumen"
                                ),
                                "flex items-center justify-between gap-2"
                              )}
                            >
                              <span className="min-w-0">Resumen de ventas</span>
                              <ReportingGapNumberBadge value={loyverseResumenMissing} />
                            </Link>
                          </li>
                          <li>
                            <Link
                              to={loyversePagoTo}
                              className={cn(
                                loyverseItemClass(
                                  onLoyverseRoute &&
                                    lvTab === "ventas" &&
                                    lvVentasSub === "pago"
                                ),
                                "flex items-center justify-between gap-2"
                              )}
                            >
                              <span className="min-w-0">Ventas por tipo de pago</span>
                              <ReportingGapNumberBadge value={loyversePagoMissing} />
                            </Link>
                          </li>
                          <li>
                            <Link
                              to={`${LOYVERSE_PATH}${loyverseQs("ventas", "articulos")}`}
                              className={loyverseItemClass(
                                onLoyverseRoute &&
                                  lvTab === "ventas" &&
                                  lvVentasSub === "articulos"
                              )}
                            >
                              Ventas por artículo
                            </Link>
                          </li>
                        </ul>
                      )}
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => setLoyverseComprasOpen((o) => !o)}
                        className={cn(
                          "flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-base font-semibold tracking-tight hover:bg-white/10",
                          isUnderLoyverseComprasTab
                            ? "text-white"
                            : "text-white/95"
                        )}
                        aria-expanded={loyverseComprasExpanded}
                        aria-controls="zm-loyverse-compras-nested"
                      >
                        <span
                          className="inline-block w-4 text-center text-[10px] text-zm-yellow"
                          aria-hidden
                        >
                          {loyverseComprasExpanded ? "▾" : "▸"}
                        </span>
                        Compras
                      </button>
                      {loyverseComprasExpanded && (
                        <ul
                          id="zm-loyverse-compras-nested"
                          className="mt-0.5 ml-3 flex flex-col gap-0.5 border-l border-white/20 pl-2"
                        >
                          <li>
                            <Link
                              to={`${LOYVERSE_PATH}${loyverseQs("compras", null)}`}
                              className={loyverseItemClass(
                                onLoyverseRoute && lvTab === "compras"
                              )}
                            >
                              Órdenes de compra
                            </Link>
                          </li>
                        </ul>
                      )}
                    </li>
                  </ul>
                )}
              </div>
            </div>
          </div>
        </nav>
      </aside>

      {financeFlyoutOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] lg:hidden"
            aria-label="Cerrar menú"
            onClick={() => setFinanceFlyoutOpen(false)}
          />
          <div
            className="zm-admin-aside fixed inset-y-0 left-[3.75rem] z-50 flex w-[min(18rem,calc(100vw-3.75rem))] flex-col border-r border-white/15 bg-zm-sidebar shadow-2xl lg:hidden"
            role="dialog"
            aria-label="Menú admin"
          >
            <div className="flex items-center justify-between border-b border-zm-green/40 px-4 py-3">
              <span className="text-base font-bold tracking-tight text-white drop-shadow-sm">
                Menú
              </span>
              <button
                type="button"
                onClick={() => setFinanceFlyoutOpen(false)}
                className="rounded-lg p-2 text-white/55 hover:bg-white/10 hover:text-white"
                aria-label="Cerrar"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              <p className="px-2 text-xs font-bold uppercase tracking-wider text-fuchsia-200">
                Artículos
              </p>
              <NavLink
                to={ARTICLES_LIST_PATH}
                className={(p) => cn(financeNavClass(p), "ml-3")}
                onClick={() => setFinanceFlyoutOpen(false)}
              >
                Lista de artículos
              </NavLink>
              <NavLink
                to={ARTICLES_CATEGORIES_PATH}
                className={(p) => cn(financeNavClass(p), "ml-3")}
                onClick={() => setFinanceFlyoutOpen(false)}
              >
                Categorías
              </NavLink>

              <NavLink
                to={`${ZM_FINANCE_BASE}/dashboard`}
                className={(p) => cn(financePanelNavClass(p), "mt-3")}
                end
                onClick={() => setFinanceFlyoutOpen(false)}
              >
                <span
                  className="inline-block w-4 shrink-0 text-center text-[10px] text-transparent select-none"
                  aria-hidden
                >
                  ▸
                </span>
                <LayoutDashboard
                  className={cn(NAV_ICON_LG, "text-lime-300")}
                  aria-hidden
                />
                <span className="drop-shadow-sm">Resumen semanal</span>
              </NavLink>

              <NavLink
                to={ZM_GASTOS_PATH}
                className={(p) => cn(financePanelNavClass(p), "mt-1")}
                onClick={() => setFinanceFlyoutOpen(false)}
              >
                <span
                  className="inline-block w-4 shrink-0 text-center text-[10px] text-transparent select-none"
                  aria-hidden
                >
                  ▸
                </span>
                <Wallet
                  className={cn(NAV_ICON_LG, "text-emerald-300")}
                  aria-hidden
                />
                <span className="drop-shadow-sm">Gastos</span>
              </NavLink>

              <NavLink
                to={ZM_CONCILIACION_PATH}
                className={(p) => cn(financePanelNavClass(p), "mt-1")}
                onClick={() => setFinanceFlyoutOpen(false)}
              >
                <span
                  className="inline-block w-4 shrink-0 text-center text-[10px] text-transparent select-none"
                  aria-hidden
                >
                  ▸
                </span>
                <Link2
                  className={cn(NAV_ICON_LG, "text-sky-300")}
                  aria-hidden
                />
                <span className="drop-shadow-sm">Conciliación</span>
              </NavLink>

              <p className="mt-3 px-2 text-xs font-bold uppercase tracking-wider text-amber-200">
                Cuentas bancarias
              </p>
              <NavLink
                to={BANK_CUENTAS_SECTION}
                className={(p) =>
                  cn(financeNavClass(p), "ml-3 flex items-center justify-between gap-2")
                }
                onClick={() => setFinanceFlyoutOpen(false)}
              >
                <span>Cuentas</span>
                <ReportingGapNumberBadge value={bankMenuMaxMissing} />
              </NavLink>

              <p className="mt-3 px-2 text-xs font-bold uppercase tracking-wider text-violet-200">
                Loyverse
              </p>
              <p className="mt-2 px-3 text-sm font-semibold text-white/80">
                Ventas
              </p>
              <Link
                to={loyverseResumenTo}
                className={cn(
                  loyverseItemClass(
                    onLoyverseRoute &&
                      lvTab === "ventas" &&
                      lvVentasSub === "resumen"
                  ),
                  "ml-3 flex items-center justify-between gap-2"
                )}
                onClick={() => setFinanceFlyoutOpen(false)}
              >
                <span className="min-w-0">Resumen de ventas</span>
                <ReportingGapNumberBadge value={loyverseResumenMissing} />
              </Link>
              <Link
                to={loyversePagoTo}
                className={cn(
                  loyverseItemClass(
                    onLoyverseRoute &&
                      lvTab === "ventas" &&
                      lvVentasSub === "pago"
                  ),
                  "ml-3 flex items-center justify-between gap-2"
                )}
                onClick={() => setFinanceFlyoutOpen(false)}
              >
                <span className="min-w-0">Ventas por tipo de pago</span>
                <ReportingGapNumberBadge value={loyversePagoMissing} />
              </Link>
              <Link
                to={`${LOYVERSE_PATH}${loyverseQs("ventas", "articulos")}`}
                className={cn(
                  loyverseItemClass(
                    onLoyverseRoute &&
                      lvTab === "ventas" &&
                      lvVentasSub === "articulos"
                  ),
                  "ml-3 block"
                )}
                onClick={() => setFinanceFlyoutOpen(false)}
              >
                Ventas por artículo
              </Link>
              <p className="mt-2 px-3 text-sm font-semibold text-white/80">
                Compras
              </p>
              <Link
                to={`${LOYVERSE_PATH}${loyverseQs("compras", null)}`}
                className={cn(
                  loyverseItemClass(
                    onLoyverseRoute && lvTab === "compras"
                  ),
                  "ml-3 block"
                )}
                onClick={() => setFinanceFlyoutOpen(false)}
              >
                Órdenes de compra
              </Link>
            </nav>
          </div>
        </>
      )}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col pl-[3.75rem] lg:pl-0">
        <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-zm-yellow/40 bg-white/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/85 lg:hidden">
          <span className="truncate text-sm font-bold text-zm-sidebar">
            Zona Market
          </span>
          <ZmAdminReportingBellPanel
            {...reportingBellSharedProps}
            variant="light"
            compact
          />
        </header>

        <main className="flex-1 bg-zm-cream px-3 py-4 sm:px-5 md:px-6 lg:px-8 lg:pt-4 lg:pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
