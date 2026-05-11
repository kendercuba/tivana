import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchBankSummary,
  fetchBankAccounts,
} from "../../../api/admin/finance/bankApi";
import { useFinanceBasePath } from "../../../contexts/FinanceBasePathContext.jsx";

function formatBs(value) {
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function FinanceDashboard() {
  const financeBase = useFinanceBasePath();
  const isZonaMarket = financeBase.startsWith("/zonamarket");
  const [bankAccounts, setBankAccounts] = useState([]);
  const [summaryAccount, setSummaryAccount] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [summaryRows, setSummaryRows] = useState([]);
  const [summaryError, setSummaryError] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  async function loadSummary(e) {
    e?.preventDefault?.();
    try {
      setSummaryLoading(true);
      setSummaryError(null);
      const res = await fetchBankSummary({
        bankAccountId: summaryAccount || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setSummaryRows(res.data || []);
    } catch (err) {
      setSummaryError(err.message);
    } finally {
      setSummaryLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchBankAccounts({ includeInactive: false });
        if (!cancelled) setBankAccounts(res.data || []);
      } catch {
        if (!cancelled) setBankAccounts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={isZonaMarket ? "space-y-8 p-4 sm:p-6" : "space-y-8 p-6"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {isZonaMarket ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-zm-green">
                Zona Market · Finanzas
              </p>
              <h1 className="mt-1 font-zm text-2xl font-bold tracking-tight text-zm-sidebar">
                Resumen por categoría
              </h1>
              <p className="text-sm text-zm-green/90 mt-2 max-w-xl leading-relaxed">
                Totales a partir de los movimientos ya guardados. Para importar
                Excel y ver cargas, usa{" "}
                <strong className="font-medium text-zm-sidebar">
                  Cuentas bancarias → Cargar estado de cuenta
                </strong>{" "}
                en el menú.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-800">
                Finanzas — panel banco
              </h1>
              <p className="text-sm text-gray-500 mt-1 max-w-xl">
                Resúmenes por categoría a partir de los movimientos guardados en
                PostgreSQL. Para subir Excel y ver el historial de cargas, usa
                «Subir excel» (Finanzas → Cuentas bancarias) en el menú lateral.
              </p>
            </>
          )}
        </div>
        <Link
          to={`${financeBase}/cargar-excel`}
          className={
            isZonaMarket
              ? "text-sm font-medium text-zm-green hover:text-zm-green-dark hover:underline"
              : "text-sm text-blue-600 hover:underline"
          }
        >
          {isZonaMarket
            ? "Ir a cargar estado de cuenta →"
            : "Ir a subir excel →"}
        </Link>
      </div>

      <section
        className={
          isZonaMarket
            ? "rounded-2xl border border-zm-yellow/60 bg-white p-5 shadow-md shadow-zm-sidebar/10 ring-1 ring-zm-green/10"
            : "rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        }
      >
        <h2
          className={
            isZonaMarket
              ? "mb-4 font-zm text-lg font-semibold text-zm-sidebar"
              : "mb-4 text-lg font-semibold text-gray-800"
          }
        >
          Movimientos guardados
        </h2>
        <form
          onSubmit={loadSummary}
          className="flex flex-wrap gap-3 items-end mb-4"
        >
          <div>
            <label className="block text-xs text-gray-500 mb-1">Cuenta</label>
            <select
              value={summaryAccount}
              onChange={(e) => setSummaryAccount(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {bankAccounts.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={summaryLoading}
            className={
              isZonaMarket
                ? "rounded-lg bg-zm-red px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zm-red/90 disabled:opacity-50"
                : "rounded-lg bg-gray-800 px-4 py-2 text-sm text-white disabled:opacity-50"
            }
          >
            {summaryLoading ? "Cargando…" : "Actualizar resumen"}
          </button>
        </form>
        {summaryError && (
          <p className="text-sm text-red-600 mb-2">{summaryError}</p>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead
              className={isZonaMarket ? "bg-zm-yellow/35 text-zm-sidebar" : "bg-gray-100"}
            >
              <tr>
                <th className="text-left px-3 py-2">Categoría</th>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-right px-3 py-2">Movimientos</th>
                <th className="text-right px-3 py-2">Haber (Bs)</th>
                <th className="text-right px-3 py-2">Debe (Bs)</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((row, i) => (
                <tr key={`${row.category}-${row.movement_type}-${i}`} className="border-t">
                  <td className="px-3 py-2">{row.category}</td>
                  <td className="px-3 py-2 capitalize">{row.movement_type}</td>
                  <td className="px-3 py-2 text-right">{row.tx_count}</td>
                  <td
                    className={
                      isZonaMarket
                        ? "px-3 py-2 text-right text-zm-green"
                        : "px-3 py-2 text-right text-green-700"
                    }
                  >
                    {formatBs(row.total_credit_bs)}
                  </td>
                  <td
                    className={
                      isZonaMarket
                        ? "px-3 py-2 text-right text-zm-red"
                        : "px-3 py-2 text-right text-red-600"
                    }
                  >
                    {formatBs(row.total_debit_bs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {summaryRows.length === 0 && !summaryLoading && (
            <p className="text-sm text-gray-500 py-4">
              No hay movimientos con esos filtros, o aún no importaste estados de
              cuenta.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
