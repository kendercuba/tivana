// frontend/src/hooks/admin/import/useClassificationCleanup.js
import { persistMappedFile } from "./persistMappedFile";

/**
 * Hook: useClassificationCleanup
 *
 * Responsabilidad ÚNICA:
 * - Ejecutar limpieza de clasificación
 * - Reescribir archivo .json
 *
 * ❌ NO maneja selección
 * ❌ NO renderiza UI
 */



export default function useClassificationCleanup({
  products,
  setProducts,
  selectedFile,
  persistChanges // (updatedProducts, selectedFile)
}) {
  /* =====================================================
     CONTADOR (derivado, NO estado)
  ===================================================== */

  const getSelectedCount = (selectedMap) =>
    Object.values(selectedMap || {}).reduce(
      (acc, row) => acc + Object.values(row).filter(Boolean).length,
      0
    );

  /* =====================================================
     FASE D — LIMPIAR CLASIFICACIÓN + REESCRIBIR JSON
  ===================================================== */

 const clearClassification = async ({
  level,
  selectedMap,
  getProductKey
}) => {
  if (!selectedFile) return;

  const selectedKeys = Object.entries(selectedMap || {})
    .filter(([, v]) => v[level])
    .map(([k]) => k);

  if (!selectedKeys.length) return;

 const updatedProducts = products.map((p) => {
  const key = getProductKey(p);
  if (!selectedKeys.includes(key)) return p;

  const cleaned = { ...p };

  if (level === "category") {
    cleaned.category_id = null;
    cleaned.subcategory_id = null;
    cleaned.subsubcategory_id = null;
  }

  if (level === "subcategory") {
    cleaned.subcategory_id = null;
    cleaned.subsubcategory_id = null;
  }

  if (level === "subsubcategory") {
    cleaned.subsubcategory_id = null;
  }

  // limpiar metadatos del motor
  cleaned.category_confidence = null;
  cleaned.subcategory_confidence = null;
  cleaned.subsubcategory_confidence = null;
  cleaned.semantic_version = null;

  return cleaned;
});

  await persistMappedFile({
    filename: selectedFile.filename,
    products: updatedProducts
  });

  setProducts(updatedProducts);
};

  /* =====================================================
     API PÚBLICA
  ===================================================== */

  return {
    getSelectedCount,
    clearClassification
  };
}
