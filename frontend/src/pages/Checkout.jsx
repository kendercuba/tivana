import { useEffect, useState, useContext } from "react";
import { UserContext } from "../context/UserContext";
import { useNavigate } from "react-router-dom";

export default function Checkout() {
  const { user, refreshCart } = useContext(UserContext);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const navigate = useNavigate();

  // 🔁 Cargar carrito
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      fetch(`${import.meta.env.VITE_API_URL}/cart`, {
        credentials: 'include',
      })
        .then((res) => res.json())
        .then((data) => setCart(data))
        .catch(() => setError("❌ Error al obtener el carrito"))
        .finally(() => setLoading(false));
    } else {
      const localCart = localStorage.getItem("guest_cart");
      setCart(localCart ? JSON.parse(localCart) : []);
      setLoading(false);
    }
  }, []);

  // 🧮 Total
  const calcularTotal = () => {
    return cart.reduce((acc, item) => acc + parseFloat(item.price) * item.quantity, 0);
  };

  // ✅ Finalizar compra
  const finalizarCompra = async () => {
    const token = localStorage.getItem("token");

    if (!cart.length) {
      setMessage("⚠️ Tu carrito está vacío.");
      return;
    }

    if (!user) {
  setMessage("⚠️ Debes iniciar sesión para completar tu compra.");
  return;
}


    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/orders/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // ✅ importante para cookies
      body: JSON.stringify({
        items: cart.map((item) => ({
          product_id: item.product_id || item.id,
          quantity: item.quantity,
          size: item.size || null,
        })),
        address,
        payment_method: paymentMethod,
      }),
    });


      const data = await res.json();

      if (data.message === "Orden creada exitosamente") {
        localStorage.removeItem("guest_cart");
        refreshCart();
        setMessage("✅ ¡Gracias por tu compra!");
        setTimeout(() => navigate("/account/orders"), 2000);
      } else {
        setMessage("❌ Hubo un problema al procesar tu orden.");
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Error al conectar con el servidor.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Finalizar compra</h1>

      {loading ? (
        <p>Cargando carrito...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : cart.length === 0 ? (
        <p>No hay productos en tu carrito.</p>
      ) : (
        <>
          {/* 🛒 Lista de productos */}
          <ul className="space-y-4 mb-6">
            {cart.map((item, i) => (
              <li
                key={`${item.id}-${item.size}-${i}`}
                className="border p-3 rounded shadow flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-gray-600">
                    {item.quantity} x ${parseFloat(item.price).toFixed(2)}
                  </p>
                  {item.size && (
                    <p className="text-sm text-gray-500">Talla: {item.size}</p>
                  )}
                </div>
                <p className="font-bold">
                  ${(item.quantity * parseFloat(item.price)).toFixed(2)}
                </p>
              </li>
            ))}
          </ul>

          {/* 📦 Dirección de envío */}
          <div className="mb-6">
            <h2 className="font-semibold mb-2">Dirección de envío</h2>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full border rounded px-3 py-2"
              rows={3}
              placeholder="Ingresa tu dirección completa..."
            />
          </div>

          {/* 💳 Método de pago */}
          <div className="mb-6">
            <h2 className="font-semibold mb-2">Método de pago</h2>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            >
              <option value="card">Tarjeta de crédito / débito</option>
              <option value="cash">Pago contra entrega</option>
              <option value="paypal">PayPal</option>
            </select>
          </div>

          {/* 💰 Resumen final */}
          <div className="border-t pt-4 text-right">
            <p className="text-lg font-semibold">
              Total: ${calcularTotal().toFixed(2)}
            </p>

            <button
              onClick={finalizarCompra}
              className="mt-4 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
            >
              Finalizar compra
            </button>

            {message && (
              <p className="mt-3 text-center text-gray-700">{message}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
