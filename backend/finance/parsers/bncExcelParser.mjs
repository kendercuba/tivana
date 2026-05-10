import XLSX from "xlsx";

/**
 * Lee las primeras filas del estado BNC y extrae los 4 dígitos tras *** (ej. CUENTA CORRIENTE ***3923).
 * Si no encuentra patrón, devuelve null (se usará la cuenta elegida en el formulario).
 */
export function extractBncAccountLastFour(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  const maxRows = Math.min(rows.length, 45);

  for (let r = 0; r < maxRows; r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const text = String(row[c] ?? "").trim();
      if (!text) continue;

      let m = text.match(/\*{2,}\s*(\d{4})\b/);
      if (m) return m[1];

      m = text.match(/\*{2,}(\d{4})(?:\s|$|[^\d])/);
      if (m) return m[1];

      m = text.match(/nro\.?\s*cuenta[^\d]*\*{2,}\s*(\d{4})/i);
      if (m) return m[1];
    }
  }

  return null;
}

export function parseBncExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Texto legible (descripciones, fechas como las muestra Excel)
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  /** Valores numéricos reales de celda (evita "874.075,00" → 874075 al interpretar formato VE) */
  const rawRows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  // Buscar fila donde empieza la tabla
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeText(cell).includes("fecha")) &&
    row.some((cell) => normalizeText(cell).includes("debe")) &&
    row.some((cell) => normalizeText(cell).includes("haber"))
  );

  if (headerIndex === -1) {
    console.log("❌ No se encontró encabezado del BNC");
    console.log(rows.slice(0, 15));
    return [];
  }

  const headers = rows[headerIndex].map((header) => normalizeText(header));

  const colDebe = findColumnIndex(headers, ["debe"]);
  const colHaber = findColumnIndex(headers, ["haber"]);
  const colSaldo = findColumnIndex(headers, ["saldo"]);

  const movements = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const rawRow = rawRows[i] || [];

    const rawObject = {};

    headers.forEach((header, index) => {
      rawObject[header] = row[index] ?? "";
    });

    const movementDate = getByHeader(rawObject, ["fecha"]);

    const movement = {
      movement_date: normalizeDate(movementDate),

      transaction_code: getByHeader(rawObject, [
        "codigo transaccion",
        "código transacción",
      ]),

      transaction_type: getByHeader(rawObject, [
        "tipo transaccion",
        "tipo transacción",
      ]),

      operation_type: getByHeader(rawObject, [
        "tipo operacion",
        "tipo operación",
      ]),

      description: getByHeader(rawObject, ["descripcion", "descripción"]),

      reference: getByHeader(rawObject, ["referencia"]),

      debit_bs: amountFromExcelCell(
        colDebe >= 0 ? rawRow[colDebe] : null,
        getByHeader(rawObject, ["debe"])
      ),

      credit_bs: amountFromExcelCell(
        colHaber >= 0 ? rawRow[colHaber] : null,
        getByHeader(rawObject, ["haber"])
      ),

      balance_bs: amountFromExcelCell(
        colSaldo >= 0 ? rawRow[colSaldo] : null,
        getByHeader(rawObject, ["saldo"])
      ),

      raw_data: rawObject,
    };

    // Ignorar filas vacías, totales o encabezados repetidos
    if (
      movement.movement_date &&
      (
        movement.description ||
        movement.debit_bs > 0 ||
        movement.credit_bs > 0
      )
    ) {
      movements.push(movement);
    }
  }

  console.log(`✅ Movimientos BNC detectados: ${movements.length}`);

  return movements;
}

// =========================
// HELPERS
// =========================

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getByHeader(row, possibleKeys) {
  for (const key of possibleKeys) {
    const normalizedKey = normalizeText(key);

    if (row[normalizedKey] !== undefined && row[normalizedKey] !== "") {
      return row[normalizedKey];
    }
  }

  return "";
}

function findColumnIndex(headers, aliases) {
  for (const alias of aliases) {
    const t = normalizeText(alias);
    const idx = headers.findIndex((h) => h === t);
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Prioriza el valor en crudo de la celda (número IEEE del .xls/.xlsx).
 * Si Excel guardó 8740.75, así evitamos la cadena formateada "874.075,00".
 */
function amountFromExcelCell(rawCell, formattedCell) {
  if (typeof rawCell === "number" && Number.isFinite(rawCell)) {
    return Math.abs(rawCell);
  }
  return parseAmount(formattedCell ?? rawCell ?? "");
}

/**
 * Montos del Excel BNC pueden venir como:
 * - US / extracto web: miles con coma y decimal con punto → "8,740.75"
 * - Solo número: "8740.75"
 * - Europa / VE: miles con punto y decimal con coma → "8.740,75"
 *
 * La versión anterior borraba todos los puntos antes de evaluar la coma,
 * de modo que "8740.75" pasaba a "874075" (error ~100×).
 */
function parseAmount(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.abs(value);
  }

  let s = String(value)
    .replace(/\+/g, "")
    .replace(/\s/g, "")
    .trim();
  if (!s) return 0;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      // Ej. 8.740,75 — miles con punto, decimal con coma
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // Ej. 8,740.75 — miles con coma, decimal con punto (muy habitual en BNC)
      s = s.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      // Ej. 8740,75 o 8,75 — coma decimal
      s = s.replace(",", ".");
    } else {
      // Ej. 1,234,567 — comas de miles
      s = s.replace(/,/g, "");
    }
  } else if (lastDot !== -1) {
    const parts = s.split(".");
    if (parts.length > 2) {
      // Ej. 8.740.750 — puntos como miles (sin coma decimal en la cadena)
      s = s.replace(/\./g, "");
    }
    // Un solo punto: 8740.75 — ya es decimal correcto
  }

  const n = parseFloat(s.replace(/[^\d.-]/g, ""));
  return Math.abs(Number.isFinite(n) ? n : 0);
}

function normalizeDate(value) {
  if (!value) return null;

  const text = String(value).trim();

  if (!text) return null;

  if (text.includes("/")) {
    const [day, month, year] = text.split("/");

    if (!day || !month || !year) return null;

    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  return null;
}