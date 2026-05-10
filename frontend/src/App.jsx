import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import DefaultLayout from './layouts/DefaultLayout';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Register from './pages/Register';
import Login from './pages/Login';
import Checkout from './pages/Checkout';
import Cart from './pages/Cart';

import AdminUsers from './pages/admin/Users';
import AdminDashboard from './pages/admin/Dashboard';
import AdminOrders from './pages/admin/Orders';
import AdminSearchLogs from './pages/admin/SearchLogs';
import AdminProducts from './pages/admin/Products';
import AdminCategories from './pages/admin/AdminCategories';
import AdminLayout from './components/admin/AdminLayout.jsx';
import AdminImportWizard from "./pages/admin/products/import/AdminImportWizard.jsx";
import AccountLayout from './pages/account/AccountLayout';
import AccountSummary from './pages/account/Summary';
import AccountOrders from './pages/account/Orders';
import AccountProfile from './pages/account/Profile';
import FinanceDashboard from './pages/admin/finance/FinanceDashboard.jsx';
import FinanceBankHub from './pages/admin/finance/FinanceBankHub.jsx';
import LoyverseImport from './pages/admin/finance/LoyverseImport.jsx';
import ZonaMarketLayout from './pages/zonamarket/ZonaMarketLayout.jsx';
import ZonaMarketHome from './pages/zonamarket/ZonaMarketHome.jsx';
import ZonaMarketAdminLayout from './components/zonamarket/ZonaMarketAdminLayout.jsx';
import { FinanceBasePathProvider } from './contexts/FinanceBasePathContext.jsx';

/** Última ruta: evita pantalla en blanco si la URL no coincide con ninguna ruta definida. */
function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-gray-900">Página no encontrada</h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-gray-600">
        Si entraste a una URL válida (por ejemplo{" "}
        <strong className="font-medium text-gray-800">/zonamarket</strong>) y ves esto, suele ser
        caché: el navegador o el CDN del hosting pueden estar sirviendo un{" "}
        <code className="rounded bg-gray-200 px-1 text-xs">index.js</code> antiguo. En Hostinger,
        vacía la caché (hPanel / LiteSpeed / CDN) y recarga con Ctrl+F5.
      </p>
      <a
        className="mt-6 inline-block text-sm font-medium text-blue-600 underline"
        href="/"
      >
        Ir al inicio
      </a>
    </div>
  );
}

function FinanceImportarLegacyRedirect() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  if (tab === 'loyverse') {
    return <Navigate to="/admin/finance/loyverse" replace />;
  }
  if (tab === 'cuentas') {
    const sub = searchParams.get('cuentasSub') ?? 'movimientos';
    return (
      <Navigate
        to={`/admin/finance/cuentas?cuentasSub=${sub}`}
        replace
      />
    );
  }
  if (tab === 'categorias') {
    return <Navigate to="/admin/finance/categorias" replace />;
  }
  if (tab === 'reglas') {
    return <Navigate to="/admin/finance/reglas" replace />;
  }
  return <Navigate to="/admin/finance/cargar-excel" replace />;
}

function App() {
  return (
    <Routes>

    
      <Route element={<DefaultLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/cart" element={<Cart />} />
      </Route>

        <Route path="/account" element={<AccountLayout />}>
        <Route index element={<AccountSummary />} />
        <Route path="orders" element={<AccountOrders />} />
        <Route path="profile" element={<AccountProfile />} />
      </Route>

      
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/users" element={<AdminUsers />} />
      <Route path="/admin/orders" element={<AdminOrders />} />
      <Route path="/admin/search-logs" element={<AdminSearchLogs />} />
      <Route path="/admin/products" element={<AdminProducts />} />
      <Route path="/admin/categories" element={<AdminCategories />} />
      <Route
        path="/admin/finance/importar"
        element={
          <AdminLayout>
            <FinanceImportarLegacyRedirect />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/finance/dashboard"
        element={
          <AdminLayout>
            <FinanceDashboard />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/finance/bank-import"
        element={<Navigate to="/admin/finance/cargar-excel" replace />}
      />
      <Route
        path="/admin/finance/loyverse-import"
        element={<Navigate to="/admin/finance/loyverse" replace />}
      />
      <Route
        path="/admin/finance/loyverse"
        element={
          <AdminLayout>
            <LoyverseImport />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/finance/:section"
        element={
          <AdminLayout>
            <FinanceBankHub />
          </AdminLayout>
        }
      />
      <Route path="/admin/products/import" element={  <AdminLayout> <AdminImportWizard />  </AdminLayout> }/>

      {/* Zona Market: URL canónica /zonamarket (no usar /zona-market ni mayúsculas). */}
      <Route
        path="/zona-market"
        element={<Navigate to="/zonamarket" replace />}
      />
      <Route path="/zonamarket" element={<ZonaMarketLayout />}>
        <Route index element={<ZonaMarketHome />} />
      </Route>

      <Route
        path="/zonamarket/admin"
        element={
          <FinanceBasePathProvider basePath="/zonamarket/admin/finance">
            <ZonaMarketAdminLayout />
          </FinanceBasePathProvider>
        }
      >
        <Route
          index
          element={
            <Navigate to="/zonamarket/admin/finance/dashboard" replace />
          }
        />
        <Route path="finance/dashboard" element={<FinanceDashboard />} />
        <Route path="finance/loyverse" element={<LoyverseImport />} />
        <Route path="finance/:section" element={<FinanceBankHub />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
