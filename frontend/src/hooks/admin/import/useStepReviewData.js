import { useState, useEffect } from "react";
import {
  fetchMappedFile,
  fetchTaxonomy
} from "../../../api/admin/import/classificationApi";

export default function useStepReviewData() {

  const [reviewFiles, setReviewFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [products, setProducts] = useState([]);
  const [logs, setLogs] = useState([]);

  const [taxonomy, setTaxonomy] = useState({
    categories: [],
    subcategories: [],
    subsubcategories: []
  });

  /* ============================================================
     📄 Cargar archivos MAPEADOS (HISTORIAL CORRECTO)
  ============================================================ */
  const loadReviewFiles = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/import/mapped-batches`
      );
      const data = await res.json();

      // 🔥 CORRECCIÓN AQUÍ
      if (Array.isArray(data.files)) {
        setReviewFiles(data.files);
      } else {
        setReviewFiles([]);
      }

    } catch (err) {
      console.error("Error cargando mapped batches:", err);
      setReviewFiles([]);
    }
  };

  /* ============================================================
     📦 Cargar archivo mapped para revisar
  ============================================================ */
 const loadReviewFile = async (file) => {
  try {
    const filename = file.filename;

    const data = await fetchMappedFile(filename);

    if (data?.success) {
      const normalizedProducts = (data.products || []).map(p => ({
        ...p,
        category_id: p.category_id ?? null,
        subcategory_id: p.subcategory_id ?? null,
        subsubcategory_id: p.subsubcategory_id ?? null
      }));

      setProducts(normalizedProducts);
      setLogs([]);
      setSelectedFile(file);

      return normalizedProducts; // 🔥 ESTA LÍNEA FALTABA
    }

  } catch (err) {
    console.error("Error cargando archivo mapeado:", err);
  }
};

  /* ============================================================
     🔥 Cargar taxonomía
  ============================================================ */
  const loadTaxonomy = async () => {
    try {
      const data = await fetchTaxonomy();
      if (data?.success) {
        setTaxonomy({
          categories: data.categories || [],
          subcategories: data.subcategories || [],
          subsubcategories: data.subsubcategories || []
        });
      }
    } catch (err) {
      console.error("Error cargando taxonomía:", err);
    }
  };

  useEffect(() => {
    loadReviewFiles();
    loadTaxonomy();
  }, []);

  return {
    reviewFiles,
    setReviewFiles,
    selectedFile,
    setSelectedFile,
    products,
    setProducts,
    logs,
    setLogs,
    taxonomy,
    setTaxonomy,
    loadReviewFiles,
    loadReviewFile,
    loadTaxonomy
  };
}
