import { useState } from "react";

export default function useMapTranslatedFile() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mapTranslatedFile = async (translatedFilename) => {
    console.log("🟢 mapTranslatedFile CALLED with:", translatedFilename);

    if (typeof translatedFilename !== "string") {
      throw new Error("translatedFilename debe ser un string");
    }

    if (!translatedFilename.endsWith("_translated.json")) {
      throw new Error("Archivo no está en estado translated");
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/import/map-translated`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            translatedFilename
          }),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Error al mapear archivo");
      }

      console.log("✅ MAPEADO OK:", data.mappedFilename);
      return data;
    } catch (err) {
      console.error("❌ mapTranslatedFile ERROR:", err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    mapTranslatedFile,
    loading,
    error,
  };
}
