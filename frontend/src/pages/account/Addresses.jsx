import { useEffect, useState } from "react";

export default function Addresses() {
  const [addresses, setAddresses] = useState([]);
  const [newAddress, setNewAddress] = useState({
    full_name: "",
    address_line: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
  });

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/profile/addresses`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then(setAddresses);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await fetch(`${import.meta.env.VITE_API_URL}/profile/addresses`, {
      method: "POST",
      headers: {
  "Content-Type": "application/json",
},
credentials: 'include',

      body: JSON.stringify(newAddress),
    });
    window.location.reload();
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Direcciones guardadas</h2>
      <ul className="mb-6 space-y-2">
        {addresses.map((a) => (
          <li key={a.id} className="border p-3 rounded shadow">
            <p>{a.full_name}</p>
            <p>{a.address_line}</p>
            <p>{a.city}, {a.state} {a.postal_code}</p>
            <p>{a.country}</p>
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} className="grid gap-2 md:grid-cols-2">
        <input required placeholder="Nombre completo" value={newAddress.full_name} onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })} className="border p-2 rounded" />
        <input required placeholder="Dirección" value={newAddress.address_line} onChange={(e) => setNewAddress({ ...newAddress, address_line: e.target.value })} className="border p-2 rounded" />
        <input required placeholder="Ciudad" value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} className="border p-2 rounded" />
        <input required placeholder="Estado" value={newAddress.state} onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })} className="border p-2 rounded" />
        <input required placeholder="Código postal" value={newAddress.postal_code} onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })} className="border p-2 rounded" />
        <input required placeholder="País" value={newAddress.country} onChange={(e) => setNewAddress({ ...newAddress, country: e.target.value })} className="border p-2 rounded" />
        <button className="md:col-span-2 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">
          Agregar dirección
        </button>
      </form>
    </div>
  );
}