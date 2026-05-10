import path from "path";
import XLSX from "xlsx";

/**
 * Intenta leer exportaciones de Loyverse (Back Office) con columnas en ES/EN.
 * Un archivo puede traer una o varias hojas; se devuelven filas tipadas para import.
 * `sourceFileName` ayuda a inferir fechas en CSV «por tipo de pago» sin columna Fecha.
 */

/**
 * @returns {{ facts: Array, detectedFormat: string }}
 */
export function parseLoyverseExcel(
  filePath,
  reportHint = "auto",
  sourceFileName = ""
) {
  const workbook = XLSX.readFile(filePath);
  const out = [];
  let detectedFormat = "unknown";
  const baseName =
    sourceFileName || path.basename(filePath || "", path.extname(filePath || ""));

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

  return { facts: out, detectedFormat };
}

/** Reglas explícitas por cabeceras Loyverse (ES), antes del detector genérico. */
function classifyLoyverseReportFromHeaders(headers, sheetName) {
  const h = headers.filter(Boolean).join(" ");
  const sn = normalizeHeader(sheetName);

  const hasVentasBrutas =
    /\bventas?\s+brutas?\b/.test(h) || /\bgross\s+sales\b/i.test(h);
  const hasVentasNetas =
    /\bventas?\s+netas?\b/.test(h) ||
    /\bventa\s+neta\b/.test(h) ||
    /\bnet\s+sales\b/i.test(h);
  const hasBeneficioBruto =
    /\bbeneficio\s+bruto\b/.test(h) ||
    /\butilidad\s+bruta\b/.test(h) ||
    /\bgross\s+profit\b/i.test(h);

  if (hasVentasBrutas && hasVentasNetas && hasBeneficioBruto) {
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
    return dataRows
      .map((r) => mapDailySummaryRow(r, sheetName))
      .filter(Boolean);
  }

  if (format === "by_payment") {
    return dataRows
      .map((r) => mapPaymentRow(r, sheetName, sourceFileName))
      .filter(Boolean);
  }

  if (format === "by_item") {
    return dataRows.map((r) => mapItemRow(r, sheetName)).filter(Boolean);
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
    const paymentTypeReport =
      /\b(tipo\s+de\s+pago|payment\s+type)\b/i.test(joined) &&
      /(monto|amount|importe|transacci)/i.test(joined);
    if (paymentTypeReport && hasSales) return i;
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
    /(quantity|cantidad|sold|vend)/.test(h)
  ) {
    return "by_item";
  }

  if (
    /(net sales|ventas netas|venta neta)/.test(h) ||
    /(gross profit|beneficio bruto|utilidad bruta)/.test(h) ||
    /resumen|summary/.test(sn)
  ) {
    return "daily_summary";
  }

  return "daily_summary";
}

function mapDailySummaryRow(raw, sheetName) {
  const businessDate = pickDate(raw, [
    "date",
    "fecha",
    "día",
    "dia",
    "day",
  ]);
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

/** Si el CSV no trae Fecha, usa el rango del nombre del archivo (ej. ...2026-05-01-2026-05-07). */
function inferPeriodEndDateFromFilename(name) {
  if (!name) return null;
  const dates = String(name).match(/\d{4}-\d{2}-\d{2}/g);
  if (dates?.length) return dates[dates.length - 1];
  const slashDates = String(name).match(/\d{1,2}\/\d{1,2}\/\d{4}/g);
  if (slashDates?.length) {
    const last = slashDates[slashDates.length - 1];
    const [d, m, y] = last.split("/");
    if (d && m && y)
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

function mapPaymentRow(raw, sheetName, sourceFileName = "") {
  let businessDate = pickDate(raw, ["date", "fecha", "día", "dia"]);
  if (!businessDate) {
    businessDate = inferPeriodEndDateFromFilename(sourceFileName);
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
    "refund amount",
    "importe del reembolso",
    "importe del reembolsos",
    "reembolsos",
  ]);

  return {
    fact_type: "payment_breakdown",
    business_date: businessDate,
    payment_method: normalizePaymentMethod(methodRaw),
    item_name: null,
    sku: null,
    qty_sold: null,
    gross_sales: grossPayments,
    net_sales: netSales,
    gross_profit: null,
    transactions_count: txnPayments,
    sheet_name: sheetName,
    raw_row:
      refundAmt != null
        ? { ...raw, _refund_amount: refundAmt }
        : raw,
  };
}

function mapItemRow(raw, sheetName) {
  const businessDate = pickDate(raw, ["date", "fecha", "día", "dia"]);
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
  const sku = pickText(raw, ["sku", "código", "codigo", "code"]);
  const qty = pickNumber(raw, [
    "sold quantity",
    "cantidad vendida",
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
    gross_sales: null,
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
