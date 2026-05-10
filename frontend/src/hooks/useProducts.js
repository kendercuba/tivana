// src/hooks/useProducts.js
import { useEffect, useState } from "react";

function useProducts({ limit = 12, origin = null } = {}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);

        let url = `${import.meta.env.VITE_API_URL}/products?limit=${limit}`;
        if (origin) url += `&origin=${origin}`;

        const res = await fetch(url);
        const data = await res.json();

        const enriched = Array.isArray(data)
          ? data.map((p) => ({
              id: p.id,
              title: p.title,
              price: p.price,
              image: p.image || p.images?.[0] || "",
              sizes: Array.isArray(p.sizes)
                ? p.sizes
                : JSON.parse(p.sizes || "[]"),
            }))
          : [];

        setProducts(enriched);
      } catch (err) {
        console.error("❌ Error al cargar productos:", err);
        setError("Error al obtener productos");
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [limit, origin]);

  return { products, loading, error };
}

export default useProducts;
