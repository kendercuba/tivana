import { useNavigate } from "react-router-dom";
import { cartItem } from "../../styles/variants/cartItem";

export default function CartItem({
  item,
  isSelected,
  onToggle,
  onQuantityChange,
  onDelete,
  onSave,
}) {
  const navigate = useNavigate();

  return (
    <div className={`${cartItem()} border-t border-gray-300 pt-6 first:border-t-0 min-h-[180px] flex flex-col`}>
      {/* 🖼️ Imagen + Contenido (título, cantidad, talla, acciones) */}
      <div className="flex items-start w-full gap-4">
        {/* ✅ Checkbox alineado al centro verticalmente */}
        <div className="flex flex-col justify-center items-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            className="mt-1"
          />
        </div>

        {/* ✅ Imagen ocupando toda la altura del contenido */}
        <div className="flex-shrink-0">
          <img
            src={item.image || (item.images?.[0] || '')}
            alt={item.title}
            className="w-32 h-full object-contain cursor-pointer"
            onClick={() => navigate(`/product/${item.id}`)}
          />
        </div>

        {/* ✅ Contenido del producto: título, cantidad, talla, acciones */}
        <div className="flex flex-col justify-between flex-grow min-h-[180px]">
          {/* Título y controles arriba */}
          <div>
            <h2
              className="font-semibold text-base md:text-lg leading-snug text-gray-800 hover:underline cursor-pointer line-clamp-2"
              onClick={() => navigate(`/product/${item.id}`)}
            >
              {item.title}
            </h2>

            {/* Controles: cantidad y talla */}
            <div className="flex items-center space-x-2 mt-2">
              <button
                className="w-8 h-8 border rounded text-lg font-medium hover:bg-gray-100"
                onClick={() => onQuantityChange("decrease")}
              >
                -
              </button>
              <span className="px-2 font-semibold text-gray-700">{item.quantity}</span>
              <button
                className="w-8 h-8 border rounded text-lg font-medium hover:bg-gray-100"
                onClick={() => onQuantityChange("increase")}
              >
                +
              </button>

              {/* 👕 Talla mostrada como texto en vez de selector */}
              <p className="ml-4 text-sm text-gray-600">
                Talla: <span className="font-medium text-gray-800">{item.size}</span>
              </p>
            </div>
          </div>

          {/* Acciones pegadas abajo */}
         <div className="flex items-center gap-4 text-sm text-blue-600 mt-2">
{/* 🔘 Eliminar */}
<button
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(item); // ✅ Pasa el item completo
  }}
  className="hover:underline"
>
  Eliminar
</button>

<span>|</span>

{/* 🔘 Guardar para más tarde */}
<button
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("📦 Guardando para más tarde:", item); // ✅ Log de depuración

    // Verificación con ID interno
    if (!item.id) {
      console.warn("❌ ID inválido:", item);
      alert("Este producto no se puede guardar para más tarde porque no tiene un ID válido.");
      return;
    }

    onSave?.(item); // ✅ Pasa el item completo
  }}
  className="hover:underline"
>
  Guardar para más tarde
</button>


<span>|</span>

{/* 🔘 Compartir */}
<button
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    // compartirProducto(); // implementa si lo deseas
  }}
  className="hover:underline"
>
  Compartir
</button>

</div>

        </div>

        {/* Precio */}
        <div className="ml-auto text-right">
          <p className="text-base md:text-lg text-gray-900 font-semibold">${item.price}</p>
        </div>
      </div>
    </div>
  );
}