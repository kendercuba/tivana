import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/admin/users`)
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error("Error fetching users:", err));
  }, []);

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-6">Usuarios Registrados</h1>
      <table className="w-full table-auto border border-gray-300 shadow-md text-sm">
        <thead className="bg-gray-100 text-left">
          <tr>
            <th className="p-2 border">ID</th>
            <th className="p-2 border">Nombre</th>
            <th className="p-2 border">Apellido</th>
            <th className="p-2 border">Correo Electrónico</th>
            <th className="p-2 border">Registrado El</th>
          </tr>
        </thead>
        <tbody>
  {users.map(user => (
    <tr key={user.id}>
      <td className="p-2 border">{user.id}</td>
      <td className="p-2 border">{user.nombre}</td>          {/* ya no uses user.first_name */}
      <td className="p-2 border">{user.apellido || '-'}</td> {/* ya no uses user.last_name */}
      <td className="p-2 border">{user.email}</td>
      <td className="p-2 border">
        {user.fecha_creacion 
          ? new Date(user.fecha_creacion).toLocaleDateString() 
          : 'N/A'}
      </td>
    </tr>
  ))}
</tbody>
      </table>
    </AdminLayout>
  );
}
