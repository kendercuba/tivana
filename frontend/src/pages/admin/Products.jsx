// src/pages/admin/Products.jsx
import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

export default function Products() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [subcategorias, setSubcategorias] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProductos();
    fetchCategorias();
    fetchSubcategorias();
  }, []);

  const fetchProductos = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/products`);
      const data = await res.json();
      setProductos(data);
    } catch (error) {
      console.error("Error cargando productos:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategorias = async () => {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/categorias`);
    const data = await res.json();
    setCategorias(data);
  };

  const fetchSubcategorias = async () => {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/subcategorias`);
    const data = await res.json();
    setSubcategorias(data);
  };

  const getCategoriaNombre = (id) => {
    const cat = categorias.find(c => c.id === id);
    return cat ? cat.nombre : "-";
  };

  const getSubcategoriaNombre = (id) => {
    const sub = subcategorias.find(s => s.id === id);
    return sub ? sub.nombre : "-";
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-4">Productos</h1>

      {loading ? (
        <p>Cargando productos...</p>
      ) : (
        <table className="w-full table-auto border border-gray-300 shadow-md text-sm">
          <thead className="bg-gray-100">
            <tr>                          
              <th className="p-2 border">ID</th>
              <th className="p-2 border">Título</th>
              <th className="p-2 border">Precio</th>
              <th className="p-2 border">Categoría</th>
              <th className="p-2 border">Subcategoría</th>
              <th className="p-2 border">Marca</th>
              <th className="p-2 border">Origen</th> 
            </tr>
          </thead>
          <tbody>
              {productos.map(prod => (
                <tr key={prod.id}>
                  <td className="p-2 border">{prod.id}</td>
                  <td className="p-2 border">{prod.title}</td>
                  <td className="p-2 border">${Number(prod.price).toFixed(2)}</td>
                  <td className="p-2 border">{prod.categoria || "-"}</td>
                  <td className="p-2 border">
                    {prod.subcategorias && prod.subcategorias.length > 0
                      ? prod.subcategorias.map(sub => sub.name).join(', ')
                      : "-"}
                  </td>
                  <td className="p-2 border">{prod.brand || "-"}</td>
                  <td className="p-2 border">{prod.origen || "-"}</td>
                </tr>
              ))}
            </tbody>
        </table>
      )}
    </AdminLayout>
  );
}
