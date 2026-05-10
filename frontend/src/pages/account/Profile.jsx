import { useContext, useState } from "react";
import { UserContext } from "../../context/UserContext";

export default function Profile() {
  const { user } = useContext(UserContext);
  const [nombre, setNombre] = useState(user?.nombre || "");
  const [apellido, setApellido] = useState(user?.apellido || "");

  const token = localStorage.getItem("token");

  const handleSubmit = async (e) => {
  e.preventDefault();
  const res = await fetch(`${import.meta.env.VITE_API_URL}/account/update`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: 'include',
    body: JSON.stringify({ nombre, apellido }),
  });
  const data = await res.json();
  if (res.ok) {
    alert("✅ Datos actualizados");
  } else {
    alert(`❌ ${data.message}`);
  }
};


  return (
    <div className="max-w-xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Información personal</h2>
      <form onSubmit={handleSubmit} className="grid gap-4">
        <input
          required
          placeholder="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          required
          placeholder="Apellido"
          value={apellido}
          onChange={(e) => setApellido(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          value={user?.email || ""}
          readOnly
          className="border p-2 rounded bg-gray-100 text-gray-500"
        />
        <button className="bg-black text-white py-2 px-4 rounded hover:bg-gray-800">
          Guardar cambios
        </button>
      </form>
    </div>
  );
}
