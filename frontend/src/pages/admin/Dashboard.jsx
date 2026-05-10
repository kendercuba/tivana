import AdminLayout from '../../components/admin/AdminLayout';
import { useEffect, useState } from 'react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    orders: 0,
    searches: 0,
    products: 0,
  });

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/admin/stats`, {
  credentials: 'include',
})
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error("Error loading dashboard stats", err));
  }, []);

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-6">Panel Administrativo</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card title="Usuarios" value={stats.users} />
        <Card title="Ordenes" value={stats.orders} />
        <Card title="Busquedas" value={stats.searches} />
        <Card title="Productos" value={stats.products} />
      </div>
    </AdminLayout>
  );
}

function Card({ title, value }) {
  return (
    <div className="bg-white p-6 rounded shadow-md text-center">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
