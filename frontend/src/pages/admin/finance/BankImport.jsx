import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Upload } from "lucide-react";
import useBankImport from "../../../hooks/admin/finance/useBankImport";
import BankImportBatchHistory from "../../../components/admin/finance/BankImportBatchHistory.jsx";
import { fetchBankAccounts } from "../../../api/admin/finance/bankApi";
import { useFinanceBasePath } from "../../../contexts/FinanceBasePathContext.jsx";
import { filesFromFileList } from "../../../utils/filesFromFileList.js";

export default function BankImport({
  accountsRefreshToken = 0,
  categoriesRefreshToken = 0,
}) {
  const financeBase = useFinanceBasePath();
  const isZonaMarket = financeBase.startsWith("/zonamarket");
  const [files, setFiles] = useState([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [bankAccountsAll, setBankAccountsAll] = useState([]);
  const [historyBump, setHistoryBump] = useState(0);

  const { loading, error, result, handleImport } = useBankImport();

  const lastImportBatchId =
    result?.data?.importBatchId ?? result?.data?.import_batch_id ?? null;

  const activeAccounts = bankAccountsAll.filter((a) => a.is_active);

  async function loadBankAccounts() {
    try {
      const res = await fetchBankAccounts({ includeInactive: true });
      setBankAccountsAll(res.data || []);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    loadBankAccounts();
  }, [accountsRefreshToken]);

  useEffect(() => {
    if (!result?.success) return;
    setFiles([]);
    setFileInputKey((k) => k + 1);
    if (lastImportBatchId != null) {
      setHistoryBump((n) => n + 1);
    }
  }, [result?.success, lastImportBatchId]);

  function handleSubmit(e) {
    e.preventDefault();

    if (activeAccounts.length === 0) {
      alert(
        "Agrega o activa al menos una cuenta: menú lateral → Cuentas bancarias → Gestionar cuentas."
      );
      return;
    }

    if (files.length === 0) {
      alert("Selecciona uno o varios archivos Excel del banco.");
      return;
    }

    const fallbackAccountId = activeAccounts[0]?.id;
    handleImport({
      files,
      bankAccountId: fallbackAccountId,
    });
  }

  return (
    <div
      className={`px-4 pt-4 pb-6 space-y-4 ${isZonaMarket ? "font-zm" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1
            className={
              isZonaMarket
                ? "text-xl font-bold text-zm-sidebar"
                : "text-xl font-bold text-gray-800"
            }
          >
            {isZonaMarket ? "Cargar estado de cuenta" : "Subir excel"}
          </h1>
        </div>
        <Link
          to={`${financeBase}/dashboard`}
          className={
            isZonaMarket
              ? "text-xs font-medium text-zm-green hover:text-zm-green-dark hover:underline whitespace-nowrap pt-0.5"
              : "text-xs text-blue-600 hover:underline whitespace-nowrap pt-0.5"
          }
        >
          Ver resúmenes (panel) →
        </Link>
      </div>

      <div
        className={
          isZonaMarket
            ? "bg-white rounded-lg shadow-md shadow-zm-sidebar/5 border border-zm-yellow/55 ring-1 ring-zm-green/10 p-3 max-w-4xl"
            : "bg-white rounded-lg shadow-sm border border-gray-200 p-3 max-w-4xl"
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 min-w-0">
          <label
            className={
              isZonaMarket
                ? "cursor-pointer inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-zm-green/40 bg-white px-3 py-2 text-xs font-semibold text-zm-green hover:bg-zm-green/5 focus-within:ring-2 focus-within:ring-zm-green/40"
                : "cursor-pointer inline-flex items-center gap-1.5 shrink-0 rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-100 focus-within:ring-2 focus-within:ring-blue-500"
            }
          >
            {isZonaMarket && (
              <Upload
                className="h-4 w-4 shrink-0 opacity-90"
                aria-hidden
                strokeWidth={2.25}
              />
            )}
            <span>Seleccionar archivo(s)</span>
            <input
              key={fileInputKey}
              type="file"
              multiple
              accept=".xls,.xlsx"
              className="sr-only"
              aria-label="Seleccionar uno o varios archivos Excel del banco (.xls, .xlsx)"
              onChange={(e) =>
                setFiles(filesFromFileList(e.target.files))
              }
            />
          </label>
          {files.length > 0 && (
            <>
              <span
                className="text-xs text-gray-700 truncate min-w-0 max-w-[10rem] sm:max-w-[18rem] font-medium"
                title={files.map((f) => f.name).join("\n")}
              >
                {files.length === 1
                  ? files[0].name
                  : `${files.length} archivos seleccionados`}
              </span>
              <button
                type="submit"
                disabled={loading}
                className={
                  isZonaMarket
                    ? "shrink-0 rounded-lg bg-zm-green px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zm-green-dark focus-visible:outline focus-visible:ring-2 focus-visible:ring-zm-green/45 disabled:opacity-50"
                    : "shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-1.5 rounded-md text-sm font-medium"
                }
              >
                {loading ? "Importando…" : isZonaMarket ? "Importar" : "Importar archivo(s)"}
              </button>
            </>
          )}
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div
          className={
            isZonaMarket
              ? "bg-zm-cream border border-zm-green/40 rounded-lg p-3 ring-1 ring-zm-yellow/40"
              : "bg-green-50 border border-green-200 rounded-lg p-3"
          }
        >
          <h2
            className={
              isZonaMarket
                ? "text-zm-sidebar font-semibold"
                : "text-green-800 font-semibold"
            }
          >
            Importación completada
          </h2>
          <p
            className={
              isZonaMarket
                ? "text-sm text-zm-green mt-1 space-y-1"
                : "text-sm text-green-700 mt-1 space-y-1"
            }
          >
            {result?.data?.multiFileCount > 1 && (
              <span className="block">
                Archivos procesados:{" "}
                <span className="font-bold">{result.data.multiFileCount}</span> (en
                orden; los totales mostrados corresponden al último archivo).
              </span>
            )}
            <span className="block">
              Filas leídas en el Excel:{" "}
              <span className="font-bold">{result?.data?.totalInFile ?? 0}</span>
            </span>
            <span className="block">
              Movimientos nuevos guardados:{" "}
              <span className="font-bold">{result?.data?.inserted ?? 0}</span>
            </span>
            <span className="block">
              Duplicados omitidos (ya estaban en el sistema):{" "}
              <span className="font-bold">{result?.data?.skippedDuplicate ?? 0}</span>
            </span>
            {lastImportBatchId != null && (
              <span
                className={
                  isZonaMarket ? "block text-zm-sidebar" : "block text-green-900"
                }
              >
                Lote guardado:{" "}
                <span className="font-mono font-bold">#{lastImportBatchId}</span>
                {" "}
                — ya está seleccionado abajo para ver sus movimientos.
              </span>
            )}
            {result?.data?.accountResolution?.fromExcel &&
              result.data.accountResolution.lastFour &&
              !result.data.accountResolution.excelDigitsUnmatched && (
              <span
                className={
                  isZonaMarket
                    ? "block text-zm-sidebar pt-2 border-t border-zm-green/25 mt-2"
                    : "block text-green-900 pt-2 border-t border-green-200 mt-2"
                }
              >
                Cuenta según el Excel (terminación …{result.data.accountResolution.lastFour}
                ):{" "}
                <span className="font-semibold">
                  {result.data.accountResolution.matchedAccountName}
                </span>
                {result.data.accountResolution.overridden && (
                  <span className="block text-amber-800 text-xs mt-1">
                    La cuenta aplicada es la detectada en el Excel (no la cuenta de
                    respaldo).
                  </span>
                )}
              </span>
            )}
            {result?.data?.accountResolution?.bncFieldUnsetReminder && (
              <span
                className={
                  isZonaMarket
                    ? "block text-zm-green/80 text-xs pt-2 mt-2 border-t border-zm-green/20"
                    : "block text-gray-600 text-xs pt-2 mt-2 border-t border-green-200"
                }
              >
                {result.data.accountResolution.bncFieldUnsetReminder}
              </span>
            )}
            {result?.data?.accountResolution?.excelDigitsUnmatched && (
              <span className="block text-amber-900 text-sm pt-2 mt-2 border-t border-amber-200">
                {result.data.accountResolution.hint}
              </span>
            )}
            {result?.data?.accountResolution &&
              !result.data.accountResolution.fromExcel && (
              <span
                className={
                  isZonaMarket
                    ? "block text-zm-green/80 text-xs pt-2 mt-2 border-t border-zm-green/20"
                    : "block text-gray-600 text-xs pt-2 mt-2 border-t border-green-200"
                }
              >
                No se detectó ***XXXX en el encabezado del Excel; se usó la primera
                cuenta activa como respaldo. Puedes ajustar la cuenta en el
                historial de importaciones.
              </span>
            )}
          </p>
        </div>
      )}

      <BankImportBatchHistory
        accountsRefreshToken={accountsRefreshToken}
        categoriesRefreshToken={categoriesRefreshToken}
        refreshToken={historyBump}
        preferredSelectBatchId={lastImportBatchId}
        useZonaMarketStyle={isZonaMarket}
      />
    </div>
  );
}
