// src/context/UserContext.jsx
import { createContext, useEffect, useState } from 'react';

export const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);

  // 🔁 Refrescar carrito según si hay sesión
  const refreshCart = async (sessionUser = user) => {
    if (sessionUser) {
      // 👤 Usuario logueado
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/cart`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          setCart(data);
          window.dispatchEvent(new Event("cart-updated")); // ✅ Dispara evento para restaurar selección

        } else {
          setCart([]);
        }
      } catch (err) {
        console.error('❌ Error cargando carrito logueado:', err);
        setCart([]);
      }
    } else {
      // 🧑‍💻 Invitado
      const localCart = JSON.parse(localStorage.getItem('guest_cart') || '[]');
      setCart(localCart);
    }
  };

  // 🔁 Validar sesión y luego cargar carrito
  useEffect(() => {
    const fetchUser = async () => {
      let sessionUser = null;

      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/account`, {
          credentials: 'include',
        });

        if (!res.ok) throw new Error('Sesión no válida');

        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          sessionUser = data.user;
        } else {
          setUser(null);
        }
      } catch (err) {
        console.warn('⚠️ Error validando sesión:', err.message);
        setUser(null);
      }

      await refreshCart(sessionUser);
      setLoading(false);
    };

    fetchUser();
  }, []);

  // ✅ Login
  // ✅ Login con fusión de carrito invitado
const login = async (userData) => {
  setUser(userData);

  // 🔄 Intentar fusionar carrito de invitado
  const guestCart = JSON.parse(localStorage.getItem("guest_cart") || "[]");
  if (guestCart.length > 0) {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/cart/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(guestCart),
      });

      if (!res.ok) {
        const error = await res.json();
        console.warn("❌ Error fusionando carrito:", error);
      } else {
        console.log("✅ Carrito fusionado exitosamente");
        localStorage.removeItem("guest_cart");
      }
    } catch (err) {
      console.error("❌ Error en solicitud de merge:", err);
    }
  }

  await refreshCart(userData);
};


  // ✅ Logout
  const logout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.warn('⚠️ Error al cerrar sesión:', err.message);
    } finally {
      setUser(null);
      setCart([]);
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        login,
        logout,
        loading,
        cart,
        setCart,
        refreshCart,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}
