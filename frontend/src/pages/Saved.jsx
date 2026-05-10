import { useNavigate } from "react-router-dom";
import useSavedItems from "../hooks/useSavedItems";
import SavedItemCard from "../components/cart/SavedItemCard"; // ✅ Usa el mismo componente visual

export default function Saved() {
  const navigate = useNavigate();
  const {
    savedItems,
    moverAlCarrito,
    eliminarGuardado,
  } = useSavedItems();

  if (savedItems.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Guardado para más tarde</h2>
        <p className="text-gray-500">No tienes productos guardados.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        Guardado para más tarde ({savedItems.length} {savedItems.length === 1 ? "producto" : "productos"})
      </h2>
      <div className="bg-white shadow-md rounded-lg p-4 divide-y">
        {savedItems.map((item) => (
          <SavedItemCard
            key={`${item.product_id}-${item.size}`}
            item={item}
            onMoveToCart={(id, size) => moverAlCarrito(id, size)}
            onDelete={(id, size) => eliminarGuardado(id, size)}
          />
        ))}
      </div>
    </div>
  );
}
