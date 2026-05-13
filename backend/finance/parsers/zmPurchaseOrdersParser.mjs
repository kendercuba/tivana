import XLSX from "xlsx";

/** Excel serial in FECHA column (CSV parsed as number by SheetJS). */
function ymdFromExcelSerialIfPlausible(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const whole = Math.floor(value);
  if (whole < 39500 || whole > 65000) return null;
  try {
    const p = XLSX.SSF.parse_date_code(whole);
    if (!p || p.y == null || p.m == null || p.d == null) return null;
    return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(
      2,
      "0"
    )}`;
  } catch {
    return null;
  }
}

function normHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * @param {unknown[][]} rows — first row = headers (sheet_to_json header:1)
 * @returns {{ ok: boolean, error?: string, columnMap?: object, headerRow?: string[] }}
 */
export function detectZmPurchaseOrdersLayout(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, error: "El archivo no tiene filas." };
  }
  const headerRow = (rows[0] || []).map((c) => String(c ?? "").trim());
  const n = headerRow.map(normHeader);

  const findExact = (want) => {
    const w = normHeader(want);
    const i = n.indexOf(w);
    return i >= 0 ? i : -1;
  };

  const cantidadIdx = [];
  for (let i = 0; i < n.length; i += 1) {
    if (n[i] === "cantidad") cantidadIdx.push(i);
  }

  const idxFecha = findExact("FECHA");
  const idxFactura = findExact("FACTURA");
  const idxRef = findExact("REF");
  const idxArticulo =
    findExact("Nombre del articulo") >= 0
      ? findExact("Nombre del articulo")
      : findExact("Nombre del artículo");
  const idxVariante = findExact("Nombre de la variante");
  const idxBarcode =
    findExact("Codigo de barras") >= 0
      ? findExact("Codigo de barras")
      : findExact("Código de barras");
  const idxCosto = findExact("Costo de compra");

  let idxQty = -1;
  let idxLineTotal = -1;
  if (cantidadIdx.length >= 2) {
    idxQty = cantidadIdx[0];
    idxLineTotal = cantidadIdx[1];
  } else if (cantidadIdx.length === 1) {
    idxQty = cantidadIdx[0];
    const altTotal = [
      "total",
      "importe",
      "subtotal",
      "total linea",
      "total línea",
    ];
    for (const a of altTotal) {
      const j = findExact(a);
      if (j >= 0) {
        idxLineTotal = j;
        break;
      }
    }
  }

  if (idxFecha < 0 || idxArticulo < 0 || idxQty < 0 || idxCosto < 0) {
    return {
      ok: false,
      error:
        "No se reconoce el formato de órdenes de compra. " +
        "Se esperan columnas: FECHA, FACTURA, REF, Nombre del articulo, " +
        "Nombre de la variante, Código de barras, Cantidad, Costo de compra " +
        "y una segunda columna de importe (segunda «Cantidad» o Total).",
    };
  }

  return {
    ok: true,
    headerRow,
    columnMap: {
      idxFecha,
      idxFactura,
      idxRef,
      idxArticulo,
      idxVariante,
      idxBarcode,
      idxQty,
      idxCosto,
      idxLineTotal,
    },
  };
}

function cellStr(v) {
  if (v == null) return "";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "";
    if (Math.abs(v) >= 1e9 && Number.isFinite(v)) {
      return String(Math.round(v));
    }
    return String(v);
  }
  return String(v).trim();
}

function parseNumberLoose(v) {
  const s = cellStr(v).replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** US-style M/D/YYYY from export; also accepts YYYY-MM-DD and Excel serials. */
export function parseBusinessDateToYmd(value) {
  const fromSerial = ymdFromExcelSerialIfPlausible(value);
  if (fromSerial) return fromSerial;

  const raw = cellStr(value);
  if (!raw) return null;
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(raw)) {
    const [y, m, d] = raw.slice(0, 10).split("-");
    if (y && m && d) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parts = raw.split(/[/.]/);
  if (parts.length >= 3) {
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    const year = parseInt(String(parts[2]).slice(0, 4), 10);
    if (
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31 &&
      year >= 2000 &&
      year <= 2100
    ) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
        2,
        "0"
      )}`;
    }
  }
  return null;
}

/**
 * @param {string} filePath
 * @param {string} [sourceFile] — original name for messages only
 */
export function parseZmPurchaseOrdersFile(filePath, sourceFile = "") {
  const ext = String(sourceFile || filePath || "")
    .toLowerCase()
    .split(".")
    .pop();
  const readOpts = ext === "csv" ? { codepage: 65001 } : {};

  let workbook;
  try {
    workbook = XLSX.readFile(filePath, readOpts);
  } catch (e) {
    return {
      lines: [],
      parseError: `No se pudo leer el archivo${sourceFile ? ` (${sourceFile})` : ""}.`,
    };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { lines: [], parseError: "El libro no tiene hojas." };
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  const layout = detectZmPurchaseOrdersLayout(rows);
  if (!layout.ok) {
    return { lines: [], parseError: layout.error };
  }

  const m = layout.columnMap;
  const out = [];

  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const businessDate = parseBusinessDateToYmd(row[m.idxFecha]);
    const itemName = cellStr(row[m.idxArticulo]);
    if (!businessDate && !itemName) continue;

    if (!businessDate) {
      return {
        lines: [],
        parseError: `Fila ${r + 1}: fecha inválida o vacía.`,
      };
    }
    if (!itemName) {
      return {
        lines: [],
        parseError: `Fila ${r + 1}: falta el nombre del artículo.`,
      };
    }

    const qty = parseNumberLoose(row[m.idxQty]);
    const unitCost = parseNumberLoose(row[m.idxCosto]);
    if (qty == null) {
      return {
        lines: [],
        parseError: `Fila ${r + 1}: cantidad inválida.`,
      };
    }
    if (unitCost == null) {
      return {
        lines: [],
        parseError: `Fila ${r + 1}: costo de compra inválido.`,
      };
    }

    let lineTotal = null;
    if (m.idxLineTotal >= 0) {
      lineTotal = parseNumberLoose(row[m.idxLineTotal]);
    }
    if (lineTotal == null) {
      lineTotal = Math.round(qty * unitCost * 1e6) / 1e6;
    }

    const poNumber = m.idxFactura >= 0 ? cellStr(row[m.idxFactura]) : "";
    const refCode = m.idxRef >= 0 ? cellStr(row[m.idxRef]) : "";
    const variantName =
      m.idxVariante >= 0 ? cellStr(row[m.idxVariante]) : "";
    const barcode = m.idxBarcode >= 0 ? cellStr(row[m.idxBarcode]) : "";

    const raw_row = {};
    for (let c = 0; c < row.length; c += 1) {
      const base =
        String(layout.headerRow[c] ?? `col_${c}`).trim() || `col_${c}`;
      let key = base;
      if (Object.prototype.hasOwnProperty.call(raw_row, key)) {
        let n = 2;
        while (Object.prototype.hasOwnProperty.call(raw_row, `${base}__${n}`)) {
          n += 1;
        }
        key = `${base}__${n}`;
      }
      raw_row[key] = row[c];
    }

    out.push({
      business_date: businessDate,
      po_number: poNumber || null,
      ref_code: refCode || null,
      item_name: itemName,
      variant_name: variantName || null,
      barcode: barcode || null,
      quantity: qty,
      unit_cost: unitCost,
      line_total: lineTotal,
      raw_row,
    });
  }

  if (out.length === 0) {
    return {
      lines: [],
      parseError: "No hay filas de datos después de la cabecera.",
    };
  }

  return { lines: out, parseError: null };
}
