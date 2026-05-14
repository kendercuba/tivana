import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Building2,
  FolderTree,
  LayoutDashboard,
  Package,
  PieChart,
  Search,
  ShoppingCart,
  Store,
  Upload,
  Users,
  Wallet,
} from "lucide-react";

function financeNavClass({ isActive }) {
  return [
    "block rounded-lg px-2 py-1.5 text-sm hover:bg-gray-700/80",
    isActive ? "font-semibold text-white bg-gray-700/50" : "text-gray-300 hover:text-white",
  ].join(" ");
}

const BANKING_CHILDREN = [
  {
    to: "/admin/finance/cuentas?cuentasSub=gestionar",
    label: "Gestionar cuentas",
  },
  {
    to: "/admin/finance/cuentas?cuentasSub=movimientos",
    label: "Movimientos / importar",
  },
  {
    to: "/admin/finance/cuentas?cuentasSub=historial",
    label: "Historial de cargas",
  },
  {
    to: "/admin/finance/cuentas?cuentasSub=categorias",
    label: "Categorías",
  },
  { to: "/admin/finance/cuentas?cuentasSub=reglas", label: "Reglas" },
];

const MAIN_LINKS = [
  {
    to: "/admin",
    label: "Panel Administrativo",
    icon: LayoutDashboard,
    end: true,
  },
  { to: "/admin/users", label: "Usuarios", icon: Users },
  { to: "/admin/orders", label: "Órdenes", icon: ShoppingCart },
  { to: "/admin/search-logs", label: "Búsquedas", icon: Search },
  { to: "/admin/products", label: "Productos", icon: Package },
  { to: "/admin/categories", label: "Categorías", icon: FolderTree },
  { to: "/admin/products/import", label: "Cargar Productos", icon: Upload },
];

function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

export default function AdminLayout({ children }) {
  const location = useLocation();
  const isUnderBanking = location.pathname === "/admin/finance/cuentas";
  const [bankingOpen, setBankingOpen] = useState(isUnderBanking);
  const [financeFlyoutOpen, setFinanceFlyoutOpen] = useState(false);

  useEffect(() => {
    if (!isUnderBanking) setBankingOpen(false);
  }, [location.pathname, isUnderBanking]);

  useEffect(() => {
    setFinanceFlyoutOpen(false);
  }, [location.pathname]);

  const bankingExpanded = isUnderBanking || bankingOpen;
  const isFinanceRoute = location.pathname.startsWith("/admin/finance");

  function toggleBanking() {
    setBankingOpen((prev) => !prev);
  }

  const railLinkClass = ({ isActive }) =>
    cn(
      "group flex items-center justify-center gap-3 rounded-xl p-2.5 text-sm font-medium transition-colors lg:w-full lg:justify-start lg:px-3",
      isActive
        ? "bg-gray-800 text-white shadow-inner lg:bg-gray-800"
        : "text-gray-300 hover:bg-gray-800/90 hover:text-white"
    );

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Barra lateral: iconos finos en móvil/tablet; panel ancho en desktop */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[3.75rem] flex-col border-r border-gray-800 bg-gray-900 text-white",
          "lg:static lg:z-0 lg:w-64 lg:shrink-0 lg:p-6 lg:space-y-4"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-center border-b border-gray-800 px-2 lg:h-auto lg:justify-start lg:border-0 lg:px-0">
          <Link
            to="/admin"
            className="flex items-center justify-center rounded-lg p-1 font-bold text-white hover:bg-gray-800 lg:p-0"
            title="Tivana Admin"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-lg leading-none lg:hidden">
              T
            </span>
            <span className="hidden text-xl lg:inline">Tivana Admin</span>
          </Link>
        </div>

        {/* Navegación principal: solo iconos &lt; lg */}
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2 lg:gap-2 lg:overflow-visible lg:p-0">
          {MAIN_LINKS.map(({ to, label, icon: Icon, end }) => (
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

          {/* Finanzas: en móvil abre flyout; en desktop bloque expandido */}
          <div className="mt-auto border-t border-gray-800 pt-2 lg:mt-0 lg:border-0 lg:pt-0">
            <button
              type="button"
              onClick={() => setFinanceFlyoutOpen(true)}
              className={cn(
                "flex w-full items-center justify-center rounded-xl p-2.5 text-gray-300 hover:bg-gray-800/90 hover:text-white lg:hidden",
                isFinanceRoute && "bg-gray-800 text-white"
              )}
              title="Finanzas"
              aria-expanded={financeFlyoutOpen}
            >
              <PieChart className="h-5 w-5 shrink-0" aria-hidden />
            </button>

            <div className="hidden lg:block">
              <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">
                Finanzas
              </p>

              <NavLink
                to="/admin/finance/dashboard"
                className={financeNavClass}
                end
              >
                Panel finanzas
              </NavLink>

              <NavLink
                to="/admin/finance/gastos"
                className={cn(financeNavClass, "flex items-center gap-2")}
              >
                <Wallet className="h-4 w-4 shrink-0 opacity-80" />
                Gastos
              </NavLink>

              <div className="mt-1">
                <button
                  type="button"
                  onClick={toggleBanking}
                  className={cn(
                    "flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gray-800/80",
                    isUnderBanking ? "font-semibold text-white" : "text-gray-300"
                  )}
                  aria-expanded={bankingExpanded}
                  aria-controls="finanzas-cuentas-bancarias-submenu"
                >
                  <span
                    className="inline-block w-4 text-center text-[10px] text-gray-500"
                    aria-hidden
                  >
                    {bankingExpanded ? "▾" : "▸"}
                  </span>
                  <Building2 className="mr-1 h-4 w-4 shrink-0 opacity-80" />
                  <span>Cuentas bancarias</span>
                </button>

                {bankingExpanded && (
                  <ul
                    id="finanzas-cuentas-bancarias-submenu"
                    className="mt-1 ml-2 flex flex-col gap-0.5 border-l border-gray-600 pl-3"
                  >
                    {BANKING_CHILDREN.map(({ to, label }) => (
                      <li key={label}>
                        <NavLink to={to} className={financeNavClass}>
                          {label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <NavLink
                to="/admin/finance/loyverse"
                className={cn(financeNavClass, "mt-1 flex items-center gap-2")}
              >
                <Store className="h-4 w-4 shrink-0 opacity-80" />
                Loyverse
              </NavLink>
            </div>
          </div>
        </nav>
      </aside>

      {/* Flyout finanzas (solo móvil/tablet) */}
      {financeFlyoutOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] lg:hidden"
            aria-label="Cerrar menú"
            onClick={() => setFinanceFlyoutOpen(false)}
          />
          <div
            className="fixed inset-y-0 left-[3.75rem] z-50 flex w-[min(18rem,calc(100vw-3.75rem))] flex-col border-r border-gray-700 bg-gray-800 shadow-2xl lg:hidden"
            role="dialog"
            aria-label="Menú finanzas"
          >
            <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
              <span className="text-sm font-semibold text-white">Finanzas</span>
              <button
                type="button"
                onClick={() => setFinanceFlyoutOpen(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-700 hover:text-white"
                aria-label="Cerrar"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              <NavLink
                to="/admin/finance/dashboard"
                className={financeNavClass}
                end
                onClick={() => setFinanceFlyoutOpen(false)}
              >
                Panel finanzas
              </NavLink>

              <NavLink
                to="/admin/finance/gastos"
                className={cn(financeNavClass, "flex items-center gap-2")}
                onClick={() => setFinanceFlyoutOpen(false)}
              >
                <Wallet className="h-4 w-4 shrink-0" />
                Gastos
              </NavLink>

              <p className="mt-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Cuentas bancarias
              </p>
              {BANKING_CHILDREN.map(({ to, label }) => (
                <NavLink
                  key={label}
                  to={to}
                  className={financeNavClass}
                  onClick={() => setFinanceFlyoutOpen(false)}
                >
                  {label}
                </NavLink>
              ))}

              <NavLink
                to="/admin/finance/loyverse"
                className={cn(financeNavClass, "mt-2 flex items-center gap-2")}
                onClick={() => setFinanceFlyoutOpen(false)}
              >
                <Store className="h-4 w-4 shrink-0" />
                Loyverse
              </NavLink>
            </nav>
          </div>
        </>
      )}

      {/* Contenido: margen izquierdo por la barra fija en móvil */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col pl-[3.75rem] lg:pl-0">
        <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center border-b border-gray-200 bg-white/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/80 lg:hidden">
          <span className="truncate text-sm font-semibold text-gray-900">
            Tivana Admin
          </span>
        </header>

        <main className="flex-1 px-3 py-4 sm:px-5 md:px-6 lg:px-8 lg:pt-4 lg:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
