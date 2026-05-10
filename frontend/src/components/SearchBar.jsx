import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { UserContext } from "../context/UserContext";


const SearchBar = () => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const navigate = useNavigate();
  const { usuario } = useContext(UserContext);

  const handleSubmit = async (e) => {
  e.preventDefault();

  console.log("🛰 Enviando búsqueda:", search);

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/search-logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: 'include',
      body: JSON.stringify({
        usuario_id: usuario?.id || null,
        termino: search,
      }),

    });

    const result = await response.json();
    console.log("✅ Respuesta del backend:", result);
  } catch (error) {
    console.error("❌ Error guardando búsqueda:", error);
  }

  navigate(`/productos?q=${encodeURIComponent(search)}`);
};

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl bg-gray-100 rounded overflow-hidden px-2 py-1 flex items-center gap-2"
    >
      <select
        id="categoria-select"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="text-sm bg-transparent outline-none"
      >
        <option value="">Todos</option>
        <option value="tecnologia">Tecnología</option>
        <option value="ropa">Ropa</option>
        <option value="hogar">Hogar</option>
        <option value="cocina">Cocina</option>
      </select>
      <input
        id="busqueda-input"
        type="text"
        placeholder="Buscar en Tivana..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="flex-grow bg-transparent outline-none text-sm px-2"
      />
      <button type="submit" className="bg-orange-500 px-3 py-2 text-white rounded-r">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5 fill-white"
          viewBox="0 0 512 512"
        >
          <path
            fill="currentColor"
            d="M416 208c0 45.9-14.9 88.3-40 122.7l126.6 126.7c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0s208 93.1 208 208M208 352a144 144 0 1 0 0-288a144 144 0 1 0 0 288"
          />
        </svg>
      </button>
    </form>
  );
};

export default SearchBar;
