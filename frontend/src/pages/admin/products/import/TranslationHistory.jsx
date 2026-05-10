import { useEffect, useState } from "react";

export default function TranslationHistory({ lastBatchId, onReady }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/import/batches`);
      const data = await res.json();
      if (data.success) setHistory(data.batches);
    } catch (err) {
      console.error("Error obteniendo historial:", err);
    }
    setLoading(false);
  };

  // Exponer función de recarga al padre
  useEffect(() => {
    if (onReady) onReady(() => fetchHistory());
  }, []);

  // Cargar historial al montar
  useEffect(() => {
    fetchHistory();
  }, []);

  if (loading)
    return <p className="text-gray-500 text-sm">Cargando historial...</p>;

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-3">Historial de Traducciones</h3>

      {history.length === 0 ? (
        <p className="text-gray-500 text-sm">No hay archivos traducidos aún.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="p-2">Archivo</th>
                <th className="p-2">Productos</th>
                <th className="p-2">Fecha</th>
                <th className="p-2">Hora</th>
                <th className="p-2">Estado</th>
              </tr>
            </thead>

            <tbody>
              {history.map((item) => {
                const date = new Date(item.created_at);

                return (
                  <tr
                    key={item.id}
                    className={`border-b hover:bg-gray-50 ${
                      item.id === lastBatchId ? "bg-yellow-100" : ""
                    }`}
                  >
                    <td className="p-2">{item.filename}</td>
                    <td className="p-2">{item.total_products}</td>
                    <td className="p-2">{date.toLocaleDateString()}</td>
                    <td className="p-2">{date.toLocaleTimeString()}</td>
                    <td className="p-2">{item.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
