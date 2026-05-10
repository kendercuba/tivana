// frontend/src/hooks/admin/import/useClassificationSuggestions.js

import { useState } from "react";
import { suggestSubcategories } from "../../../api/admin/import/classificationApi";

export default function useClassificationSuggestions({
  selectedFile,
  productsToShow,
  getProductKey,
  loadMappedFile // ✅ agregado para coherencia
}) {
  // ===============================
  // Estados
  // ===============================
  const [inlineSuggestions, setInlineSuggestions] = useState({});
  const [suggesting, setSuggesting] = useState(false);

  // ===============================
  // Sugerir subcategorías inline
  // ===============================
  const handleSuggestSubcategories = async () => {
    if (!selectedFile) return;

    const targets = productsToShow.filter(
      p => !p.subcategory_id
    );

    if (targets.length === 0) {
      alert("No hay productos sin subcategoría visibles");
      return;
    }

    setSuggesting(true);

    try {
      const data = await suggestSubcategories({
        mappedFilename: selectedFile.filename,
        productIds: targets.map(p => getProductKey(p))
      });

      if (!data.success) {
        throw new Error("Error sugiriendo subcategorías");
      }

      const map = {};
      data.suggestions.forEach(s => {
        map[s.product_id] = {
          type: "subcategory",
          suggested_id: s.suggested_id,
          suggested_name: s.suggested_name,
          accepted: true
        };
      });

      setInlineSuggestions(prev => ({
        ...prev,
        ...map
      }));

    } catch (err) {
      console.error(err);
      alert("Error sugiriendo subcategorías");
    } finally {
      setSuggesting(false);
    }
  };

  // ===============================
  // API pública
  // ===============================
  return {
    inlineSuggestions,
    setInlineSuggestions,
    suggesting,
    handleSuggestSubcategories
  };
}
