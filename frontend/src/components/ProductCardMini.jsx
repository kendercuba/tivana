// src/components/ProductCardMini.jsx
import { Link } from "react-router-dom";

export default function ProductCardMini({ product }) {
  return (
    <Link
      to={`/product/${product.id}`}
      className="flex flex-col items-center text-center w-24 md:w-28 hover:scale-105 transition-transform"
    >
      <img
        src={product.images?.[0] || "/placeholder.webp"}
        alt={product.title}
        className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-md mb-1 border"
      />
      <span className="text-[11px] md:text-xs text-gray-700 line-clamp-2 leading-tight">
        {product.title}
      </span>
    </Link>
  );
}
