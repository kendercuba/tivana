import { useMemo, useState } from "react";
import HeaderMenu from "../../../../components/admin/import/HeaderMenu";



export default function StepReviewTable({
  
  productsToShow,
  viewFilter,
  setViewFilter,
  resetAllChanges,
  hasSelectedProducts,
  selectedCount,
  taxonomy,
  draftEdits,
  setDraftEdits,
  getProductKey,
  previewImage,
  setPreviewImage,
  selectedMap,

  tableFilters,
  setTableFilters,
  cleanup,
  actions,
  clearDrafts,

  dirtyCount,           
  onApplyChanges, 

  onAutoClassifyCategory,
  onAutoClassifySubcategories,
  onAutoClassifySubsubcategories

}) {



  // 🔎 Resaltar texto buscado dentro del título
const highlightText = (text, search) => {
  if (!search) return text;

  const regex = new RegExp(`(${search})`, "gi");

  const parts = text.split(regex);

  return parts.map((part, i) =>
    part.toLowerCase() === search.toLowerCase() ? (
      <mark key={i} className="bg-yellow-200 px-1 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
};


const hasCategorySelection = Object.values(selectedMap).some(
  v => v?.category === true
);


const hasSubcategorySelection = Object.values(selectedMap).some(
  v => v?.subcategory === true
);

const hasSubsubcategorySelection = Object.values(selectedMap).some(
  v => v.subsubcategory === true
);

const activeCategoryIds = Array.from(
  new Set(
    productsToShow
      .filter(p => {
        const key = getProductKey(p);
        return selectedMap[key]?.subcategory;
      })
      .map(p =>
        draftEdits[getProductKey(p)]?.category_id ??
        p.category_id
      )
      .filter(v => v !== undefined && v !== null)
  )
);

// solo válida si hay UNA sola categoría
const bulkSubcategoryCategoryId =
  activeCategoryIds.length === 1 ? activeCategoryIds[0] : null;


  const activeSubcategoryIds = Array.from(
  new Set(
    productsToShow
      .filter(p => {
        const key = getProductKey(p);
        return selectedMap[key]?.subsubcategory;
      })
      .map(p =>
        draftEdits[getProductKey(p)]?.subcategory_id ??
        p.subcategory_id
      )
      .filter(v => v !== undefined && v !== null)

  )
);

const bulkSubsubcategorySubcategoryId =
  activeSubcategoryIds.length === 1 ? activeSubcategoryIds[0] : null;


const hasAnySelection = Object.values(selectedMap).some(
  v => v?.category || v?.subcategory || v?.subsubcategory
);



const categoryCounts = useMemo(() => {
  const map = {};
  productsToShow.forEach(p => {
    if (p.category_id) {
      map[p.category_id] = (map[p.category_id] || 0) + 1;
    }
  });
  return map;
}, [productsToShow]);

const subcategoryCounts = useMemo(() => {
  const map = {};
  productsToShow.forEach(p => {
    if (p.subcategory_id) {
      map[p.subcategory_id] = (map[p.subcategory_id] || 0) + 1;
    }
  });
  return map;
}, [productsToShow]);

const subsubcategoryCounts = useMemo(() => {
  const map = {};
  productsToShow.forEach(p => {
    if (p.subsubcategory_id) {
      map[p.subsubcategory_id] = (map[p.subsubcategory_id] || 0) + 1;
    }
  });
  return map;
}, [productsToShow]);

// ===============================
// TAXONOMÍA FILTRADA (SOLO USADA)
// ===============================
const availableCategories = useMemo(() => {
  return taxonomy.categories.filter(c => categoryCounts[c.id]);
}, [taxonomy.categories, categoryCounts]);

const availableSubcategories = useMemo(() => {
  return taxonomy.subcategories.filter(s => subcategoryCounts[s.id]);
}, [taxonomy.subcategories, subcategoryCounts]);

const availableSubsubcategories = useMemo(() => {
  return taxonomy.subsubcategories.filter(ss => subsubcategoryCounts[ss.id]);
}, [taxonomy.subsubcategories, subsubcategoryCounts]);


// ===============================
// CONTEOS SIN CLASIFICAR
// ===============================
const unclassifiedCategoryCount = useMemo(() => {
  return productsToShow.filter(p => !p.category_id).length;
}, [productsToShow]);

const unclassifiedSubcategoryCount = useMemo(() => {
  return productsToShow.filter(
    p => p.category_id && !p.subcategory_id
  ).length;
}, [productsToShow]);

const unclassifiedSubsubcategoryCount = useMemo(() => {
  return productsToShow.filter(
    p => !p.subsubcategory_id
  ).length;
}, [productsToShow]);


const isCategoryHeaderChecked =
  productsToShow.length > 0 &&
  productsToShow.every(p => {
    const key = getProductKey(p);
    return selectedMap[key]?.category;
  });

const isSubcategoryHeaderChecked =
  productsToShow.length > 0 &&
  productsToShow.every(p => {
    const key = getProductKey(p);
    return selectedMap[key]?.subcategory;
  });

const isSubsubcategoryHeaderChecked =
  productsToShow.length > 0 &&
  productsToShow.every(p => {
    const key = getProductKey(p);
    return selectedMap[key]?.subsubcategory;
  });


const deleteLevel =
  Object.values(selectedMap).some(v => v.subsubcategory)
    ? "subsubcategory"
    : Object.values(selectedMap).some(v => v.subcategory)
    ? "subcategory"
    : Object.values(selectedMap).some(v => v.category)
    ? "category"
    : null;

const selectedKeysForDelete = Object.entries(selectedMap)
  .filter(([, v]) => v[deleteLevel === "category"
    ? "category"
    : deleteLevel === "subcategory"
    ? "subcategory"
    : "subsubcategory"
  ])
  .map(([k]) => k);

  

 return (
  <div className="mt-6">
    {/* TÍTULO + BOTONES */}
    <div className="flex justify-between items-center mb-3">
      <h3 className="text-xl font-semibold">
        Vista previa de clasificación
      </h3>

      <div className="flex items-center gap-2">        
        
      </div>
    </div>

<div className="flex justify-end items-center gap-4 mb-3">  
 {/* 🔄 Reset + Seleccionar todo */}

<select
  className="border rounded text-sm px-2 py-1"
  value={viewFilter}
  onChange={(e) => setViewFilter(e.target.value)}
>
  <option value="all">Todos</option>

  <option
  value="selected"
  disabled={!hasSelectedProducts}
>
  Seleccionados ({selectedCount})
</option>
</select>

<div className="flex items-center gap-2 text-sm font-medium text-gray-700">
  {/* 🔄 Reset filtros */}
  <button
  type="button"
  onClick={resetAllChanges}
  title="Restablecer filtros"
  className="
    p-1.5
    rounded-md
    text-blue-600
    hover:bg-blue-50
    transition
  "
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className="w-[18px] h-[18px]"
    fill="currentColor"
  >
    <path d="M12.57 1.25a10.83 10.83 0 0 0-9.75 7.14a.25.25 0 0 1-.27.16L.86 8.31a.5.5 0 0 0-.49.21a.51.51 0 0 0 0 .53L3 13.75a.5.5 0 0 0 .4.25a.46.46 0 0 0 .42-.14l3.77-3.74a.51.51 0 0 0 .12-.51a.48.48 0 0 0-.4-.34L5.59 9a.25.25 0 0 1-.18-.12a.26.26 0 0 1 0-.23a8.34 8.34 0 0 1 7.26-4.9a8.25 8.25 0 1 1-6.36 13.13a1.25 1.25 0 1 0-2 1.48a10.75 10.75 0 1 0 8.26-17.11"/>
  </svg>
</button>


  {/* ☑ Seleccionar todo */}
  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      className="h-4 w-4 accent-blue-600"
      checked={
        productsToShow.length > 0 &&
        productsToShow.every(p => {
          const key = getProductKey(p);
          return (
            selectedMap[key]?.category &&
            selectedMap[key]?.subcategory &&
            selectedMap[key]?.subsubcategory
          );
        })
      }
      onChange={(e) =>
        actions.toggleSelectAllRows(e.target.checked)
      }
    />
    <span>Seleccionar todo</span>
  </label>
</div>


  {/* 🗑️ Eliminar */}
  <button
  type="button"
  disabled={!hasAnySelection}
  onClick={() =>
    actions.deleteSelectedClassifications({
      cleanup,
      clearDrafts,
      getProductKey
    })
  }
  title="Eliminar clasificaciones seleccionadas"
  className={`flex items-center justify-center rounded-md p-2 transition
    ${
      hasAnySelection
        ? "text-gray-500 hover:text-blue-600 hover:bg-blue-50"
        : "text-gray-300 cursor-not-allowed"
    }
  `}
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.5"
  >
    <path d="m20 9l-1.995 11.346A2 2 0 0 1 16.035 22h-8.07a2 2 0 0 1-1.97-1.654L4 9m17-3h-5.625M3 6h5.625m0 0V4a2 2 0 0 1 2-2h2.75a2 2 0 0 1 2 2v2m-6.75 0h6.75" />
  </svg>
</button>


  {/* Aplicar cambios */}
  <button
  disabled={dirtyCount === 0}
  onClick={async () => {
    await onApplyChanges();
    actions.clearSelection?.();
  }}
  className={`px-3 py-1 rounded text-sm transition
    ${
      dirtyCount > 0
        ? "bg-blue-600 hover:bg-blue-700 text-white"
        : "bg-gray-200 text-gray-400 cursor-not-allowed"
    }
  `}
>
  Aplicar cambios ({dirtyCount})
</button>
</div>

      <div className="border rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm table-fixed">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-4 py-2 w-20">Imagen</th>
              <th className="px-4 py-2 w-[520px]">
                <div className="flex flex-col gap-1">
                  <span>Título</span>

                  <input
                    type="text"
                    placeholder="Buscar título..."
                    className="border rounded text-xs px-2 py-1 w-full"
                    value={tableFilters.title || ""}
                    onChange={(e) =>
                      setTableFilters(prev => ({
                        ...prev,
                        title: e.target.value
                      }))
                    }
                  />
                </div>
              </th>

              {/* CATEGORÍA */}
              <th className="px-4 py-2 w-[180px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                      <input
                      type="checkbox"
                      className="h-4 w-4 accent-blue-600"
                      checked={isCategoryHeaderChecked}
                      onChange={(e) =>
                        actions.toggleSelectAll("category", e.target.checked)
                      }
                    />
                    <span>Categoría</span>
                  </div>
                  <HeaderMenu
                    items={[
                      {
                        label: "Clasificar automáticamente",
                        onClick: onAutoClassifyCategory
                      },
                      
                    ]}
                  />

                </div>

                                <select
                  className="mt-1 w-full border rounded text-xs"
                  value={tableFilters.category_id}
                  onChange={(e) =>
                    setTableFilters(prev => ({
                      ...prev,
                      category_id: e.target.value,
                      subcategory_id: "",
                      subsubcategory_id: ""
                    }))
                  }
                >
                  <option value="">Todas</option>
                  <option value="unclassified">
                  Sin clasificar ({unclassifiedCategoryCount})
                </option>


                  {availableCategories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({categoryCounts[c.id]})
                </option>
              ))}

                </select>
                  <div className="mt-1">
                    <select
                      className="w-full border rounded text-xs"
                      disabled={!hasCategorySelection}
                      value=""
                      onChange={(e) => {
                        const value = Number(e.target.value);

                        productsToShow.forEach(p => {
                          const key = getProductKey(p);
                          if (selectedMap[key]?.category) {
                            actions.changeCategory(key, value, p);
                          }
                        });
                      }}
                    >
                      <option value="">
                        {hasCategorySelection
                          ? "Aplicar categoría a seleccionados"
                          : "Selecciona productos"}
                      </option>

                      {taxonomy.categories.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                
              </th>

              {/* SUBCATEGORÍA */}
              <th className="px-4 py-2 w-[180px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">                   
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-blue-600"
                        checked={isSubcategoryHeaderChecked}
                        onChange={(e) =>
                          actions.toggleSelectAll("subcategory", e.target.checked)
                        }
                      />
                                    
                    <span>Subcategoría</span>
                  </div>
                  <HeaderMenu
                    items={[
                      {
                        label: "Clasificar automáticamente",
                        onClick: onAutoClassifySubcategories
                      }                      
                    ]}
                  />

                </div>
                              <select
                className="mt-1 w-full border rounded text-xs"
                value={tableFilters.subcategory_id}
                onChange={(e) =>
                  setTableFilters(prev => ({
                    ...prev,
                    subcategory_id: e.target.value,
                    subsubcategory_id: ""
                  }))
                }
              >
                <option value="">Todas</option>
                <option value="unclassified">
                  Sin clasificar ({unclassifiedSubcategoryCount})
                </option>


                {availableSubcategories
                  .filter(
                    s =>
                      !tableFilters.category_id ||
                      s.category_id === Number(tableFilters.category_id)
                  )
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({subcategoryCounts[s.id]})
                    </option>
                  ))}

              </select> 
              
                <div className="mt-1">
                  <select
                    className="w-full border rounded text-xs"
                    disabled={!bulkSubcategoryCategoryId || !hasSubcategorySelection}
                    value=""
                    onChange={(e) => {
                      const value = Number(e.target.value);

                      productsToShow.forEach(p => {
                        const key = getProductKey(p);
                        if (selectedMap[key]?.subcategory) {
                          actions.changeSubcategory(key, value, p);
                        }
                      });
                    }}
                  >
                    <option value="">
                      {bulkSubcategoryCategoryId && hasSubcategorySelection
                        ? "Aplicar subcategoría a seleccionados"
                        : "Selecciona productos de una misma categoría"}
                    </option>

                    {taxonomy.subcategories
                      .filter(s => s.category_id === bulkSubcategoryCategoryId)
                      .map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>

            
              </th>

              {/* SUB-SUB */}
              <th className="px-4 py-2 w-[180px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">                    
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-blue-600"
                        checked={isSubsubcategoryHeaderChecked}
                        onChange={(e) =>
                          actions.toggleSelectAll("subsubcategory", e.target.checked)
                        }
                      />                 
                    <span>Sub-sub</span>
                  </div>
                  <HeaderMenu
                    items={[
                      {
                        label: "Clasificar automáticamente",
                        onClick: onAutoClassifySubsubcategories
                      }
                     
                    ]}
                  />

                </div>
                   <select
                  className="mt-1 w-full border rounded text-xs"
                   value={tableFilters.subsubcategory_id}
                  onChange={(e) =>
                    setTableFilters(prev => ({
                      ...prev,
                      subsubcategory_id: e.target.value
                    }))
                  }

                >
                  <option value="">Todas</option>
                  <option value="unclassified">
                  Sin clasificar ({unclassifiedSubsubcategoryCount})
                </option>


                  {availableSubsubcategories
                    .filter(
                      ss =>
                        !tableFilters.subcategory_id ||
                        ss.subcategory_id === Number(tableFilters.subcategory_id)
                    )
                    .map(ss => (
                      <option key={ss.id} value={ss.id}>
                        {ss.name} ({subsubcategoryCounts[ss.id]})
                      </option>
                    ))}


                </select>
                 <div className="mt-1">
                  <select
                    className="w-full border rounded text-xs"
                    disabled={!bulkSubsubcategorySubcategoryId || !hasSubsubcategorySelection}
                    value=""
                    onChange={(e) => {
                      const value = Number(e.target.value);

                      productsToShow.forEach(p => {
                        const key = getProductKey(p);
                        if (selectedMap[key]?.subsubcategory) {
                          actions.changeSubsubcategory(key, value, p);
                        }
                      });
                    }}
                  >
                    <option value="">
                      {bulkSubsubcategorySubcategoryId && hasSubsubcategorySelection
                        ? "Aplicar sub-subcategoría a seleccionados"
                        : "Selecciona productos de una misma subcategoría"}
                    </option>

                    {taxonomy.subsubcategories
                      .filter(
                        ss => ss.subcategory_id === bulkSubsubcategorySubcategoryId
                      )
                      .map(ss => (
                        <option key={ss.id} value={ss.id}>
                          {ss.name}
                        </option>
                      ))}
                  </select>
                </div>

              </th>
            </tr>
          </thead>

          <tbody>
            {productsToShow.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-gray-400"
                >
                  No hay productos para mostrar
                </td>
              </tr>
            )}

            {productsToShow.map((p, index) => {
  const productKey = getProductKey(p);


              const currentCategory =
                draftEdits[productKey]?.category_id ??
                p.category_id ??
                "";

              const currentSubcategory =
              draftEdits[productKey]?.subcategory_id ??
              p.subcategory_id ??
              "";


                const currentSubsub =
                draftEdits[productKey]?.subsubcategory_id ??
                p.subsubcategory_id ??
                "";

              return (
                <tr
                  key={productKey}
                  className={`border-t transition
                    ${
                      draftEdits[productKey]
                        ? "bg-yellow-50 ring-1 ring-yellow-400"
                        : index % 2 === 0
                        ? "bg-white hover:bg-gray-50"
                        : "bg-gray-50 hover:bg-gray-100"
                    }
                  `}
                >


                 {/* IMAGEN */}
                <td className="px-4 py-2">
                  {p.images?.[0] && (
                    <img
                      src={p.images?.[0]}
                      className="w-12 h-12 object-cover cursor-pointer"
                      onClick={() => setPreviewImage(p.images?.[0])}
                    />
                  )}
                </td>
                  {/* TÍTULO */}
                  <td className="px-4 py-2">
                    <div
                      className="line-clamp-2"
                      title={p.title?.es || p.title}
                    >
                      {highlightText(
                        p.title?.es || p.title || "",
                        tableFilters.title
                      )}
                    </div>
                  </td>

                  {/* CATEGORÍA */}
                  <td className="px-4 py-2">
                    <div className="flex items-start gap-2">
  <input
    type="checkbox"
    className="h-4 w-4 accent-blue-600 mt-1"
    checked={!!selectedMap[productKey]?.category}
    onChange={(e) =>
      actions.toggleRowSelection(
        productKey,
        "category",
        e.target.checked
      )
    }
  />

  {/* CONTENEDOR VERTICAL */}
  <div className="flex flex-col w-full">
    <select
      className="w-full border rounded text-xs"
      value={currentCategory}
      onChange={(e) =>
        actions.changeCategory(
          productKey,
          e.target.value,
          p
        )
      }
    >
      <option value="">Sin clasificar</option>
      {taxonomy.categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} ({c.id})
        </option>
      ))}
    </select>
  </div>
</div>

                  </td>

                 {/* SUBCATEGORÍA */}
<td className="px-4 py-2">
  <div className="flex items-start gap-2">
    <input
      type="checkbox"
      className="h-4 w-4 accent-blue-600 mt-1"
      checked={!!selectedMap[productKey]?.subcategory}
      onChange={(e) =>
        actions.toggleRowSelection(
          productKey,
          "subcategory",
          e.target.checked
        )
      }
    />

    {/* CONTENEDOR VERTICAL */}
    <div className="flex flex-col w-full">
      <select
        className="border rounded text-xs w-full"
        value={currentSubcategory}
        onChange={(e) =>
          actions.changeSubcategory(
            productKey,
            e.target.value,
            p
          )
        }
      >
        <option value="">Sin clasificar</option>
        {taxonomy.subcategories
          .filter(
            (s) =>
              s.category_id ===
              (draftEdits[productKey]?.category_id ?? p.category_id)
          )
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.id})
            </option>
          ))}
      </select>

     </div>
  </div>
</td>

                  {/* SUB-SUB */}
<td className="px-4 py-2">
  <div className="flex items-start gap-2">
    <input
      type="checkbox"
      className="h-4 w-4 accent-blue-600 mt-1"
      checked={!!selectedMap[productKey]?.subsubcategory}
      onChange={(e) =>
        actions.toggleRowSelection(
          productKey,
          "subsubcategory",
          e.target.checked
        )
      }
    />

    {/* CONTENEDOR VERTICAL */}
    <div className="flex flex-col w-full">
      <select
        className="border rounded text-xs w-full"
        value={currentSubsub}
        onChange={(e) =>
          actions.changeSubsubcategory(
            productKey,
            e.target.value,
            p
          )
        }
      >
        <option value="">Sin clasificar</option>
        {taxonomy.subsubcategories
          .filter(
            (ss) =>
              ss.subcategory_id ===
              (draftEdits[productKey]?.subcategory_id ?? p.subcategory_id)
          )
          .map((ss) => (
            <option key={ss.id} value={ss.id}>
              {ss.name} ({ss.id})
            </option>
          ))}
      </select>

        </div>
  </div>
</td>

                </tr>
              );
            })}
          </tbody>
        </table>
{previewImage && (
  <div
    className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
    onClick={() => setPreviewImage(null)}
  >
    <img
      src={previewImage}
      className="max-h-[90vh] max-w-[90vw] rounded shadow-lg"
    />
  </div>
)}
      </div>
   </div>
  );
}
