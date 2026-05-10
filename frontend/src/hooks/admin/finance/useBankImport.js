import { useState } from "react";
import { importBankFile } from "../../../api/admin/finance/bankApi";

export default function useBankImport() {

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(null);

  const [result, setResult] = useState(null);

  async function handleImport({ file, bankAccountId } = {}) {

    try {

      setLoading(true);

      setError(null);

      const response = await importBankFile({ file, bankAccountId });

      setResult(response);

      console.log("✅ Archivo importado:", response);

    } catch (err) {

      console.error("❌ Error importando banco:", err);

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