import { useEffect, useState } from "react";
import {
  fetchBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
} from "../../../api/admin/finance/bankApi";

export default function BankAccountsManager({ onAccountsChanged }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState("");
  const [newLastFour, setNewLastFour] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      setError(null);
      const res = await fetchBankAccounts({ includeInactive: true });
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
    onAccountsChanged?.();
  }

  async function handleCreate(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      setCreating(true);
      await createBankAccount({
        name,
        bnc_last_four: newLastFour.trim() || undefined,
      });
      setNewName("");
      setNewLastFour("");
      await notifyAndReload();
    } catch (e) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function saveAccount(account, { name, bnc_last_four }) {
    const t = name.trim();
    if (!t) {
      alert("El nombre no puede estar vacío.");
      return;
    }
    try {
      await updateBankAccount(account.id, {
        name: t,
        bnc_last_four:
          bnc_last_four === "" || bnc_last_four === undefined
            ? null
            : bnc_last_four,
      });
      await notifyAndReload();
    } catch (e) {
      alert(e.message);
    }
  }

  async function toggleActive(account) {
    try {
      await updateBankAccount(account.id, { is_active: !account.is_active });
      await notifyAndReload();
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleDelete(account) {
    const msg = `¿Eliminar la cuenta «${account.name}»? No se puede deshacer.`;
    if (!window.confirm(msg)) return;
    try {
      await deleteBankAccount(account.id);
      await notifyAndReload();
    } catch (e) {
      alert(e.message);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-gray-500">Cargando cuentas…</p>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">
          Cuentas bancarias
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          «Últimos dígitos BNC» deben coincidir con los 4 números después de *** en
          el estado de cuenta del Excel (ej. 3923). Así la importación asigna la
          cuenta correcta aunque elijas otra en el selector.
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
              <th className="text-left px-3 py-2 whitespace-nowrap">
                Últimos dígitos BNC
              </th>
              <th className="text-center px-3 py-2">Activa</th>
              <th className="text-left px-3 py-2">Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <AccountRow
                key={a.id}
                account={a}
                onSave={(payload) => saveAccount(a, payload)}
                onToggleActive={() => toggleActive(a)}
                onDelete={() => handleDelete(a)}
              />
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !error && (
          <p className="text-sm text-gray-500 p-4">
            No hay cuentas. Ejecuta la migración SQL o agrega una nueva.
          </p>
        )}
      </div>

      <form
        onSubmit={handleCreate}
        className="flex flex-wrap gap-3 items-end pt-2 border-t border-gray-100"
      >
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-gray-500 mb-1">
            Nueva cuenta
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ej. BNC — caja chica"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="w-36">
          <label className="block text-xs text-gray-500 mb-1">
            ***XXXX (opc.)
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={8}
            value={newLastFour}
            onChange={(e) =>
              setNewLastFour(e.target.value.replace(/\D/g, "").slice(0, 8))
            }
            placeholder="3923"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
        >
          {creating ? "Guardando…" : "Agregar cuenta"}
        </button>
      </form>
    </div>
  );
}

function digitsLast4(v) {
  const d = String(v ?? "").replace(/\D/g, "");
  if (d.length >= 4) return d.slice(-4);
  return d;
}

function AccountRow({ account, onSave, onToggleActive, onDelete }) {
  const [name, setName] = useState(account.name);
  const [lastFour, setLastFour] = useState(account.bnc_last_four || "");

  useEffect(() => {
    setName(account.name);
    setLastFour(account.bnc_last_four || "");
  }, [account.id, account.name, account.bnc_last_four]);

  const dirty =
    name.trim() !== account.name ||
    digitsLast4(lastFour) !== digitsLast4(account.bnc_last_four);

  return (
    <tr className={`border-t ${account.is_active ? "" : "bg-gray-50 opacity-80"}`}>
      <td className="px-3 py-2 text-gray-500 font-mono text-xs">{account.id}</td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full max-w-xs border border-gray-200 rounded px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={8}
          value={lastFour}
          onChange={(e) =>
            setLastFour(e.target.value.replace(/\D/g, "").slice(0, 8))
          }
          placeholder="3923"
          title="Mismos 4 dígitos que ***3923 en el Excel del BNC"
          className="w-24 border border-gray-200 rounded px-2 py-1 text-sm font-mono"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={account.is_active}
          onChange={onToggleActive}
          title="Solo cuentas activas se muestran al importar"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              onSave({
                name,
                bnc_last_four: lastFour.trim() === "" ? null : lastFour,
              })
            }
            disabled={!dirty}
            className="text-blue-600 hover:underline text-xs disabled:text-gray-400 disabled:no-underline"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center justify-center p-1.5 rounded-md text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200"
            title="Eliminar cuenta"
            aria-label="Eliminar cuenta"
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
