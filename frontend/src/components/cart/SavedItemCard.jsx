import { Link } from 'react-router-dom';

export default function SavedItemCard({ item, onMoveToCart, onDelete }) {
  const {
    product_id, // ✅ El ID real del producto
    title,
    price,
    size,
    images,
    image,
  } = item;

  const imageSrc = image || (images?.[0] || '');
  const titleText = typeof title === 'object' ? title.es || title.en : title;

    return (
    <div className="flex justify-between items-center py-4 px-2 hover:bg-gray-50 transition-all">
      <div className="flex items-center gap-4">
        <img
          src={imageSrc}
          alt={titleText}
          className="w-32 h-full object-contain cursor-pointer"
          onClick={() => window.location.href = `/product/${product_id}`} // También puedes usar `useNavigate`
        />
        <div>
          <Link
            to={`/product/${product_id}`}
             className="font-semibold text-base md:text-lg leading-snug text-gray-800 hover:underline cursor-pointer line-clamp-2"
          >
            {titleText}
          </Link>
          <p className="text-sm text-green-600 mt-1">Disponible</p>
          <p className="text-sm text-gray-600 mt-1">Talla: {size}</p>
        </div>
      </div>
      <div className="flex flex-col justify-between items-end h-full min-h-[140px] pr-2">
  {/* Precio arriba */}
  <p className="text-red-600 font-semibold text-base">{`$${price}`}</p>

  {/* Botones abajo */}
  <div className="flex gap-3">
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onMoveToCart(product_id, size);
      }}
      className="bg-yellow-400 text-black px-4 py-1 text-sm rounded hover:bg-yellow-500"
    >
      Agregar al carrito
    </button>

    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDelete(product_id, size);
      }}
      className="text-sm text-red-500 hover:underline"
    >
      Eliminar
    </button>
  </div>
</div>



    </div>
  );
}
