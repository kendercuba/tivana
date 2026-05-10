import { useEffect, useMemo, useState } from "react";
import {
  fetchBankMovementCategories,
  patchBankMovementCategory,
} from "../../../api/admin/finance/bankApi";

function RefreshIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(`${String(dateString).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date(dateString);
    if (Number.isNaN(fallback.getTime())) return "—";
    return new Intl.DateTimeFormat("es-VE", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(fallback);
  }
  return new Intl.DateTimeFormat("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatBs(value) {
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function sortArrow(active, dir) {
  if (!active) return "⇅";
  return dir === "asc" ? "↑" : "↓";
}

const FILTER_EMPTY_SENTINEL = "__EMPTY__";

function movementDateKey(m) {
  const raw = m.movement_date;
  if (raw == null || raw === "") return "";
  const s = String(raw).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function compareMovementChronological(a, b) {
  const da = String(a.movement_date ?? "");
  const db = String(b.movement_date ?? "");
  const cmp = da.localeCompare(db);
  if (cmp !== 0) return cmp;
  return Number(a.id ?? 0) - Number(b.id ?? 0);
}

function filterMovementsByLotFilters(movements, ctx, omitColumn) {
  const {
    categoryFilter,
    descSearch,
    lotColFilterDate,
    lotColFilterCode,
    lotColFilterTxnType,
    lotColFilterOpType,
  } = ctx;

  let list = [...movements];
  if (categoryFilter) {
    list = list.filter((m) => m.category === categoryFilter);
  }
  if (omitColumn !== "date" && lotColFilterDate) {
    list = list.filter((m) => {
      const dk = movementDateKey(m);
      const key = dk === "" ? FILTER_EMPTY_SENTINEL : dk;
      return key === lotColFilterDate;
    });
  }
  if (omitColumn !== "code" && lotColFilterCode) {
    list = list.filter((m) => {
      const raw = String(m.transaction_code ?? "").trim();
      const key = raw === "" ? FILTER_EMPTY_SENTINEL : raw;
      return key === lotColFilterCode;
    });
  }
  if (omitColumn !== "txn" && lotColFilterTxnType) {
    list = list.filter((m) => {
      const raw = String(m.transaction_type ?? "").trim();
      const key = raw === "" ? FILTER_EMPTY_SENTINEL : raw;
      return key === lotColFilterTxnType;
    });
  }
  if (omitColumn !== "op" && lotColFilterOpType) {
    list = list.filter((m) => {
      const raw = String(m.operation_type ?? "").trim();
      const key = raw === "" ? FILTER_EMPTY_SENTINEL : raw;
      return key === lotColFilterOpType;
    });
  }
  const q = descSearch.trim().toLowerCase();
  if (q) {
    list = list.filter((m) => {
      const blob = [
        m.description,
        m.reference,
        m.transaction_code,
        m.transaction_type,
        m.operation_type,
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");
      return blob.includes(q);
    });
  }
  return list;
}

const BATCH_TEXT_SORT_FIELDS = new Set([
  "transaction_code",
  "transaction_type",
  "operation_type",
  "description",
  "reference",
]);

const FALLBACK_CATEGORY_OPTIONS = [
  "Venta",
  "Comisión bancaria",
  "Transferencia interna",
  "Gasto operativo",
  "Ingreso por revisar",
  "Egreso por revisar",
  "Sin clasificar",
  "Compra inventario",
  "Nómina",
  "Transferencia enviada por revisar",
].map((value) => ({ value, label: value }));

/**
 * Tabla de movimientos BNC (filtros en cascada, totales, categoría por fila).
 * Se usa en «lote seleccionado» y en monitor por cuenta.
 */
export default function BankMovementsTableBlock({
  movements,
  loading,
  error,
  resetKey,
  categoriesRefreshToken = 0,
  onMovementUpdated,
  title,
  hintNoContext,
  emptyLoadedMessage,
  maxHeightClass = "max-h-[min(520px,52vh)]",
  /** Oculta título + franja meta («496 visibles…»); útil en «Movimientos por cuenta». */
  hideTitleBar = false,
}) {
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [descSearch, setDescSearch] = useState("");
  const [sortColumn, setSortColumn] = useState("movement_date");
  const [sortDir, setSortDir] = useState("asc");
  const [savingMovementId, setSavingMovementId] = useState(null);
  const [lotColFilterDate, setLotColFilterDate] = useState("");
  const [lotColFilterCode, setLotColFilterCode] = useState("");
  const [lotColFilterTxnType, setLotColFilterTxnType] = useState("");
  const [lotColFilterOpType, setLotColFilterOpType] = useState("");

  const effectiveCategoryOptions =
    categoryOptions.length > 0 ? categoryOptions : FALLBACK_CATEGORY_OPTIONS;

  const hasContext =
    resetKey != null && resetKey !== "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchBankMovementCategories();
        if (!cancelled) setCategoryOptions(res.data || []);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categoriesRefreshToken]);

  useEffect(() => {
    setCategoryFilter("");
    setDescSearch("");
    setSortColumn("movement_date");
    setSortDir("asc");
    setLotColFilterDate("");
    setLotColFilterCode("");
    setLotColFilterTxnType("");
    setLotColFilterOpType("");
  }, [resetKey]);

  const lotFilterCtx = useMemo(
    () => ({
      categoryFilter,
      descSearch,
      lotColFilterDate,
      lotColFilterCode,
      lotColFilterTxnType,
      lotColFilterOpType,
    }),
    [
      categoryFilter,
      descSearch,
      lotColFilterDate,
      lotColFilterCode,
      lotColFilterTxnType,
      lotColFilterOpType,
    ]
  );

  const lotColumnFilterOptions = useMemo(() => {
    const sourceDates = filterMovementsByLotFilters(
      movements,
      lotFilterCtx,
      "date"
    );
    const sourceCodes = filterMovementsByLotFilters(
      movements,
      lotFilterCtx,
      "code"
    );
    const sourceTxn = filterMovementsByLotFilters(
      movements,
      lotFilterCtx,
      "txn"
    );
    const sourceOp = filterMovementsByLotFilters(
      movements,
      lotFilterCtx,
      "op"
    );

    const dateMap = new Map();
    const codeMap = new Map();
    const txnMap = new Map();
    const opMap = new Map();
    for (const m of sourceDates) {
      const dk = movementDateKey(m);
      const dateKey = dk === "" ? FILTER_EMPTY_SENTINEL : dk;
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
    }
    for (const m of sourceCodes) {
      const rawCode = String(m.transaction_code ?? "").trim();
      const codeKey = rawCode === "" ? FILTER_EMPTY_SENTINEL : rawCode;
      codeMap.set(codeKey, (codeMap.get(codeKey) || 0) + 1);
    }
    for (const m of sourceTxn) {
      const rawTxn = String(m.transaction_type ?? "").trim();
      const txnKey = rawTxn === "" ? FILTER_EMPTY_SENTINEL : rawTxn;
      txnMap.set(txnKey, (txnMap.get(txnKey) || 0) + 1);
    }
    for (const m of sourceOp) {
      const rawOp = String(m.operation_type ?? "").trim();
      const opKey = rawOp === "" ? FILTER_EMPTY_SENTINEL : rawOp;
      opMap.set(opKey, (opMap.get(opKey) || 0) + 1);
    }
    const dates = [...dateMap.entries()]
      .sort(([a], [b]) => {
        if (a === FILTER_EMPTY_SENTINEL) return -1;
        if (b === FILTER_EMPTY_SENTINEL) return 1;
        return String(a).localeCompare(String(b));
      })
      .map(([value, count]) => ({
        value,
        count,
        label:
          value === FILTER_EMPTY_SENTINEL
            ? `(sin fecha) (${count})`
            : `${formatDate(value)} (${count})`,
      }));
    const codes = [...codeMap.entries()]
      .sort(([a], [b]) => String(a).localeCompare(String(b), "es"))
      .map(([value, count]) => ({
        value,
        count,
        label:
          value === FILTER_EMPTY_SENTINEL
            ? `(sin código) (${count})`
            : `${value} (${count})`,
      }));
    const txnTypes = [...txnMap.entries()]
      .sort(([a], [b]) => String(a).localeCompare(String(b), "es"))
      .map(([value, count]) => ({
        value,
        count,
        label:
          value === FILTER_EMPTY_SENTINEL
            ? `(vacío) (${count})`
            : `${value} (${count})`,
      }));
    const opTypes = [...opMap.entries()]
      .sort(([a], [b]) => String(a).localeCompare(String(b), "es"))
      .map(([value, count]) => ({
        value,
        count,
        label:
          value === FILTER_EMPTY_SENTINEL
            ? `(vacío) (${count})`
            : `${value.length > 42 ? `${value.slice(0, 40)}…` : value} (${count})`,
      }));
    return { dates, codes, txnTypes, opTypes };
  }, [movements, lotFilterCtx]);

  useEffect(() => {
    const vd = new Set(lotColumnFilterOptions.dates.map((o) => o.value));
    const vc = new Set(lotColumnFilterOptions.codes.map((o) => o.value));
    const vt = new Set(lotColumnFilterOptions.txnTypes.map((o) => o.value));
    const vo = new Set(lotColumnFilterOptions.opTypes.map((o) => o.value));
    if (lotColFilterDate && !vd.has(lotColFilterDate)) setLotColFilterDate("");
    if (lotColFilterCode && !vc.has(lotColFilterCode)) setLotColFilterCode("");
    if (lotColFilterTxnType && !vt.has(lotColFilterTxnType))
      setLotColFilterTxnType("");
    if (lotColFilterOpType && !vo.has(lotColFilterOpType))
      setLotColFilterOpType("");
  }, [
    lotColumnFilterOptions,
    lotColFilterDate,
    lotColFilterCode,
    lotColFilterTxnType,
    lotColFilterOpType,
  ]);

  const displayedMovements = useMemo(() => {
    let list = filterMovementsByLotFilters(movements, lotFilterCtx, null);

    list.sort((a, b) => {
      if (sortColumn === "movement_date") {
        const da = String(a.movement_date ?? "");
        const db = String(b.movement_date ?? "");
        const cmp = da.localeCompare(db);
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (BATCH_TEXT_SORT_FIELDS.has(sortColumn)) {
        const sa = String(a[sortColumn] ?? "").toLowerCase();
        const sb = String(b[sortColumn] ?? "").toLowerCase();
        const cmp = sa.localeCompare(sb, "es");
        return sortDir === "asc" ? cmp : -cmp;
      }
      const va = Number(a[sortColumn] ?? 0);
      const vb = Number(b[sortColumn] ?? 0);
      return sortDir === "asc" ? va - vb : vb - va;
    });

    return list;
  }, [movements, lotFilterCtx, sortColumn, sortDir]);

  const visibleTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const m of displayedMovements) {
      debit += Number(m.debit_bs || 0);
      credit += Number(m.credit_bs || 0);
    }
    if (displayedMovements.length === 0) {
      return { debit, credit, balance: 0 };
    }
    const chronological = [...displayedMovements].sort(
      compareMovementChronological
    );
    const last = chronological[chronological.length - 1];
    const balance = Number(last.balance_bs || 0);
    return { debit, credit, balance };
  }, [displayedMovements]);

  const batchFilterCounts = useMemo(() => {
    const byCategory = {};
    for (const m of movements) {
      const cat = m.category ?? "";
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }
    return {
      byCategory,
      total: movements.length,
    };
  }, [movements]);

  function toggleSort(column) {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDir("asc");
    } else {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    }
  }

  /** Vuelve filtros de columna, categoría y búsqueda a «todas» / vacío (no cambia el orden). */
  function resetLotFilters() {
    setCategoryFilter("");
    setDescSearch("");
    setLotColFilterDate("");
    setLotColFilterCode("");
    setLotColFilterTxnType("");
    setLotColFilterOpType("");
  }

  async function handleMovementCategoryChange(movement, nextCategory) {
    if (nextCategory === movement.category) return;
    setSavingMovementId(movement.id);
    try {
      const res = await patchBankMovementCategory(movement.id, nextCategory);
      onMovementUpdated?.(res.data);
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingMovementId(null);
    }
  }

  const showMetaStrip =
    !hideTitleBar && hasContext && movements.length > 0 && !loading;

  const showFullTitleBlock =
    !hideTitleBar ||
    error ||
    loading ||
    (!hasContext && hintNoContext);

  return (
    <section
      className={`bg-white border border-gray-200 shadow-sm overflow-hidden ${
        hideTitleBar ? "rounded-lg" : "rounded-xl"
      }`}
    >
      {showFullTitleBlock && (
        <div
          className={`border-b border-gray-200 ${
            showMetaStrip ? "bg-gray-50" : ""
          }`}
        >
          <div className="px-3 py-2">
            {!hideTitleBar ? (
              <>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-800 leading-snug">
                    {title}
                  </h2>
                  {!hasContext && hintNoContext && (
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {hintNoContext}
                    </p>
                  )}
                </div>

                {error && (
                  <p className="text-xs text-red-600 mt-1.5">{error}</p>
                )}
                {loading && (
                  <p className="text-[11px] text-gray-500 mt-1.5">Cargando…</p>
                )}

                {showMetaStrip && (
                  <p className="text-[11px] text-gray-500 mt-2 lg:mt-1.5 leading-snug">
                    <span className="font-semibold text-gray-700">
                      {displayedMovements.length}
                    </span>
                    {" / "}
                    {movements.length} visibles · Filtros en la fila bajo los
                    títulos (en cascada) · Orden: clic en encabezados (↑↓).
                  </p>
                )}
              </>
            ) : (
              <>
                {error && (
                  <p className="text-xs text-red-600">{error}</p>
                )}
                {loading && (
                  <p className="text-[11px] text-gray-500">Cargando…</p>
                )}
                {!hasContext && hintNoContext && (
                  <p className="text-[11px] text-gray-500">{hintNoContext}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {hasContext &&
        movements.length > 0 &&
        displayedMovements.length === 0 && (
          <div className="text-xs text-amber-900 bg-amber-50 border-t border-amber-100 px-3 py-2 leading-snug flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0">
              Ningún movimiento coincide con los filtros. Prueba categoría, texto
              de búsqueda u otros filtros de columna.
            </p>
            <button
              type="button"
              onClick={resetLotFilters}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-[11px] font-medium text-amber-950 hover:bg-amber-100"
              title="Quitar todos los filtros y la búsqueda"
              aria-label="Recargar filtros"
            >
              <RefreshIcon className="w-3.5 h-3.5" />
              Recargar
            </button>
          </div>
        )}

      {hasContext &&
        movements.length > 0 &&
        displayedMovements.length > 0 && (
          <div className={`overflow-x-auto ${maxHeightClass} overflow-y-auto`}>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort("movement_date")}
                      className="inline-flex items-center gap-1 font-semibold text-gray-700 hover:text-blue-700"
                    >
                      Fecha{" "}
                      <span className="text-blue-600 font-mono text-xs">
                        {sortArrow(
                          sortColumn === "movement_date",
                          sortDir
                        )}
                      </span>
                    </button>
                  </th>
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort("transaction_code")}
                      className="inline-flex items-center gap-1 font-semibold text-gray-700 hover:text-blue-700"
                    >
                      Código{" "}
                      <span className="text-blue-600 font-mono text-xs">
                        {sortArrow(
                          sortColumn === "transaction_code",
                          sortDir
                        )}
                      </span>
                    </button>
                  </th>
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort("transaction_type")}
                      className="inline-flex items-center gap-1 font-semibold text-gray-700 hover:text-blue-700"
                    >
                      Tipo trans.{" "}
                      <span className="text-blue-600 font-mono text-xs">
                        {sortArrow(
                          sortColumn === "transaction_type",
                          sortDir
                        )}
                      </span>
                    </button>
                  </th>
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort("operation_type")}
                      className="inline-flex items-center gap-1 font-semibold text-gray-700 hover:text-blue-700"
                    >
                      Tipo oper.{" "}
                      <span className="text-blue-600 font-mono text-xs">
                        {sortArrow(
                          sortColumn === "operation_type",
                          sortDir
                        )}
                      </span>
                    </button>
                  </th>
                  <th className="text-left px-2 py-1.5 min-w-[200px]">
                    <button
                      type="button"
                      onClick={() => toggleSort("description")}
                      className="inline-flex items-center gap-1 font-semibold text-gray-700 hover:text-blue-700"
                    >
                      Descripción{" "}
                      <span className="text-blue-600 font-mono text-xs">
                        {sortArrow(sortColumn === "description", sortDir)}
                      </span>
                    </button>
                  </th>
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort("reference")}
                      className="inline-flex items-center gap-1 font-semibold text-gray-700 hover:text-blue-700"
                    >
                      Referencia{" "}
                      <span className="text-blue-600 font-mono text-xs">
                        {sortArrow(sortColumn === "reference", sortDir)}
                      </span>
                    </button>
                  </th>
                  <th className="text-right px-2 py-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort("debit_bs")}
                      className="inline-flex items-center gap-1 font-semibold text-gray-700 hover:text-blue-700 ml-auto w-full justify-end"
                    >
                      Debe{" "}
                      <span className="text-blue-600 font-mono text-xs">
                        {sortArrow(sortColumn === "debit_bs", sortDir)}
                      </span>
                    </button>
                  </th>
                  <th className="text-right px-2 py-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort("credit_bs")}
                      className="inline-flex items-center gap-1 font-semibold text-gray-700 hover:text-blue-700 ml-auto w-full justify-end"
                    >
                      Haber{" "}
                      <span className="text-blue-600 font-mono text-xs">
                        {sortArrow(sortColumn === "credit_bs", sortDir)}
                      </span>
                    </button>
                  </th>
                  <th className="text-right px-2 py-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort("balance_bs")}
                      className="inline-flex items-center gap-1 font-semibold text-gray-700 hover:text-blue-700 ml-auto w-full justify-end"
                    >
                      Saldo{" "}
                      <span className="text-blue-600 font-mono text-xs">
                        {sortArrow(sortColumn === "balance_bs", sortDir)}
                      </span>
                    </button>
                  </th>
                  <th className="text-left px-2 py-1.5 min-w-[220px] align-middle">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-gray-700">
                        Categoría
                      </span>
                      <button
                        type="button"
                        onClick={resetLotFilters}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-300"
                        title="Quitar todos los filtros y la búsqueda en descripción"
                        aria-label="Recargar filtros"
                      >
                        <RefreshIcon className="w-3.5 h-3.5 text-gray-600" />
                        Recargar
                      </button>
                    </div>
                  </th>
                </tr>
                <tr className="bg-gray-50 border-t border-gray-200 text-[11px]">
                  <th className="text-left align-top px-2 py-1 font-normal min-w-[140px]">
                    <span className="sr-only">Filtrar por fecha</span>
                    <select
                      value={lotColFilterDate}
                      onChange={(e) => setLotColFilterDate(e.target.value)}
                      className="w-full max-w-[min(180px,28vw)] border border-gray-300 rounded px-1 py-0.5 bg-white"
                      title="Filtrar por fecha del movimiento"
                    >
                      <option value="">Todas las fechas</option>
                      {lotColumnFilterOptions.dates.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </th>
                  <th className="text-left align-top px-2 py-1 font-normal min-w-[88px]">
                    <span className="sr-only">Filtrar por código</span>
                    <select
                      value={lotColFilterCode}
                      onChange={(e) => setLotColFilterCode(e.target.value)}
                      className="w-full max-w-[min(120px,22vw)] border border-gray-300 rounded px-1 py-0.5 bg-white"
                      title="Filtrar por código de transacción"
                    >
                      <option value="">Todos los códigos</option>
                      {lotColumnFilterOptions.codes.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </th>
                  <th className="text-left align-top px-2 py-1 font-normal min-w-[120px]">
                    <span className="sr-only">Filtrar por tipo de transacción</span>
                    <select
                      value={lotColFilterTxnType}
                      onChange={(e) => setLotColFilterTxnType(e.target.value)}
                      className="w-full max-w-[min(160px,26vw)] border border-gray-300 rounded px-1 py-0.5 bg-white"
                      title="Filtrar por tipo trans."
                    >
                      <option value="">Todos</option>
                      {lotColumnFilterOptions.txnTypes.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </th>
                  <th className="text-left align-top px-2 py-1 font-normal min-w-[140px]">
                    <span className="sr-only">Filtrar por tipo de operación</span>
                    <select
                      value={lotColFilterOpType}
                      onChange={(e) => setLotColFilterOpType(e.target.value)}
                      className="w-full max-w-[min(220px,36vw)] border border-gray-300 rounded px-1 py-0.5 bg-white"
                      title="Filtrar por tipo operación"
                    >
                      <option value="">Todos</option>
                      {lotColumnFilterOptions.opTypes.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </th>
                  <th className="text-left align-top px-2 py-1 font-normal min-w-[120px]">
                    <span className="sr-only">Buscar en descripción, referencia y códigos</span>
                    <input
                      type="search"
                      value={descSearch}
                      onChange={(e) => setDescSearch(e.target.value)}
                      placeholder="Buscar texto…"
                      className="w-full min-w-[7rem] border border-gray-300 rounded px-1 py-0.5 text-[11px] bg-white"
                      title="Filtra por descripción, referencia o códigos"
                      autoComplete="off"
                    />
                  </th>
                  <th className="text-right px-2 py-1 align-bottom whitespace-nowrap bg-gray-50 border-l border-gray-100">
                    <span className="block text-[10px] leading-tight text-gray-500 font-normal">
                      Σ visible
                    </span>
                    <span className="text-gray-600 tabular-nums text-[11px]">
                      {displayedMovements.length} filas
                    </span>
                  </th>
                  <th className="text-right px-2 py-1 align-bottom whitespace-nowrap bg-gray-50 border-l border-gray-200">
                    <span className="block text-[10px] leading-tight text-gray-500 font-normal">
                      Total debe
                    </span>
                    <span className="text-red-700 font-semibold tabular-nums text-[11px]">
                      Bs {formatBs(visibleTotals.debit)}
                    </span>
                  </th>
                  <th className="text-right px-2 py-1 align-bottom whitespace-nowrap bg-gray-50 border-l border-gray-100">
                    <span className="block text-[10px] leading-tight text-gray-500 font-normal">
                      Total haber
                    </span>
                    <span className="text-green-800 font-semibold tabular-nums text-[11px]">
                      Bs {formatBs(visibleTotals.credit)}
                    </span>
                  </th>
                  <th
                    className="text-right px-2 py-1 align-bottom whitespace-nowrap bg-gray-50 border-l border-gray-100"
                    title="Saldo según el último movimiento en orden de fecha (no es la suma de la columna)."
                  >
                    <span className="block text-[10px] leading-tight text-gray-500 font-normal">
                      Saldo final
                    </span>
                    <span className="text-gray-900 font-semibold tabular-nums text-[11px]">
                      Bs {formatBs(visibleTotals.balance)}
                    </span>
                  </th>
                  <th className="text-left align-top px-2 py-1 font-normal min-w-[160px] bg-gray-50 border-l border-gray-100">
                    <span className="sr-only">Filtrar por categoría</span>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full max-w-[min(220px,40vw)] border border-gray-300 rounded px-1 py-0.5 text-[11px] bg-white"
                      title="Filtrar por categoría"
                    >
                      <option value="">
                        Todas ({batchFilterCounts.total})
                      </option>
                      {effectiveCategoryOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {`${opt.label} (${batchFilterCounts.byCategory[opt.value] ?? 0})`}
                        </option>
                      ))}
                    </select>
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedMovements.map((m) => {
                  const optSet = new Set(
                    effectiveCategoryOptions.map((o) => o.value)
                  );
                  const hasLegacy =
                    m.category && !optSet.has(m.category);
                  return (
                    <tr key={m.id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap align-top">
                        {formatDate(m.movement_date)}
                      </td>
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        {m.transaction_code ?? "—"}
                      </td>
                      <td className="px-3 py-2 align-top max-w-[140px]">
                        {m.transaction_type ?? "—"}
                      </td>
                      <td className="px-3 py-2 align-top max-w-[140px]">
                        {m.operation_type ?? "—"}
                      </td>
                      <td className="px-3 py-2 max-w-lg align-top">
                        {m.description ?? "—"}
                      </td>
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        {m.reference ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-red-600 align-top whitespace-nowrap">
                        Bs {formatBs(m.debit_bs)}
                      </td>
                      <td className="px-3 py-2 text-right text-green-700 align-top whitespace-nowrap">
                        Bs {formatBs(m.credit_bs)}
                      </td>
                      <td className="px-3 py-2 text-right align-top whitespace-nowrap">
                        Bs {formatBs(m.balance_bs)}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <select
                          value={m.category || ""}
                          disabled={savingMovementId === m.id}
                          onChange={(e) =>
                            handleMovementCategoryChange(m, e.target.value)
                          }
                          className="max-w-full border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white disabled:opacity-60"
                        >
                          {hasLegacy && (
                            <option value={m.category}>
                              {m.category} (valor anterior)
                            </option>
                          )}
                          {effectiveCategoryOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {savingMovementId === m.id && (
                          <span className="block text-[10px] text-gray-400 mt-0.5">
                            Guardando…
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      {hasContext &&
        !loading &&
        movements.length === 0 &&
        emptyLoadedMessage}

    </section>
  );
}
