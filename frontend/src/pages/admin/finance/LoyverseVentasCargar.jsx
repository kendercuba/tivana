import { useEffect, useState } from "react";
import useLoyverseImport from "../../../hooks/admin/finance/useLoyverseImport";
import LoyverseImportBatchHistory from "../../../components/admin/finance/LoyverseImportBatchHistory.jsx";
import { formatLoyverseReportKind } from "../../../components/admin/finance/loyverseImportFormatters.js";
import { validateLoyverseReportHint } from "../../../api/admin/finance/loyverseApi";
import { filesFromFileList } from "../../../utils/filesFromFileList.js";

const LOYVERSE_UPLOAD_ACCEPT =
  ".xls,.xlsx,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export default function LoyverseVentasCargar() {
  const [files, setFiles] = useState([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [fileHintError, setFileHintError] = useState(null);
  const [fileHintValidating, setFileHintValidating] = useState(false);
  const [reportHint, setReportHint] = useState("auto");

  const { loading, error, result, handleImport } = useLoyverseImport();

  useEffect(() => {
    setFiles([]);
    setFileHintError(null);
    setFileInputKey((k) => k + 1);
  }, [reportHint]);

  async function handleFileChange(e) {
    const picked = filesFromFileList(e.target.files);
    setFileHintError(null);
    if (picked.length === 0) {
      setFiles([]);
      return;
    }
    if (reportHint === "auto") {
      setFiles(picked);
      await handleImport({ files: picked, reportHint: "auto" });
      return;
    }
    setFileHintValidating(true);
    try {
      for (const f of picked) {
        const v = await validateLoyverseReportHint({
          file: f,
          reportHint,
        });
        if (!v.ok) {
          setFileHintError(
            `${f.name}: ${v.message || "El archivo no coincide con el tipo de reporte elegido."}`
          );
          setFiles([]);
          setFileInputKey((k) => k + 1);
          return;
        }
      }
      setFiles(picked);
    } catch (err) {
      setFileHintError(err.message || "No se pudo validar el archivo.");
      setFiles([]);
      setFileInputKey((k) => k + 1);
      return;
    } finally {
      setFileHintValidating(false);
    }
    await handleImport({ files: picked, reportHint });
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pt-4 pb-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 max-w-2xl">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Tipo de reporte (opcional; si eliges automático, se clasifica por
              cabeceras del archivo)
            </label>
            <select
              value={reportHint}
              onChange={(e) => setReportHint(e.target.value)}
              disabled={fileHintValidating || loading}
              className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            >
              <option value="auto">Detectar automáticamente</option>
              <option value="daily_summary">
                Resumen de ventas (diario: brutas, netas, beneficio…)
              </option>
              <option value="by_payment">Ventas por tipo de pago</option>
              <option value="by_item">Ventas por artículo</option>
            </select>
          </div>

          {(reportHint === "by_payment" || reportHint === "auto") && (
            <p className="text-[11px] text-amber-950/90 bg-amber-50 border border-amber-100 rounded-md px-2.5 py-2 leading-snug">
              <strong>Ventas por tipo de pago:</strong> el nombre del archivo no puede
              incluir dos fechas distintas (export de rango). Sube un archivo por día.
              Si el nombre repite el mismo día dos veces (p. ej.{" "}
              <span className="font-mono">2026-05-01-2026-05-01</span>), sí se acepta.
            </p>
          )}

          <div>
            <span className="block text-xs font-medium text-gray-600 mb-1">
              Archivo(s) Excel o CSV
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <label
                className={`cursor-pointer inline-flex items-center shrink-0 rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 focus-within:ring-2 focus-within:ring-blue-500 ${
                  fileHintValidating || loading
                    ? "pointer-events-none opacity-60"
                    : ""
                }`}
              >
                Seleccionar archivo(s)
                <input
                  key={fileInputKey}
                  type="file"
                  multiple
                  accept={LOYVERSE_UPLOAD_ACCEPT}
                  className="sr-only"
                  aria-label="Seleccionar uno o varios archivos exportados desde Loyverse"
                  disabled={fileHintValidating || loading}
                  onChange={handleFileChange}
                />
              </label>
              {files.length > 0 && (
                <span
                  className="text-xs text-gray-700 truncate min-w-0 flex-1 max-sm:w-full font-medium max-w-[10rem] sm:max-w-[18rem]"
                  title={files.map((f) => f.name).join("\n")}
                >
                  {files.length === 1
                    ? files[0].name
                    : `${files.length} archivos seleccionados`}
                </span>
              )}
            </div>
            {fileHintValidating && (
              <p className="text-xs text-gray-600 mt-1">Validando archivos…</p>
            )}
            {fileHintError && (
              <p className="text-sm text-red-700 mt-1" role="alert">
                {fileHintError}
              </p>
            )}
          </div>

        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h2 className="text-green-800 font-semibold">Importación completada</h2>
          <p className="text-sm text-green-700 mt-1 space-y-1">
            {result?.data?.multiFileCount > 1 && (
              <span className="block">
                Archivos procesados:{" "}
                <span className="font-bold">{result.data.multiFileCount}</span> (en
                orden; el lote destacado corresponde al último).
              </span>
            )}
            <span className="block">
              Filas detectadas (último archivo):{" "}
              <span className="font-bold">{result?.data?.totalInFile ?? 0}</span>
            </span>
            <span className="block">
              Filas nuevas guardadas (último archivo):{" "}
              <span className="font-bold">{result?.data?.inserted ?? 0}</span>
            </span>
            <span className="block">
              Duplicados omitidos (último archivo):{" "}
              <span className="font-bold">{result?.data?.skippedDuplicate ?? 0}</span>
            </span>
            {result?.data?.detectedFormat != null && (
              <span className="block">
                Clasificación detectada (último archivo):{" "}
                <span className="font-bold">
                  {formatLoyverseReportKind(result.data.detectedFormat)}
                </span>
              </span>
            )}
            {result?.data?.importBatchId != null && (
              <span className="block text-green-900 pt-1">
                Lote <span className="font-mono font-bold">#{result.data.importBatchId}</span>
                {" "}— seleccionado abajo para previsualizar.
              </span>
            )}
          </p>
        </div>
      )}

      <LoyverseImportBatchHistory
        refreshToken={result?.data?.importBatchId ?? 0}
        preferredSelectBatchId={result?.data?.importBatchId ?? null}
      />
    </div>
  );
}
