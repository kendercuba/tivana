import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Building2,
  Home,
  LayoutDashboard,
  PieChart,
  Store,
  Upload,
} from "lucide-react";

const ZM_FINANCE_BASE = "/zonamarket/admin/finance";
const LOYVERSE_PATH = `${ZM_FINANCE_BASE}/loyverse`;

const LS_LOYVERSE_EXPANDED = "zm-admin-loyverse-expanded";

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

function loyverseQs(tab, ventasSub) {
  const q = new URLSearchParams();
  q.set("tab", tab);
  if (ventasSub != null && ventasSub !== "") q.set("ventasSub", ventasSub);
  return `?${q.toString()}`;
}

function financeNavClass({ isActive }) {
  return [
    "block rounded-lg px-2 py-1.5 text-sm transition-colors",
    isActive
      ? "font-semibold text-white bg-zm-red/35 ring-1 ring-zm-yellow/50"
      : "text-white/90 hover:bg-white/10 hover:text-white",
  ].join(" ");
}

const BANK_CARGAR_EXCEL = `${ZM_FINANCE_BASE}/cargar-excel`;
const BANK_CUENTAS_SECTION = `${ZM_FINANCE_BASE}/cuentas`;
const BANK_CATEGORIAS = `${ZM_FINANCE_BASE}/categorias`;
const BANK_REGLAS = `${ZM_FINANCE_BASE}/reglas`;

const CUENTAS_NAV_PATHS = new Set([
  BANK_CUENTAS_SECTION,
  BANK_CATEGORIAS,
  BANK_REGLAS,
]);

/** Solo rutas de banco (Loyverse va aparte, mismo nivel en el menú). */
function isUnderZmBanking(pathname) {
  return (
    pathname === BANK_CARGAR_EXCEL ||
    CUENTAS_NAV_PATHS.has(pathname)
  );
}

const STORE_LINKS = [
  { to: "/zonamarket", label: "Zona Market", icon: Home, end: true },
];

function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

/** Misma base visual que filas con caret + icono (Cuentas bancarias / Loyverse). */
function financePanelNavClass({ isActive }) {
  return cn(
    "flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors",
    isActive
      ? "font-semibold text-white bg-zm-red/35 ring-1 ring-zm-yellow/50"
      : "text-white/90 hover:bg-white/10 hover:text-white"
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
    if (s === "cargar") return "cargar";
    if (s === "pago") return "pago";
    if (s === "resumen") return "resumen";
    return "resumen";
  })();

  const isUnderLoyverseVentasTabs =
    onLoyverseRoute &&
    lvTab === "ventas" &&
    (lvVentasSub === "resumen" || lvVentasSub === "pago");
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

  useEffect(() => {
    try {
      localStorage.setItem(LS_LOYVERSE_EXPANDED, String(loyverseRootOpen));
    } catch {
      /* ignore */
    }
  }, [loyverseRootOpen]);

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

  function toggleBanking() {
    setBankingOpen((prev) => !prev);
  }

  const railLinkClass = ({ isActive }) =>
    cn(
      "group flex items-center justify-center gap-3 rounded-xl p-2.5 text-sm font-medium transition-colors lg:w-full lg:justify-start lg:px-3",
      isActive
        ? "bg-white/10 text-white shadow-inner ring-2 ring-zm-yellow/90"
        : "text-white/90 hover:bg-white/10 hover:text-white"
    );

  return (
    <div className="font-zm flex min-h-screen bg-zm-cream">
      <aside
        className={cn(
          "zm-admin-aside fixed inset-y-0 left-0 z-40 flex min-h-0 w-[3.75rem] flex-col border-r border-white/15 bg-zm-sidebar text-white shadow-lg shadow-black/25",
          "lg:static lg:z-0 lg:min-h-screen lg:w-64 lg:shrink-0 lg:self-stretch lg:p-5 lg:space-y-4"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-center border-b border-zm-green/40 px-2 lg:h-auto lg:justify-start lg:border-0 lg:px-0">
          <Link
            to="/zonamarket/admin"
            className="flex flex-col items-center justify-center gap-1 rounded-lg p-1 font-bold text-white hover:opacity-95 lg:p-0"
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
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2 lg:gap-2 lg:overflow-visible lg:p-0">
          {STORE_LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={railLinkClass}
              title={label}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span className="hidden lg:inline">{label}</span>
            </NavLink>
          ))}

          <div className="mt-auto border-t border-zm-green/40 pt-2 lg:mt-0 lg:border-0 lg:pt-0">
            <button
              type="button"
              onClick={() => setFinanceFlyoutOpen(true)}
              className={cn(
                "flex w-full items-center justify-center rounded-xl p-2.5 text-white/90 hover:bg-white/10 hover:text-white lg:hidden",
                isFinanceRoute &&
                  "bg-zm-red/40 text-white ring-2 ring-zm-yellow/80"
              )}
              title="Menú admin"
              aria-expanded={financeFlyoutOpen}
            >
              <PieChart className="h-5 w-5 shrink-0" aria-hidden />
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
                  className="mr-1 h-4 w-4 shrink-0 opacity-80"
                  aria-hidden
                />
                <span>Panel finanzas</span>
              </NavLink>

              <div className="mt-1">
                <button
                  type="button"
                  onClick={toggleBanking}
                  className={cn(
                    "flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/10",
                    isUnderBanking ? "font-semibold text-white" : "text-white/85"
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
                  <Building2 className="mr-1 h-4 w-4 shrink-0 opacity-80" />
                  <span>Cuentas bancarias</span>
                </button>

                {bankingExpanded && (
                  <ul
                    id="zm-finanzas-cuentas-submenu"
                    className="mt-1 ml-2 flex flex-col gap-0.5 border-l border-zm-yellow/35 pl-3"
                  >
                    <li>
                      <NavLink to={BANK_CUENTAS_SECTION} className={financeNavClass}>
                        Cuentas
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to={BANK_CATEGORIAS} className={financeNavClass}>
                        Categorías
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to={BANK_REGLAS} className={financeNavClass}>
                        Reglas
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        to={BANK_CARGAR_EXCEL}
                        className={(p) =>
                          cn(financeNavClass(p), "flex items-center gap-2")
                        }
                      >
                        <Upload className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                        Cargar estado de cuenta
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
                    "flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/10",
                    onLoyverseRoute ? "font-semibold text-white" : "text-white/85"
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
                  <Store className="mr-1 h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  <span>Loyverse</span>
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
                          "flex w-full items-center gap-1 rounded-lg px-2 py-1 text-left text-sm hover:bg-white/10",
                          isUnderLoyverseVentasTabs
                            ? "font-semibold text-white"
                            : "text-white/85"
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
                              to={`${LOYVERSE_PATH}${loyverseQs("ventas", "resumen")}`}
                              className={loyverseItemClass(
                                onLoyverseRoute &&
                                  lvTab === "ventas" &&
                                  lvVentasSub === "resumen"
                              )}
                            >
                              Resumen de ventas
                            </Link>
                          </li>
                          <li>
                            <Link
                              to={`${LOYVERSE_PATH}${loyverseQs("ventas", "pago")}`}
                              className={loyverseItemClass(
                                onLoyverseRoute &&
                                  lvTab === "ventas" &&
                                  lvVentasSub === "pago"
                              )}
                            >
                              Ventas por tipo de pago
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
                          "flex w-full items-center gap-1 rounded-lg px-2 py-1 text-left text-sm hover:bg-white/10",
                          isUnderLoyverseComprasTab
                            ? "font-semibold text-white"
                            : "text-white/85"
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
                              Resumen de compras
                            </Link>
                          </li>
                        </ul>
                      )}
                    </li>
                    <li>
                      <Link
                        to={`${LOYVERSE_PATH}${loyverseQs("ventas", "cargar")}`}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                          onLoyverseRoute &&
                            lvTab === "ventas" &&
                            lvVentasSub === "cargar"
                            ? "font-semibold text-white bg-zm-red/35 ring-1 ring-zm-yellow/50"
                            : "text-white/90 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <Upload className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                        Cargar reporte Ventas
                      </Link>
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
              <span className="text-sm font-semibold text-white">Menú</span>
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
              <NavLink
                to={`${ZM_FINANCE_BASE}/dashboard`}
                className={financePanelNavClass}
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
                  className="mr-1 h-4 w-4 shrink-0 opacity-80"
                  aria-hidden
                />
                <span>Panel finanzas</span>
              </NavLink>

              <p className="mt-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-zm-yellow/95">
                Cuentas bancarias
              </p>
              <NavLink
                to={BANK_CUENTAS_SECTION}
                className={(p) => cn(financeNavClass(p), "ml-3")}
                onClick={() => setFinanceFlyoutOpen(false)}
              >
                Cuentas
              </NavLink>
              <NavLink
                to={BANK_CATEGORIAS}
                className={(p) => cn(financeNavClass(p), "ml-3")}
                onClick={() => setFinanceFlyoutOpen(false)}
              >
                Categorías
              </NavLink>
              <NavLink
                to={BANK_REGLAS}
                className={(p) => cn(financeNavClass(p), "ml-3")}
                onClick={() => setFinanceFlyoutOpen(false)}
              >
                Reglas
              </NavLink>
              <NavLink
                to={BANK_CARGAR_EXCEL}
                className={(p) =>
                  cn(financeNavClass(p), "ml-3 flex items-center gap-2")
                }
                onClick={() => setFinanceFlyoutOpen(false)}
              >
                <Upload className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                Cargar estado de cuenta
              </NavLink>

              <p className="mt-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-zm-yellow/95">
                Loyverse
              </p>
              <p className="mt-2 px-3 text-[11px] font-medium text-white/55">
                Ventas
              </p>
              <Link
                to={`${LOYVERSE_PATH}${loyverseQs("ventas", "resumen")}`}
                className={cn(
                  loyverseItemClass(
                    onLoyverseRoute &&
                      lvTab === "ventas" &&
                      lvVentasSub === "resumen"
                  ),
                  "ml-3 block"
                )}
                onClick={() => setFinanceFlyoutOpen(false)}
              >
                Resumen de ventas
              </Link>
              <Link
                to={`${LOYVERSE_PATH}${loyverseQs("ventas", "pago")}`}
                className={cn(
                  loyverseItemClass(
                    onLoyverseRoute &&
                      lvTab === "ventas" &&
                      lvVentasSub === "pago"
                  ),
                  "ml-3 block"
                )}
                onClick={() => setFinanceFlyoutOpen(false)}
              >
                Ventas por tipo de pago
              </Link>
              <p className="mt-2 px-3 text-[11px] font-medium text-white/55">
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
                Resumen de compras
              </Link>
              <Link
                to={`${LOYVERSE_PATH}${loyverseQs("ventas", "cargar")}`}
                className={cn(
                  financeNavClass({
                    isActive:
                      onLoyverseRoute &&
                      lvTab === "ventas" &&
                      lvVentasSub === "cargar",
                  }),
                  "flex items-center gap-2"
                )}
                onClick={() => setFinanceFlyoutOpen(false)}
              >
                <Upload className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                Cargar reporte Ventas
              </Link>
            </nav>
          </div>
        </>
      )}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col pl-[3.75rem] lg:pl-0">
        <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center border-b border-zm-yellow/40 bg-white/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/85 lg:hidden">
          <span className="truncate text-sm font-bold text-zm-sidebar">
            Zona Market
          </span>
        </header>

        <main className="flex-1 bg-zm-cream px-3 py-4 sm:px-5 md:px-6 lg:px-8 lg:pt-4 lg:pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
