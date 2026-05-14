import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useFinanceBasePath } from "../../../contexts/FinanceBasePathContext.jsx";
import { fetchFinanceCategories } from "../../../api/admin/finance/financeCategoriesApi.js";
import { fetchBankAccounts } from "../../../api/admin/finance/bankApi.js";
import {
  createZmManualExpense,
  deleteZmManualExpense,
  fetchZmManualExpenses,
  rematchZmManualExpense,
  updateZmManualExpense,
} from "../../../api/admin/finance/zmManualExpensesApi.js";

function formatBs(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatBsCell(value) {
  const core = formatBs(value);
  if (core === "—") return "—";
  return `Bs.\u00A0${core}`;
}

function currentMonthYyyyMm() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatEsDate(ymd) {
  if (!ymd) return "—";
  const [y, m, day] = String(ymd).slice(0, 10).split("-").map(Number);
  if (!y || !m || !day) return ymd;
  const dt = new Date(y, m - 1, day);
  return dt.toLocaleDateString("es-VE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function matchStatusLabel(status) {
  switch (status) {
    case "emparejado":
      return "Emparejado";
    case "pendiente":
      return "Pendiente";
    case "sin_coincidencia":
      return "Sin coincidencia";
    case "ambigua":
      return "Ambigua";
    default:
      return status || "—";
  }
}

const emptyForm = {
  expense_date: "",
  concept: "",
  amount_bs: "",
  category: "",
  bank_account_id: "",
  bank_reference: "",
  notes: "",
};

export default function ZmManualExpensesPage() {
  const financeBase = useFinanceBasePath();
  const [monthYyyyMm, setMonthYyyyMm] = useState(currentMonthYyyyMm);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const expenseCategories = useMemo(
    () => (categories || []).filter((c) => c.movement_type === "expense"),
    [categories]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, catRes, accRes] = await Promise.all([
        fetchZmManualExpenses({ monthYyyyMm }),
        fetchFinanceCategories(),
        fetchBankAccounts({ includeInactive: false }),
      ]);
      setRows(Array.isArray(list) ? list : []);
      setCategories(catRes.data || []);
      setBankAccounts(accRes.data || []);
    } catch (e) {
      setError(e.message || "Error cargando datos.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [monthYyyyMm]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function openCreate() {
    setEditingId(null);
    const d = new Date();
    setForm({
      ...emptyForm,
      expense_date: d.toISOString().slice(0, 10),
      category: expenseCategories[0]?.name || "",
    });
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditingId(row.id);
    setForm({
      expense_date: String(row.expense_date || "").slice(0, 10),
      concept: row.concept || "",
      amount_bs: String(row.amount_bs ?? ""),
      category: row.category || "",
      bank_account_id:
        row.bank_account_id != null ? String(row.bank_account_id) : "",
      bank_reference: row.bank_reference || "",
      notes: row.notes || "",
    });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        expense_date: form.expense_date,
        concept: form.concept.trim(),
        amount_bs: Number(form.amount_bs),
        category: form.category,
        notes: form.notes.trim() || null,
        bank_reference: form.bank_reference.trim() || null,
        bank_account_id:
          form.bank_account_id && form.bank_account_id !== ""
            ? Number(form.bank_account_id)
            : null,
      };
      if (editingId == null) {
        await createZmManualExpense(payload);
      } else {
        await updateZmManualExpense(editingId, payload);
      }
      setModalOpen(false);
      await loadAll();
    } catch (err) {
      setError(err.message || "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("¿Eliminar este gasto?")) return;
    try {
      await deleteZmManualExpense(id);
      await loadAll();
    } catch (err) {
      setError(err.message || "Error al eliminar.");
    }
  }

  async function handleRematch(id) {
    try {
      await rematchZmManualExpense(id);
      await loadAll();
    } catch (err) {
      setError(err.message || "Error al re-emparejar.");
    }
  }

  return (
    <div className="w-full max-w-7xl px-4 pb-10 pt-3 font-zm sm:px-6">
      <div className="flex w-full items-center rounded-b-xl bg-zm-green px-4 py-3 text-white shadow-sm sm:px-6">
        <h1 className="text-sm font-semibold tracking-tight sm:text-base">
          Gastos de empresa
        </h1>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="zm-exp-month"
              className="block text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Mes
            </label>
            <input
              id="zm-exp-month"
              type="month"
              className="mt-1 rounded-lg border border-zm-green/30 bg-white px-3 py-2 text-sm text-zm-sidebar"
              value={monthYyyyMm}
              onChange={(e) => setMonthYyyyMm(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-zm-green px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zm-green-dark focus-visible:outline focus-visible:ring-2 focus-visible:ring-zm-green/45"
          >
            Registrar gasto
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-zm-red" role="alert">
          {error}
        </p>
      )}
      {loading && (
        <p className="mt-3 text-sm text-gray-600">Cargando…</p>
      )}

      {!loading && (
        <div className="mt-4 max-h-[min(65vh,36rem)] overflow-x-auto overflow-y-auto rounded-lg border border-zm-green/15 bg-white shadow-sm sm:max-h-[min(70vh,42rem)]">
          <table className="min-w-[920px] w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 border-b border-zm-green/25 bg-zm-cream [&_th]:bg-zm-cream">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 text-left text-gray-900">
                  Fecha
                </th>
                <th className="px-3 py-2 text-left text-gray-900">Concepto</th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-gray-900">
                  Categoría
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right text-gray-900">
                  Monto (Bs)
                </th>
                <th className="px-3 py-2 text-left text-gray-900">Cuenta</th>
                <th className="px-3 py-2 text-left text-gray-900">Referencia</th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-gray-900">
                  Banco
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right text-gray-900">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="border-t border-gray-100">
                  <td
                    colSpan={8}
                    className="px-3 py-6 text-center text-sm text-gray-600"
                  >
                    No hay gastos en este mes.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-gray-100 hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-gray-900">
                      {formatEsDate(r.expense_date)}
                    </td>
                    <td className="max-w-[14rem] px-3 py-2 text-gray-900">
                      <span className="line-clamp-2" title={r.concept}>
                        {r.concept}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                      {r.category}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-gray-900">
                      {formatBsCell(r.amount_bs)}
                    </td>
                    <td className="max-w-[10rem] truncate px-3 py-2 text-xs text-gray-600">
                      {r.bank_account_name || "—"}
                    </td>
                    <td className="max-w-[10rem] truncate px-3 py-2 font-mono text-xs text-gray-600">
                      {r.bank_reference || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.match_status === "emparejado" ? (
                        <span className="inline-block rounded-full bg-zm-green/15 px-2 py-0.5 font-semibold text-zm-sidebar">
                          {matchStatusLabel(r.match_status)}
                        </span>
                      ) : (
                        <span className="text-gray-700">
                          {matchStatusLabel(r.match_status)}
                        </span>
                      )}
                      {r.matched_movement_id && (
                        <span className="mt-0.5 block text-[10px] text-gray-500">
                          {formatEsDate(r.matched_movement_date)} ·{" "}
                          {r.matched_bank_reference || "—"}
                        </span>
                      )}
                      {r.match_note && r.match_status !== "emparejado" && (
                        <span className="mt-0.5 block text-[10px] text-gray-500">
                          {r.match_note}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        type="button"
                        className="mr-1 text-xs font-semibold text-zm-green hover:underline"
                        onClick={() => openEdit(r)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="mr-1 text-xs font-semibold text-zm-green hover:underline"
                        onClick={() => handleRematch(r.id)}
                      >
                        Reemparejar
                      </button>
                      <button
                        type="button"
                        className="text-xs font-semibold text-zm-red hover:underline"
                        onClick={() => handleDelete(r.id)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link
          to={`${financeBase}/cuentas?cuentasSub=movimientos`}
          className="font-semibold text-zm-green hover:underline"
        >
          Ir a movimientos bancarios
        </Link>
        <span className="text-gray-300" aria-hidden>
          |
        </span>
        <Link
          to={`${financeBase}/cuentas?cuentasSub=categorias`}
          className="font-semibold text-zm-green hover:underline"
        >
          Categorías
        </Link>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) setModalOpen(false);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zm-green/20 bg-white p-4 shadow-xl sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="zm-exp-modal-title"
          >
            <h2
              id="zm-exp-modal-title"
              className="text-base font-bold text-zm-sidebar"
            >
              {editingId == null ? "Registrar gasto" : "Editar gasto"}
            </h2>
            <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="zm-exp-date"
                  className="text-xs font-semibold text-gray-600"
                >
                  Fecha
                </label>
                <input
                  id="zm-exp-date"
                  type="date"
                  required
                  className="mt-1 w-full rounded-lg border border-zm-green/30 px-3 py-2 text-sm"
                  value={form.expense_date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, expense_date: e.target.value }))
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="zm-exp-concept"
                  className="text-xs font-semibold text-gray-600"
                >
                  Concepto
                </label>
                <input
                  id="zm-exp-concept"
                  required
                  className="mt-1 w-full rounded-lg border border-zm-green/30 px-3 py-2 text-sm"
                  value={form.concept}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, concept: e.target.value }))
                  }
                  placeholder="Ej. Mensualidad internet, gasolina compras…"
                />
              </div>
              <div>
                <label
                  htmlFor="zm-exp-amount"
                  className="text-xs font-semibold text-gray-600"
                >
                  Monto (Bs)
                </label>
                <input
                  id="zm-exp-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  className="mt-1 w-full rounded-lg border border-zm-green/30 px-3 py-2 text-sm tabular-nums"
                  value={form.amount_bs}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount_bs: e.target.value }))
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="zm-exp-cat"
                  className="text-xs font-semibold text-gray-600"
                >
                  Categoría (gasto)
                </label>
                <select
                  id="zm-exp-cat"
                  required
                  className="mt-1 w-full rounded-lg border border-zm-green/30 px-3 py-2 text-sm"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                >
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="zm-exp-bank"
                  className="text-xs font-semibold text-gray-600"
                >
                  Cuenta banco (opcional, ayuda al emparejamiento)
                </label>
                <select
                  id="zm-exp-bank"
                  className="mt-1 w-full rounded-lg border border-zm-green/30 px-3 py-2 text-sm"
                  value={form.bank_account_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bank_account_id: e.target.value }))
                  }
                >
                  <option value="">Todas / no indicar</option>
                  {bankAccounts.map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="zm-exp-ref"
                  className="text-xs font-semibold text-gray-600"
                >
                  Referencia del pago (Pago Móvil, etc.)
                </label>
                <input
                  id="zm-exp-ref"
                  className="mt-1 w-full rounded-lg border border-zm-green/30 px-3 py-2 font-mono text-sm"
                  value={form.bank_reference}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bank_reference: e.target.value }))
                  }
                  placeholder="Como figura en el banco"
                />
              </div>
              <div>
                <label
                  htmlFor="zm-exp-notes"
                  className="text-xs font-semibold text-gray-600"
                >
                  Notas
                </label>
                <textarea
                  id="zm-exp-notes"
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-zm-green/30 px-3 py-2 text-sm"
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-lg border border-zm-green/35 px-3 py-2 text-xs font-semibold text-zm-green hover:bg-zm-cream/50"
                  onClick={() => setModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-zm-green px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zm-green-dark disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
