import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/admin/orders`)
      .then(res => res.json())
      .then(data => setOrders(data))
      .catch(err => console.error("Error fetching orders:", err));
  }, []);

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-6">Órdenes</h1>
      <table className="w-full table-auto border border-gray-300 shadow-md">
        <thead className="bg-gray-100 text-left">
          <tr>
            <th className="p-2 border">ID</th>
            <th className="p-2 border">Usuario</th>
            <th className="p-2 border">Producto</th>
            <th className="p-2 border">Precio</th>
            <th className="p-2 border">Estado</th>
            <th className="p-2 border">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order.id} className="hover:bg-gray-50">
              <td className="p-2 border">{order.id}</td>
              <td className="p-2 border">{order.first_name} {order.last_name}</td>
              <td className="p-2 border">{order.product}</td>
              <td className="p-2 border">${parseFloat(order.price).toFixed(2)}</td>
              <td className="p-2 border">
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold
                  ${order.status === 'completado' ? 'bg-green-100 text-green-700' :
                    order.status === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
                    order.status === 'cancelado' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'}
                `}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </td>
              <td className="p-2 border">
                {new Date(order.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminLayout>
  );
}
