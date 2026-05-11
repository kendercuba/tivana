import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Settings2 } from "lucide-react";
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

/** Fecha corta para tablas densas (sin día de la semana). */
function formatDateShortVe(dateString) {
  if (!dateString) return "—";
  const date = new Date(`${String(dateString).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-VE", {
    day: "numeric",
    month: "short",
    year: "numeric",
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

const MOV_COLUMN_ORDER = [
  "movement_date",
  "transaction_code",
  "transaction_type",
  "operation_type",
  "description",
  "reference",
  "debit_bs",
  "credit_bs",
  "balance_bs",
  "category",
];

const MOV_COLUMN_LABELS = {
  movement_date: "Fecha",
  transaction_code: "Código",
  transaction_type: "Tipo trans.",
  operation_type: "Tipo oper.",
  description: "Descripción",
  reference: "Referencia",
  debit_bs: "Debe",
  credit_bs: "Haber",
  balance_bs: "Saldo",
  category: "Categoría",
};

const IMPORT_FULL_VISIBILITY = Object.fromEntries(
  MOV_COLUMN_ORDER.map((id) => [id, true])
);

/** Vista monitor: ocultas por defecto las columnas más ruidosas. */
const MONITOR_DEFAULT_COLUMN_VISIBILITY = {
  movement_date: true,
  transaction_code: false,
  transaction_type: false,
  operation_type: false,
  description: true,
  reference: false,
  debit_bs: true,
  credit_bs: true,
  balance_bs: true,
  category: true,
};

/** Pesos relativos para repartir el ancho con `table-fixed` (vista cómoda). */
const COMFY_COL_WEIGHT = {
  movement_date: 1.15,
  transaction_code: 0.75,
  transaction_type: 0.85,
  operation_type: 0.95,
  /** Más compacta en pantallas anchas (el tope real lo da maxWidth en col/celdas). */
  description: 1.55,
  reference: 1.15,
  debit_bs: 1.35,
  credit_bs: 1.35,
  balance_bs: 1.35,
  category: 1.05,
};

/**
 * Anchos mínimos por columna (vista cómoda) para evitar solapamiento en móvil/tablet:
 * la tabla usa `table-auto` + scroll horizontal cuando el viewport es más estrecho.
 */
const COMFY_COL_MIN_PX = {
  movement_date: 100,
  transaction_code: 88,
  transaction_type: 108,
  operation_type: 124,
  description: 240,
  reference: 112,
  debit_bs: 108,
  credit_bs: 108,
  balance_bs: 108,
  category: 152,
};

/** Tope de ancho para «Descripción» en vista cómoda (compacto en desktop, fluido en móvil). */
const COMFY_DESC_MAX = "min(26rem, calc(100vw - 2rem))";

/** Misma idea que el padding horizontal de las celdas en vista cómoda (tbody). */
function comfyToolbarCellPaddingClass(columnId) {
  if (columnId === "description") return "px-2";
  if (columnId === "category") return "px-1.5";
  return "px-4";
}

function comfyToolbarCellAlignClass(columnId) {
  if (
    columnId === "debit_bs" ||
    columnId === "credit_bs" ||
    columnId === "balance_bs"
  ) {
    return "items-end text-right";
  }
  if (columnId === "category") return "items-end";
  return "items-start text-left";
}

/** Contenedor de tarjeta en barra de totales: encoge con la celda sin desbordar. */
const COMFY_TOOLBAR_STAT_CARD =
  "min-w-0 w-full max-w-full overflow-hidden rounded-lg border px-2 py-1 shadow-sm sm:px-2.5 sm:py-1.5";
/** Etiqueta (Total debe, etc.): corta con puntos si no cabe; texto corto. */
const COMFY_TOOLBAR_STAT_LABEL =
  "min-w-0 truncate text-[9px] font-semibold uppercase tracking-wide leading-tight sm:text-[10px]";

/** Fluid type para importes/cantidades (min ≤ valor central ≤ max siempre). */
const COMFY_TOOLBAR_FLUID_BIG =
  "text-[clamp(0.5rem,min(2.4vw+0.35rem,1rem),1rem)]";

/** Número/cantidad en tarjeta Visible (misma lógica fluida que importes). */
const COMFY_TOOLBAR_VISIBLE_COUNT =
  `mt-0.5 block min-w-0 max-w-full whitespace-nowrap text-left font-semibold tabular-nums leading-none overflow-x-auto ${COMFY_TOOLBAR_FLUID_BIG} [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`;

/**
 * Importe: una sola línea; fuente fluida. Sin break-all para no partir importes.
 */
const COMFY_TOOLBAR_STAT_VALUE =
  `mt-0.5 block min-w-0 max-w-full hyphens-none text-right font-semibold tabular-nums leading-none whitespace-nowrap overflow-x-auto ${COMFY_TOOLBAR_FLUID_BIG} [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`;

function ToolbarVisibleRowsCard({ count }) {
  return (
    <div
      className={`${COMFY_TOOLBAR_STAT_CARD} border-slate-200 bg-white text-left ring-1 ring-slate-900/[0.04]`}
    >
      <p className={`${COMFY_TOOLBAR_STAT_LABEL} text-slate-500`}>Visible</p>
      <p className={`${COMFY_TOOLBAR_VISIBLE_COUNT} text-slate-900`}>
        <span className="tabular-nums">{count}</span>{" "}
        <span className="text-[0.82em] font-normal text-slate-600">filas</span>
      </p>
    </div>
  );
}

function loadColumnVisibility(storageKey) {
  if (!storageKey || typeof localStorage === "undefined") {
    return { ...MONITOR_DEFAULT_COLUMN_VISIBILITY };
  }
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { ...MONITOR_DEFAULT_COLUMN_VISIBILITY };
    const parsed = JSON.parse(raw);
    const merged = { ...MONITOR_DEFAULT_COLUMN_VISIBILITY };
    for (const id of MOV_COLUMN_ORDER) {
      if (typeof parsed[id] === "boolean") merged[id] = parsed[id];
    }
    merged.movement_date = true;
    return merged;
  } catch {
    return { ...MONITOR_DEFAULT_COLUMN_VISIBILITY };
  }
}

function persistColumnVisibility(storageKey, vis) {
  if (!storageKey || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(vis));
  } catch {
    /* ignore */
  }
}

/**
 * Tabla de movimientos BNC (filtros en cascada, totales, categoría por fila).
 * Se usa en «lote seleccionado» y en monitor por cuenta.
 */
const BankMovementsTableBlock = forwardRef(function BankMovementsTableBlock(
  {
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
    /** Tipografía y espaciado más claros (vista monitor por cuenta). */
    appearance = "default",
    /**
     * Si se define, se muestra el selector de columnas y se guarda la config en localStorage.
     * Vista importar por lote: omitir para ver siempre todas las columnas.
     */
    columnVisibilityStorageKey = null,
    /** Oculta la franja de totales (Σ, debe/haber/saldo) dentro de la tabla; en vista cómoda van en la barra superior alineada a columnas. */
    hideInlineSummaryTotals = false,
    /**
     * Si es true, no se dibuja la rejilla de totales encima de la tabla; el padre puede mostrarla
     * con la misma geometría vía `onExternalSummaryChange`.
     */
    externalSummaryStrip = false,
    /** Recibe layout de columnas + totales para alinear una franja fuera de la tabla (p. ej. monitor por cuenta). */
    onExternalSummaryChange,
    /** En vista cómoda sin franja externa de totales: muestra la barra Recargar/Columnas encima de la tabla (sin rejilla de tarjetas). */
    hideComfortableStatCards = false,
    /** Al incrementarse, resetea filtros de columna/categoría como «Recargar» dentro de la tabla. */
    resetFiltersKey = 0,
    /** Oculta la barra Recargar/Columnas encima de la tabla (p. ej. Columnas en el padre). */
    suppressTopToolbar = false,
    /** Ref al botón «Columnas» en el padre; el menú se posiciona con `position:fixed`. */
    columnPickerAnchorRef = null,
  },
  ref
) {
  const comfy = appearance === "comfortable";
  const sortBtnClass =
    "inline-flex items-center gap-1 font-semibold hover:text-blue-700 " +
    (comfy ? "text-slate-800" : "text-gray-700");
  const sortBtnClassEnd = `${sortBtnClass} ml-auto w-full justify-end`;
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
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const [colPickerFixedStyle, setColPickerFixedStyle] = useState(null);
  const colPickerRef = useRef(null);
  const colPickerMenuRef = useRef(null);
  /** Altura real de la 1.ª fila del thead (sticky) para alinear la fila de filtros sin rendija. */
  const headerSortRowRef = useRef(null);
  const [filterRowStickyTopPx, setFilterRowStickyTopPx] = useState(40);

  useImperativeHandle(
    ref,
    () => ({
      toggleColumnPicker: () => {
        if (!columnVisibilityStorageKey) return;
        setColPickerOpen((o) => !o);
      },
    }),
    [columnVisibilityStorageKey]
  );

  const [colVis, setColVis] = useState(() =>
    columnVisibilityStorageKey
      ? loadColumnVisibility(columnVisibilityStorageKey)
      : { ...IMPORT_FULL_VISIBILITY }
  );

  useEffect(() => {
    if (!columnVisibilityStorageKey) return;
    persistColumnVisibility(columnVisibilityStorageKey, colVis);
  }, [columnVisibilityStorageKey, colVis]);

  useLayoutEffect(() => {
    if (!colPickerOpen || !suppressTopToolbar || !columnPickerAnchorRef) {
      setColPickerFixedStyle(null);
      return;
    }
    function place() {
      const el = columnPickerAnchorRef.current;
      if (!el || typeof window === "undefined") return;
      const r = el.getBoundingClientRect();
      const w = 240;
      setColPickerFixedStyle({
        top: r.bottom + 6,
        left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)),
      });
    }
    place();
    document.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [colPickerOpen, suppressTopToolbar, columnPickerAnchorRef]);

  useEffect(() => {
    function handleDown(e) {
      if (!colPickerOpen) return;
      const t = e.target;
      if (colPickerRef.current?.contains(t)) return;
      if (columnPickerAnchorRef?.current?.contains(t)) return;
      if (colPickerMenuRef.current?.contains(t)) return;
      setColPickerOpen(false);
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [colPickerOpen, columnPickerAnchorRef]);

  function visibleCol(id) {
    return colVis[id] !== false;
  }

  function toggleColumnVisibility(id) {
    if (id === "movement_date") return;
    setColVis((prev) => {
      const next = { ...prev, [id]: prev[id] === false };
      const nOn = MOV_COLUMN_ORDER.filter((k) => next[k] !== false).length;
      if (nOn < 1) return prev;
      return next;
    });
  }

  const comfyColFractions = useMemo(() => {
    if (!comfy) return null;
    const ids = MOV_COLUMN_ORDER.filter((id) => colVis[id] !== false);
    if (ids.length === 0) return null;
    const sumW = ids.reduce(
      (s, id) => s + (COMFY_COL_WEIGHT[id] ?? 1),
      0
    );
    return ids.map((id) => ({
      id,
      pct: ((COMFY_COL_WEIGHT[id] ?? 1) / sumW) * 100,
    }));
  }, [comfy, colVis]);

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

  useLayoutEffect(() => {
    const row = headerSortRowRef.current;
    if (!row) return;
    function measure() {
      const h = row.getBoundingClientRect().height;
      if (h > 0) setFilterRowStickyTopPx(Math.ceil(h));
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
  }, [colVis, comfy, displayedMovements.length, movements.length]);

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

  const showOuterToolbarRow = useMemo(
    () =>
      !suppressTopToolbar &&
      !(
        hideInlineSummaryTotals &&
        comfy &&
        comfyColFractions &&
        comfyColFractions.length > 0 &&
        !externalSummaryStrip &&
        !hideComfortableStatCards
      ),
    [
      suppressTopToolbar,
      hideInlineSummaryTotals,
      comfy,
      comfyColFractions,
      externalSummaryStrip,
      hideComfortableStatCards,
    ]
  );

  useEffect(() => {
    if (typeof onExternalSummaryChange !== "function") return;
    if (!externalSummaryStrip) {
      onExternalSummaryChange(null);
      return;
    }
    if (
      !hideInlineSummaryTotals ||
      !comfy ||
      !comfyColFractions ||
      comfyColFractions.length === 0
    ) {
      onExternalSummaryChange(null);
      return;
    }
    onExternalSummaryChange({
      fractions: comfyColFractions,
      visibleRows: displayedMovements.length,
      totals: visibleTotals,
      showVisibleOnReference: visibleCol("reference"),
    });
  }, [
    externalSummaryStrip,
    onExternalSummaryChange,
    hideInlineSummaryTotals,
    comfy,
    comfyColFractions,
    displayedMovements.length,
    visibleTotals.debit,
    visibleTotals.credit,
    visibleTotals.balance,
    colVis,
  ]);

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
  const resetLotFilters = useCallback(() => {
    setCategoryFilter("");
    setDescSearch("");
    setLotColFilterDate("");
    setLotColFilterCode("");
    setLotColFilterTxnType("");
    setLotColFilterOpType("");
  }, []);

  useEffect(() => {
    if (resetFiltersKey <= 0) return;
    resetLotFilters();
  }, [resetFiltersKey, resetLotFilters]);

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
      className={`bg-white border min-w-0 ${
        comfy
          ? "rounded-2xl border-slate-200 shadow-md shadow-slate-900/5"
          : hideTitleBar
            ? "rounded-lg border-gray-200 shadow-sm"
            : "rounded-xl border-gray-200 shadow-sm"
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
                    {movements.length} visibles
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
          <>
            {showOuterToolbarRow && (
              <div className="flex flex-col gap-2 px-2 pb-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-3">
                <button
                  type="button"
                  onClick={resetLotFilters}
                  className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:w-auto sm:justify-start"
                  title="Quitar todos los filtros y la búsqueda en descripción"
                  aria-label="Recargar filtros"
                >
                  <RefreshIcon className="h-4 w-4 text-slate-600" />
                  Recargar
                </button>
                {columnVisibilityStorageKey && (
                  <div
                    className="relative w-full shrink-0 sm:ml-auto sm:w-auto"
                    ref={colPickerRef}
                  >
                    <button
                      type="button"
                      onClick={() => setColPickerOpen((o) => !o)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:w-auto sm:justify-start"
                      aria-expanded={colPickerOpen}
                    >
                      <Settings2 className="h-4 w-4 text-slate-600" aria-hidden />
                      Columnas
                    </button>
                    {colPickerOpen && (
                      <div
                        ref={colPickerMenuRef}
                        className="absolute right-0 top-full z-40 mt-1.5 w-60 rounded-xl border border-slate-200 bg-white py-2 shadow-xl shadow-slate-900/15"
                        role="menu"
                      >
                        <p className="border-b border-slate-100 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Mostrar columnas
                        </p>
                        <ul className="max-h-[min(70vh,22rem)] overflow-y-auto py-1">
                          {MOV_COLUMN_ORDER.map((id) => (
                            <li key={id}>
                              <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  checked={colVis[id] !== false}
                                  disabled={id === "movement_date"}
                                  onChange={() => toggleColumnVisibility(id)}
                                />
                                <span>{MOV_COLUMN_LABELS[id]}</span>
                                {id === "movement_date" && (
                                  <span className="ml-auto text-[10px] text-slate-400">
                                    siempre
                                  </span>
                                )}
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/*
              Un solo contenedor con overflow-auto: si el scroll horizontal va en un hijo,
              position:sticky del thead suele fallar. Así encabezado + filtros quedan fijos
              al hacer scroll dentro de la tabla; el scroll de página mueve todo el bloque.
            */}
            <div
              className={`${maxHeightClass} w-full min-w-0 overflow-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]`}
            >
                {hideInlineSummaryTotals &&
                  comfy &&
                  comfyColFractions &&
                  comfyColFractions.length > 0 &&
                  !externalSummaryStrip &&
                  !hideComfortableStatCards && (
                    <div className="relative min-w-0 border-b border-slate-100 bg-white">
                      <div
                        className="grid w-full min-w-0 items-end gap-x-0 pb-2 pt-1"
                        style={{
                          gridTemplateColumns: comfyColFractions
                            .map((f) => `${f.pct}fr`)
                            .join(" "),
                        }}
                      >
                        {comfyColFractions.map(({ id }) => (
                          <div
                            key={id}
                            className={`min-w-0 flex flex-col justify-end gap-1.5 ${comfyToolbarCellPaddingClass(id)} ${comfyToolbarCellAlignClass(id)}`}
                          >
                            {id === "movement_date" && (
                              <>
                                <button
                                  type="button"
                                  onClick={resetLotFilters}
                                  className="inline-flex w-fit max-w-full shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                                  title="Quitar todos los filtros y la búsqueda en descripción"
                                  aria-label="Recargar filtros"
                                >
                                  <RefreshIcon className="h-4 w-4 shrink-0 text-slate-600" />
                                  Recargar
                                </button>
                                {!visibleCol("reference") && (
                                  <ToolbarVisibleRowsCard
                                    count={displayedMovements.length}
                                  />
                                )}
                              </>
                            )}
                            {id === "reference" && visibleCol("reference") && (
                              <ToolbarVisibleRowsCard
                                count={displayedMovements.length}
                              />
                            )}
                            {id === "debit_bs" && (
                              <div
                                className={`${COMFY_TOOLBAR_STAT_CARD} border-red-100 bg-gradient-to-br from-red-50/95 to-white ring-1 ring-red-900/5`}
                              >
                                <p
                                  className={`${COMFY_TOOLBAR_STAT_LABEL} text-right text-red-800/90`}
                                >
                                  Total debe
                                </p>
                                <p
                                  className={`${COMFY_TOOLBAR_STAT_VALUE} text-red-900`}
                                >
                                  Bs {formatBs(visibleTotals.debit)}
                                </p>
                              </div>
                            )}
                            {id === "credit_bs" && (
                              <div
                                className={`${COMFY_TOOLBAR_STAT_CARD} border-emerald-100 bg-gradient-to-br from-emerald-50/95 to-white ring-1 ring-emerald-900/5`}
                              >
                                <p
                                  className={`${COMFY_TOOLBAR_STAT_LABEL} text-right text-emerald-800/90`}
                                >
                                  Total haber
                                </p>
                                <p
                                  className={`${COMFY_TOOLBAR_STAT_VALUE} text-emerald-900`}
                                >
                                  Bs {formatBs(visibleTotals.credit)}
                                </p>
                              </div>
                            )}
                            {id === "balance_bs" && (
                              <div
                                className={`${COMFY_TOOLBAR_STAT_CARD} border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white ring-1 ring-indigo-900/5`}
                                title="Saldo según el último movimiento en orden de fecha (no es la suma de la columna)."
                              >
                                <p
                                  className={`${COMFY_TOOLBAR_STAT_LABEL} text-right text-indigo-800/85`}
                                >
                                  Saldo final
                                </p>
                                <p
                                  className={`${COMFY_TOOLBAR_STAT_VALUE} text-slate-900`}
                                >
                                  Bs {formatBs(visibleTotals.balance)}
                                </p>
                              </div>
                            )}
                            {id === "category" &&
                              columnVisibilityStorageKey &&
                              visibleCol("category") && (
                                <div ref={colPickerRef} className="relative shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setColPickerOpen((o) => !o)}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                                    aria-expanded={colPickerOpen}
                                  >
                                    <Settings2
                                      className="h-4 w-4 text-slate-600"
                                      aria-hidden
                                    />
                                    Columnas
                                  </button>
                                  {colPickerOpen && (
                                    <div
                                      ref={colPickerMenuRef}
                                      className="absolute right-0 top-full z-40 mt-1.5 w-60 rounded-xl border border-slate-200 bg-white py-2 shadow-xl shadow-slate-900/15"
                                      role="menu"
                                    >
                                      <p className="border-b border-slate-100 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Mostrar columnas
                                      </p>
                                      <ul className="max-h-[min(70vh,22rem)] overflow-y-auto py-1">
                                        {MOV_COLUMN_ORDER.map((cid) => (
                                          <li key={cid}>
                                            <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">
                                              <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                checked={colVis[cid] !== false}
                                                disabled={cid === "movement_date"}
                                                onChange={() =>
                                                  toggleColumnVisibility(cid)
                                                }
                                              />
                                              <span>{MOV_COLUMN_LABELS[cid]}</span>
                                              {cid === "movement_date" && (
                                                <span className="ml-auto text-[10px] text-slate-400">
                                                  siempre
                                                </span>
                                              )}
                                            </label>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}
                          </div>
                        ))}
                      </div>
                      {columnVisibilityStorageKey &&
                        !visibleCol("category") && (
                          <div
                            className="absolute right-3 top-2 z-30"
                            ref={colPickerRef}
                          >
                            <button
                              type="button"
                              onClick={() => setColPickerOpen((o) => !o)}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                              aria-expanded={colPickerOpen}
                            >
                              <Settings2
                                className="h-4 w-4 text-slate-600"
                                aria-hidden
                              />
                              Columnas
                            </button>
                            {colPickerOpen && (
                              <div
                                ref={colPickerMenuRef}
                                className="absolute right-0 top-full z-40 mt-1.5 w-60 rounded-xl border border-slate-200 bg-white py-2 shadow-xl shadow-slate-900/15"
                                role="menu"
                              >
                                <p className="border-b border-slate-100 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Mostrar columnas
                                </p>
                                <ul className="max-h-[min(70vh,22rem)] overflow-y-auto py-1">
                                  {MOV_COLUMN_ORDER.map((cid) => (
                                    <li key={cid}>
                                      <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">
                                        <input
                                          type="checkbox"
                                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                          checked={colVis[cid] !== false}
                                          disabled={cid === "movement_date"}
                                          onChange={() =>
                                            toggleColumnVisibility(cid)
                                          }
                                        />
                                        <span>{MOV_COLUMN_LABELS[cid]}</span>
                                        {cid === "movement_date" && (
                                          <span className="ml-auto text-[10px] text-slate-400">
                                            siempre
                                          </span>
                                        )}
                                      </label>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  )}
                <table
                className={`${
                  comfy
                    ? "min-w-full w-max table-auto border-collapse text-[15px] leading-snug"
                    : "min-w-full text-sm"
                }`}
              >
                {comfy && comfyColFractions && comfyColFractions.length > 0 && (
                  <colgroup>
                    {comfyColFractions.map(({ id }) => (
                      <col
                        key={id}
                        style={{
                          minWidth: COMFY_COL_MIN_PX[id] ?? 96,
                          ...(id === "description"
                            ? { maxWidth: COMFY_DESC_MAX }
                            : {}),
                        }}
                      />
                    ))}
                  </colgroup>
                )}
                <thead>
                  <tr
                    ref={headerSortRowRef}
                    className={`sticky top-0 z-[40] shadow-[0_1px_0_0_rgb(148_163_184_/_0.4)] ${
                      comfy
                        ? "bg-slate-100 [&_th]:bg-slate-100"
                        : "bg-gray-100 [&_th]:bg-gray-100"
                    }`}
                  >
                    {visibleCol("movement_date") && (
                      <th className="text-left px-2 py-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleSort("movement_date")}
                          className={sortBtnClass}
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
                    )}
                    {visibleCol("transaction_code") && (
                      <th className="text-left px-2 py-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleSort("transaction_code")}
                          className={sortBtnClass}
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
                    )}
                    {visibleCol("transaction_type") && (
                      <th className="text-left px-2 py-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleSort("transaction_type")}
                          className={sortBtnClass}
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
                    )}
                    {visibleCol("operation_type") && (
                      <th className="text-left px-2 py-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleSort("operation_type")}
                          className={sortBtnClass}
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
                    )}
                    {visibleCol("description") && (
                      <th
                        className="text-left px-2 py-1.5 min-w-0"
                        style={comfy ? { maxWidth: COMFY_DESC_MAX } : undefined}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort("description")}
                          className={sortBtnClass}
                        >
                          Descripción{" "}
                          <span className="text-blue-600 font-mono text-xs">
                            {sortArrow(sortColumn === "description", sortDir)}
                          </span>
                        </button>
                      </th>
                    )}
                    {visibleCol("reference") && (
                      <th className="text-left px-2 py-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleSort("reference")}
                          className={sortBtnClass}
                        >
                          Referencia{" "}
                          <span className="text-blue-600 font-mono text-xs">
                            {sortArrow(sortColumn === "reference", sortDir)}
                          </span>
                        </button>
                      </th>
                    )}
                    {visibleCol("debit_bs") && (
                      <th className="text-right px-2 py-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleSort("debit_bs")}
                          className={sortBtnClassEnd}
                        >
                          Debe{" "}
                          <span className="text-blue-600 font-mono text-xs">
                            {sortArrow(sortColumn === "debit_bs", sortDir)}
                          </span>
                        </button>
                      </th>
                    )}
                    {visibleCol("credit_bs") && (
                      <th className="text-right px-2 py-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleSort("credit_bs")}
                          className={sortBtnClassEnd}
                        >
                          Haber{" "}
                          <span className="text-blue-600 font-mono text-xs">
                            {sortArrow(sortColumn === "credit_bs", sortDir)}
                          </span>
                        </button>
                      </th>
                    )}
                    {visibleCol("balance_bs") && (
                      <th className="text-right px-2 py-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleSort("balance_bs")}
                          className={sortBtnClassEnd}
                        >
                          Saldo{" "}
                          <span className="text-blue-600 font-mono text-xs">
                            {sortArrow(sortColumn === "balance_bs", sortDir)}
                          </span>
                        </button>
                      </th>
                    )}
                    {visibleCol("category") && (
                      <th
                        className={`text-left px-2 py-1.5 align-middle min-w-0 ${
                          comfy ? "" : "min-w-[220px]"
                        }`}
                      >
                        <span
                          className={`font-semibold ${comfy ? "text-slate-800 text-xs" : "text-gray-700"}`}
                        >
                          Categoría
                        </span>
                      </th>
                    )}
                  </tr>
                  <tr
                    className={`sticky z-[39] border-t text-[11px] shadow-[0_1px_0_0_rgb(148_163_184_/_0.3)] ${
                      comfy
                        ? "border-slate-200 bg-slate-50 [&_th]:bg-slate-50"
                        : "bg-gray-50 border-gray-200 [&_th]:bg-gray-50"
                    }`}
                    style={{ top: filterRowStickyTopPx }}
                  >
                    {visibleCol("movement_date") && (
                      <th className="text-left align-top px-2 py-1 font-normal min-w-[140px]">
                        <span className="sr-only">Filtrar por fecha</span>
                        <select
                          value={lotColFilterDate}
                          onChange={(e) => setLotColFilterDate(e.target.value)}
                          className={`w-full border border-gray-300 rounded px-1 py-0.5 bg-white ${
                            comfy ? "text-[11px]" : "max-w-[min(180px,28vw)]"
                          }`}
                          title="Filtrar por fecha del movimiento"
                        >
                          <option value="">Todas las fechas</option>
                          {lotColumnFilterOptions.dates.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        {!hideInlineSummaryTotals &&
                          !visibleCol("description") &&
                          !visibleCol("reference") && (
                          <div className="mt-1.5 text-right">
                            <span className="block text-[10px] leading-tight text-gray-500">
                              Σ visible
                            </span>
                            <span className="text-gray-600 tabular-nums text-[11px]">
                              {displayedMovements.length} filas
                            </span>
                          </div>
                        )}
                      </th>
                    )}
                    {visibleCol("transaction_code") && (
                      <th className="text-left align-top px-2 py-1 font-normal min-w-[88px]">
                        <span className="sr-only">Filtrar por código</span>
                        <select
                          value={lotColFilterCode}
                          onChange={(e) => setLotColFilterCode(e.target.value)}
                          className={`w-full border border-gray-300 rounded px-1 py-0.5 bg-white ${
                            comfy ? "text-[11px]" : "max-w-[min(120px,22vw)]"
                          }`}
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
                    )}
                    {visibleCol("transaction_type") && (
                      <th className="text-left align-top px-2 py-1 font-normal min-w-[120px]">
                        <span className="sr-only">
                          Filtrar por tipo de transacción
                        </span>
                        <select
                          value={lotColFilterTxnType}
                          onChange={(e) => setLotColFilterTxnType(e.target.value)}
                          className={`w-full border border-gray-300 rounded px-1 py-0.5 bg-white ${
                            comfy ? "text-[11px]" : "max-w-[min(160px,26vw)]"
                          }`}
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
                    )}
                    {visibleCol("operation_type") && (
                      <th className="text-left align-top px-2 py-1 font-normal min-w-[140px]">
                        <span className="sr-only">
                          Filtrar por tipo de operación
                        </span>
                        <select
                          value={lotColFilterOpType}
                          onChange={(e) => setLotColFilterOpType(e.target.value)}
                          className={`w-full border border-gray-300 rounded px-1 py-0.5 bg-white ${
                            comfy ? "text-[11px]" : "max-w-[min(220px,36vw)]"
                          }`}
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
                    )}
                    {visibleCol("description") && (
                      <th
                        className="text-left align-top px-2 py-1 font-normal min-w-[120px]"
                        style={comfy ? { maxWidth: COMFY_DESC_MAX } : undefined}
                      >
                        <span className="sr-only">
                          Buscar en descripción, referencia y códigos
                        </span>
                        <input
                          type="search"
                          value={descSearch}
                          onChange={(e) => setDescSearch(e.target.value)}
                          placeholder="Buscar texto…"
                          className={`w-full max-w-full border border-gray-300 rounded px-1 py-0.5 text-[11px] bg-white ${
                            comfy ? "min-w-0" : "min-w-[7rem]"
                          }`}
                          title="Filtra por descripción, referencia o códigos"
                          autoComplete="off"
                        />
                        {!hideInlineSummaryTotals &&
                          !visibleCol("reference") && (
                          <div className="mt-1.5 text-right">
                            <span className="block text-[10px] leading-tight text-gray-500">
                              Σ visible
                            </span>
                            <span className="text-gray-600 tabular-nums text-[11px]">
                              {displayedMovements.length} filas
                            </span>
                          </div>
                        )}
                      </th>
                    )}
                    {visibleCol("reference") && (
                      <th className="text-right px-2 py-1 align-bottom whitespace-nowrap bg-gray-50 border-l border-gray-100">
                        {!hideInlineSummaryTotals && (
                          <>
                            <span className="block text-[10px] leading-tight text-gray-500 font-normal">
                              Σ visible
                            </span>
                            <span className="text-gray-600 tabular-nums text-[11px]">
                              {displayedMovements.length} filas
                            </span>
                          </>
                        )}
                      </th>
                    )}
                    {visibleCol("debit_bs") && (
                      <th className="text-right px-2 py-1 align-bottom whitespace-nowrap bg-gray-50 border-l border-gray-200">
                        {!hideInlineSummaryTotals && (
                          <>
                            <span className="block text-[10px] leading-tight text-gray-500 font-normal">
                              Total debe
                            </span>
                            <span className="text-red-700 font-semibold tabular-nums text-[11px]">
                              Bs {formatBs(visibleTotals.debit)}
                            </span>
                          </>
                        )}
                      </th>
                    )}
                    {visibleCol("credit_bs") && (
                      <th className="text-right px-2 py-1 align-bottom whitespace-nowrap bg-gray-50 border-l border-gray-100">
                        {!hideInlineSummaryTotals && (
                          <>
                            <span className="block text-[10px] leading-tight text-gray-500 font-normal">
                              Total haber
                            </span>
                            <span className="text-green-800 font-semibold tabular-nums text-[11px]">
                              Bs {formatBs(visibleTotals.credit)}
                            </span>
                          </>
                        )}
                      </th>
                    )}
                    {visibleCol("balance_bs") && (
                      <th
                        className="text-right px-2 py-1 align-bottom whitespace-nowrap bg-gray-50 border-l border-gray-100"
                        title="Saldo según el último movimiento en orden de fecha (no es la suma de la columna)."
                      >
                        {!hideInlineSummaryTotals && (
                          <>
                            <span className="block text-[10px] leading-tight text-gray-500 font-normal">
                              Saldo final
                            </span>
                            <span className="text-gray-900 font-semibold tabular-nums text-[11px]">
                              Bs {formatBs(visibleTotals.balance)}
                            </span>
                          </>
                        )}
                      </th>
                    )}
                    {visibleCol("category") && (
                      <th
                        className={`text-left align-top px-2 py-1 font-normal bg-gray-50 border-l border-gray-100 min-w-0 ${
                          comfy ? "" : "min-w-[160px]"
                        }`}
                      >
                        <span className="sr-only">Filtrar por categoría</span>
                        <select
                          value={categoryFilter}
                          onChange={(e) => setCategoryFilter(e.target.value)}
                          className={`w-full border border-gray-300 rounded px-1 py-0.5 bg-white text-[11px] ${
                            comfy ? "min-w-[9rem] max-w-full" : "max-w-[min(220px,40vw)]"
                          }`}
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
                    )}
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
                      <tr
                        key={m.id}
                        className={`border-t transition-colors ${
                          comfy
                            ? "border-slate-100 hover:bg-blue-50/40 odd:bg-white even:bg-slate-50/50"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        {visibleCol("movement_date") && (
                          <td
                            className={`whitespace-nowrap align-top tabular-nums ${
                              comfy ? "px-4 py-3" : "px-3 py-2"
                            }`}
                          >
                            {comfy
                              ? formatDateShortVe(m.movement_date)
                              : formatDate(m.movement_date)}
                          </td>
                        )}
                        {visibleCol("transaction_code") && (
                          <td
                            className={`align-top whitespace-nowrap font-medium text-slate-700 ${
                              comfy ? "px-4 py-3" : "px-3 py-2"
                            }`}
                          >
                            {m.transaction_code ?? "—"}
                          </td>
                        )}
                        {visibleCol("transaction_type") && (
                          <td
                            className={`align-top max-w-[140px] text-slate-700 ${
                              comfy ? "px-4 py-3" : "px-3 py-2"
                            }`}
                          >
                            {m.transaction_type ?? "—"}
                          </td>
                        )}
                        {visibleCol("operation_type") && (
                          <td
                            className={`align-top max-w-[140px] text-slate-700 ${
                              comfy ? "px-4 py-3" : "px-3 py-2"
                            }`}
                          >
                            {m.operation_type ?? "—"}
                          </td>
                        )}
                        {visibleCol("description") && (
                          <td
                            className={`align-top min-w-0 break-words ${
                              comfy
                                ? "px-2 py-2 text-slate-700"
                                : "max-w-lg px-3 py-2"
                            }`}
                            style={comfy ? { maxWidth: COMFY_DESC_MAX } : undefined}
                            title={String(m.description ?? "")}
                          >
                            <span
                              className={
                                comfy
                                  ? "line-clamp-5 block text-[11.5px] leading-[1.35] text-slate-700"
                                  : "line-clamp-3 text-xs leading-snug"
                              }
                            >
                              {m.description ?? "—"}
                            </span>
                          </td>
                        )}
                        {visibleCol("reference") && (
                          <td
                            className={`align-top whitespace-nowrap tabular-nums text-slate-600 ${
                              comfy ? "px-4 py-3" : "px-3 py-2"
                            }`}
                          >
                            {m.reference ?? "—"}
                          </td>
                        )}
                        {visibleCol("debit_bs") && (
                          <td
                            className={`text-right text-red-700 align-top whitespace-nowrap tabular-nums font-medium ${
                              comfy ? "px-4 py-3" : "px-3 py-2 text-red-600"
                            }`}
                          >
                            Bs {formatBs(m.debit_bs)}
                          </td>
                        )}
                        {visibleCol("credit_bs") && (
                          <td
                            className={`text-right align-top whitespace-nowrap tabular-nums font-medium ${
                              comfy
                                ? "px-4 py-3 text-emerald-800"
                                : "px-3 py-2 text-green-700"
                            }`}
                          >
                            Bs {formatBs(m.credit_bs)}
                          </td>
                        )}
                        {visibleCol("balance_bs") && (
                          <td
                            className={`text-right align-top whitespace-nowrap tabular-nums text-slate-900 ${
                              comfy ? "px-4 py-3 font-medium" : "px-3 py-2"
                            }`}
                          >
                            Bs {formatBs(m.balance_bs)}
                          </td>
                        )}
                        {visibleCol("category") && (
                          <td
                            className={`align-top min-w-0 ${
                              comfy ? "px-1.5 py-3" : "px-3 py-2"
                            }`}
                          >
                            <select
                              value={m.category || ""}
                              disabled={savingMovementId === m.id}
                              onChange={(e) =>
                                handleMovementCategoryChange(m, e.target.value)
                              }
                              className={`w-full max-w-full border border-slate-300 rounded-lg bg-white disabled:opacity-60 ${
                                comfy
                                  ? "px-1.5 py-1.5 text-xs shadow-sm"
                                  : "border-gray-300 px-2 py-1 text-xs"
                              }`}
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
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

      {hasContext &&
        !loading &&
        movements.length === 0 &&
        emptyLoadedMessage}

      {colPickerOpen &&
        suppressTopToolbar &&
        columnVisibilityStorageKey &&
        colPickerFixedStyle && (
          <div
            ref={colPickerMenuRef}
            className="fixed z-[60] w-60 rounded-xl border border-slate-200 bg-white py-2 shadow-xl shadow-slate-900/15"
            style={{
              top: colPickerFixedStyle.top,
              left: colPickerFixedStyle.left,
            }}
            role="menu"
            aria-label="Mostrar columnas"
          >
            <p className="border-b border-slate-100 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Mostrar columnas
            </p>
            <ul className="max-h-[min(70vh,22rem)] overflow-y-auto py-1">
              {MOV_COLUMN_ORDER.map((id) => (
                <li key={id}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={colVis[id] !== false}
                      disabled={id === "movement_date"}
                      onChange={() => toggleColumnVisibility(id)}
                    />
                    <span>{MOV_COLUMN_LABELS[id]}</span>
                    {id === "movement_date" && (
                      <span className="ml-auto text-[10px] text-slate-400">
                        siempre
                      </span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
    </section>
  );
});

BankMovementsTableBlock.displayName = "BankMovementsTableBlock";

export default BankMovementsTableBlock;

export {
  RefreshIcon,
  ToolbarVisibleRowsCard,
  COMFY_TOOLBAR_STAT_CARD,
  COMFY_TOOLBAR_STAT_LABEL,
  COMFY_TOOLBAR_STAT_VALUE,
  comfyToolbarCellPaddingClass,
  comfyToolbarCellAlignClass,
};
