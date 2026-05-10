// src/pages/account/Orders.jsx
import { useEffect, useState, useContext } from "react";
import { UserContext } from "../../context/UserContext";

// 📦 Página para ver todos los pedidos realizados
export default function MeOrders() {
  const { user } = useContext(UserContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 🔁 Cargar pedidos del usuario autenticado
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("⚠️ Debes iniciar sesión para ver tus pedidos.");
      setLoading(false);
      return;
    }

    fetch(`${import.meta.env.VITE_API_URL}/orders`, {
  credentials: 'include' // ✅ Aquí está bien ubicado
})

      .then((res) => {
        if (!res.ok) throw new Error("Error al obtener pedidos");
        return res.json();
      })
      .then((data) => setOrders(data))
      .catch(() => setError("❌ Error al obtener los pedidos"))
      .finally(() => setLoading(false));
  }, []);

  // ⛔ Mensajes de estado
  if (loading) return <p className="p-4">Cargando pedidos...</p>;
  if (error) return <p className="p-4 text-red-600">{error}</p>;

  // ✅ Renderizado de pedidos
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-semibold mb-6">Mis pedidos</h2>

      {orders.length === 0 ? (
        <p>No has realizado ningún pedido todavía.</p>
      ) : (
        orders.map((order) => (
          <div
            key={order.id}
            className="border rounded p-4 shadow mb-6 bg-white"
          >
            <p className="text-sm text-gray-600 mb-1">
              Pedido realizado el{" "}
              {new Date(order.created_at).toLocaleDateString()}
            </p>
            <p className="text-lg font-bold text-blue-700 mb-3">
              Total: ${order.total?.toFixed(2)}
            </p>

            <div className="divide-y divide-gray-200">
              {order.items.map((item, idx) => (
                <div key={idx} className="py-2 flex gap-4 items-center">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-16 h-16 object-cover rounded"
                  />
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm text-gray-600">
                      Cantidad: {item.quantity} — Talla: {item.size}
                    </p>
                    <p className="text-sm text-gray-800">
                      Precio: ${item.price?.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
