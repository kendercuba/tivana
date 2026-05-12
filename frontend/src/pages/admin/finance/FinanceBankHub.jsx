import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";

const BANK_IMPORT_HIGHLIGHT_STORAGE_KEY = "zm-bank-import-highlight-batch";

function readStoredBankImportHighlightBatchId() {
  try {
    const raw = sessionStorage.getItem(BANK_IMPORT_HIGHLIGHT_STORAGE_KEY);
    if (raw != null && raw !== "") {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {
    /* ignore */
  }
  return null;
}
import { useFinanceBasePath } from "../../../contexts/FinanceBasePathContext.jsx";
import BankAccountsManager from "../../../components/admin/finance/BankAccountsManager.jsx";
import BankAccountMovementsMonitor from "../../../components/admin/finance/BankAccountMovementsMonitor.jsx";
import FinanceCategoriesManager from "../../../components/admin/finance/FinanceCategoriesManager.jsx";
import FinanceClassificationRulesManager from "../../../components/admin/finance/FinanceClassificationRulesManager.jsx";
import BankImportBatchHistory from "../../../components/admin/finance/BankImportBatchHistory.jsx";

function cuentasSubFromSearch(searchParams) {
  const s = searchParams.get("cuentasSub");
  if (s === "gestionar") return "gestionar";
  if (s === "historial") return "historial";
  if (s === "categorias") return "categorias";
  if (s === "reglas") return "reglas";
  return "movimientos";
}

export default function FinanceBankHub() {
  const financeBase = useFinanceBasePath();
  const isZonaMarketFinance = financeBase.startsWith("/zonamarket");
  const { section } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const cuentasSub = cuentasSubFromSearch(searchParams);

  const [accountsRefreshToken, setAccountsRefreshToken] = useState(0);
  const [categoriesRefreshToken, setCategoriesRefreshToken] = useState(0);
  /** Bumps BankImportBatchHistory when movimientos tab imports a file. */
  const [bankImportHistoryTick, setBankImportHistoryTick] = useState(0);

  /**
   * Lives in the hub (not inside Movimientos) so tab switches do not unmount
   * highlight state. Hydrated from sessionStorage so a reload keeps the last batch.
   */
  const [bankImportHighlightBatchId, setBankImportHighlightBatchId] =
    useState(readStoredBankImportHighlightBatchId);

  useEffect(() => {
    try {
      if (bankImportHighlightBatchId == null) {
        sessionStorage.removeItem(BANK_IMPORT_HIGHLIGHT_STORAGE_KEY);
      } else {
        sessionStorage.setItem(
          BANK_IMPORT_HIGHLIGHT_STORAGE_KEY,
          String(bankImportHighlightBatchId)
        );
      }
    } catch {
      /* ignore */
    }
  }, [bankImportHighlightBatchId]);

  const bumpBankAccountsRefresh = useCallback(() => {
    setAccountsRefreshToken((n) => n + 1);
  }, []);

  const bumpCategoriesRefresh = useCallback(() => {
    setCategoriesRefreshToken((n) => n + 1);
  }, []);

  if (section === "categorias") {
    return (
      <Navigate
        to={`${financeBase}/cuentas?cuentasSub=categorias`}
        replace
      />
    );
  }
  if (section === "reglas") {
    return (
      <Navigate to={`${financeBase}/cuentas?cuentasSub=reglas`} replace />
    );
  }
  if (section === "cargar-excel") {
    return (
      <Navigate
        to={`${financeBase}/cuentas?cuentasSub=movimientos`}
        replace
      />
    );
  }

  if (section !== "cuentas") {
    return <Navigate to={`${financeBase}/cuentas`} replace />;
  }

  const cuentasSubBtn = (sub, label) => (
    <button
      type="button"
      onClick={() =>
        setSearchParams({ cuentasSub: sub })
      }
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
        cuentasSub === sub
          ? "bg-zm-cream/70 border-zm-green/45 text-zm-sidebar shadow-sm"
          : "bg-transparent border-transparent text-gray-600 hover:text-zm-sidebar hover:bg-zm-cream/40"
      }`}
    >
      {label}
    </button>
  );

  const compactMovimientosChrome =
    cuentasSub === "movimientos" || cuentasSub === "historial";

  return (
    <div>
      <div className="w-full font-zm">
        <div className="flex w-full items-center bg-zm-green px-4 sm:px-6 py-3 text-white shadow-sm rounded-b-xl">
          <h1 className="text-sm sm:text-base font-semibold tracking-tight">
            Cuentas Bancarias
          </h1>
        </div>
        <div
          className={`${compactMovimientosChrome ? "px-4 pt-3 pb-0 sm:px-6" : "px-4 pt-3 pb-0 sm:px-6"}`}
        >
          <div className="border-b border-zm-green/20">
            <div className="flex flex-wrap gap-1 py-1">
              {cuentasSubBtn("gestionar", "Gestionar cuentas")}
              {cuentasSubBtn("movimientos", "Movimientos por cuenta")}
              {cuentasSubBtn("historial", "Historial de cargas")}
              {cuentasSubBtn("categorias", "Categorías")}
              {cuentasSubBtn("reglas", "Reglas")}
            </div>
          </div>
        </div>
      </div>

      {cuentasSub === "gestionar" && (
        <div className="p-6 max-w-4xl mx-auto w-full">
          <BankAccountsManager onAccountsChanged={bumpBankAccountsRefresh} />
        </div>
      )}

      {cuentasSub === "movimientos" && (
        <div className="max-w-none min-w-0 box-border px-3 pb-6 pt-2 sm:px-5 lg:px-6">
          <BankAccountMovementsMonitor
            categoriesRefreshToken={categoriesRefreshToken}
            accountsRefreshToken={accountsRefreshToken}
            highlightImportBatchId={bankImportHighlightBatchId}
            onHighlightImportBatchIdChange={setBankImportHighlightBatchId}
            onImportSuccess={() => {
              bumpBankAccountsRefresh();
              setBankImportHistoryTick((n) => n + 1);
            }}
          />
        </div>
      )}

      {cuentasSub === "historial" && (
        <div className="max-w-none min-w-0 box-border px-3 pb-6 pt-2 sm:px-5 lg:px-6">
          <BankImportBatchHistory
            accountsRefreshToken={accountsRefreshToken}
            categoriesRefreshToken={categoriesRefreshToken}
            refreshToken={`${bankImportHistoryTick}:${accountsRefreshToken}`}
            useZonaMarketStyle={isZonaMarketFinance}
            onImportBatchDeleted={(deletedBatchId) => {
              setBankImportHighlightBatchId((prev) =>
                prev != null && Number(prev) === Number(deletedBatchId)
                  ? null
                  : prev
              );
            }}
          />
        </div>
      )}

      {cuentasSub === "categorias" && (
        <div className="p-6 max-w-4xl mx-auto w-full">
          <FinanceCategoriesManager
            onCategoriesChanged={bumpCategoriesRefresh}
          />
        </div>
      )}

      {cuentasSub === "reglas" && (
        <div className="p-6 max-w-6xl mx-auto w-full">
          <FinanceClassificationRulesManager />
        </div>
      )}
    </div>
  );
}
