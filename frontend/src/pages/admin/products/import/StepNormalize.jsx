import { useEffect, useState } from "react";

export default function StepNormalize() {
  const [translatedFiles, setTranslatedFiles] = useState([]);
  const [normalizedFiles, setNormalizedFiles] = useState([]);
  const [mappedFiles, setMappedFiles] = useState([]);

  const [loadingFile, setLoadingFile] = useState(null);
  const [mappingFile, setMappingFile] = useState(null);

  /* ============================================================
     CARGAR ARCHIVOS TRADUCIDOS
  ============================================================ */
  const loadTranslatedFiles = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/import/translated-files`
      );
      const data = await res.json();

      if (data.success) {
        setTranslatedFiles(data.files || []);
      }
    } catch (err) {
      console.error("Error cargando archivos traducidos:", err);
    }
  };

  /* ============================================================
     CARGAR ARCHIVOS NORMALIZADOS
  ============================================================ */
  const loadNormalizedFiles = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/import/normalized-files`
      );
      const data = await res.json();

      if (data.success) {
        setNormalizedFiles(data.files || []);
      }
    } catch (err) {
      console.error("Error cargando archivos normalizados:", err);
    }
  };

  /* ============================================================
     CARGAR ARCHIVOS MAPEADOS
  ============================================================ */
  const loadMappedFiles = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/import/mapped-files`
      );
      const data = await res.json();

      if (data.success) {
        setMappedFiles(data.files || []);
      }
    } catch (err) {
      console.error("Error cargando archivos mapeados:", err);
    }
  };

  /* ============================================================
     ELIMINAR ARCHIVO
  ============================================================ */
  const handleDelete = async (filename, type) => {
    const confirmDelete = window.confirm(
      "¿Seguro que deseas eliminar este archivo?"
    );

    if (!confirmDelete) return;

    try {
      await fetch(
        `${import.meta.env.VITE_API_URL}/import/delete-file`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename, type }),
        }
      );

      // Recargar todo
      loadTranslatedFiles();
      loadNormalizedFiles();
      loadMappedFiles();

    } catch (err) {
      console.error("Error eliminando archivo:", err);
    }
  };

  /* ============================================================
     NORMALIZAR
  ============================================================ */
  const handleNormalize = async (filename) => {
    setLoadingFile(filename);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/import/normalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ translatedFilename: filename }),
        }
      );

      const data = await res.json();

      if (data.success) {
        alert("Archivo normalizado correctamente");
        loadNormalizedFiles();
      } else {
        alert(data.error || "Error normalizando");
      }
    } catch (err) {
      console.error(err);
      alert("Error normalizando");
    }

    setLoadingFile(null);
  };

  /* ============================================================
     MAPEAR
  ============================================================ */
  const handleMap = async (filename) => {
    setMappingFile(filename);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/import/map-normalized`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ normalizedFilename: filename }),
        }
      );

      const data = await res.json();

      if (data.success) {
        alert("Archivo mapeado correctamente");
        loadMappedFiles();
      } else {
        alert(data.error || "Error mapeando");
      }
    } catch (err) {
      console.error(err);
      alert("Error mapeando");
    }

    setMappingFile(null);
  };

  /* ============================================================
     CARGA INICIAL
  ============================================================ */
  useEffect(() => {
    loadTranslatedFiles();
    loadNormalizedFiles();
    loadMappedFiles();
  }, []);


return (
  <div className="bg-white p-6 rounded shadow space-y-10">

    {/* ============================================================
        SECCIÓN 1 — ARCHIVOS TRADUCIDOS
    ============================================================ */}
    <div>
      <h2 className="text-xl font-semibold mb-4">
        Archivos Traducidos
      </h2>

      {translatedFiles.length === 0 ? (
        <p className="text-gray-500">
          No hay archivos traducidos.
        </p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-3 border">Archivo</th>
              <th className="p-3 border text-center">Acción</th>
            </tr>
          </thead>
          <tbody>
            {translatedFiles.map((file) => {
              const normalizedName = file.replace(
                "_translated.json",
                "_normalized.json"
              );

              const alreadyNormalized = normalizedFiles.some(
                (n) => n.filename === normalizedName
              );

              return (
                <tr key={file} className="hover:bg-gray-50">
                  <td className="p-3 border">{file}</td>

                  <td className="p-3 border text-center space-x-3">

                    {alreadyNormalized ? (
                      <button
                        disabled
                        className="bg-gray-400 text-white px-4 py-1 rounded cursor-not-allowed"
                      >
                        Normalizado
                      </button>
                    ) : (
                      <button
                        onClick={() => handleNormalize(file)}
                        disabled={loadingFile === file}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded"
                      >
                        {loadingFile === file
                          ? "Normalizando..."
                          : "Normalizar"}
                      </button>
                    )}

                    {/* BOTÓN ELIMINAR */}
                    <button
                      onClick={() => handleDelete(file, "translated")}
                      className="text-red-600 hover:text-red-800"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                      >
                        <path d="m20 9l-1.995 11.346A2 2 0 0 1 16.035 22h-8.07a2 2 0 0 1-1.97-1.654L4 9m17-3h-5.625M3 6h5.625m0 0V4a2 2 0 0 1 2-2h2.75a2 2 0 0 1 2 2v2m-6.75 0h6.75" />
                      </svg>
                    </button>

                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>

    {/* ============================================================
        SECCIÓN 2 — ARCHIVOS NORMALIZADOS
    ============================================================ */}
    <div>
      <h2 className="text-xl font-semibold mb-4">
        Archivos Normalizados
      </h2>

      {normalizedFiles.length === 0 ? (
        <p className="text-gray-500">
          No hay archivos normalizados.
        </p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-3 border">Archivo</th>
              <th className="p-3 border text-center">Acción</th>
            </tr>
          </thead>
          <tbody>
            {normalizedFiles.map((file) => {

              const mappedName = file.filename.replace(
                "_normalized.json",
                "_mapped.json"
              );

              const alreadyMapped = mappedFiles.includes(mappedName);

              return (
                <tr key={file.filename} className="hover:bg-gray-50">
                  <td className="p-3 border">{file.filename}</td>

                  <td className="p-3 border text-center space-x-3">

                    {alreadyMapped ? (
                      <button
                        disabled
                        className="bg-gray-400 text-white px-4 py-1 rounded cursor-not-allowed"
                      >
                        Mapeado
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMap(file.filename)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded"
                      >
                        Mapear
                      </button>
                    )}

                    {/* BOTÓN ELIMINAR */}
                    <button
                      onClick={() => handleDelete(file.filename, "normalized")}
                      className="text-red-600 hover:text-red-800"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                      >
                        <path d="m20 9l-1.995 11.346A2 2 0 0 1 16.035 22h-8.07a2 2 0 0 1-1.97-1.654L4 9m17-3h-5.625M3 6h5.625m0 0V4a2 2 0 0 1 2-2h2.75a2 2 0 0 1 2 2v2m-6.75 0h6.75" />
                      </svg>
                    </button>

                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>

  </div>
);

}
