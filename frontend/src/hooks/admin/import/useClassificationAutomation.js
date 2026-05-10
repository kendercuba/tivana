// frontend/src/hooks/admin/import/useClassificationAutomation.js

import { useState } from "react";
import { semanticClassify } from "../../../api/admin/import/classificationApi";

export default function useClassificationAutomation({
  selectedFile,
  setProducts,
  loadReviewFile,
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);

  if (!selectedFile) {
    return {
      analyzing,
      applying,
      handleAutoCategories: async () => {},
      handleAutoSubcategories: async () => {},
      handleAutoSubsubcategories: async () => {},
    };
  }

  const mappedFilename = selectedFile.filename.replace(
    "_translated.json",
    "_mapped.json"
  );

  /* ============================================================
     🧠 MOTOR SEMÁNTICO UNIVERSAL
  ============================================================ */

  const runSemanticClassification = async (level) => {
  const data = await semanticClassify(mappedFilename, {
    mode: "only-null",
    level, // 🔥 enviamos nivel
    fieldWeights: {
      title: 0.7,
      description: 0.3,
    },
  });

    if (!data?.success) throw new Error();

    await loadReviewFile({
      ...selectedFile,
      filename: mappedFilename,
      mappedFile: mappedFilename,
    });
  };

  /* ============================================================
     📌 CATEGORÍAS
  ============================================================ */
  const handleAutoCategories = async () => {
    try {
      setAnalyzing(true);
      await runSemanticClassification("category");
    } catch (err) {
      console.error("❌ Semantic categorías:", err);
      alert("Error clasificando categorías");
    } finally {
      setAnalyzing(false);
    }
  };

  /* ============================================================
     📌 SUBCATEGORÍAS
  ============================================================ */
  const handleAutoSubcategories = async () => {
    try {
      setAnalyzing(true);
      await runSemanticClassification("subcategory");
    } catch (err) {
      console.error("❌ Semantic subcategorías:", err);
      alert("Error clasificando subcategorías");
    } finally {
      setAnalyzing(false);
    }
  };

  /* ============================================================
     📌 SUBSUBCATEGORÍAS
  ============================================================ */
  const handleAutoSubsubcategories = async () => {
    try {
      setAnalyzing(true);
      await runSemanticClassification("subsubcategory");
    } catch (err) {
      console.error("❌ Semantic sub-subcategorías:", err);
      alert("Error clasificando sub-subcategorías");
    } finally {
      setAnalyzing(false);
    }
  };

  return {
    analyzing,
    applying,
    handleAutoCategories,
    handleAutoSubcategories,
    handleAutoSubsubcategories,
  };
}