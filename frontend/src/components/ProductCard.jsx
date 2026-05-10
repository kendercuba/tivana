// src/components/ProductCard.jsx
import { Link } from "react-router-dom";

export default function ProductCard({ product }) {
  return (
    <div className="bg-white border rounded-xl shadow-sm hover:shadow-md transition duration-200 p-3 flex flex-col">
      <Link to={`/product/${product.id}`}>
        <img
          src={product.images?.[0] || "/placeholder.webp"}
          alt={product.title}
          className="h-48 w-full object-cover rounded-md mb-2"
        />
        <h3 className="text-sm font-semibold text-gray-800 line-clamp-2">
          {product.title}
        </h3>
      </Link>

      <div className="mt-auto flex items-center justify-between">
        <span className="text-red-600 font-bold">${product.price}</span>
        {product.available !== false ? (
          <span className="text-green-600 text-xs">Disponible</span>
        ) : (
          <span className="text-gray-500 text-xs">Agotado</span>
        )}
      </div>
    </div>
  );
}
