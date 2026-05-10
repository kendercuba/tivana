import { useState, useEffect, useRef } from "react";
import StepReview from "./StepReview";
import StepNormalize from "./StepNormalize";



export default function AdminImportWizard() {
  const [step, setStep] = useState(1);

  // Estado
  const [uploadedFilename, setUploadedFilename] = useState(null);
  const [uploadedSize, setUploadedSize] = useState(null);
  const [batchId, setBatchId] = useState(null);

  const [translating, setTranslating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [cancelRequested, setCancelRequested] = useState(false);

  const [history, setHistory] = useState([]);
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const [reloadHistoryFn, setReloadHistoryFn] = useState(null);

  
  // 🔥 NUEVO: Para poder cancelar el stream real
  const readerRef = useRef(null);

  const tabs = [
    { id: 1, name: "Traducir" },
    { id: 2, name: "Normalizar" },
    { id: 3, name: "Revisar" },
    { id: 4, name: "Insertar" },
  ];

    /* ============================================================
     🗂  Cargar historial
  ============================================================ */
  const loadHistory = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/import/batches`);
      const data = await res.json();
      setHistory(Array.isArray(data.batches) ? data.batches : []);
    } catch (err) {
      console.error("Error cargando historial:", err);
      setHistory([]);
    }
  };

  useEffect(() => {
    loadHistory();
    setReloadHistoryFn(() => loadHistory);
  }, []);

  const sortedHistory = [...history].sort((a, b) => {
  return new Date(`${b.date} ${b.time}`) - new Date(`${a.date} ${a.time}`);
});

const totalPages = Math.ceil(sortedHistory.length / ITEMS_PER_PAGE);

const paginatedHistory = sortedHistory.slice(
  (currentPage - 1) * ITEMS_PER_PAGE,
  currentPage * ITEMS_PER_PAGE
);


/* ============================================================
   📤 Subida de archivo (SIN crear batch todavía)
============================================================ */
const handleUploadAndBatch = async (file, json) => {
  // 1. Subir el archivo RAW al backend
  const uploadRes = await fetch(
    `${import.meta.env.VITE_API_URL}/import/upload`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        products: json,
      }),
    }
  );

  const uploadData = await uploadRes.json();

  if (!uploadData.success) {
    alert("❌ Error al subir archivo");
    return;
  }

  // 🚫 YA NO CREAMOS BATCH AQUÍ
  // SOLO guardamos info del archivo subido

  setUploadedFilename(file.name);
  setUploadedSize(file.size);

  // Eliminamos cualquier batch anterior
  setBatchId(null);
  localStorage.removeItem("import_batch_id");

  // Historial solo muestra TRADUCIDOS,
  // así que recargarlo no da problemas
  if (reloadHistoryFn) reloadHistoryFn();
};


  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold mb-6">📦 Importador de Productos</h1>

      {/* Tabs */}
      <div className="flex gap-4 border-b pb-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStep(tab.id)}
            className={`pb-2 px-2 border-b-4 ${
              step === tab.id
                ? "border-blue-500 text-blue-500"
                : "border-transparent"
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* ============================================================
         🟦 PASO 1 — TRADUCIR
      ============================================================ */}
      {step === 1 && (
        <div className="p-6 bg-white rounded shadow-md">
          <h2 className="text-2xl font-bold mb-6"> 1 - Traducir JSON</h2>

          <div className="flex items-center gap-4 mb-6">
            {/* ------------------ SUBIR ARCHIVO ------------------ */}
            <label className="flex items-center gap-3 bg-gray-100 hover:bg-gray-200 text-gray-700 border rounded px-4 py-2 cursor-pointer shadow-sm transition select-none">
              {!uploadedFilename ? (
                <span className="text-xl">⬆</span>
              ) : (
                <span className="text-xl">📄</span>
              )}

              <div className="flex flex-col leading-tight">
                <span className="font-medium truncate max-w-[180px]">
                  {!uploadedFilename ? "Subir archivo JSON" : uploadedFilename}
                </span>

                {uploadedSize && uploadedFilename && (
                  <span className="text-xs text-gray-500">
                    {(uploadedSize / 1024 / 1024).toFixed(2)} MB
                  </span>
                )}
              </div>

              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;

                  setUploadedSize(file.size);

                  const reader = new FileReader();
                  reader.onload = async (event) => {
                    try {
                      const text = event.target.result.replace(/^\uFEFF/, "");
                      const json = JSON.parse(text);

                      if (!Array.isArray(json)) {
                        alert("❌ El archivo debe ser una lista de productos");
                        return;
                      }

                      await handleUploadAndBatch(file, json);
                    } catch (err) {
                      console.error(err);
                      alert("Archivo JSON inválido");
                    }
                  };
                  reader.readAsText(file, "UTF-8");
                }}
              />

              {/* eliminar archivo */}
              {uploadedFilename && (
                <button
                  type="button"
                  onClick={() => {
                    setUploadedFilename(null);
                    setUploadedSize(null);
                    setBatchId(null);
                    localStorage.removeItem("import_batch_id");
                  }}
                  className="text-red-500 hover:text-red-700 text-xl ml-2"
                  title="Eliminar archivo"
                >
                  🗑
                </button>
              )}
            </label>

            {/* ------------------ BOTÓN TRADUCIR ------------------ */}
            <button
              disabled={translating || !uploadedFilename}
              className={`px-4 py-2 rounded text-white ${
                translating ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
              }`}
                      onClick={async () => {
            setTranslating(true);
            setCancelRequested(false);
            setProgressPercent(0);

            const res = await fetch(
              `${import.meta.env.VITE_API_URL}/import/translate`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  // ahora enviamos filename, NO batch_id
                  filename: uploadedFilename  
                }),
              }
            );


                const reader = res.body.getReader();
                readerRef.current = reader;

                const decoder = new TextDecoder();
                let done = false;

                while (!done) {
                  if (cancelRequested) {
                    try {
                      reader.cancel();
                    } catch (e) {}
                    break;
                  }

                  const { value, done: doneReading } = await reader.read();
                  done = doneReading;

                  if (value) {
                    const text = decoder.decode(value);
                    const messages = text.trim().split("\n");

                    messages.forEach((msg) => {
  try {
    const json = JSON.parse(msg);

    if (json.progress) {
      setProgressPercent(json.progress);
    }

    // capturar batch_id enviado por backend ANTES de terminar
    if (json.batch_id) {
      setBatchId(json.batch_id);
      localStorage.setItem("import_batch_id", json.batch_id);
    }

    if (json.cancelled) {
      setCancelRequested(true);
    }
  } catch {}
});

                  }
                }

                setTranslating(false);

                if (reloadHistoryFn) reloadHistoryFn();
              }}
            >
              Traducir ahora
            </button>

            {translating && (
              <>
                <span className="ml-3 text-blue-700 font-semibold">
                  {progressPercent}%
                </span>

                <button
                  onClick={async () => {
                    setCancelRequested(true);

                    await fetch(`${import.meta.env.VITE_API_URL}/import/cancel`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      batch_id: batchId, 
                      filename: uploadedFilename  // NECESARIO si batch aún no existe
                    }),
                  });


                    try {
                      readerRef.current?.cancel();
                    } catch (e) {}
                  }}
                  className="ml-4 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Cancelar
                </button>

              </>
            )}
          </div>

          {/* LOADER */}
          {translating && (
            <div className="flex flex-col items-center my-6">
              <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          )}

          {/* BATCH INFO */}
          {batchId && (
            <p className="mb-4 text-gray-800">Batch ID: {batchId}</p>
          )}

          {/* ============================
              HISTORIAL DE TRADUCCIONES
          ============================ */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">
              Historial de Traducciones
            </h3>

            <div className="overflow-x-auto border rounded-lg shadow-sm">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 border-b border-r text-left">
                      Archivo
                    </th>
                    <th className="px-4 py-2 border-b border-r text-left">
                      Productos
                    </th>
                    <th className="px-4 py-2 border-b border-r text-left">
                      Fecha
                    </th>
                    <th className="px-4 py-2 border-b border-r text-left">
                      Hora
                    </th>
                    <th className="px-4 py-2 border-b border-r text-left">
                      Estado
                    </th>                   
                  </tr>
                </thead>

                <tbody>
                  {paginatedHistory.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 transition"
                      >
                        <td className="px-4 py-2 border-b border-r">
                          {item.filename}
                        </td>
                        <td className="px-4 py-2 border-b border-r">
                          {item.total_products}
                        </td>
                        <td className="px-4 py-2 border-b border-r">
                          {item.date}
                        </td>
                        <td className="px-4 py-2 border-b border-r">
                          {item.time}
                        </td>

                        <td className="px-4 py-2 border-b border-r">
                          <span
                            className={`px-2 py-1 rounded text-sm ${
                              item.status === "translated"
                                ? "bg-green-100 text-green-700"
                                : item.status === "cancelled"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        </tr>
                    ))}
                </tbody>
              </table>
             {totalPages > 1 && (
  <div className="flex justify-center gap-2 mt-4">
    {Array.from({ length: totalPages }).map((_, i) => (
      <button
        key={i}
        onClick={() => setCurrentPage(i + 1)}
        className={`px-3 py-1 rounded border text-sm ${
          currentPage === i + 1
            ? "bg-blue-600 text-white"
            : "bg-white hover:bg-gray-100"
        }`}
      >
        {i + 1}
      </button>
    ))}
  </div>
)}
 
            </div>
          </div>

          </div>
      )}

      {/* Paso 2 */}
      {step === 2 && <StepNormalize />}


      {/* Paso 3 */}
      {step === 3 && <StepReview />}

     
      {/* Paso 4 */}
      {step === 4 && (
        <div className="p-6 bg-white rounded shadow-md">
          <h2 className="text-xl font-bold mb-4">
            Paso 4 — Insertar productos
          </h2>
          <p>Aquí va el botón final para cargar los productos a PostgreSQL.</p>
        </div>
      )}
    </div>
  );
}
