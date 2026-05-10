import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

export default function AdminSearchLogs() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/admin/search-logs/all`)
      .then(res => res.json())
      .then(data => {
        console.log("📊 Datos recibidos:", data);
        setLogs(data);
      })
      .catch(err => console.error("❌ Error cargando logs de búsqueda:", err));
  }, []);

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-6">Búsquedas</h1>
      <table className="w-full table-auto border border-gray-300 shadow-md">
        <thead className="bg-gray-100 text-left">
          <tr>
            <th className="p-2 border">ID</th>
            <th className="p-2 border">Término de Búsqueda</th>
            <th className="p-2 border">Usuario</th>
            <th className="p-2 border">Fecha</th>
          </tr>
        </thead>
        <tbody>
  {logs.length === 0 ? (
    <tr>
      <td className="p-2 border text-center" colSpan={4}>No hay datos disponibles</td>
    </tr>
  ) : (
    logs.map(log => (
      <tr key={log.id}>
        <td className="p-2 border">{log.id}</td>
        <td className="p-2 border">{log.termino || '—'}</td>
        <td className="p-2 border">
          {log.nombre ? `${log.nombre} ${log.apellido || ''}`.trim() : "Invitado"}
        </td>
        <td className="p-2 border">
          {log.fecha ? new Date(log.fecha).toLocaleDateString() : "Sin fecha"}
        </td>
      </tr>
    ))
  )}
</tbody>

      </table>
    </AdminLayout>
  );
}
