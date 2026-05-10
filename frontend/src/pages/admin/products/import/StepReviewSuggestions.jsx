/* ================================================
   🧠 HELPERS PARA MOSTRAR SUGERENCIAS
================================================= */
const renderSuggestionTitle = (s) => {
  switch (s.type) {
    case "create_subcategory":
      return `Crear subcategoría en "${s.parent_name}"`;

    case "create_subsubcategory":
      return `Crear sub-subcategoría en "${s.parent_name}"`;

    case "reassign_category":
      return "Reubicar producto a otra categoría";

    case "split_subcategory":
      return `Dividir subcategoría "${s.subcategory_name}"`;

    default:
      return "Sugerencia";
  }
};

const renderSuggestionDescription = (s) => {
  switch (s.type) {
    case "create_subcategory":
    case "create_subsubcategory":
      return `Productos afectados: ${s.products_count}`;

    case "reassign_category":
      return s.reason;

    case "split_subcategory":
      return `Productos afectados: ${s.products_count}`;


    default:
      return "";
  }
};

export default function StepReviewSuggestions({
  showSuggestions,
  suggestions,
  selectedSuggestions,
  setSelectedSuggestions,
  applying,
  handleApplySuggestions,
  products,
  setHighlightedProducts
}) {
  if (!showSuggestions) return null;

  const hasSuggestions = suggestions && suggestions.length > 0;


  return (
    <div>
  <div className="mt-6 p-4 border rounded bg-indigo-50">
    <h3 className="text-lg font-bold mb-3">
      🧠 Sugerencias detectadas ({suggestions.length})
    </h3>

    {!hasSuggestions && (
  <p className="text-gray-600">No se detectaron mejoras.</p>
)}


    <ul className="space-y-3">
      {suggestions.map((s) => (
        <li
  key={s.id}
  onClick={() => {
    setHighlightedProducts(null);

    // 🔹 Dividir subcategoría
    if (s.type === "split_subcategory") {
      setHighlightedProducts(
  (products || []).filter(p => p.subcategory_id === s.subcategory_id)
);

    }

    // 🔹 Reasignar categoría
    if (s.type === "reassign_category") {
      setHighlightedProducts(
  (products || []).filter(p =>
    String(p.id) === String(s.product_id)
  )
);

    }

    // 🔹 Crear sub-subcategoría
    if (s.type === "create_subsubcategory") {
      setHighlightedProducts(
  (products || []).filter(p =>
    p.subcategory_id === s.parent_subcategory_id &&
    !p.subsubcategory_id
  )
);

    }
  }}
  className="flex items-start gap-3 bg-white p-3 rounded shadow-sm cursor-pointer hover:bg-indigo-50"
>

          <input
  type="checkbox"
  className="mt-1"
  checked={!!selectedSuggestions[s.id]}
  onClick={(e) => e.stopPropagation()}
  onChange={() =>
    setSelectedSuggestions(prev => ({
      ...prev,
      [s.id]: !prev[s.id]
    }))
  }
/>


          <div className="text-sm">
            <div className="font-semibold text-indigo-700">
              {renderSuggestionTitle(s)}
            </div>

            <div className="text-gray-600">
              {renderSuggestionDescription(s)}
            </div>

            {s.sample_products && s.sample_products.length > 0 && (
            <div className="mt-2 text-xs text-gray-600">
              <div className="font-semibold">Productos afectados:</div>
              <ul className="list-disc ml-4">
                {s.sample_products.map((title, i) => (
                  <li key={i}>{title}</li>
                ))}
              </ul>
            </div>
          )}

            {/* 🔹 Propuesta de división en grupos */}
      {s.type === "split_subcategory" && s.proposed_groups && (
        <div className="mt-2 text-xs text-gray-700">
          <div className="font-semibold mb-1">
            Se propone dividir en:
          </div>

          <ul className="list-disc ml-4 space-y-1">
            {s.proposed_groups.map((g, i) => (
              <li key={i}>
                <span className="font-medium">{g.name}</span>{" "}
                <span className="text-gray-500">
                  ({g.product_ids.length} productos)
                </span>

                {g.sample_products && g.sample_products.length > 0 && (
                  <ul className="list-disc ml-4 mt-1 text-gray-500">
                    {g.sample_products.map((p, j) => (
                      <li key={j}>{p}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}


            <div className="text-xs text-gray-500 mt-1">
              Confianza: {(s.confidence * 100).toFixed(0)}%
            </div>
          </div>
        </li>
      ))}
    </ul>
  </div>



{hasSuggestions && (
  <div className="mt-4 flex gap-3">
    <button
      onClick={handleApplySuggestions}
      disabled={applying}
      className={`px-4 py-2 rounded text-white transition
        ${applying
          ? "bg-gray-400 cursor-not-allowed"
          : "bg-indigo-600 hover:bg-indigo-700"
        }`}
    >
      {applying ? "Aplicando..." : "Aplicar sugerencias seleccionadas"}
    </button>
  </div>
)}
    </div>
  );
}
