import { useState } from "react";

/**
 * Hook: Auditor IA de clasificación
 * ---------------------------------
 * - Ejecuta auditoría sobre productos actuales
 * - NO persiste cambios
 * - Devuelve sugerencias al padre
 */
export default function useClassificationAudit({
  selectedFile,
  products,
  draftEdits,
  setAuditSuggestions
}) {
  const [loading, setLoading] = useState(false);

  const runAudit = async (level) => {
    if (!selectedFile) return;

    try {
      setLoading(true);

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/import/audit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            mappedFilename: selectedFile.filename,
            products,
            level, 
            draftEdits  // ✅ CLAVE
          })
        }
      );

      if (!res.ok) {
        throw new Error("Error ejecutando auditoría IA");
      }

      const data = await res.json();

      console.log("🧠 Auditoría IA - sugerencias:", data.suggestions);

      setAuditSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch (err) {
      console.error("❌ Error auditoría IA:", err);
    } finally {
      setLoading(false);
    }
  };

  return {
    runAudit,
    loading
  };
}
