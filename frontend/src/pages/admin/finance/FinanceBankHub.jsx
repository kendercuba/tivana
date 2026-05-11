import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFinanceBasePath } from "../../../contexts/FinanceBasePathContext.jsx";
import BankImport from "./BankImport.jsx";
import BankAccountsManager from "../../../components/admin/finance/BankAccountsManager.jsx";
import BankAccountMovementsMonitor from "../../../components/admin/finance/BankAccountMovementsMonitor.jsx";
import FinanceCategoriesManager from "../../../components/admin/finance/FinanceCategoriesManager.jsx";
import FinanceClassificationRulesManager from "../../../components/admin/finance/FinanceClassificationRulesManager.jsx";

const SECTIONS = ["cargar-excel", "cuentas", "categorias", "reglas"];

function cuentasSubFromSearch(searchParams) {
  const s = searchParams.get("cuentasSub");
  if (s === "gestionar") return "gestionar";
  return "movimientos";
}

export default function FinanceBankHub() {
  const financeBase = useFinanceBasePath();
  const { section } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const cuentasSub = cuentasSubFromSearch(searchParams);

  const [accountsRefreshToken, setAccountsRefreshToken] = useState(0);
  const [categoriesRefreshToken, setCategoriesRefreshToken] = useState(0);

  const bumpBankAccountsRefresh = useCallback(() => {
    setAccountsRefreshToken((n) => n + 1);
  }, []);

  const bumpCategoriesRefresh = useCallback(() => {
    setCategoriesRefreshToken((n) => n + 1);
  }, []);

  const prevSectionRef = useRef(null);

  useEffect(() => {
    const prev = prevSectionRef.current;
    if (section === "cargar-excel" && prev !== null && prev !== "cargar-excel") {
      setAccountsRefreshToken((n) => n + 1);
    }
    if (section === "cuentas" && prev === "cargar-excel") {
      setAccountsRefreshToken((n) => n + 1);
    }
    prevSectionRef.current = section;
  }, [section]);

  if (!SECTIONS.includes(section)) {
    return <Navigate to={`${financeBase}/cargar-excel`} replace />;
  }

  const cuentasSubBtn = (sub, label) => (
    <button
      type="button"
      onClick={() =>
        setSearchParams({ cuentasSub: sub })
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
    section === "cuentas" && cuentasSub === "movimientos";

  return (
    <div>
      {section === "cuentas" && (
        <div
          className={`max-w-4xl ${compactMovimientosChrome ? "px-4 pt-2 pb-0 sm:px-6" : "px-4 pt-3 pb-0 sm:px-6"}`}
        >
          <h1 className="text-xl font-bold text-gray-800 leading-tight">
            Cuentas Bancarias
          </h1>
          <div className="border-b border-gray-200 mt-2">
            <div className="max-w-6xl flex flex-wrap gap-1 py-1">
              {cuentasSubBtn("gestionar", "Gestionar cuentas")}
              {cuentasSubBtn("movimientos", "Movimientos por cuenta")}
            </div>
          </div>
        </div>
      )}

      {section === "cuentas" && cuentasSub === "gestionar" && (
        <div className="p-6 max-w-4xl mx-auto w-full">
          <BankAccountsManager onAccountsChanged={bumpBankAccountsRefresh} />
        </div>
      )}

      {section === "cuentas" && cuentasSub === "movimientos" && (
        <div className="max-w-none min-w-0 box-border px-3 pb-6 pt-2 sm:px-5 lg:px-6">
          <BankAccountMovementsMonitor
            categoriesRefreshToken={categoriesRefreshToken}
            accountsRefreshToken={accountsRefreshToken}
          />
        </div>
      )}

      {section === "cargar-excel" && (
        <BankImport
          accountsRefreshToken={accountsRefreshToken}
          categoriesRefreshToken={categoriesRefreshToken}
        />
      )}

      {section === "categorias" && (
        <div className="p-6 max-w-4xl">
          <FinanceCategoriesManager
            onCategoriesChanged={bumpCategoriesRefresh}
          />
        </div>
      )}

      {section === "reglas" && (
        <div className="p-6 max-w-6xl">
          <FinanceClassificationRulesManager />
        </div>
      )}
    </div>
  );
}
