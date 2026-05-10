import { useEffect, useState } from "react";
import { fetchFinanceCategories } from "../../../api/admin/finance/financeCategoriesApi.js";
import {
  fetchClassificationRules,
  createClassificationRule,
  updateClassificationRule,
  deleteClassificationRule,
} from "../../../api/admin/finance/classificationRulesApi.js";

const TYPE_HINT =
  "Las comparaciones ignoran mayúsculas y acentos. Si el tipo transacción del Excel contiene el texto que escribes (ej. COBCOM), la regla aplica.";

export default function FinanceClassificationRulesManager() {
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [newCode, setNewCode] = useState("");
  const [newMtt, setNewMtt] = useState("");
  const [newMot, setNewMot] = useState("");
  const [newCat, setNewCat] = useState("");
  const [newSub, setNewSub] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadAll() {
    try {
      setError(null);
      const [rRes, cRes] = await Promise.all([
        fetchClassificationRules(),
        fetchFinanceCategories(),
      ]);
      setRules(rRes.data || []);
      const cats = cRes.data || [];
      setCategories(cats);
      if (!newCat && cats.length > 0) {
        setNewCat(cats[0].name);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function notifyAndReload() {
    await loadAll();
  }

  async function handleCreate(e) {
    e.preventDefault();
    const transaction_code = newCode.trim();
    if (!transaction_code) return;
    if (!newCat.trim()) {
      alert("Elige una categoría.");
      return;
    }
    try {
      setCreating(true);
      await createClassificationRule({
        transaction_code,
        match_transaction_type: newMtt.trim(),
        match_operation_type: newMot.trim(),
        category_name: newCat.trim(),
        subcategory: newSub.trim() || "—",
        notes: newNotes.trim() || null,
      });
      setNewCode("");
      setNewMtt("");
      setNewMot("");
      setNewSub("");
      setNewNotes("");
      await notifyAndReload();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(rule) {
    if (!window.confirm(`¿Eliminar esta regla (#${rule.id})?`)) return;
    try {
      await deleteClassificationRule(rule.id);
      await notifyAndReload();
    } catch (e) {
      alert(e.message);
    }
  }

  async function saveRule(rule, payload) {
    try {
      await updateClassificationRule(rule.id, payload);
      await notifyAndReload();
    } catch (e) {
      alert(e.message);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Cargando reglas…</p>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">
          Reglas de clasificación BNC
        </h2>
        <p className="text-xs text-gray-500 mt-1 space-y-1">
          <span className="block">
            Se evalúan en orden ascendente por «Orden». Para cada movimiento se
            usa la <strong>primera</strong> regla que coincida: mismo{" "}
            <strong>código</strong>, y si rellenas filtros, el tipo transacción y/o
            tipo operación del Excel deben <strong>contener</strong> ese texto (sin
            importar mayúsculas).
          </span>
          <span className="block mt-1">
            Ejemplo: código <code className="text-xs">732</code> + tipo trans.{" "}
            <code className="text-xs">ABOCOM</code> → ventas POS; mismo código{" "}
            <code className="text-xs">732</code> +{" "}
            <code className="text-xs">COBCOM</code> → comisión del banco. Código{" "}
            <code className="text-xs">758</code> → comisión agregadores POS.{" "}
            {TYPE_HINT}
          </span>
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
              loadAll();
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
              <th className="text-right px-2 py-2 whitespace-nowrap">Orden</th>
              <th className="text-left px-2 py-2">Código</th>
              <th className="text-left px-2 py-2">Contiene tipo trans.</th>
              <th className="text-left px-2 py-2">Contiene tipo oper.</th>
              <th className="text-left px-2 py-2">Categoría</th>
              <th className="text-left px-2 py-2">Subcategoría</th>
              <th className="text-center px-2 py-2">Activa</th>
              <th className="text-left px-2 py-2">Tipo calc.</th>
              <th className="text-left px-2 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <RuleRow
                key={r.id}
                rule={r}
                categories={categories}
                onSave={(payload) => saveRule(r, payload)}
                onDelete={() => handleDelete(r)}
              />
            ))}
          </tbody>
        </table>
        {rules.length === 0 && !error && (
          <p className="text-sm text-gray-500 p-4">
            No hay reglas. Agrega una abajo o ejecuta la migración SQL{" "}
            <code className="text-xs">2026-05-14_finance_bank_classification_rules.sql</code>.
          </p>
        )}
      </div>

      <form
        onSubmit={handleCreate}
        className="space-y-3 pt-3 border-t border-gray-100"
      >
        <p className="text-sm font-medium text-gray-700">Nueva regla</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-20">
            <label className="block text-xs text-gray-500 mb-1">Código *</label>
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="732"
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm font-mono"
            />
          </div>
          <div className="min-w-[120px] flex-1">
            <label className="block text-xs text-gray-500 mb-1">
              Tipo trans. (opc.)
            </label>
            <input
              type="text"
              value={newMtt}
              onChange={(e) => setNewMtt(e.target.value)}
              placeholder="COBCOM"
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            />
          </div>
          <div className="min-w-[120px] flex-1">
            <label className="block text-xs text-gray-500 mb-1">
              Tipo oper. (opc.)
            </label>
            <input
              type="text"
              value={newMot}
              onChange={(e) => setNewMot(e.target.value)}
              placeholder="Agregadores"
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="block text-xs text-gray-500 mb-1">
              Categoría *
            </label>
            <select
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[180px] flex-1">
            <label className="block text-xs text-gray-500 mb-1">
              Subcategoría
            </label>
            <input
              type="text"
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              placeholder="Ej. Comisión % ventas POS"
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1">Notas</label>
            <input
              type="text"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Para ti (no afecta la lógica)"
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={creating || !newCode.trim()}
            className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            {creating ? "Guardando…" : "Agregar regla"}
          </button>
        </div>
      </form>
    </div>
  );
}

function RuleRow({ rule, categories, onSave, onDelete }) {
  const [sortOrder, setSortOrder] = useState(String(rule.sort_order ?? 0));
  const [code, setCode] = useState(rule.transaction_code || "");
  const [mtt, setMtt] = useState(rule.match_transaction_type || "");
  const [mot, setMot] = useState(rule.match_operation_type || "");
  const [cat, setCat] = useState(rule.category_name || "");
  const [sub, setSub] = useState(rule.subcategory || "");
  const [active, setActive] = useState(rule.is_active !== false);

  useEffect(() => {
    setSortOrder(String(rule.sort_order ?? 0));
    setCode(rule.transaction_code || "");
    setMtt(rule.match_transaction_type || "");
    setMot(rule.match_operation_type || "");
    setCat(rule.category_name || "");
    setSub(rule.subcategory || "");
    setActive(rule.is_active !== false);
  }, [
    rule.id,
    rule.sort_order,
    rule.transaction_code,
    rule.match_transaction_type,
    rule.match_operation_type,
    rule.category_name,
    rule.subcategory,
    rule.is_active,
  ]);

  const dirty =
    Number(sortOrder) !== Number(rule.sort_order) ||
    code.trim() !== (rule.transaction_code || "").trim() ||
    mtt.trim() !== (rule.match_transaction_type || "").trim() ||
    mot.trim() !== (rule.match_operation_type || "").trim() ||
    cat.trim() !== (rule.category_name || "").trim() ||
    sub.trim() !== (rule.subcategory || "").trim() ||
    active !== (rule.is_active !== false);

  const mtLabel = rule.movement_type || "—";

  return (
    <tr className="border-t align-top">
      <td className="px-2 py-2">
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="w-16 border border-gray-200 rounded px-1 py-1 text-sm text-right"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-16 border border-gray-200 rounded px-1 py-1 text-sm font-mono"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          value={mtt}
          onChange={(e) => setMtt(e.target.value)}
          className="max-w-[140px] border border-gray-200 rounded px-1 py-1 text-sm"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          value={mot}
          onChange={(e) => setMot(e.target.value)}
          className="max-w-[160px] border border-gray-200 rounded px-1 py-1 text-sm"
        />
      </td>
      <td className="px-2 py-2">
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="max-w-[180px] border border-gray-200 rounded px-1 py-1 text-sm"
        >
          {cat && !categories.some((c) => c.name === cat) && (
            <option value={cat}>{cat}</option>
          )}
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          value={sub}
          onChange={(e) => setSub(e.target.value)}
          className="max-w-[200px] border border-gray-200 rounded px-1 py-1 text-sm"
        />
      </td>
      <td className="px-2 py-2 text-center">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
      </td>
      <td className="px-2 py-2 text-xs text-gray-500 whitespace-nowrap">
        {mtLabel}
      </td>
      <td className="px-2 py-2 whitespace-nowrap">
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() =>
              onSave({
                sort_order: Number(sortOrder),
                transaction_code: code.trim(),
                match_transaction_type: mtt.trim(),
                match_operation_type: mot.trim(),
                category_name: cat.trim(),
                subcategory: sub.trim() || "—",
                is_active: active,
              })
            }
            disabled={!dirty || !code.trim() || !cat.trim()}
            className="text-blue-600 hover:underline text-xs disabled:text-gray-400"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center justify-center p-1 rounded-md text-red-600 hover:bg-red-50"
            title="Eliminar regla"
            aria-label="Eliminar regla"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
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
