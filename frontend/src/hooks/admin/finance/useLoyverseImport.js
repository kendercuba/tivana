import { useState } from "react";
import { importLoyverseFile } from "../../../api/admin/finance/loyverseApi";

export default function useLoyverseImport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function handleImport({ file, reportHint }) {
    try {
      setLoading(true);
      setError(null);

      const response = await importLoyverseFile({ file, reportHint });

      setResult(response);
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
