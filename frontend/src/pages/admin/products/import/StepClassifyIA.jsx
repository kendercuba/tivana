import { useState, useEffect, useRef } from "react";

export default function StepClassifyIA() {
  const [translatedFiles, setTranslatedFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);

  const [previewBefore, setPreviewBefore] = useState([]);
  const [previewAfter, setPreviewAfter] = useState([]);

  // 🔥 PROGRESO REAL
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const intervalRef = useRef(null);

  /* ============================================================
     1️⃣ Cargar lista de archivos traducidos
  ============================================================ */
  const loadTranslatedFiles = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/import/translated-files`
      );
      const data = await res.json();
      setTranslatedFiles(data.success ? data.files : []);
    } catch (err) {
      console.error("❌ Error cargando archivos traducidos:", err);
      setTranslatedFiles([]);
    }
  };

  /* ============================================================
     2️⃣ Preview antes de clasificar
  ============================================================ */
  const loadPreviewBefore = async (filename) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/import/preview-file/${filename}`
      );
      const data = await res.json();
      setPreviewBefore(Array.isArray(data.products) ? data.products.slice(0, 40) : []);
    } catch (err) {
      console.error("❌ Error preview translated:", err);
      setPreviewBefore([]);
    }
  };

  useEffect(() => {
    loadTranslatedFiles();
  }, []);

  /* ============================================================
     3️⃣ Seleccionar archivo
  ============================================================ */
  const handleSelectFile = (file) => {
    setSelectedFile(file);
    setPreviewBefore([]);
    setPreviewAfter([]);
    setProgress(0);
    setStatus(null);
    setLoading(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    loadPreviewBefore(file.filename);
  };

  /* ============================================================
     🔥 4️⃣ MONITOREO REAL DEL BATCH (BACKEND)
  ============================================================ */
  const startMonitoring = (mappedFilename) => {

    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/import/batch/progress`
        );
        const data = await res.json();

        if (!data || data.status === "idle") return;

        setStatus(data.status);

        // ✅ PROGRESO REAL DESDE BACKEND
            if (typeof data.percent === "number") {
        setProgress(data.percent);
      }


        if (data.status === "completed") {
          setProgress(100);
          setLoading(false);
          clearInterval(intervalRef.current);
          intervalRef.current = null;

          
                const mappedRes = await fetch(
        `${import.meta.env.VITE_API_URL}/import/mapped-file/${mappedFilename}`
      );

          const mappedData = await mappedRes.json();

          if (mappedData.success) {
            setPreviewAfter(mappedData.products.slice(0, 40));
          }
        }
      } catch (err) {
        console.error("❌ Error monitoreando batch:", err);
      }
    }, 3000);
  };

  /* ============================================================
     5️⃣ Iniciar clasificación IA
  ============================================================ */
  const startClassifyIA = async () => {
    if (!selectedFile) return alert("Selecciona un archivo primero.");

    setLoading(true);
    setProgress(1);
    setStatus("starting");

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/import/map`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            translatedFilename: selectedFile.filename,
          }),
        }
      );

      const data = await res.json();
if (!data.success) {
  alert("❌ Error clasificando con IA");
  setLoading(false);
  return;
}

// ✅ ACTUALIZAR EL ARCHIVO SELECCIONADO CON EL NOMBRE REAL
setSelectedFile(prev => ({
  ...prev,
  filename: data.mappedFilename,
  mapped: true
}));

// 🔥 Comenzar monitoreo real
startMonitoring(data.mappedFilename);

    } catch (err) {
      console.error("❌ Error en IA:", err);
      alert("Error ejecutando la clasificación IA.");
      setLoading(false);
    }
  };

  /* ============================================================
     6️⃣ UI
  ============================================================ */
  return (
    <div className="p-6 bg-white rounded shadow-md w-full">
      <h2 className="text-2xl font-bold mb-6"> 2 - Clasificación de Categorias con IA</h2>

      {/* LISTA DE ARCHIVOS */}
      <h3 className="text-xl font-semibold mb-3">Archivos traducidos disponibles</h3>

      <div className="border rounded-lg overflow-hidden shadow-sm mb-6">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-4 py-2">Archivo</th>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2 text-center">Acción</th>
            </tr>
          </thead>
          <tbody>
            {translatedFiles.map((f) => (
              <tr key={f.filename} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">{f.filename}</td>
                <td className="px-4 py-2">{f.date}</td>
                <td className="px-4 py-2 text-center">
                  <button
                    onClick={() => handleSelectFile(f)}
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded"
                  >
                    Seleccionar
                  </button>
                </td>
              </tr>
            ))}
            {translatedFiles.length === 0 && (
              <tr>
                <td colSpan="3" className="px-4 py-4 text-center text-gray-500">
                  No hay archivos traducidos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ARCHIVO SELECCIONADO */}
      {selectedFile && (
        <div className="p-4 bg-blue-50 rounded-lg shadow-sm mb-6">
          <h3 className="text-lg font-semibold mb-2">Archivo seleccionado</h3>

          <p><b>Nombre:</b> {selectedFile.filename}</p>
          <p><b>Fecha:</b> {selectedFile.date}</p>

          <button
            onClick={startClassifyIA}
            disabled={loading}
            className="mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
          >
            {loading ? "Clasificando..." : "Clasificar con IA"}
          </button>

          {loading && (
            <div className="mt-4">
              <p className="text-sm text-gray-700 mb-1">
                Estado: {status}
              </p>
              <div className="w-full bg-gray-200 h-3 rounded overflow-hidden">
                <div
                  className="bg-blue-600 h-3 transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-700 mt-1">
                Progreso estimado: {progress}%
              </p>
            </div>
          )}
        </div>
      )}

      {/* VISTA PREVIA ANTES */}
      {previewBefore.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-3">
            Vista previa (archivo traducido)
          </h3>
          <table className="w-full border text-sm">
            <tbody>
              {previewBefore.map((p, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-2">
                    <img
                      src={p.images?.[0] || "/placeholder.png"}
                      className="w-12 h-12 object-cover rounded"
                    />
                  </td>
                  <td className="px-4 py-2">{p.title?.es || p.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* VISTA PREVIA DESPUÉS */}
      {previewAfter.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-3">
            Vista previa (clasificado por IA)
          </h3>
          <table className="w-full border text-sm">
            <tbody>
              {previewAfter.map((p, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-2">
                    <img
                      src={p.images?.[0] || "/placeholder.png"}
                      className="w-12 h-12 object-cover rounded"
                    />
                  </td>
                  <td className="px-4 py-2">{p.title?.es}</td>
                  <td className="px-4 py-2">{p.classification?.category}</td>
                  <td className="px-4 py-2">{p.classification?.subcategory}</td>
                  <td className="px-4 py-2">{p.classification?.subsubcategory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
