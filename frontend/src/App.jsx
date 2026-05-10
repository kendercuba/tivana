import { Routes, Route, Navigate } from 'react-router-dom';
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
import ImportarDatos from './pages/admin/finance/ImportarDatos.jsx';
import LoyverseImport from './pages/admin/finance/LoyverseImport.jsx';


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
            <ImportarDatos />
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
        element={<Navigate to="/admin/finance/importar" replace />}
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
      <Route path="/admin/products/import" element={  <AdminLayout> <AdminImportWizard />  </AdminLayout> }/>
    </Routes>
  );
}

export default App;
