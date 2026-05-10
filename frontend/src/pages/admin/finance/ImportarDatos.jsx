import { Navigate, useSearchParams } from "react-router-dom";
import { useCallback, useState } from "react";
import BankImport from "./BankImport.jsx";
import BankAccountsManager from "../../../components/admin/finance/BankAccountsManager.jsx";
import BankAccountMovementsMonitor from "../../../components/admin/finance/BankAccountMovementsMonitor.jsx";
import FinanceCategoriesManager from "../../../components/admin/finance/FinanceCategoriesManager.jsx";
import FinanceClassificationRulesManager from "../../../components/admin/finance/FinanceClassificationRulesManager.jsx";

function tabFromSearch(searchParams) {
  const t = searchParams.get("tab");
  if (t === "cuentas") return "cuentas";
  if (t === "categorias") return "categorias";
  if (t === "reglas") return "reglas";
  return "bnc";
}

/** Sub-vista dentro de la pestaña «Cuentas bancarias». Por defecto: movimientos. */
function cuentasSubFromSearch(searchParams) {
  const s = searchParams.get("cuentasSub");
  if (s === "gestionar") return "gestionar";
  return "movimientos";
}

export default function ImportarDatos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabFromSearch(searchParams);
  const cuentasSub = cuentasSubFromSearch(searchParams);

  const [accountsRefreshToken, setAccountsRefreshToken] = useState(0);
  const [categoriesRefreshToken, setCategoriesRefreshToken] = useState(0);

  const bumpBankAccountsRefresh = useCallback(() => {
    setAccountsRefreshToken((n) => n + 1);
  }, []);

  const bumpCategoriesRefresh = useCallback(() => {
    setCategoriesRefreshToken((n) => n + 1);
  }, []);

  function setTab(next) {
    const prev = tab;
    if (next === "cuentas") {
      setSearchParams({
        tab: "cuentas",
        cuentasSub: searchParams.get("cuentasSub") ?? "movimientos",
      });
    } else if (next === "categorias") {
      setSearchParams({ tab: "categorias" });
    } else if (next === "reglas") {
      setSearchParams({ tab: "reglas" });
    } else {
      setSearchParams({});
    }
    if (next === "bnc" && prev !== "bnc") {
      setAccountsRefreshToken((n) => n + 1);
    }
    /** Tras importar o borrar lotes en «Cargar excel», al volver a Cuentas se refrescan movimientos monitorizados. */
    if (next === "cuentas" && prev === "bnc") {
      setAccountsRefreshToken((n) => n + 1);
    }
  }

  if (searchParams.get("tab") === "loyverse") {
    return <Navigate to="/admin/finance/loyverse" replace />;
  }

  const tabBtn = (key, label) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`px-3 py-1.5 text-xs font-medium rounded-t-md border border-b-0 -mb-px ${
        tab === key
          ? "bg-white border-gray-200 text-gray-900"
          : "bg-transparent border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {label}
    </button>
  );

  const cuentasSubBtn = (sub, label) => (
    <button
      type="button"
      onClick={() =>
        setSearchParams({ tab: "cuentas", cuentasSub: sub })
      }
      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
        cuentasSub === sub
          ? "bg-white border-gray-300 text-gray-900 shadow-sm"
          : "bg-transparent border-transparent text-gray-600 hover:text-gray-900 hover:bg-white/60"
      }`}
    >
      {label}
    </button>
  );

  const compactMovimientosChrome =
    tab === "cuentas" && cuentasSub === "movimientos";

  return (
    <div>
      <div
        className={`max-w-4xl ${compactMovimientosChrome ? "px-4 pt-2 pb-0 sm:px-6" : "px-4 pt-3 pb-0 sm:px-6"}`}
      >
        <h1 className="text-xl font-bold text-gray-800 leading-tight">
          Datos bancarios
        </h1>
        {!compactMovimientosChrome && (
          <p className="text-xs text-gray-500 mt-1 mb-2 leading-snug">
            Administra cuentas bancarias, carga Excel del BNC, categorías y
            reglas de clasificación.
          </p>
        )}
        <div className="flex flex-wrap gap-1 border-b border-gray-200">
          {tabBtn("bnc", "Cargar excel")}
          {tabBtn("cuentas", "Cuentas bancarias")}
          {tabBtn("categorias", "Categorías")}
          {tabBtn("reglas", "Reglas")}
        </div>
      </div>

      {tab === "cuentas" && (
        <div className="border-b border-gray-200 bg-gray-100/90 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto flex flex-wrap gap-1 py-1">
            {cuentasSubBtn("gestionar", "Gestionar cuentas")}
            {cuentasSubBtn("movimientos", "Movimientos por cuenta")}
          </div>
        </div>
      )}

      {tab === "cuentas" && cuentasSub === "gestionar" && (
        <div className="p-6 max-w-4xl mx-auto w-full">
          <BankAccountsManager onAccountsChanged={bumpBankAccountsRefresh} />
        </div>
      )}

      {tab === "cuentas" && cuentasSub === "movimientos" && (
        <div className="max-w-none min-w-0 -mx-8 px-2 sm:px-3 pb-4 pt-1 box-border">
          <BankAccountMovementsMonitor
            categoriesRefreshToken={categoriesRefreshToken}
            accountsRefreshToken={accountsRefreshToken}
          />
        </div>
      )}

      {tab === "bnc" && (
        <BankImport
          accountsRefreshToken={accountsRefreshToken}
          categoriesRefreshToken={categoriesRefreshToken}
        />
      )}

      {tab === "categorias" && (
        <div className="p-6 max-w-4xl">
          <FinanceCategoriesManager onCategoriesChanged={bumpCategoriesRefresh} />
        </div>
      )}

      {tab === "reglas" && (
        <div className="p-6 max-w-6xl">
          <FinanceClassificationRulesManager />
        </div>
      )}
    </div>
  );
}
