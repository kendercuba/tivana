import { Link } from "react-router-dom";

export default function AdminLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white p-6 space-y-4">
        <h2 className="text-2xl font-bold">Tivana Admin</h2>

        <nav className="flex flex-col gap-2 text-sm">
          <Link to="/admin" className="hover:underline">Panel Administrativo</Link>
          <Link to="/admin/users" className="hover:underline">Usuarios</Link>
          <Link to="/admin/orders" className="hover:underline">Órdenes</Link>
          <Link to="/admin/search-logs" className="hover:underline">Búsquedas</Link>
          <Link to="/admin/products" className="hover:underline">Productos</Link>
          <Link to="/admin/categories" className="hover:underline">Categorías</Link>
          <Link to="/admin/products/import" className="hover:underline">Cargar Productos</Link>

          <div className="pt-3 mt-3 border-t border-gray-700">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">
              Finanzas
            </p>

            <Link
              to="/admin/finance/dashboard"
              className="block hover:underline"
            >
              Panel finanzas
            </Link>
            <Link
              to="/admin/finance/importar"
              className="block hover:underline"
            >
              Datos bancarios
            </Link>
            <Link
              to="/admin/finance/loyverse"
              className="block hover:underline"
            >
              Loyverse
            </Link>
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-gray-50 px-8 pt-4 pb-8">{children}</main>
    </div>
  );
}