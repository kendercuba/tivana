import { useState, useEffect, useContext } from "react";
import { UserContext } from "../context/UserContext";

function useSavedItems() {
  const { user, refreshCart } = useContext(UserContext);
  const [savedItems, setSavedItems] = useState([]);

  const fetchSavedItems = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/saved`, {
        credentials: 'include',
      });
      const data = await res.json();
      console.log("📦 Productos guardados recibidos:", data);
      setSavedItems(data);
    } catch (err) {
      console.error("❌ Error al obtener productos guardados:", err);
    }
  };

  useEffect(() => {
    if (user) fetchSavedItems();
  }, [user]);

  const guardarParaMasTarde = async (item) => {
    const productId = item.id;

    if (!productId || !item.size) {
      console.error("❌ id inválido o falta size:", { productId, size: item.size });
      return;
    }

    console.log("💾 Guardando producto para más tarde:", { productId, size: item.size });

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/saved`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ product_id: productId, size: item.size }),
      });

      console.log("📡 Respuesta del guardado:", res.status);

      if (!res.ok) throw new Error("❌ Error al guardar");

      await fetchSavedItems();
    } catch (error) {
      console.error("❌ Error al guardar para más tarde:", error);
    }
  };

  const moverAlCarrito = async (productId, size) => {
    if (!user) return;

    console.log("🛒 Mover al carrito:", { productId, size });

    try {
      // 1. Agregar al carrito
      const res = await fetch(`${import.meta.env.VITE_API_URL}/cart/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: Number(productId),
          size,
          quantity: 1,
        }),
      });

      console.log("📦 Respuesta agregar al carrito:", res.status);

      if (!res.ok) {
        console.error("❌ Error al agregar al carrito");
        return;
      }

      // ✅ Marcar el producto como seleccionado automáticamente
const key = `${productId}-${size}`;
const selectedKey = `selected_items_${user.id}`;
const current = JSON.parse(localStorage.getItem(selectedKey) || "[]");
if (!current.includes(key)) {
  const nuevaSeleccion = [...current, key];
  localStorage.setItem(selectedKey, JSON.stringify(nuevaSeleccion));
}

      // 2. Eliminar de productos guardados
      await eliminarGuardado(productId, size);

      // 3. Refrescar estados
      refreshCart();
      await fetchSavedItems();
    } catch (err) {
      console.error("❌ Error al mover al carrito:", err);
    }
  };

  const eliminarGuardado = async (productId, size) => {
    try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/saved/${productId}/${size}`, {
  method: "DELETE",
  credentials: "include",
});


    if (!res.ok) {
      console.error("❌ Error al eliminar guardado");
      return;
    }

    await fetchSavedItems();
  } catch (err) {
    console.error("❌ Error al eliminar guardado:", err);
  }
};


  return {
    savedItems,
    fetchSavedItems,
    guardarParaMasTarde,
    moverAlCarrito,
    eliminarGuardado,
  };
}

export default useSavedItems;
