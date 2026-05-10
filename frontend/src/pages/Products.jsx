// src/pages/Products.jsx
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({
    category: '',
    brand: '',
    minPrice: '',
    maxPrice: ''
  });

  const location = useLocation();
  const query = new URLSearchParams(location.search).get("q")?.toLowerCase() || "";

  useEffect(() => {
    const params = new URLSearchParams();

    if (query) params.append('q', query);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });

    fetch(`${import.meta.env.VITE_API_URL}/products?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setProducts(data))
      .catch((err) => console.error('Error loading products from API:', err));
  }, [query, filters]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Todos los productos</h1>

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <select
          name="category"
          value={filters.category}
          onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
          className="p-2 border rounded"
        >
          <option value="">Todas las categorías</option>
          <option value="Hombre">Hombre</option>
          <option value="Mujer">Mujer</option>
        </select>

        <select
          name="brand"
          value={filters.brand}
          onChange={(e) => setFilters((prev) => ({ ...prev, brand: e.target.value }))}
          className="p-2 border rounded"
        >
          <option value="">Todas las marcas</option>
          <option value="Shein">Shein</option>
          <option value="Nike">Nike</option>
        </select>

        <input
          type="number"
          name="minPrice"
          placeholder="Precio mínimo"
          className="p-2 border rounded"
          value={filters.minPrice}
          onChange={(e) => setFilters((prev) => ({ ...prev, minPrice: e.target.value }))}
        />

        <input
          type="number"
          name="maxPrice"
          placeholder="Precio máximo"
          className="p-2 border rounded"
          value={filters.maxPrice}
          onChange={(e) => setFilters((prev) => ({ ...prev, maxPrice: e.target.value }))}
        />
      </div>

      {/* Lista de productos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
        {products.map((product, index) => (
          <Link
            key={index}
            to={`/product/${product.id}`}
            className="border rounded-lg bg-white hover:shadow-lg transition overflow-hidden flex flex-col"
          >
            <div className="relative">
              <img
                src={product.image || 'https://via.placeholder.com/300'}
                alt={product.title || 'Producto sin título'}
                className="w-full h-48 object-cover"
              />
            </div>

            <div className="p-2 flex-grow flex flex-col justify-between">
              <h2 className="text-sm font-medium text-gray-800 line-clamp-2 h-10">
                {product.title || 'Sin título'}
              </h2>

              <div className="mt-2">
                <span className="text-blue-600 font-bold">
                  {!isNaN(product.price) ? Number(product.price).toFixed(2) : '0.00'}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
