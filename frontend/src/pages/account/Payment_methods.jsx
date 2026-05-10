import { useEffect, useState } from "react";

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [newPayment, setNewPayment] = useState({
    cardholder_name: "",
    card_last4: "",
    expiry_month: "",
    expiry_year: "",
    brand: "",
  });

  const token = localStorage.getItem("token");

 useEffect(() => {
  fetch(`${import.meta.env.VITE_API_URL}/profile/payment-methods`, {
    credentials: 'include'
  })
    .then((res) => res.json())
    .then(setPayments);
}, []);


 const handleSubmit = async (e) => {
  e.preventDefault();
  await fetch(`${import.meta.env.VITE_API_URL}/profile/payment-methods`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: 'include',
    body: JSON.stringify(newPayment),
  });
  window.location.reload();
};


  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Métodos de pago</h2>
      <ul className="mb-6 space-y-2">
        {payments.map((p) => (
          <li key={p.id} className="border p-3 rounded shadow">
            <p>{p.cardholder_name} - {p.brand} ****{p.card_last4}</p>
            <p>Expira: {p.expiry_month}/{p.expiry_year}</p>
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} className="grid gap-2 md:grid-cols-2">
        <input required placeholder="Titular" value={newPayment.cardholder_name} onChange={(e) => setNewPayment({ ...newPayment, cardholder_name: e.target.value })} className="border p-2 rounded" />
        <input required placeholder="Últimos 4 dígitos" value={newPayment.card_last4} onChange={(e) => setNewPayment({ ...newPayment, card_last4: e.target.value })} className="border p-2 rounded" maxLength={4} />
        <input required placeholder="Mes exp." value={newPayment.expiry_month} onChange={(e) => setNewPayment({ ...newPayment, expiry_month: e.target.value })} className="border p-2 rounded" />
        <input required placeholder="Año exp." value={newPayment.expiry_year} onChange={(e) => setNewPayment({ ...newPayment, expiry_year: e.target.value })} className="border p-2 rounded" />
        <input required placeholder="Marca (Visa, etc)" value={newPayment.brand} onChange={(e) => setNewPayment({ ...newPayment, brand: e.target.value })} className="border p-2 rounded" />
        <button className="md:col-span-2 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700">
          Agregar tarjeta
        </button>
      </form>
    </div>
  );
}