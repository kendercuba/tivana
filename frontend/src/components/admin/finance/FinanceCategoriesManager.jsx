import { useEffect, useState } from "react";
import {
  fetchFinanceCategories,
  createFinanceCategory,
  updateFinanceCategory,
  deleteFinanceCategory,
} from "../../../api/admin/finance/financeCategoriesApi.js";

const MOVEMENT_TYPE_OPTIONS = [
  { value: "income", label: "Ingreso" },
  { value: "expense", label: "Egreso" },
  { value: "transfer", label: "Transferencia interna" },
  { value: "unknown", label: "Sin clasificar" },
];

export default function FinanceCategoriesManager({ onCategoriesChanged }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState("");
  const [newMt, setNewMt] = useState("expense");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      setError(null);
      const res = await fetchFinanceCategories();
      setRows(res.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function notifyAndReload() {
    await load();
    onCategoriesChanged?.();
  }

  async function handleCreate(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      setCreating(true);
      await createFinanceCategory({
        name,
        movement_type: newMt,
      });
      setNewName("");
      setNewMt("expense");
      await notifyAndReload();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function saveRow(cat, payload) {
    try {
      await updateFinanceCategory(cat.id, payload);
      await notifyAndReload();
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleDelete(cat) {
    const msg = `¿Eliminar la categoría «${cat.name}»?`;
    if (!window.confirm(msg)) return;
    try {
      await deleteFinanceCategory(cat.id);
      await notifyAndReload();
    } catch (e) {
      alert(e.message);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-gray-500">Cargando categorías…</p>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">
          Categorías de movimientos BNC
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Los mismos nombres aparecen en los desplegables al reclasificar
          movimientos. Si cambias el nombre de una categoría, los movimientos
          existentes se actualizan. La importación desde Excel sigue usando las
          reglas internas del sistema para asignar categoría inicialmente.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600">
          {error}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              setLoading(true);
              load();
            }}
          >
            Reintentar
          </button>
        </p>
      )}

      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-3 py-2">ID</th>
              <th className="text-left px-3 py-2">Nombre</th>
              <th className="text-left px-3 py-2">Tipo</th>
              <th className="text-right px-3 py-2">Orden</th>
              <th className="text-left px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <CategoryRow
                key={c.id}
                cat={c}
                onSave={(payload) => saveRow(c, payload)}
                onDelete={() => handleDelete(c)}
              />
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !error && (
          <p className="text-sm text-gray-500 p-4">
            No hay categorías. Ejecuta la migración SQL{" "}
            <code className="text-xs">2026-05-13_finance_categories.sql</code>{" "}
            en PostgreSQL y recarga.
          </p>
        )}
      </div>

      <form
        onSubmit={handleCreate}
        className="flex flex-wrap gap-3 items-end pt-2 border-t border-gray-100"
      >
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1">
            Nueva categoría
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ej. Servicios públicos"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1">Tipo</label>
          <select
            value={newMt}
            onChange={(e) => setNewMt(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {MOVEMENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
        >
          {creating ? "Guardando…" : "Agregar categoría"}
        </button>
      </form>
    </div>
  );
}

function CategoryRow({ cat, onSave, onDelete }) {
  const [name, setName] = useState(cat.name);
  const [movementType, setMovementType] = useState(cat.movement_type);
  const [sortOrder, setSortOrder] = useState(String(cat.sort_order ?? 0));

  useEffect(() => {
    setName(cat.name);
    setMovementType(cat.movement_type);
    setSortOrder(String(cat.sort_order ?? 0));
  }, [cat.id, cat.name, cat.movement_type, cat.sort_order]);

  const dirty =
    name.trim() !== cat.name ||
    movementType !== cat.movement_type ||
    Number(sortOrder) !== Number(cat.sort_order);

  return (
    <tr className="border-t">
      <td className="px-3 py-2 text-gray-500 font-mono text-xs">{cat.id}</td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full max-w-md border border-gray-200 rounded px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={movementType}
          onChange={(e) => setMovementType(e.target.value)}
          className="border border-gray-200 rounded px-2 py-1 text-sm min-w-[11rem]"
        >
          {MOVEMENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="w-20 border border-gray-200 rounded px-2 py-1 text-sm text-right"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              onSave({
                name: name.trim(),
                movement_type: movementType,
                sort_order: Number(sortOrder),
              })
            }
            disabled={!dirty || !name.trim()}
            className="text-blue-600 hover:underline text-xs disabled:text-gray-400 disabled:no-underline"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center justify-center p-1.5 rounded-md text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200"
            title="Eliminar categoría"
            aria-label="Eliminar categoría"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}
