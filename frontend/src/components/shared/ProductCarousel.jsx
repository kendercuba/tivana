// src/components/shared/ProductCarousel.jsx
import { Link } from "react-router-dom";
import useProducts from "../../hooks/useProducts";
import { ChevronRight } from "lucide-react";

export default function ProductCarousel({ title, origin }) {
  const { products, loading, error } = useProducts({ limit: 12, origin });

  if (loading) return <div className="p-4">Cargando productos...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="mb-10 px-4">
      {/* 🔹 Encabezado del carrusel */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Link
          to={`/products?origin=${origin || ""}`}
          className="text-blue-600 text-sm flex items-center hover:underline"
        >
          Ver más <ChevronRight size={18} />
        </Link>
      </div>

      {/* 🔸 Carrusel horizontal */}
      <div className="flex overflow-x-auto gap-4 scrollbar-hide">
        {products.map((product) => (
          <Link
            key={product.id}
            to={`/product/${product.id}`}
            className="min-w-[160px] max-w-[160px] flex-shrink-0"
          >
            <img
              src={product.image}
              alt={product.title}
              className="w-full h-44 object-cover rounded"
            />
            <p className="text-xs mt-1 line-clamp-2">{product.title}</p>
            <p className="text-sm font-bold text-orange-600 mt-1">${product.price}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
