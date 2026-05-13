import { useState } from "react";
import { importBankFile } from "../../../api/admin/finance/bankApi";

function normalizeBankImportFiles(file, files) {
  if (files != null && typeof files.length === "number" && files.length > 0) {
    return Array.from(files);
  }
  if (file != null) return [file];
  return [];
}

export default function useBankImport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  /**
   * @param {object} opts
   * @param {File} [opts.file]
   * @param {File[]|FileList} [opts.files]
   * @param {number} [opts.bankAccountId]
   */
  async function handleImport({ file, files, bankAccountId } = {}) {
    const list = normalizeBankImportFiles(file, files);
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
          lastResponse = await importBankFile({ file: f, bankAccountId });
        } catch (err) {
          const msg = err?.message || "Error importando banco.";
          throw new Error(list.length > 1 ? `${f.name}: ${msg}` : msg);
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
      console.error("Bank import failed:", err);
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
