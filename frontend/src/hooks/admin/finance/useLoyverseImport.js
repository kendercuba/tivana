import { useState } from "react";
import { importLoyverseFile } from "../../../api/admin/finance/loyverseApi";

function normalizeImportFileList(file, files) {
  if (files != null && typeof files.length === "number" && files.length > 0) {
    return Array.from(files);
  }
  if (file != null) return [file];
  return [];
}

export default function useLoyverseImport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  /**
   * @param {object} opts
   * @param {File} [opts.file] — single file (backwards compatible)
   * @param {File[]|FileList} [opts.files] — several files, imported in order
   * @param {string} [opts.reportHint]
   */
  async function handleImport({ file, files, reportHint } = {}) {
    const list = normalizeImportFileList(file, files);
    if (list.length === 0) {
      setError("No hay archivos para importar.");
      return;
    }
    try {
      setLoading(true);
      setError(null);

      let lastResponse = null;
      for (const f of list) {
        try {
          lastResponse = await importLoyverseFile({ file: f, reportHint });
        } catch (err) {
          const msg = err?.message || "Error importando Loyverse.";
          throw new Error(
            list.length > 1 ? `${f.name}: ${msg}` : msg
          );
        }
      }

      const baseData = lastResponse?.data ?? {};
      setResult({
        ...lastResponse,
        data: {
          ...baseData,
          ...(list.length > 1 ? { multiFileCount: list.length } : {}),
        },
      });
    } catch (err) {
      console.error("❌ Error importando Loyverse:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return {
    loading,
    error,
    result,
    handleImport,
  };
}
