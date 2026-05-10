import { useEffect, useState } from "react";

export default function Messages() {
  const [messages, setMessages] = useState([]);
  const token = localStorage.getItem("token");

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/account/messages`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then(setMessages);
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Mensajes</h2>
      {messages.length === 0 ? (
        <p>No tienes mensajes nuevos.</p>
      ) : (
        <ul className="space-y-4">
          {messages.map((msg) => (
            <li key={msg.id} className="border p-3 rounded shadow">
              <p className="font-semibold">{msg.subject}</p>
              <p>{msg.body}</p>
              <p className="text-sm text-gray-500">{new Date(msg.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
