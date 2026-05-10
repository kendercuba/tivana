// frontend/src/hooks/admin/import/useBulkClassification.js

export default function useBulkClassification({
  products,
  setProducts,
  selectedRows,
  tableFilters,
  applyFilters
}) {
  /* =====================================================
     🔹 Resolver productos objetivo (selected / filtered)
  ===================================================== */
  function getTargetProducts(target) {
    if (target === "selected") {
      return products.filter(p => selectedRows[p._rowKey]);
    }

    if (target === "filtered") {
      return applyFilters(products, tableFilters);
    }

    return [];
  }

  /* =====================================================
     🔹 Función base para aplicar cambios masivos
  ===================================================== */
  function applyBulk({ target, field, value }) {
    if (!value) return;

    const targets = getTargetProducts(target);
    if (!targets.length) return;

    const targetKeys = new Set(targets.map(p => p._rowKey));

    const updatedProducts = products.map(p =>
      targetKeys.has(p._rowKey)
        ? { ...p, [field]: value }
        : p
    );

    setProducts(updatedProducts);
  }

  /* =====================================================
     🟡 CATEGORÍA
  ===================================================== */
  function applyCategoryBulk({ target, categoryId }) {
    applyBulk({
      target,
      field: "category_id",
      value: categoryId
    });
  }

  /* =====================================================
     🟡 SUBCATEGORÍA
  ===================================================== */
  function applySubcategoryBulk({ target, subcategoryId }) {
    applyBulk({
      target,
      field: "subcategory_id",
      value: subcategoryId
    });
  }

  /* =====================================================
     🟡 SUB-SUBCATEGORÍA
  ===================================================== */
  function applySubsubcategoryBulk({ target, subsubcategoryId }) {
    applyBulk({
      target,
      field: "subsubcategory_id",
      value: subsubcategoryId
    });
  }

  /* =====================================================
     🔹 API pública del hook
  ===================================================== */
  return {
    applyCategoryBulk,
    applySubcategoryBulk,
    applySubsubcategoryBulk
  };
}
