// src/context/UserContext.jsx
import { createContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export const UserContext = createContext();

/** Landing pública: no llamar /account (evita 401 en consola y esperas innecesarias). */
function isPublicZonaMarketLanding(pathname) {
  const p = pathname.replace(/\/+$/, "") || "/";
  return p === "/zonamarket";
}

export function UserProvider({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);

  const refreshCart = async (sessionUser = user) => {
    if (sessionUser) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/cart`, {
          credentials: "include",
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          setCart(data);
          window.dispatchEvent(new Event("cart-updated"));
        } else {
          setCart([]);
        }
      } catch (err) {
        console.error("❌ Error cargando carrito logueado:", err);
        setCart([]);
      }
    } else {
      const localCart = JSON.parse(
        localStorage.getItem("guest_cart") || "[]"
      );
      setCart(localCart);
    }
  };

  useEffect(() => {
    const run = async () => {
      if (isPublicZonaMarketLanding(location.pathname)) {
        setUser(null);
        try {
          const localCart = JSON.parse(
            localStorage.getItem("guest_cart") || "[]"
          );
          setCart(Array.isArray(localCart) ? localCart : []);
        } catch {
          setCart([]);
        }
        setLoading(false);
        return;
      }

      let sessionUser = null;

      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/account`, {
          credentials: "include",
        });

        if (res.status === 401 || res.status === 403) {
          setUser(null);
        } else if (!res.ok) {
          console.warn("⚠️ /account respondió", res.status);
          setUser(null);
        } else {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            sessionUser = data.user;
          } else {
            setUser(null);
          }
        }
      } catch (err) {
        console.warn("⚠️ Error de red validando sesión:", err.message);
        setUser(null);
      }

      await refreshCart(sessionUser);
      setLoading(false);
    };

    run();
  }, [location.pathname]);

  const login = async (userData) => {
    setUser(userData);

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
          localStorage.removeItem("guest_cart");
        }
      } catch (err) {
        console.error("❌ Error en solicitud de merge:", err);
      }
    }

    await refreshCart(userData);
  };

  const logout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.warn("⚠️ Error al cerrar sesión:", err.message);
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
