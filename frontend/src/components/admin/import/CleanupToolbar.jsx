import React from "react";

/**
 * CleanupToolbar
 *
 * UI del modo "Seleccionar / Eliminar clasificación"
 * - NO contiene lógica de negocio
 * - NO conoce productos ni archivos
 */
export default function CleanupToolbar({
  cleanupMode,
  onToggleMode,

  levelSelection,
  onToggleLevel,

  onSelectAll,
  onClear
}) {
  return (
    <div className="mb-4 border rounded-lg bg-yellow-50 shadow-sm">

      {/* ===============================
         HEADER / BOTÓN PRINCIPAL
      =============================== */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-yellow-100 rounded-t-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMode}
            className={`px-4 py-2 rounded font-semibold transition ${
              cleanupMode
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-yellow-500 hover:bg-yellow-600 text-white"
            }`}
          >
            {cleanupMode ? "Cancelar selección" : "Seleccionar / Eliminar"}
          </button>

          <span className="text-sm text-gray-700">
            {cleanupMode
              ? "Modo limpieza activo"
              : "Activar modo de selección para limpiar clasificaciones"}
          </span>
        </div>
      </div>

      {/* ===============================
         CONTROLES (solo si está activo)
      =============================== */}
      {cleanupMode && (
        <div className="px-4 py-4 space-y-4">

          {/* -------- Selección global -------- */}
          <div className="flex items-center gap-3">
            <button
              onClick={onSelectAll}
              className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-900 text-white text-sm"
            >
              Seleccionar todo
            </button>

            <span className="text-sm text-gray-600">
              Selecciona todos los productos visibles
            </span>
          </div>

          {/* -------- Selección por nivel -------- */}
          <div className="flex flex-wrap gap-6 items-center">

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={levelSelection.category}
                onChange={() => onToggleLevel("category")}
              />
              <span className="text-sm font-medium">Categorías</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={levelSelection.subcategory}
                onChange={() => onToggleLevel("subcategory")}
              />
              <span className="text-sm font-medium">Subcategorías</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={levelSelection.subsubcategory}
                onChange={() => onToggleLevel("subsubcategory")}
              />
              <span className="text-sm font-medium">Sub-subcategorías</span>
            </label>
          </div>

          {/* -------- Acción final -------- */}
          <div className="flex justify-end pt-2 border-t">
            <button
              onClick={onClear}
              className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              🧹 Eliminar clasificación seleccionada
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
