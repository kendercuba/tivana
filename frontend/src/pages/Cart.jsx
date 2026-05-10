import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import useCart from "../hooks/useCart.js";
import Button from '../components/ui/Button';
import CartItem from "../components/cart/CartItem";
import Card from '../components/ui/Card';
import SavedItemCard from "../components/cart/SavedItemCard";
import useSavedItems from "../hooks/useSavedItems";


export default function Cart() {
  const navigate = useNavigate();

  const {
    cart,
    loading,
    error,
    isSelected,
    toggleItemSelection,
    toggleSeleccionarTodo,
    calcularSubtotalSeleccionados,
    compartirProducto,
    aumentarCantidad,
    disminuirCantidad,
    eliminarProducto,
    aumentarCantidadInvitado,
    disminuirCantidadInvitado,
    eliminarProductoInvitado,
    seleccionRestaurada, 
  } = useCart();

  const {
    savedItems,
    guardarParaMasTarde,
    moverAlCarrito,
    eliminarGuardado
  } = useSavedItems();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (loading) return <div className="p-4">Cargando carrito...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  // ✅ Reemplazado: item.id || item.product_id → item.id
  const allSelected = cart.length > 0 && cart.every(item =>
    isSelected(item.id, item.size)
  );

  return (
  <div className="bg-gray-100 py-10"> {/* 🟠 Contenedor raíz */}

    <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 px-6"> {/* 🌐 Grid principal */}

      {/* 🔹 COLUMNA IZQUIERDA: productos + guardados */}
      <div className="flex flex-col gap-10">

        {/* 🛒 Productos del carrito */}
        <Card className="w-full border border-blue-400">
          <h1 className="text-2xl font-bold mb-6">Carrito de compras</h1>

          {cart.length === 0 ? (
            <p className="text-gray-500 mb-6">Tu carrito está vacío.</p>
          ) : (
            <>
              {seleccionRestaurada && (
                <div className="flex justify-between items-center mb-4">
                  <button
                    onClick={toggleSeleccionarTodo}
                    className="text-blue-600 hover:underline"
                  >
                    {allSelected ? "Quitar selección" : "Seleccionar todo"}
                  </button>
                </div>
              )}
              <div className="space-y-6">
                {cart.map((item) => (
                  <CartItem
                    key={`${item.id}-${item.size}`}
                    item={item}
                    isSelected={isSelected(item.id, item.size)}
                    onToggle={() => toggleItemSelection(item.id, item.size)}
                    onQuantityChange={(action) =>
                      item.isGuest
                        ? action === "increase"
                          ? aumentarCantidadInvitado(item.id, item.size)
                          : disminuirCantidadInvitado(item.id, item.size)
                        : action === "increase"
                          ? aumentarCantidad(item.id, item.size)
                          : disminuirCantidad(item.id, item.size)
                    }
                    onDelete={() => {
                      const size = item.size;
                      item.isGuest
                        ? eliminarProductoInvitado(item.id, size)
                        : eliminarProducto(item.id, size);
                    }}
                    onSave={(itemToSave) => {
                      const esValido = typeof itemToSave.id === "number" && itemToSave.id > 0;
                      if (!esValido) {
                        console.warn("❌ ID inválido:", itemToSave);
                        alert("Este producto no se puede guardar para más tarde porque no tiene un ID válido.");
                        return;
                      }

                      guardarParaMasTarde(itemToSave).then(() => {
                        itemToSave.isGuest
                          ? eliminarProductoInvitado(itemToSave.id, itemToSave.size)
                          : eliminarProducto(itemToSave.id, itemToSave.size);
                      });
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </Card>

        {/* 💾 Guardado para más tarde */}
        {savedItems.length > 0 && (
          <Card className="w-full border border-purple-400">
            <h2 className="text-xl font-semibold mb-6">
              Guardado para más tarde ({savedItems.length} {savedItems.length === 1 ? "producto" : "productos"})
            </h2>
            <div className="divide-y">
              {savedItems.map((item) => (
                <SavedItemCard
                  key={`${item.id}-${item.size}`}
                  item={item}
                  onMoveToCart={() => moverAlCarrito(item.product_id, item.size)}
                  onDelete={() => eliminarGuardado(item.product_id, String(item.size))}
                />
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* 🔸 COLUMNA DERECHA: Resumen */}
      <div className="w-full h-fit sticky top-28 self-start">
        <Card className="w-full border border-yellow-400">
          <h2 className="text-xl font-semibold mb-4">Resumen</h2>
          <p className="mb-2 text-sm">
            Productos seleccionados:{" "}
            <strong>
              {
                cart.filter((item) =>
                  isSelected(item.id, item.size)
                ).length
              }
            </strong>
          </p>
          <p className="mb-4 text-sm">
            Subtotal:{" "}
            <strong>${calcularSubtotalSeleccionados().toFixed(2)}</strong>
          </p>
          <p className="text-xs text-gray-500 mb-4">
            El envío y los impuestos se calcularán en el checkout.
          </p>
          <Button full intent="primary">
            Proceder al pago
          </Button>
        </Card>
      </div>
    </div>
  </div>
);

}
