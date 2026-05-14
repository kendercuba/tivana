import path from "path";
import XLSX from "xlsx";

/**
 * Intenta leer exportaciones de Loyverse (Back Office) con columnas en ES/EN.
 * Un archivo puede traer una o varias hojas; se devuelven filas tipadas para import.
 * `sourceFileName` ayuda a inferir fechas en CSV «por tipo de pago» sin columna Fecha.
 */

/** User-facing (API / admin UI in Spanish). */
const ITEM_SALES_FILENAME_RANGE_ERROR_ES =
  "No se puede cargar este archivo: el nombre incluye dos fechas distintas. Para «Ventas por artículo» exporta un solo día desde Loyverse, o un rango cuyo nombre de archivo use el mismo día repetido (p. ej. 2026-05-08-2026-05-08).";

const PAYMENT_FILENAME_RANGE_ERROR_ES =
  "No se puede cargar este archivo: el nombre incluye dos fechas distintas (rango). Sube el reporte de ventas por tipo de pago de un solo día. Si el nombre repite el mismo día dos veces (por ejemplo 2026-05-01-2026-05-01), sí se acepta.";

const LOYVERSE_STRICT_HINT_DAILY_GOT_PAYMENT_ES =
  "Este archivo corresponde al reporte «Ventas por tipo de pago». Aquí solo puedes cargar el export «Resumen de ventas» (diario: brutas, netas, beneficio…). Usa la pestaña «Ventas por tipo de pago» o exporta el archivo correcto desde Loyverse Back Office.";

const LOYVERSE_STRICT_HINT_DAILY_GOT_ITEM_ES =
  "Este archivo parece ser «Ventas por artículo». En esta pantalla solo se acepta el Resumen de ventas diarias.";

const LOYVERSE_STRICT_HINT_PAYMENT_GOT_DAILY_ES =
  "Este archivo es el «Resumen de ventas» (diario). Aquí solo puedes cargar el export «Ventas por tipo de pago». Usa la pestaña «Resumen de ventas» o el archivo correcto desde Loyverse.";

const LOYVERSE_STRICT_HINT_PAYMENT_GOT_ITEM_ES =
  "Este archivo parece ser ventas por artículo. Aquí solo se acepta «Ventas por tipo de pago».";

const LOYVERSE_STRICT_HINT_ITEM_GOT_DAILY_ES =
  "Este archivo es el Resumen de ventas diarias. Para ventas por artículo elige ese export en Loyverse Back Office.";

const LOYVERSE_STRICT_HINT_ITEM_GOT_PAYMENT_ES =
  "Este archivo es ventas por tipo de pago. Para ventas por artículo elige ese export en Loyverse Back Office.";

/**
 * Best-effort shape from workbook headers (before forcing reportHint).
 * @returns {"daily_summary"|"by_payment"|"by_item"|"unknown"}
 */
export function inferLoyverseContentFormatFromWorkbook(workbook) {
  let sawPayment = false;
  let sawItem = false;
  let sawDaily = false;
  let anyHeader = false;

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    const headerIndex = findHeaderRowIndex(rows);
    if (headerIndex === -1) continue;
    anyHeader = true;
    const headers = rows[headerIndex].map((h) => normalizeHeader(h));
    const fromContent = classifyLoyverseReportFromHeaders(headers, sheetName);
    if (fromContent === "by_payment") {
      sawPayment = true;
      continue;
    }
    if (fromContent === "daily_summary") {
      sawDaily = true;
      continue;
    }
    if (fromContent === "by_item") {
      sawItem = true;
      continue;
    }
    const df = detectFormat(headers, sheetName);
    if (df === "by_payment") sawPayment = true;
    else if (df === "by_item") sawItem = true;
    else sawDaily = true;
  }

  if (!anyHeader) return "unknown";
  if (sawPayment) return "by_payment";
  if (sawItem) return "by_item";
  if (sawDaily) return "daily_summary";
  return "unknown";
}

/**
 * When reportHint is strict (not auto), reject obvious mismatches between hint and inferred shape.
 * @returns {string|null} User-facing Spanish error, or null if OK / skipped.
 */
export function validateStrictReportHintAgainstContentShape(
  reportHint,
  contentShape
) {
  const hint = String(reportHint || "").trim() || "auto";
  if (hint === "auto") return null;
  if (!contentShape || contentShape === "unknown") return null;

  if (hint === "daily_summary") {
    if (contentShape === "by_payment") return LOYVERSE_STRICT_HINT_DAILY_GOT_PAYMENT_ES;
    if (contentShape === "by_item") return LOYVERSE_STRICT_HINT_DAILY_GOT_ITEM_ES;
    return null;
  }
  if (hint === "by_payment") {
    if (contentShape === "daily_summary") return LOYVERSE_STRICT_HINT_PAYMENT_GOT_DAILY_ES;
    if (contentShape === "by_item") return LOYVERSE_STRICT_HINT_PAYMENT_GOT_ITEM_ES;
    return null;
  }
  if (hint === "by_item") {
    if (contentShape === "daily_summary") return LOYVERSE_STRICT_HINT_ITEM_GOT_DAILY_ES;
    if (contentShape === "by_payment") return LOYVERSE_STRICT_HINT_ITEM_GOT_PAYMENT_ES;
    return null;
  }
  return null;
}

/**
 * @returns {{ facts: Array, detectedFormat: string, parseError?: string }}
 */
export function parseLoyverseExcel(
  filePath,
  reportHint = "auto",
  sourceFileName = ""
) {
  const ext = path.extname(filePath || "").toLowerCase();
  const workbook = XLSX.readFile(filePath, {
    ...(ext === ".csv" ? { codepage: 65001 } : {}),
  });
  const hintTrim = String(reportHint || "").trim() || "auto";
  const contentShape = inferLoyverseContentFormatFromWorkbook(workbook);
  const mismatchErr = validateStrictReportHintAgainstContentShape(
    hintTrim,
    contentShape
  );
  if (mismatchErr) {
    return {
      facts: [],
      detectedFormat: contentShape !== "unknown" ? contentShape : "unknown",
      parseError: mismatchErr,
    };
  }

  const out = [];
  let detectedFormat = "unknown";
  const baseName =
    sourceFileName || path.basename(filePath || "", path.extname(filePath || ""));

  if (workbookRequiresPaymentFilenameRule(workbook, reportHint)) {
    const check = validatePaymentReportFilenameForImport(baseName);
    if (!check.ok) {
      return {
        facts: [],
        detectedFormat: "by_payment",
        parseError: check.message,
      };
    }
  }

  if (workbookRequiresItemFilenameRule(workbook, reportHint)) {
    const check = validateItemSalesFilenameForImport(baseName);
    if (!check.ok) {
      return {
        facts: [],
        detectedFormat: "by_item",
        parseError: check.message,
      };
    }
  }

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    const headerIndex = findHeaderRowIndex(rows);
    if (headerIndex === -1) continue;

    const headers = rows[headerIndex].map((h) => normalizeHeader(h));
    const fromContent = classifyLoyverseReportFromHeaders(headers, sheetName);
    const format =
      reportHint !== "auto"
        ? reportHint
        : fromContent !== "unknown"
          ? fromContent
          : detectFormat(headers, sheetName);

    const parsed = parseSheetRows(
      rows,
      sheetName,
      format,
      baseName,
      headerIndex
    );
    if (parsed.length > 0 && detectedFormat === "unknown") {
      detectedFormat = format;
    }
    out.push(...parsed);
  }

  if (detectedFormat === "unknown") detectedFormat = "daily_summary";

  return { facts: out, detectedFormat, parseError: undefined };
}

/** True if import should enforce single-day filename rules (payment report). */
function workbookRequiresPaymentFilenameRule(workbook, reportHint) {
  if (String(reportHint || "").trim() === "by_payment") return true;
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    const headerIndex = findHeaderRowIndex(rows);
    if (headerIndex === -1) continue;
    const headers = rows[headerIndex].map((h) => normalizeHeader(h));
    const fromContent = classifyLoyverseReportFromHeaders(headers, sheetName);
    const format =
      reportHint !== "auto"
        ? reportHint
        : fromContent !== "unknown"
          ? fromContent
          : detectFormat(headers, sheetName);
    if (format === "by_payment") return true;
  }
  return false;
}

function slashDMYtoIso(s) {
  const parts = String(s || "")
    .trim()
    .split("/");
  if (parts.length !== 3) return null;
  const d = Number(parts[0]);
  const m = Number(parts[1]);
  const y = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
    return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Distinct calendar dates (YYYY-MM-DD) appearing in the file basename. */
function collectDistinctCalendarDatesFromFilename(name) {
  const iso = String(name || "").match(/\d{4}-\d{2}-\d{2}/g) || [];
  const slash = String(name || "").match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || [];
  const fromSlash = slash.map((s) => slashDMYtoIso(s)).filter(Boolean);
  return [...new Set([...iso, ...fromSlash])].sort();
}

function validatePaymentReportFilenameForImport(baseName) {
  const distinct = collectDistinctCalendarDatesFromFilename(baseName);
  if (distinct.length > 1) {
    return { ok: false, message: PAYMENT_FILENAME_RANGE_ERROR_ES };
  }
  return { ok: true };
}

function validateItemSalesFilenameForImport(baseName) {
  const distinct = collectDistinctCalendarDatesFromFilename(baseName);
  if (distinct.length > 1) {
    return { ok: false, message: ITEM_SALES_FILENAME_RANGE_ERROR_ES };
  }
  return { ok: true };
}

/** True if import should enforce single-day filename rules (item sales without Fecha column). */
function workbookRequiresItemFilenameRule(workbook, reportHint) {
  if (String(reportHint || "").trim() === "by_item") return true;
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    const headerIndex = findHeaderRowIndex(rows);
    if (headerIndex === -1) continue;
    const headers = rows[headerIndex].map((h) => normalizeHeader(h));
    const fromContent = classifyLoyverseReportFromHeaders(headers, sheetName);
    const format =
      String(reportHint || "").trim() !== "auto"
        ? String(reportHint || "").trim()
        : fromContent !== "unknown"
          ? fromContent
          : detectFormat(headers, sheetName);
    if (format === "by_item") return true;
  }
  return false;
}

/**
 * Loyverse «Resumen de ventas»: columnas brutas / netas / beneficio.
 * En Excel a veces la columna llega truncada («Beneficio br»).
 */
function joinedHeaderMatchesDailySummaryMetricPattern(joined) {
  const hasVentasBrutas =
    /\bventas?\s+brutas?\b/.test(joined) || /\bgross\s+sales\b/i.test(joined);
  const hasVentasNetas =
    /\bventas?\s+netas?\b/.test(joined) ||
    /\bventa\s+neta\b/.test(joined) ||
    /\bnet\s+sales\b/i.test(joined);
  const hasBeneficio =
    /\bbeneficio\s+bruto\b/.test(joined) ||
    /\bbeneficio\s+br\b/.test(joined) ||
    /\butilidad\s+bruta\b/.test(joined) ||
    /\bgross\s+profit\b/i.test(joined);
  return hasVentasBrutas && hasVentasNetas && hasBeneficio;
}

/**
 * Export de un solo día: Loyverse suele poner «Tiempo» (hora) en vez de «Fecha».
 * El nombre del archivo debe indicar un único día (p. ej. …-2026-05-13-2026-05-13).
 */
function isLoyverseHourlyDailySummaryBreakdown(headerLine, sourceFileName) {
  if (!/\btiempo\b|\btime\b|\bhora\b/i.test(headerLine)) return false;
  if (/\b(fecha|date)\b/i.test(headerLine)) return false;
  return Boolean(inferBusinessDateFromPaymentFilename(sourceFileName));
}

function skipLoyverseHourlySubtotalOrLabelRow(raw) {
  const label = pickText(raw, ["tiempo", "time", "hora", "hour"]);
  if (!label || !String(label).trim()) return false;
  const t = normalizeHeader(label);
  return /\b(total|subtotal|suma)\b/.test(t);
}

/**
 * Suma todas las filas por hora en un solo hecho `daily_summary` para el día del nombre de archivo.
 * El margen % se recalcula a partir de totales (no se suman porcentajes hora a hora).
 */
function aggregateHourlyDailySummaryRows(dataRows, sheetName, businessDate) {
  const grossKeys = [
    "gross sales",
    "ventas brutas",
    "venta bruta",
    "total sales",
  ];
  const netKeys = [
    "net sales",
    "ventas netas",
    "venta neta",
    "net sales (tax inclusive)",
    "net sales (tax excluded)",
    "neto",
  ];
  const profitKeys = [
    "gross profit",
    "beneficio bruto",
    "beneficio br",
    "utilidad bruta",
    "profit",
  ];
  const costKeys = [
    "cost of goods",
    "costo de los",
    "costo de los bienes",
    "costo",
    "cogs",
  ];
  const receiptKeys = [
    "receipts",
    "recibos",
    "transactions",
    "transacciones",
    "tickets",
  ];

  let gross = 0;
  let net = 0;
  let profit = 0;
  let refunds = 0;
  let discounts = 0;
  let taxes = 0;
  let cost = 0;
  let receipts = 0;
  let sawNumeric = false;
  let receiptsAny = false;
  let usedRows = 0;

  for (const raw of dataRows) {
    if (skipLoyverseHourlySubtotalOrLabelRow(raw)) continue;
    usedRows += 1;
    const add = (acc, n) => {
      if (n == null || !Number.isFinite(n)) return acc;
      sawNumeric = true;
      return acc + n;
    };

    gross = add(gross, pickNumber(raw, grossKeys));
    net = add(net, pickNumber(raw, netKeys));
    profit = add(profit, pickNumber(raw, profitKeys));
    refunds = add(refunds, pickNumber(raw, ["refunds", "reembolsos", "reembolso", "devoluciones"]));
    discounts = add(discounts, pickNumber(raw, ["discounts", "descuentos", "descuento"]));
    taxes = add(taxes, pickNumber(raw, ["taxes", "impuestos", "impuesto", "tax"]));
    cost = add(cost, pickNumber(raw, costKeys));

    const rc = pickInt(raw, receiptKeys);
    if (rc != null) {
      receipts += rc;
      receiptsAny = true;
    }
  }

  if (!sawNumeric && usedRows === 0) return null;

  const marginPct =
    net !== 0 && Number.isFinite(net) && Number.isFinite(profit)
      ? (profit / net) * 100
      : null;

  return {
    fact_type: "daily_summary",
    business_date: businessDate,
    payment_method: null,
    item_name: null,
    sku: null,
    qty_sold: null,
    gross_sales: sawNumeric ? gross : null,
    net_sales: sawNumeric ? net : null,
    gross_profit: sawNumeric ? profit : null,
    refunds: sawNumeric ? refunds : null,
    discounts: sawNumeric ? discounts : null,
    taxes: sawNumeric ? taxes : null,
    margin_pct: marginPct != null && Number.isFinite(marginPct) ? marginPct : null,
    cost_goods: sawNumeric ? cost : null,
    transactions_count: receiptsAny ? receipts : null,
    sheet_name: sheetName,
    raw_row: {
      _aggregated_from_hourly: true,
      _hourly_row_count: dataRows.length,
      _hourly_rows_used: usedRows,
    },
  };
}

/** Reglas explícitas por cabeceras Loyverse (ES), antes del detector genérico. */
function classifyLoyverseReportFromHeaders(headers, sheetName) {
  const h = headers.filter(Boolean).join(" ");
  const sn = normalizeHeader(sheetName);

  if (joinedHeaderMatchesDailySummaryMetricPattern(h)) {
    const hasDayColumn = /\b(fecha|date|dia|día)\b/.test(h);
    const hasArticulosVendidos =
      /\barticulos?\s+vendidos\b/.test(h) || /\bsold\s+quantity\b/i.test(h);
    const hasArticuloNameCol = /\barticulo\b/.test(h);
    if (!hasDayColumn && hasArticulosVendidos && hasArticuloNameCol) {
      return "by_item";
    }
    return "daily_summary";
  }

  const hasTipoPago =
    /\btipo\s+de\s+pagos?\b/.test(h) || /\bpayment\s+type\b/i.test(h);
  const hasTxnPago =
    /\btransacciones?\s+de\s+pagos?\b/.test(h) ||
    /\bpayment\s+transactions\b/i.test(h);
  const hasMontoPago =
    /\bmonto\s+de\s+pagos?\b/.test(h) ||
    /\bmonto\s+pagos?\b/.test(h) ||
    /\bpayment\s+amount\b/i.test(h);

  if (hasTipoPago && hasTxnPago && hasMontoPago) {
    return "by_payment";
  }

  if (/\bresumen\b/.test(sn) && /\bventas?\b/.test(h)) {
    return "daily_summary";
  }

  return "unknown";
}

function parseSheetRows(
  rows,
  sheetName,
  format,
  sourceFileName = "",
  headerIndex
) {
  if (!rows?.length || headerIndex == null || headerIndex === -1) return [];

  const headers = rows[headerIndex].map((h) => normalizeHeader(h));

  const dataRows = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      obj[h] = row[idx] ?? "";
    });
    if (rowLooksEmpty(obj)) continue;
    dataRows.push(obj);
  }

  if (format === "daily_summary") {
    const headerLine = headers.filter(Boolean).join(" ");
    const singleDayYmd = inferBusinessDateFromPaymentFilename(sourceFileName);
    if (
      singleDayYmd &&
      isLoyverseHourlyDailySummaryBreakdown(headerLine, sourceFileName) &&
      dataRows.length > 0
    ) {
      const one = aggregateHourlyDailySummaryRows(
        dataRows,
        sheetName,
        singleDayYmd
      );
      return one ? [one] : [];
    }
    return dataRows
      .map((r) => mapDailySummaryRow(r, sheetName, sourceFileName))
      .filter(Boolean);
  }

  if (format === "by_payment") {
    return dataRows
      .map((r) => mapPaymentRow(r, sheetName, sourceFileName))
      .filter(Boolean);
  }

  if (format === "by_item") {
    return dataRows
      .map((r) => mapItemRow(r, sheetName, sourceFileName))
      .filter(Boolean);
  }

  return [];
}

function findHeaderRowIndex(rows) {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const joined = row.map((c) => normalizeHeader(c)).join(" | ");
    const hasDate = /\b(fecha|date|dia|día)\b/i.test(joined);
    const hasSales =
      /(venta|sale|net|neto|brut|gross|profit|beneficio|pago|payment|monto)/i.test(
        joined
      );
    const itemSalesHeader =
      /\barticulos?\s+vendidos\b/.test(joined) &&
      /\b(ventas?\s+netas|net\s+sales)\b/i.test(joined) &&
      /\b(articulo|item|producto|sku)\b/i.test(joined);
    const paymentTypeReport =
      /\b(tipo\s+de\s+pago|payment\s+type)\b/i.test(joined) &&
      /(monto|amount|importe|transacci)/i.test(joined);
    if (paymentTypeReport && hasSales) return i;
    if (itemSalesHeader && hasSales) return i;
    if (joinedHeaderMatchesDailySummaryMetricPattern(joined) && !itemSalesHeader) {
      return i;
    }
    if (hasDate && hasSales) return i;
  }
  return -1;
}

function detectFormat(headers, sheetName) {
  const h = headers.join(" ");
  const sn = normalizeHeader(sheetName);

  if (
    /\b(tipo\s+de\s+pago|payment\s+type)\b/.test(h) &&
    /(monto|amount|importe|neto)/.test(h) &&
    !/\b(fecha|date)\b/.test(h)
  ) {
    return "by_payment";
  }

  if (
    /payment|pago|tipo/.test(h) &&
    /(amount|monto|total|ventas)/.test(h) &&
    !/sold|vend|cantidad|quantity/.test(h)
  ) {
    return "by_payment";
  }

  if (
    /(item|articulo|artículo|product|sku)/.test(h) &&
    /(quantity|cantidad|sold|vend|articulos?\s+vendidos)/.test(h)
  ) {
    return "by_item";
  }

  if (
    /(net sales|ventas netas|venta neta)/.test(h) ||
    /(gross profit|beneficio bruto|beneficio br|utilidad bruta)/.test(h) ||
    /resumen|summary/.test(sn)
  ) {
    return "daily_summary";
  }

  return "daily_summary";
}

function mapDailySummaryRow(raw, sheetName, sourceFileName = "") {
  let businessDate = pickDate(raw, [
    "date",
    "fecha",
    "día",
    "dia",
    "day",
  ]);
  if (!businessDate) {
    businessDate = inferBusinessDateFromPaymentFilename(sourceFileName);
  }
  if (!businessDate) return null;

  const netSales = pickNumber(raw, [
    "net sales",
    "ventas netas",
    "venta neta",
    "net sales (tax inclusive)",
    "net sales (tax excluded)",
    "neto",
  ]);

  const grossSales = pickNumber(raw, [
    "gross sales",
    "ventas brutas",
    "venta bruta",
    "total sales",
  ]);

  const grossProfit = pickNumber(raw, [
    "gross profit",
    "beneficio bruto",
    "beneficio br",
    "utilidad bruta",
    "profit",
  ]);

  const marginPct = pickNumber(raw, ["margin", "margen"]);

  const costGoods = pickNumber(raw, [
    "cost of goods",
    "costo de los",
    "costo de los bienes",
    "costo",
    "cogs",
  ]);

  const refunds = pickNumber(raw, [
    "refunds",
    "reembolsos",
    "reembolso",
    "devoluciones",
  ]);

  const discounts = pickNumber(raw, [
    "discounts",
    "descuentos",
    "descuento",
  ]);

  const taxes = pickNumber(raw, [
    "taxes",
    "impuestos",
    "impuesto",
    "tax",
  ]);

  if (
    netSales === null &&
    grossSales === null &&
    grossProfit === null &&
    costGoods === null
  ) {
    return null;
  }

  const enrichedRaw =
    marginPct != null || costGoods != null
      ? { ...raw, _margin_pct: marginPct, _cost_goods: costGoods }
      : raw;

  return {
    fact_type: "daily_summary",
    business_date: businessDate,
    payment_method: null,
    item_name: null,
    sku: null,
    qty_sold: null,
    gross_sales: grossSales,
    net_sales: netSales,
    gross_profit: grossProfit,
    refunds,
    discounts,
    taxes,
    margin_pct: marginPct,
    cost_goods: costGoods,
    transactions_count: pickInt(raw, [
      "receipts",
      "recibos",
      "transactions",
      "transacciones",
      "tickets",
    ]),
    sheet_name: sheetName,
    raw_row: enrichedRaw,
  };
}

/**
 * Single calendar day from basename (YYYY-MM-DD or D/M/YYYY).
 * Used for payment/item rows without Fecha, daily summary without Fecha, and hourly daily exports
 * when the filename encodes one day (e.g. sales-summary-2026-05-13-2026-05-13).
 * Returns null when the name encodes more than one distinct calendar day (range export).
 */
function inferBusinessDateFromPaymentFilename(name) {
  if (!name) return null;
  const distinct = collectDistinctCalendarDatesFromFilename(name);
  if (distinct.length === 1) return distinct[0];
  const dates = String(name).match(/\d{4}-\d{2}-\d{2}/g);
  if (dates?.length === 1) return dates[0];
  const slashDates = String(name).match(/\d{1,2}\/\d{1,2}\/\d{4}/g);
  if (slashDates?.length === 1) return slashDMYtoIso(slashDates[0]);
  if (slashDates?.length) {
    const last = slashDates[slashDates.length - 1];
    return slashDMYtoIso(last);
  }
  return null;
}

/** Columnas con encoding roto (ej. transacciÃ³nes) o variantes Loyverse. */
function pickRefundTransactionCount(raw) {
  let v = pickInt(raw, [
    "reembolso de transacciones",
    "reembolso de transacci",
    "reembolsos de transacciones",
    "refund transactions",
    "refund transaction",
  ]);
  if (v != null) return v;
  for (const [col, val] of Object.entries(raw)) {
    const c = normalizeHeader(col);
    if (
      c.includes("reembolso") &&
      c.includes("transacc") &&
      !c.includes("importe") &&
      !c.includes("monto")
    ) {
      const n = parseLocalizedNumber(String(val ?? ""));
      if (n != null) return Math.round(n);
    }
  }
  return null;
}

function mapPaymentRow(raw, sheetName, sourceFileName = "") {
  let businessDate = pickDate(raw, ["date", "fecha", "día", "dia"]);
  if (!businessDate) {
    businessDate = inferBusinessDateFromPaymentFilename(sourceFileName);
  }

  const methodRaw = pickText(raw, [
    "payment type",
    "tipo de pago",
    "payment",
    "pago",
    "metodo",
    "método",
    "method",
  ]);

  const grossPayments = pickNumber(raw, [
    "importe del pago",
    "monto de pagos",
    "payment amount",
    "monto de pago",
    "importe bruto",
    "gross",
  ]);

  const netAmount = pickNumber(raw, [
    "monto neto",
    "net amount",
    "neto",
    "net sales",
    "ventas netas",
  ]);

  const amountFallback = pickNumber(raw, [
    "sales",
    "ventas",
    "amount",
    "monto",
    "total",
    "importe",
  ]);

  const netSales = netAmount ?? amountFallback;

  if (!methodRaw || (netSales === null && grossPayments === null)) return null;

  if (!businessDate) return null;

  const txnPayments = pickInt(raw, [
    "transacciones de pago",
    "payment transactions",
    "transactions",
    "transacciones",
  ]);

  const refundAmt = pickNumber(raw, [
    "importe del reembol",
    "importe del ree",
    "refund amount",
    "importe del reembolso",
    "importe del reembolsos",
    "reembolsos",
  ]);

  const refundTxnCount = pickRefundTransactionCount(raw);

  const enrichedRaw = { ...raw };
  if (refundAmt != null) {
    enrichedRaw._loyverse_refund_amount = refundAmt;
    enrichedRaw._refund_amount = refundAmt;
  }
  if (refundTxnCount != null) {
    enrichedRaw._loyverse_refund_txn_count = refundTxnCount;
  }

  /** Texto de la columna «Tipo de pago» tal como viene en el Excel (p. ej. Tarjeta, Pago Movil). */
  const paymentTypeLabel = methodRaw ? String(methodRaw).trim() : null;

  return {
    fact_type: "payment_breakdown",
    business_date: businessDate,
    payment_method: normalizePaymentMethod(methodRaw),
    payment_type_label: paymentTypeLabel,
    payment_refund_txn_count: refundTxnCount,
    payment_refund_amount: refundAmt,
    item_name: null,
    sku: null,
    qty_sold: null,
    gross_sales: grossPayments,
    net_sales: netSales,
    gross_profit: null,
    transactions_count: txnPayments,
    sheet_name: sheetName,
    raw_row: enrichedRaw,
  };
}

function mapItemRow(raw, sheetName, sourceFileName = "") {
  let businessDate = pickDate(raw, ["date", "fecha", "día", "dia"]);
  if (!businessDate) {
    businessDate = inferBusinessDateFromPaymentFilename(sourceFileName);
  }
  if (!businessDate) return null;

  const itemName = pickText(raw, [
    "item",
    "articulo",
    "artículo",
    "product",
    "producto",
    "name",
    "nombre",
  ]);
  const sku = pickText(raw, ["sku", "ref", "código", "codigo", "code"]);
  const qty = pickNumber(raw, [
    "sold quantity",
    "cantidad vendida",
    "articulos vendidos",
    "articulo vendidos",
    "quantity",
    "cantidad",
    "qty",
    "vendidos",
  ]);
  const netSales = pickNumber(raw, [
    "net sales",
    "ventas netas",
    "net sales (tax inclusive)",
    "sales",
    "ventas",
  ]);
  const grossSales = pickNumber(raw, [
    "gross sales",
    "ventas brutas",
    "venta bruta",
  ]);
  const grossProfit = pickNumber(raw, [
    "gross profit",
    "beneficio bruto",
    "profit",
  ]);

  if (!itemName && !sku) return null;

  return {
    fact_type: "item_line",
    business_date: businessDate,
    payment_method: null,
    item_name: itemName,
    sku,
    qty_sold: qty,
    gross_sales: grossSales,
    net_sales: netSales,
    gross_profit: grossProfit,
    transactions_count: null,
    sheet_name: sheetName,
    raw_row: raw,
  };
}

function normalizePaymentMethod(raw) {
  const t = normalizeHeader(raw);
  if (!t) return "desconocido";
  if (/(zelle)/i.test(t)) return "zelle";
  if (/(efectivo|cash)/i.test(t)) return "efectivo";
  if (/(pago\s*m[oó]vil|mobile|transferencia\s*bancaria)/i.test(t)) {
    return "pago_movil";
  }
  if (/(pos|punto|tarjeta|card|debit|credit|credito|crédito)/i.test(t)) {
    return "pos";
  }
  return t.slice(0, 80);
}

function normalizeHeader(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function rowLooksEmpty(obj) {
  const vals = Object.values(obj).filter(
    (v) => v !== "" && v !== null && v !== undefined
  );
  return vals.length === 0;
}

function pickText(row, keys) {
  for (const k of keys) {
    const nk = normalizeHeader(k);
    for (const [col, val] of Object.entries(row)) {
      if (normalizeHeader(col) === nk && val !== "" && val != null) {
        return String(val).trim();
      }
    }
  }
  for (const k of keys) {
    const nk = normalizeHeader(k);
    for (const [col, val] of Object.entries(row)) {
      if (normalizeHeader(col).includes(nk) && val !== "" && val != null) {
        return String(val).trim();
      }
    }
  }
  return "";
}

function pickDate(row, keys) {
  const raw = pickText(row, keys);
  if (!raw) return null;
  const text = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  if (text.includes("/")) {
    const [a, b, y] = text.split(/[\/\-]/);
    if (a && b && y) {
      const day = a.padStart(2, "0");
      const month = b.padStart(2, "0");
      const year = y.length === 2 ? `20${y}` : y;
      return `${year}-${month}-${day}`;
    }
  }
  const excelSerial = Number(text);
  if (!Number.isNaN(excelSerial) && excelSerial > 20000) {
    const utc = XLSX.SSF?.parse_date_code?.(excelSerial);
    if (utc)
      return `${utc.y}-${String(utc.m).padStart(2, "0")}-${String(utc.d).padStart(2, "0")}`;
  }
  return null;
}

/** Loyverse suele exportar con punto decimal (113.19) o coma europea; evitar borrar el punto decimal. */
function parseLocalizedNumber(text) {
  let s = String(text)
    .trim()
    .replace(/\+/g, "")
    .replace(/\s/g, "")
    .replace(/%/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      s = parts[0].replace(/\./g, "") + "." + parts[1];
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasDot && !hasComma) {
    const parts = s.split(".");
    if (parts.length === 2 && parts[1].length <= 2) {
      s = `${parts[0].replace(/,/g, "")}.${parts[1]}`;
    } else if (parts.length > 2) {
      s = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
    }
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function pickNumber(row, keys) {
  const raw = pickText(row, keys);
  if (raw === "") return null;
  return parseLocalizedNumber(raw);
}

function pickInt(row, keys) {
  const n = pickNumber(row, keys);
  if (n === null) return null;
  return Math.round(n);
}
