// frontend/src/hooks/admin/import/useClassificationEditor.js

import { useState } from "react";

/**
 * Hook: useClassificationEditor
 *
 * Responsabilidad:
 * - Manejar estados temporales de edición manual
 * - Manejar creación inline (input + confirm/cancel)
 * - Marcar cambios como dirty
 *
 * ❌ NO persiste en backend
 * ❌ NO recarga taxonomía
 * ❌ NO decide reglas de negocio
 */
export default function useClassificationEditor({
  selectedFile,
  productsToShow,
  getProductKey
}) {
  // ===============================
  // Estados
  // ===============================
  const [manualAssignments, setManualAssignments] = useState({});
  const [manualSubsubAssignments, setManualSubsubAssignments] = useState({});
  const [manualCategoryAssignments, setManualCategoryAssignments] = useState({});
  const [creatingInline, setCreatingInline] = useState({});
  const [dirtyMap, setDirtyMap] = useState({});
  const [bulkSubcategoryId, setBulkSubcategoryId] = useState("");

  // ===============================
  // Dirty helper
  // ===============================
  const markDirty = (productKey, field, isDirty) => {
    setDirtyMap(prev => {
      const next = { ...prev };

      if (isDirty) {
        next[productKey] = {
          ...(next[productKey] || {}),
          [field]: true
        };
      } else if (next[productKey]) {
        delete next[productKey][field];
        if (Object.keys(next[productKey]).length === 0) {
          delete next[productKey];
        }
      }

      return next;
    });
  };

  // ===============================
  // Inline create
  // ===============================
  const startInlineCreate = ({ productKey, level }) => {
    setCreatingInline({
      [productKey]: { level, value: "" }
    });
  };

  const updateInlineValue = (productKey, value) => {
    setCreatingInline(prev => ({
      ...prev,
      [productKey]: {
        ...prev[productKey],
        value
      }
    }));
  };

  const cancelInlineCreate = () => {
    setCreatingInline({});
  };

  /**
   * confirmInlineCreate
   * ⚠️ NO crea nada aquí
   * ⚠️ Solo delega y cierra UI si hubo éxito
   */
 const confirmInlineCreate = async ({ product, level, onCreate }) => {
  const productKey = getProductKey(product);
  const entry = creatingInline[productKey];

  if (!entry?.value?.trim()) return null;

  const payload = {
    name: entry.value.trim(),
    product
  };

  if (level === "subcategory") {
    payload.category_id =
      manualCategoryAssignments[productKey] ?? product.category_id;
  }

  // 🔥 ESTE ID ES EL QUE SE PERDÍA
  const createdId = await onCreate(payload);

  if (!createdId) return null;

  // 🔥 cerrar inline create
  setCreatingInline(prev => {
    const next = { ...prev };
    delete next[productKey];
    return next;
  });

  // 🔥 DEVOLVER EL ID (CLAVE)
  return createdId;
};


  // ===============================
  // API pública
  // ===============================
  return {
    manualAssignments,
    setManualAssignments,

    manualSubsubAssignments,
    setManualSubsubAssignments,

    manualCategoryAssignments,
    setManualCategoryAssignments,

    dirtyMap,
    setDirtyMap,
    markDirty,

    bulkSubcategoryId,
    setBulkSubcategoryId,

    creatingInline,
    startInlineCreate,
    updateInlineValue,
    cancelInlineCreate,
    confirmInlineCreate
  };
}
