import { useState, useMemo, useEffect, useRef } from "react";
import StepReviewTable from "./StepReviewTable.jsx";
import useStepReviewData from "../../../../hooks/admin/import/useStepReviewData";
import useStepReviewActions from "../../../../hooks/admin/import/useStepReviewActions";
import useClassificationCleanup from "../../../../hooks/admin/import/useClassificationCleanup";
import { persistMappedFile } from "../../../../hooks/admin/import/persistMappedFile";
import useClassificationAutomation  from "../../../../hooks/admin/import/useClassificationAutomation";
import useClassificationAudit from "../../../../hooks/admin/import/useClassificationAudit";



export default function StepReview() {


const ITEMS_PER_PAGE = 10;
const [currentPage, setCurrentPage] = useState(1);
const originalProductsRef = useRef([]);  
  // 🔑 Helper
const getProductKey = (p) => p.id;


  // 🧠 UI state (FASE A)
  const [draftEdits, setDraftEdits] = useState({});
  const [auditSuggestions, setAuditSuggestions] = useState([]);
  const [auditRan, setAuditRan] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

 // 🔘 FASE B — modo selección
const [selectionMode, setSelectionMode] = useState(false);

// 📦 selección por fila y nivel
// { productKey: { category: true, subcategory: true } }
const [selectedMap, setSelectedMap] = useState({});
const [previewImage, setPreviewImage] = useState(null);
const selectedCount = Object.values(selectedMap).filter(
  v => v?.category || v?.subcategory || v?.subsubcategory
).length;


const hasSelectedProducts = selectedCount > 0;


  const clearDrafts = (keys, level) => {
  setDraftEdits(prev => {
    const next = { ...prev };

    keys.forEach(k => {
      if (!next[k]) return;

      if (level === "category") {
        delete next[k];
      } else if (level === "subcategory") {
        delete next[k].subcategory_id;
        delete next[k].subsubcategory_id;
      } else if (level === "subsubcategory") {
        delete next[k].subsubcategory_id;
      }

      if (Object.keys(next[k]).length === 0) {
        delete next[k];
      }
    });

    return next;
  });
};
  

  const dirtyCount = Object.keys(draftEdits).length;

  
  // 📦 DATA
const {
  reviewFiles,
  selectedFile,
  setSelectedFile,
  products,
  setProducts,
  taxonomy,
  loadReviewFiles,
  loadReviewFile,
  loadTaxonomy
} = useStepReviewData();

useEffect(() => {

  if (!selectedFile) return;
  if (!products?.length) return;

  // guardar snapshot solo si está vacío
  if (originalProductsRef.current.length === 0) {
    originalProductsRef.current = JSON.parse(JSON.stringify(products));
  }

}, [products, selectedFile]);

const audit = useClassificationAudit({
  selectedFile,
  products,
  draftEdits,
  setAuditSuggestions
});

const normalizeFiles = (reviewFiles || []).map(f => {
  const dateTime = `${f.date} ${f.time || "00:00:00"}`;
  return {
    ...f,
    __datetime: new Date(dateTime)
  };
});



const sortedReviewFiles = [...normalizeFiles].sort((a, b) => {
  return b.__datetime - a.__datetime;
});



const totalPages = Math.ceil(sortedReviewFiles.length / ITEMS_PER_PAGE);

const paginatedFiles = sortedReviewFiles.slice(
  (currentPage - 1) * ITEMS_PER_PAGE,
  currentPage * ITEMS_PER_PAGE
);


const classificationAutomation = useClassificationAutomation({
  selectedFile,
  setProducts,
  loadReviewFile
});



  
   // 🔘 FASE C — FILTROS DE LA TABLA
const [tableFilters, setTableFilters] = useState({
  title: "",        // 🔎 NUEVO FILTRO
  category_id: "",
  subcategory_id: "",
  subsubcategory_id: ""
});

// 👁️ FILTRO DE VISTA
const [viewFilter, setViewFilter] = useState("all");


  // 🧮 Filtro VISUAL (sin lógica)
const productsToShow = useMemo(() => {
  return (products || []).filter((p) => {

    const key = getProductKey(p);

    // 🔎 FILTRO POR TÍTULO
if (tableFilters.title) {
  const search = tableFilters.title.toLowerCase();

  const title = (p.title?.es || p.title || "").toLowerCase();

  if (!title.includes(search)) {
    return false;
  }
}


    // 👁️ FILTRO: SOLO SELECCIONADOS
    if (viewFilter === "selected") {
      if (!selectedMap[key]) return false;
    }

    // Categoría
    if (tableFilters.category_id) {
      if (
        tableFilters.category_id === "unclassified"
          ? !!p.category_id
          : p.category_id !== Number(tableFilters.category_id)
      ) {
        return false;
      }
    }

    // Subcategoría
    if (tableFilters.subcategory_id) {
      if (
        tableFilters.subcategory_id === "unclassified"
          ? !!p.subcategory_id
          : p.subcategory_id !== Number(tableFilters.subcategory_id)
      ) {
        return false;
      }
    }

    // Sub-subcategoría
    if (tableFilters.subsubcategory_id) {
      if (
        tableFilters.subsubcategory_id === "unclassified"
          ? !!p.subsubcategory_id
          : p.subsubcategory_id !== Number(tableFilters.subsubcategory_id)
      ) {
        return false;
      }
    }

    return true;
  });
}, [products, tableFilters, viewFilter, selectedMap]);

  // 🧪 Debug controlado (permitido)
  useEffect(() => {
  console.group("🧪 [STEP REVIEW] draftEdits snapshot");

  Object.entries(draftEdits).forEach(([key, value]) => {
    console.log(key, value);
  });

  console.groupEnd();
}, [draftEdits]);




const actions = useStepReviewActions({
  products,          // 👈 AÑADIR
  setProducts, 
  originalProductsRef,
  productsToShow,
  getProductKey,

  selectionMode,
  setSelectionMode,
  selectedMap,
  setSelectedMap,

  draftEdits,
  setDraftEdits,
});

const cleanup = useClassificationCleanup({
  products,
  setProducts,
  selectedFile,
  persistChanges: persistMappedFile
});

const handleApplyChanges = async () => {
  try {
    setIsApplying(true);

    const updatedProducts = [...products];
    

    /* =====================================================
       2️⃣ APLICAR DRAFTS + IDS CREADOS AL PRODUCTO
    ===================================================== */

    for (const [key, draft] of Object.entries(draftEdits)) {
      const index = updatedProducts.findIndex(
        (p) => getProductKey(p) === key
      );

      if (index === -1) continue;

      const base = updatedProducts[index];
      updatedProducts[index] = {
  ...base,
  ...draft
};

    }

 // 🧹 LIMPIAR Y NORMALIZAR PRODUCTOS ANTES DE PERSISTIR
const cleanedProducts = updatedProducts.map((p) => {
  const {
    newCategoryName,
    newSubcategoryName,
    newSubsubcategoryName,
    __create,
    __dirty,
    category_id,
    subcategory_id,
    subsubcategory_id,
    ...rest
  } = p;

  return {
  ...rest,

  // 🔑 OBLIGATORIOS PARA persistMappedFile
  category_id: Number.isInteger(category_id) ? category_id : null,
  subcategory_id: Number.isInteger(subcategory_id) ? subcategory_id : null,
  subsubcategory_id: Number.isInteger(subsubcategory_id)
    ? subsubcategory_id
    : null
};

});


    /* =====================================================
       3️⃣ PERSISTIR JSON / DB
    ===================================================== */

  await persistMappedFile({
  filename: selectedFile.filename,
  products: cleanedProducts
});

    /* =====================================================
       4️⃣ SINCRONIZAR ESTADO (PRIMERO PRODUCTOS)
    ===================================================== */

    setProducts(cleanedProducts);
    setDraftEdits({});
    setSelectedMap({});
    setSelectionMode(false);

    /* =====================================================
       5️⃣ 🔥 ÚNICO loadTaxonomy — YA CON PRODUCTOS CORRECTOS
    ===================================================== */

    await loadTaxonomy();

  } catch (err) {
    console.error("❌ Error aplicando cambios:", err);
    alert(err.message || "Error al aplicar cambios");
  } finally {
    setIsApplying(false);
  }
};


  return (
    <div className="p-6 bg-white rounded shadow-md w-full">
      <h2 className="text-2xl font-bold mb-6">
        3 - Revisar clasificación
      </h2>
     
      {/* 📂 LISTA DE ARCHIVOS */}
      <div className="border rounded-lg overflow-hidden shadow-sm mb-6">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">Archivo</th>
              <th className="px-4 py-2 text-center">Productos</th>
              <th className="px-4 py-2 text-center">Fecha</th>
              <th className="px-4 py-2 text-center">Hora</th>
              <th className="px-4 py-2 text-center">Estado</th>
              <th className="px-4 py-2 text-center">Acción</th>
            </tr>
          </thead>

        <tbody>
  {paginatedFiles.map((f) => (
    <tr key={f.id} className="border-t">

      {/* Archivo */}
      <td className="px-4 py-2">
        {f.filename}
      </td>

      {/* Productos */}
      <td className="px-4 py-2 text-center">
        {f.total_products}
      </td>

      {/* Fecha */}
      <td className="px-4 py-2 text-center">
        {f.date}
      </td>

      {/* Hora */}
      <td className="px-4 py-2 text-center">
        {f.time}
      </td>

      {/* Estado */}
      <td className="px-4 py-2 text-center">
        <span className="px-2 py-1 rounded text-sm bg-blue-100 text-blue-700">
  mapped
</span>
      </td>

      {/* Acción */}
      <td className="px-4 py-2 text-center">
        <button
          className="text-blue-600 hover:underline"
      onClick={async () => {

  // borrar snapshot anterior
  originalProductsRef.current = [];

  // cargar archivo
  const loadedProducts = await loadReviewFile(f);

  // guardar snapshot nuevo
  originalProductsRef.current = JSON.parse(JSON.stringify(loadedProducts));

}}

        >
          Revisar
        </button>

      </td>

    </tr>
  ))}
</tbody>


        </table>
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-3 py-1 rounded border text-sm ${
                    currentPage === i + 1
                      ? "bg-blue-600 text-white"
                      : "bg-white hover:bg-gray-100"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}

      </div>



      {/* 🧱 TABLA */}
      {selectedFile && (
        <StepReviewTable
  productsToShow={productsToShow}
  taxonomy={taxonomy}
  resetAllChanges={actions.resetAllChanges}
  draftEdits={draftEdits}
  setDraftEdits={setDraftEdits}
  getProductKey={getProductKey}

  previewImage={previewImage}
  setPreviewImage={setPreviewImage}
        
  viewFilter={viewFilter}
  setViewFilter={setViewFilter}
  hasSelectedProducts={hasSelectedProducts}
  selectedCount={selectedCount} 
       

  selectionMode={selectionMode}
  setSelectionMode={setSelectionMode}
  selectedMap={selectedMap}
  setSelectedMap={setSelectedMap}
  
  
  tableFilters={tableFilters}
  setTableFilters={setTableFilters}

  actions={actions}
  cleanup={cleanup}
  clearDrafts={clearDrafts}

  dirtyCount={dirtyCount}               
  onApplyChanges={handleApplyChanges}

  onAutoClassifyCategory={classificationAutomation.handleAutoCategories}
  onAutoClassifySubcategories={classificationAutomation.handleAutoSubcategories}
  onAutoClassifySubsubcategories={classificationAutomation.handleAutoSubsubcategories}

/>

      )}
    </div>
  );
}
