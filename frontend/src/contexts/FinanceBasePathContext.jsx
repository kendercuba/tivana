import { createContext, useContext, useMemo } from "react";

const DEFAULT_FINANCE_BASE = "/admin/finance";

const FinanceBasePathContext = createContext(DEFAULT_FINANCE_BASE);

export function FinanceBasePathProvider({ basePath = DEFAULT_FINANCE_BASE, children }) {
  const value = useMemo(
    () => String(basePath).replace(/\/$/, ""),
    [basePath]
  );
  return (
    <FinanceBasePathContext.Provider value={value}>
      {children}
    </FinanceBasePathContext.Provider>
  );
}

/** Base URL para enlaces internos de finanzas (`…/finance` sin barra final). */
export function useFinanceBasePath() {
  return useContext(FinanceBasePathContext);
}
