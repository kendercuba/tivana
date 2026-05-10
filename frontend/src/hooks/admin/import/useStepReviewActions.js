export default function useStepReviewActions({
  products,
  setProducts,
  originalProductsRef,
  productsToShow,
  getProductKey,
  selectionMode,
  setSelectionMode,
  selectedMap,
  setSelectedMap,
  draftEdits,
  setDraftEdits
}) {

  /* =====================================================
     🟡 MODO SELECCIÓN
  ===================================================== */

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => !prev);
    setSelectedMap({});
  };

  /* =====================================================
     🟡 SELECCIÓN POR COLUMNA
  ===================================================== */

  const toggleSelectAll = (level, checked) => {
    const updated = {};

    productsToShow.forEach((p) => {
      const key = getProductKey(p);
      updated[key] = {
        ...selectedMap[key],
        [level]: checked
      };
    });

    setSelectedMap((prev) => ({ ...prev, ...updated }));
  };

  /* =====================================================
     🟡 SELECCIÓN POR FILA
  ===================================================== */

  const toggleRowSelection = (productKey, level, checked) => {
    setSelectedMap((prev) => ({
      ...prev,
      [productKey]: {
        ...prev[productKey],
        [level]: checked
      }
    }));
  };

const isAllSelected = (levels = ["category", "subcategory", "subsubcategory"]) => {
  if (!productsToShow.length) return false;

  return productsToShow.every(p => {
    const key = getProductKey(p);
    return levels.every(level => selectedMap[key]?.[level]);
  });
};


const toggleSelectAllRows = (checked) => {
  const next = {};

  productsToShow.forEach(p => {
    const key = getProductKey(p);
    next[key] = {
      category: checked,
      subcategory: checked,
      subsubcategory: checked
    };
  });

  setSelectedMap(checked ? next : {});
};



const deleteSelectedClassifications = async ({
  cleanup,
  clearDrafts,
  getProductKey
}) => {
  const levels = ["subsubcategory", "subcategory", "category"];

  for (const level of levels) {
    const keys = Object.entries(selectedMap)
      .filter(([, v]) => v[level])
      .map(([k]) => k);

    if (!keys.length) continue;

    await cleanup.clearClassification({
      level,
      selectedMap,
      getProductKey
    });

    clearDrafts(keys, level);
  }

  setSelectedMap({});
};

const clearSelection = () => {
  setSelectedMap({});
};
  /* =====================================================
     🟢 EDICIÓN VISUAL (DRAFT)
  ===================================================== */

const changeCategory = (productKey, value, originalProduct) => {
  setDraftEdits(prev => {
    const next = { ...prev };

    // ➕ Crear nueva categoría
    if (value === "__new__") {
      next[productKey] = {
        __create: {
          level: "category",
          name: ""
        }
      };

      delete next[productKey].category_id;
      delete next[productKey].subcategory_id;
      delete next[productKey].subsubcategory_id;

      return next;
    }

    const newValue = value ? Number(value) : null;
    const originalValue = originalProduct.category_id ?? null;

    if (newValue === originalValue) {
      delete next[productKey];
      return next;
    }

    next[productKey] = {
      ...next[productKey],
      category_id: newValue,
      subcategory_id: null,
      subsubcategory_id: null
    };

    return next;
  });

  // 🔥 SINCRONIZAR PRODUCTS (OPCIÓN A)
  const newValue = value ? Number(value) : null;

  setProducts(prev =>
    prev.map(p =>
      getProductKey(p) === productKey
        ? {
            ...p,
            category_id: newValue,
            subcategory_id: null,
            subsubcategory_id: null
          }
        : p
    )
  );
};


  const updateCreateName = (productKey, name) => {
  setDraftEdits(prev => ({
    ...prev,
    [productKey]: {
      ...prev[productKey],
      __create: {
        ...prev[productKey]?.__create,
        name
      }
    }
  }));
};

const changeSubcategory = (productKey, value, originalProduct) => {
  console.log("🔥 changeSubcategory CALLED", {
    productKey,
    value,
    originalCategory: originalProduct.category_id,
    draftBefore: draftEdits[productKey]
  });

  setDraftEdits(prev => {
    const next = { ...prev };

    if (value === "__new__") {
      const categoryId =
        prev[productKey]?.category_id ?? originalProduct.category_id;

      if (!categoryId) return prev;

      next[productKey] = {
        ...next[productKey],
        category_id: categoryId,
        subcategory_id: null,
        subsubcategory_id: null,
        __create: {
          level: "subcategory",
          name: ""
        }
      };

      return next;
    }

    const newValue = value ? Number(value) : null;
    const originalValue = originalProduct.subcategory_id ?? null;

    if (newValue === originalValue) {
      if (next[productKey]) {
        delete next[productKey].subcategory_id;
        delete next[productKey].subsubcategory_id;
        if (Object.keys(next[productKey]).length === 0) {
          delete next[productKey];
        }
      }
      return next;
    }

    next[productKey] = {
      ...next[productKey],
      subcategory_id: newValue,
      subsubcategory_id: null
    };

    return next;
  });

  // 🔥 🔥 🔥 AQUÍ MISMO VA ESTE BLOQUE (NO DENTRO DEL setDraftEdits)
  const newValue = value ? Number(value) : null;

  setProducts(prev =>
    prev.map(p =>
      getProductKey(p) === productKey
        ? {
            ...p,
            subcategory_id: newValue,
            subsubcategory_id: null
          }
        : p
    )
  );
};


const changeSubsubcategory = (productKey, value, originalProduct) => {
  setDraftEdits(prev => {
    const next = { ...prev };

    // ➕ Crear nueva sub-subcategoría
    if (value === "__new__") {
  const subcategoryId =
  prev[productKey]?.subcategory_id ??
  originalProduct.subcategory_id;

if (!subcategoryId) return prev;

// 🔑 GARANTIZAR parent en el draft
next[productKey] = {
  ...next[productKey],
  subcategory_id: subcategoryId
};


  if (!subcategoryId) return prev;

  next[productKey] = {
    ...next[productKey],
    subcategory_id: subcategoryId, // 🔑 CLAVE
    __create: {
      level: "subsubcategory",
      name: ""
    }
  };

  delete next[productKey].subsubcategory_id;
  return next;
}


    const newValue = value ? Number(value) : null;
    const originalValue = originalProduct.subsubcategory_id ?? null;

    if (newValue === originalValue) {
      if (next[productKey]) {
        delete next[productKey].subsubcategory_id;
        if (Object.keys(next[productKey]).length === 0) {
          delete next[productKey];
        }
      }
      return next;
    }

    next[productKey] = {
      ...next[productKey],
      subsubcategory_id: newValue
    };

    return next;

    
  });
  const newValue = value ? Number(value) : null;

setProducts(prev =>
  prev.map(p =>
    getProductKey(p) === productKey
      ? {
          ...p,
          subsubcategory_id: newValue
        }
      : p
  )
);

};


const confirmCreate = async (productKey, originalProduct, createFn) => {
  const draft = draftEdits[productKey];
  if (!draft?.__create?.name) return;

  const { level, name } = draft.__create;

  const created = await createFn({
  ...(level === "category" && { name }),
  ...(level === "subcategory" && {
    name,
    category_id: draft.category_id ?? originalProduct.category_id
  }),
  ...(level === "subsubcategory" && {
    name,
    subcategory_id: draft.subcategory_id ?? originalProduct.subcategory_id
  })
});

const createdId = created?.id ?? created; // ✅ soporta ambos casos
if (!createdId) return;

setDraftEdits(prev => {
  const next = { ...prev };
  const draft = next[productKey];

  if (!draft) return prev;

  // 🧹 eliminar estado temporal correctamente
  delete draft.__create;

  if (level === "category") {
    draft.category_id = createdId;
    draft.subcategory_id = null;
    draft.subsubcategory_id = null;
  }

  if (level === "subcategory") {
    draft.subcategory_id = createdId;
    draft.subsubcategory_id = null;
  }

  if (level === "subsubcategory") {
    draft.subsubcategory_id = createdId;
  }

  return { ...next };
});


};

/* =====================================================
   🔄 RESET COMPLETO DEL EDITOR
===================================================== */
const resetAllChanges = () => {

  if (!originalProductsRef?.current?.length) return;

  setProducts(JSON.parse(JSON.stringify(originalProductsRef.current)));

  setDraftEdits({});
  setSelectedMap({});
  setSelectionMode(false);

};


  /* =====================================================
     📤 API PÚBLICA
  ===================================================== */

 return {
  // selección
  toggleSelectionMode,
  toggleSelectAll,
  toggleSelectAllRows, // 👈 NUEVA
  toggleRowSelection,
  deleteSelectedClassifications,
   clearSelection,

  // edición
  changeCategory,
  changeSubcategory,
  changeSubsubcategory,
  updateCreateName,
  confirmCreate,

   // reset
  resetAllChanges
};

}
