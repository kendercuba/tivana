// frontend/src/hooks/admin/import/persistMappedFile.js

export async function persistMappedFile({ filename, products }) {
  if (!filename || !Array.isArray(products)) {
    throw new Error("persistMappedFile: parámetros inválidos");
  }

  // 🔑 Normalizar filename (puede venir como objeto)
  let safeFilename =
  typeof filename === "string"
    ? filename
    : filename.name || filename.filename;

// 🔑 Asegurar que sea mapped, no translated
if (safeFilename.endsWith("_translated.json")) {
  safeFilename = safeFilename.replace(
    "_translated.json",
    "_mapped.json"
  );
}

  if (!safeFilename) {
    throw new Error("persistMappedFile: filename inválido");
  }

  console.log("🔥 GUARDANDO ARCHIVO:", safeFilename);

  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/import/mapped-file/${safeFilename}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products })
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`No se pudo guardar el archivo mapeado: ${text}`);
  }

  return true;
}
