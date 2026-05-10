import { useEffect, useState } from "react";
import BankMovementsTableBlock from "./BankMovementsTableBlock.jsx";
import {
  fetchBankAccounts,
  fetchBankMovementsByAccount,
} from "../../../api/admin/finance/bankApi";

/**
 * Bloque independiente (ancho completo) para ver movimientos de una cuenta.
 * No comparte contenedor con la tabla de alta de cuentas.
 */
export default function BankAccountMovementsMonitor({
  categoriesRefreshToken = 0,
  accountsRefreshToken = 0,
}) {
  const [rows, setRows] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  const [monitorAccountId, setMonitorAccountId] = useState(null);
  const [monitorMovements, setMonitorMovements] = useState([]);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorError, setMonitorError] = useState(null);
  const [monitorRefreshTick, setMonitorRefreshTick] = useState(0);

  async function loadAccounts() {
    try {
      setAccountsLoading(true);
      const res = await fetchBankAccounts({ includeInactive: true });
      setRows(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setAccountsLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, [accountsRefreshToken]);

  useEffect(() => {
    if (rows.length === 0) {
      setMonitorAccountId(null);
      return;
    }
    setMonitorAccountId((prev) => {
      if (prev != null && rows.some((r) => r.id === prev)) return prev;
      return rows[0].id;
    });
  }, [rows]);

  useEffect(() => {
    if (monitorAccountId == null) {
      setMonitorMovements([]);
      setMonitorError(null);
      setMonitorLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setMonitorLoading(true);
        setMonitorError(null);
        const res = await fetchBankMovementsByAccount(monitorAccountId, {
          limit: 25000,
        });
        if (!cancelled) setMonitorMovements(res.data || []);
      } catch (e) {
        if (!cancelled) setMonitorError(e.message);
      } finally {
        if (!cancelled) setMonitorLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [monitorAccountId, accountsRefreshToken, monitorRefreshTick]);

  return (
    <div className="space-y-2 min-w-0">
      <div className="flex flex-wrap items-end gap-2 px-0.5">
        <div className="min-w-[200px] flex-1 max-w-md">
          <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
            Monitorear movimientos de la cuenta
          </label>
          <select
            value={monitorAccountId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setMonitorAccountId(v === "" ? null : Number(v));
            }}
            disabled={accountsLoading || rows.length === 0}
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-400"
          >
            {rows.length === 0 ? (
              <option value="">
                {accountsLoading ? "Cargando cuentas…" : "Sin cuentas"}
              </option>
            ) : (
              rows.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {!a.is_active ? " (inactiva)" : ""}
                </option>
              ))
            )}
          </select>
        </div>
        <button
          type="button"
          disabled={monitorAccountId == null || accountsLoading}
          onClick={() => setMonitorRefreshTick((n) => n + 1)}
          className="text-xs text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline pb-1.5"
        >
          Recargar movimientos
        </button>
      </div>

      <BankMovementsTableBlock
        movements={monitorMovements}
        loading={monitorLoading}
        error={monitorError}
        resetKey={monitorAccountId != null ? String(monitorAccountId) : ""}
        categoriesRefreshToken={categoriesRefreshToken}
        maxHeightClass="max-h-[calc(100dvh-10rem)]"
        hideTitleBar
        onMovementUpdated={(updated) => {
          if (!updated?.id) return;
          setMonitorMovements((prev) =>
            prev.map((x) =>
              x.id === updated.id ? { ...x, ...updated } : x
            )
          );
        }}
        hintNoContext={
          rows.length === 0
            ? "Agrega una cuenta en el bloque superior para poder monitorear movimientos."
            : "Selecciona una cuenta en el desplegable."
        }
        emptyLoadedMessage={
          <p className="text-sm text-gray-500 p-4">
            Esta cuenta aún no tiene movimientos importados, o todos los de la
            última carga figuraron como duplicados.
          </p>
        }
      />
    </div>
  );
}
