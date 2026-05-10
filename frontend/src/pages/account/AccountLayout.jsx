// src/pages/account/AccountLayout.jsx
import { Outlet, NavLink } from "react-router-dom";
import {
  FaUser,
  FaBoxOpen,
  FaAddressCard,
  FaCreditCard,
  FaLock,
  FaComments,
  FaFileAlt,
  FaHeadset,
} from "react-icons/fa";

export default function AccountLayout() {
  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4">
      <div className="max-w-6xl mx-auto flex overflow-hidden min-h-[900px]">
        {/* Barra lateral */}
        <aside className="w-72 border-r px-6 py-10">
          <h2 className="text-2xl font-bold mb-8 text-gray-900">Mi Cuenta</h2>
          <nav className="space-y-5 text-[16px] font-medium text-gray-700">
            <NavLink to="/account/profile" className="flex items-center gap-3 hover:text-black">
              <FaUser className="text-lg" /> Perfil
            </NavLink>
            <NavLink to="/account/orders" className="flex items-center gap-3 hover:text-black">
              <FaBoxOpen className="text-lg" /> Pedidos
            </NavLink>
            <NavLink to="/account/archived-orders" className="flex items-center gap-3 hover:text-black">
              <FaFileAlt className="text-lg" /> Archivados
            </NavLink>
            <NavLink to="/account/addresses" className="flex items-center gap-3 hover:text-black">
              <FaAddressCard className="text-lg" /> Direcciones
            </NavLink>
            <NavLink to="/account/payment-methods" className="flex items-center gap-3 hover:text-black">
              <FaCreditCard className="text-lg" /> Pagos
            </NavLink>
            <NavLink to="/account/security-logs" className="flex items-center gap-3 hover:text-black">
              <FaLock className="text-lg" /> Seguridad
            </NavLink>
            <NavLink to="/account/messages" className="flex items-center gap-3 hover:text-black">
              <FaComments className="text-lg" /> Mensajes
            </NavLink>
            <NavLink to="/account/summary" className="flex items-center gap-3 hover:text-black">
              <FaFileAlt className="text-lg" /> Resumen
            </NavLink>
            <NavLink to="/account/support-requests" className="flex items-center gap-3 hover:text-black">
              <FaHeadset className="text-lg" /> Soporte
            </NavLink>
          </nav>
        </aside>

        {/* Contenido */}
        <main className="flex-1 px-10 py-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
