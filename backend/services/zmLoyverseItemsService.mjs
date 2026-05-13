import XLSX from "xlsx";
import { pool } from "../db.mjs";

function stripDiacritics(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Loyverse export: strip trailing [TIENDA] for matching. */
function normalizeHeaderKey(s) {
  let t = stripDiacritics(String(s ?? ""));
  t = t.replace(/[\u00A0\u2007\u202F\uFEFF]/g, " ");
  t = t.replace(/\s*\[[^\]]+\]\s*$/i, "").trim();
  return t.toLowerCase().replace(/\s+/g, " ");
}

function detectStoreSuffix(headers) {
  for (const h of headers) {
    const m = String(h).match(/\[([^\]]+)\]/);
    if (m) return m[1].trim();
  }
  return null;
}

function cellStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseNum(val) {
  if (val == null || val === "") return null;
  if (typeof val === "number" && Number.isFinite(val)) return val;
  const s = String(val)
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  if (s === "" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function pick(norm, ...aliases) {
  for (const a of aliases) {
    const key = normalizeHeaderKey(a);
    if (Object.prototype.hasOwnProperty.call(norm, key)) {
      const v = norm[key];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
  }
  return null;
}

/**
 * Loyverse «Coste» only (never «Costo de compra»). Tolerates odd spacing in .xlsx headers.
 * @param {Record<string, unknown>} norm
 */
function pickLoyverseCoste(norm) {
  const direct = pick(norm, "Coste");
  if (direct !== undefined && direct !== null && String(direct).trim() !== "") {
    return direct;
  }
  for (const [key, val] of Object.entries(norm)) {
    if (normalizeHeaderKey(key) === "coste") {
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return val;
      }
    }
  }
  return null;
}

function rowArrayToNormDict(headers, row) {
  const o = {};
  for (let i = 0; i < headers.length; i++) {
    const nk = normalizeHeaderKey(headers[i]);
    if (!nk) continue;
    if (!(nk in o)) o[nk] = row[i];
  }
  return o;
}

/**
 * Loyverse export «Artículos»: columna **M** = «Coste» (A=0 → índice 12). Columna **T** = «Costo de compra» (no usar).
 */
const LOYVERSE_ITEMS_COSTE_EXCEL_COL_M_ZERO_BASED = 12;

/**
 * @param {unknown[]} rowArray
 * @param {Record<string, unknown>} norm
 */
function readCosteFromLoyverseRow(rowArray, norm) {
  if (
    Array.isArray(rowArray) &&
    rowArray.length > LOYVERSE_ITEMS_COSTE_EXCEL_COL_M_ZERO_BASED
  ) {
    const cell = rowArray[LOYVERSE_ITEMS_COSTE_EXCEL_COL_M_ZERO_BASED];
    if (cell !== undefined && cell !== null && String(cell).trim() !== "") {
      return cell;
    }
  }
  return pickLoyverseCoste(norm);
}

function mapNormRowToRecord(norm, rowArray) {
  const handle = cellStr(pick(norm, "Handle", "handle"));
  if (!handle) return null;

  return {
    handle,
    item_ref: cellStr(pick(norm, "REF", "ref")),
    name: cellStr(pick(norm, "Nombre", "nombre")),
    category_name: cellStr(pick(norm, "Categoria", "Categoría", "categoria")),
    /** Columna M «Coste» del export (índice 12); nunca columna T «Costo de compra». */
    purchase_cost: parseNum(readCosteFromLoyverseRow(rowArray, norm)),
    price: parseNum(pick(norm, "Precio", "Precio [ZONA MARKET]")),
    quantity_on_hand: parseNum(
      pick(norm, "En inventario", "En inventario [ZONA MARKET]")
    ),
    low_stock_threshold: parseNum(
      pick(norm, "Existencias bajas", "Existencias bajas [ZONA MARKET]")
    ),
    optimal_stock: parseNum(
      pick(norm, "Stock óptimo", "Stock optimo", "Stock óptimo [ZONA MARKET]")
    ),
    barcode: cellStr(pick(norm, "Codigo de barras", "Código de barras")),
  };
}

/**
 * Parse Loyverse «Items» export buffer (CSV or Excel).
 * @param {Buffer} buffer
 * @param {string} originalname
 */
export function parseLoyverseItemsWorkbook(buffer, originalname) {
  const lower = String(originalname || "").toLowerCase();
  const isCsv = lower.endsWith(".csv");
  const wb = XLSX.read(buffer, {
    type: "buffer",
    raw: false,
    codepage: isCsv ? 65001 : undefined,
    FS: isCsv ? undefined : undefined,
  });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new Error("Workbook has no sheets.");
  }
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });
  if (!matrix.length || matrix.length < 2) {
    throw new Error("No data rows in file.");
  }

  const headerCells = matrix[0].map((c) => String(c ?? "").trim());
  const storeSuffix = detectStoreSuffix(headerCells);

  const records = [];
  for (let r = 1; r < matrix.length; r++) {
    const rowArray = matrix[r];
    if (!Array.isArray(rowArray) || rowArray.length === 0) continue;
    const norm = rowArrayToNormDict(headerCells, rowArray);
    const rec = mapNormRowToRecord(norm, rowArray);
    if (rec) records.push(rec);
  }

  return { records, storeSuffix, rowCount: records.length };
}

const UPSERT_SQL = `
INSERT INTO zm_loyverse_items (
  handle, item_ref, name, category_name, price, purchase_cost,
  quantity_on_hand, low_stock_threshold, optimal_stock, barcode,
  last_import_id, updated_at
) VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW()
)
ON CONFLICT (handle) DO UPDATE SET
  item_ref = EXCLUDED.item_ref,
  name = EXCLUDED.name,
  category_name = EXCLUDED.category_name,
  price = EXCLUDED.price,
  purchase_cost = EXCLUDED.purchase_cost,
  quantity_on_hand = EXCLUDED.quantity_on_hand,
  low_stock_threshold = EXCLUDED.low_stock_threshold,
  optimal_stock = EXCLUDED.optimal_stock,
  barcode = EXCLUDED.barcode,
  last_import_id = EXCLUDED.last_import_id,
  updated_at = NOW()
`;

function rowParams(rec, importId) {
  return [
    rec.handle,
    rec.item_ref,
    rec.name,
    rec.category_name,
    rec.price,
    rec.purchase_cost,
    rec.quantity_on_hand,
    rec.low_stock_threshold,
    rec.optimal_stock,
    rec.barcode,
    importId,
  ];
}

/**
 * @param {Buffer} buffer
 * @param {string} originalname
 */
export async function importZmLoyverseItemsFromBuffer(buffer, originalname) {
  const { records, storeSuffix, rowCount } = parseLoyverseItemsWorkbook(
    buffer,
    originalname
  );
  if (rowCount === 0) {
    throw new Error("No valid rows (missing Handle).");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ins = await client.query(
      `INSERT INTO zm_loyverse_item_imports (source_filename, row_count, store_suffix)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [originalname || null, rowCount, storeSuffix]
    );
    const importId = ins.rows[0].id;

    for (const rec of records) {
      await client.query(UPSERT_SQL, rowParams(rec, importId));
    }

    await client.query("COMMIT");
    return { importId, rowCount, storeSuffix };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function listZmLoyverseItems() {
  const r = await pool.query(
    `SELECT
       id,
       handle,
       item_ref AS ref,
       name,
       category_name AS category,
       price,
       purchase_cost,
       quantity_on_hand,
       low_stock_threshold,
       optimal_stock,
       barcode,
       last_import_id,
       updated_at
     FROM zm_loyverse_items
     ORDER BY category_name NULLS LAST, name NULLS LAST, handle`
  );
  return r.rows;
}

export async function listZmLoyverseItemCategories() {
  const r = await pool.query(
    `SELECT
       category_name AS category,
       COUNT(*)::int AS item_count
     FROM zm_loyverse_items
     WHERE category_name IS NOT NULL AND TRIM(category_name) <> ''
     GROUP BY category_name
     ORDER BY category_name`
  );
  return r.rows;
}

export async function listZmLoyverseItemImports({ limit = 30 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 30, 1), 200);
  const r = await pool.query(
    `SELECT id, imported_at, source_filename, row_count, store_suffix
     FROM zm_loyverse_item_imports
     ORDER BY id DESC
     LIMIT $1`,
    [lim]
  );
  return r.rows;
}

/**
 * Deletes one import batch and article rows that still reference it as last_import_id.
 * @param {number|string} importId
 * @returns {Promise<boolean>} true if a row was removed from zm_loyverse_item_imports
 */
export async function deleteZmLoyverseItemImport(importId) {
  const id = Number(importId);
  if (!Number.isFinite(id) || id <= 0) {
    return false;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM zm_loyverse_items WHERE last_import_id = $1`,
      [id]
    );
    const del = await client.query(
      `DELETE FROM zm_loyverse_item_imports WHERE id = $1`,
      [id]
    );
    await client.query("COMMIT");
    return del.rowCount > 0;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
