import { pool } from "../../db.mjs";

function clampPaymentMethod(raw) {
  const s = String(raw || "pago_movil").trim().toLowerCase();
  const allowed = new Set(["pago_movil", "efectivo", "pos", "zelle"]);
  return allowed.has(s) ? s : "pago_movil";
}

/**
 * Loyverse payment_breakdown aggregate for one business day + payment method.
 */
async function loyversePaymentAggregate(businessDate, paymentMethod) {
  const { rows } = await pool.query(
    `
    SELECT
      COALESCE(SUM(f.transactions_count), 0)::int AS txn_count,
      COALESCE(SUM(f.gross_sales::numeric), 0)::numeric(18, 6) AS gross_sales_usd,
      COALESCE(
        SUM(
          f.gross_sales::numeric * COALESCE(r.rate_bs, 0)::numeric
        ),
        0
      )::numeric(18, 2) AS importe_pago_bs
    FROM finance_loyverse_facts f
    INNER JOIN finance_import_batches b
      ON b.id = f.import_batch_id AND b.import_type = 'loyverse'
    LEFT JOIN finance_loyverse_daily_exchange_rates r
      ON r.business_date = (f.business_date)::date
    WHERE f.fact_type = 'payment_breakdown'
      AND (f.business_date)::date = $1::date
      AND f.payment_method = $2
    `,
    [businessDate, paymentMethod]
  );
  return rows[0] || {};
}

/**
 * Bank credits that look like Pago Móvil income (abonos / códigos BNC-style y texto).
 */
async function bankPagoMovilCredits(bankAccountId, businessDate) {
  const { rows } = await pool.query(
    `
    SELECT
      m.id,
      (m.movement_date)::date::text AS movement_date,
      m.reference,
      m.description,
      m.transaction_code,
      m.transaction_type,
      m.operation_type,
      m.credit_bs::numeric AS credit_bs,
      m.debit_bs::numeric AS debit_bs,
      m.category,
      m.subcategory
    FROM finance_bank_movements m
    WHERE m.bank_account_id = $1
      AND (m.movement_date)::date = $2::date
      AND COALESCE(m.credit_bs, 0)::numeric > 0
      AND (
        TRIM(COALESCE(m.transaction_code, '')) IN ('388')
        OR LOWER(COALESCE(m.operation_type, '')) LIKE '%pago movil%'
        OR LOWER(COALESCE(m.operation_type, '')) LIKE '%pago móvil%'
        OR LOWER(COALESCE(m.description, '')) LIKE '%pago movil%'
        OR LOWER(COALESCE(m.description, '')) LIKE '%pago móvil%'
        OR LOWER(COALESCE(m.reference, '')) LIKE '%pago movil%'
        OR LOWER(COALESCE(m.reference, '')) LIKE '%pago móvil%'
        OR LOWER(COALESCE(m.subcategory, '')) LIKE '%pago movil%'
        OR LOWER(COALESCE(m.subcategory, '')) LIKE '%pago móvil%'
        OR (
          (
            LOWER(COALESCE(m.transaction_type, '')) LIKE '%abono%'
            OR LOWER(COALESCE(m.operation_type, '')) LIKE '%abono%'
          )
          AND (
            LOWER(COALESCE(m.operation_type, '')) LIKE '%movil%'
            OR LOWER(COALESCE(m.operation_type, '')) LIKE '%móvil%'
            OR LOWER(COALESCE(m.description, '')) LIKE '%movil%'
            OR LOWER(COALESCE(m.description, '')) LIKE '%móvil%'
            OR LOWER(COALESCE(m.reference, '')) LIKE '%movil%'
            OR LOWER(COALESCE(m.reference, '')) LIKE '%móvil%'
            OR LOWER(COALESCE(m.transaction_code, '')) IN ('388')
          )
        )
      )
    ORDER BY m.id ASC
    `,
    [bankAccountId, businessDate]
  );
  return rows;
}

/**
 * Generic credits on account for one calendar day (efectivo / zelle).
 */
const POS_BATCH_MAX_LEN = 80;
const POS_LOTE_WINDOW_DAYS = 6;

/**
 * POS settlement lines: match by batch number in reference/description and a date
 * window from business day (weekend sales often post Monday or later).
 */
async function bankPosCreditsByLote(bankAccountId, businessDate, posBatchRaw) {
  const needle = String(posBatchRaw || "").trim();
  if (!needle || needle.length > POS_BATCH_MAX_LEN) {
    return [];
  }
  const needleLower = needle.toLowerCase();
  const { rows } = await pool.query(
    `
    SELECT
      m.id,
      (m.movement_date)::date::text AS movement_date,
      m.reference,
      m.description,
      m.transaction_code,
      m.transaction_type,
      m.operation_type,
      m.credit_bs::numeric AS credit_bs,
      m.debit_bs::numeric AS debit_bs,
      m.category,
      m.subcategory
    FROM finance_bank_movements m
    WHERE m.bank_account_id = $1
      AND (m.movement_date)::date >= $2::date
      AND (m.movement_date)::date <= ($2::date + ($3::int * INTERVAL '1 day'))::date
      AND COALESCE(m.credit_bs, 0)::numeric > 0
      AND (
        POSITION($4::text IN LOWER(COALESCE(m.reference, ''))) > 0
        OR POSITION($4::text IN LOWER(COALESCE(m.description, ''))) > 0
      )
    ORDER BY m.movement_date ASC, m.id ASC
    `,
    [bankAccountId, businessDate, POS_LOTE_WINDOW_DAYS, needleLower]
  );
  return rows;
}

async function bankAllCredits(bankAccountId, businessDate) {
  const { rows } = await pool.query(
    `
    SELECT
      m.id,
      (m.movement_date)::date::text AS movement_date,
      m.reference,
      m.description,
      m.transaction_code,
      m.transaction_type,
      m.operation_type,
      m.credit_bs::numeric AS credit_bs,
      m.debit_bs::numeric AS debit_bs,
      m.category,
      m.subcategory
    FROM finance_bank_movements m
    WHERE m.bank_account_id = $1
      AND (m.movement_date)::date = $2::date
      AND COALESCE(m.credit_bs, 0)::numeric > 0
    ORDER BY m.id ASC
    `,
    [bankAccountId, businessDate]
  );
  return rows;
}

function computeMatchStatus({
  paymentMethod,
  loyTxn,
  loyBs,
  bankCount,
  bankSum,
  posLoteMode,
}) {
  const out = {
    status: "revisar",
    hint_es:
      "Compará conteos y totales; los clientes suelen redondear y el banco puede sumar un poco más que Loyverse.",
    diff_txn: bankCount - loyTxn,
    diff_bs: Number((bankSum - loyBs).toFixed(2)),
    pos_lote: Boolean(posLoteMode),
  };

  if (loyTxn === 0 && bankCount === 0) {
    out.status = "sin_datos";
    out.hint_es = "No hay filas Loyverse ni movimientos bancarios para este criterio.";
    return out;
  }
  if (loyTxn === 0) {
    out.status = "sin_loyverse";
    out.hint_es =
      "No hay ventas por tipo de pago importadas para esa fecha y método. Importá el reporte Loyverse o cambiá la fecha.";
    return out;
  }
  if (bankCount === 0) {
    out.status = "sin_banco";
    out.hint_es = posLoteMode
      ? "No hay abonos con ese lote en referencia o descripción dentro de la ventana de fechas. Revisá el número o el extracto."
      : "No hay abonos en banco que coincidan con el filtro del día. Revisá la cuenta o el extracto.";
    return out;
  }

  const epsLow = Math.max(8, 0.003 * loyBs);
  const epsHigh = Math.max(40, 0.025 * loyBs);
  const sumOk = bankSum >= loyBs - epsLow && bankSum <= loyBs + epsHigh;

  if (posLoteMode) {
    if (sumOk) {
      out.status = "ok";
      out.hint_es =
        "Total bancario (filas con el lote en referencia o descripción) alineado con Loyverse; en POS suele haber una liquidación vs varias transacciones.";
      return out;
    }
    if (bankSum < loyBs - epsLow) {
      out.status = "banco_bajo";
      out.hint_es =
        "Con ese lote el banco suma menos que Loyverse: verificá el número o si falta otra línea.";
      return out;
    }
    if (bankSum > loyBs + epsHigh) {
      out.status = "banco_alto";
      out.hint_es =
        "Con ese lote el banco suma bastante más que Loyverse; revisá duplicados o importaciones.";
      return out;
    }
    out.status = "ok_sobre";
    out.hint_es =
      "El banco suma algo más que Loyverse con el mismo lote (redondeo o comisiones).";
    return out;
  }

  if (paymentMethod !== "pago_movil") {
    out.status = "banco_sin_filtro_pm";
    out.hint_es =
      "Para métodos distintos de Pago Móvil se listan todos los créditos del día en la cuenta; el cotejo es manual.";
    return out;
  }

  const countOk = bankCount === loyTxn;

  if (countOk && sumOk) {
    out.status = "ok";
    out.hint_es =
      "Misma cantidad de transacciones y total bancario alineado con Loyverse (tolerancia por redondeo).";
    return out;
  }

  if (countOk && bankSum >= loyBs - epsLow) {
    out.status = "ok_sobre";
    out.hint_es =
      "Misma cantidad de filas; el banco suma algo más que Loyverse (típico por redondeo a favor del comercio).";
    return out;
  }

  if (!countOk && sumOk) {
    out.status = "suma_ok_conteo";
    out.hint_es =
      "Los totales encajan con tolerancia pero el número de movimientos no coincide; revisá duplicados o importaciones.";
    return out;
  }

  if (bankSum < loyBs - epsLow) {
    out.status = "banco_bajo";
    out.hint_es =
      "El banco suma menos que Loyverse: puede faltar un abono o haber otra cuenta.";
    return out;
  }

  out.status = "banco_alto";
  out.hint_es =
    "El banco suma bastante más que Loyverse o los conteos no coinciden; revisá categorías y fechas.";
  return out;
}

export async function getLoyverseBankReconciliationSnapshot({
  businessDate,
  bankAccountId,
  paymentMethod,
  posBatch,
}) {
  const d = String(businessDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new Error("Fecha inválida.");
  }
  const bid = Number(bankAccountId);
  if (!Number.isFinite(bid) || bid <= 0) {
    throw new Error("Cuenta bancaria obligatoria.");
  }
  const pm = clampPaymentMethod(paymentMethod);
  const batchTrim = String(posBatch || "").trim().slice(0, POS_BATCH_MAX_LEN);

  const lv = await loyversePaymentAggregate(d, pm);
  const loyTxn = Number(lv.txn_count || 0);
  const loyGrossUsd = Number(lv.gross_sales_usd || 0);
  const loyBs = Number(lv.importe_pago_bs || 0);

  let movements = [];
  let bankQuery = { mode: "all_credits_day", window_days: 0 };

  if (pm === "pos") {
    if (!batchTrim) {
      movements = [];
      bankQuery = {
        mode: "pos_lote_pending",
        window_days: POS_LOTE_WINDOW_DAYS,
        hint_es:
          "Indicá el mismo lote que en Ventas por tipo de pago; el banco suele repetirlo en referencia o descripción.",
      };
    } else {
      movements = await bankPosCreditsByLote(bid, d, batchTrim);
      bankQuery = {
        mode: "pos_lote",
        window_days: POS_LOTE_WINDOW_DAYS,
        pos_batch: batchTrim,
        hint_es: `Abonos con el lote «${batchTrim}» en referencia o descripción (ventana de ${POS_LOTE_WINDOW_DAYS} días desde la fecha de negocio por liquidaciones posteriores).`,
      };
    }
  } else if (pm === "pago_movil") {
    movements = await bankPagoMovilCredits(bid, d);
    bankQuery = {
      mode: "pago_movil_day",
      window_days: 0,
      hint_es:
        "Solo créditos del día: código 388 y/o abonos con texto de Pago Móvil (tipo de operación, descripción, referencia o subcategoría clasificada).",
    };
  } else {
    movements = await bankAllCredits(bid, d);
    bankQuery = {
      mode: "all_credits_day",
      window_days: 0,
      hint_es:
        "Todos los créditos del día en la cuenta; el cotejo con Loyverse es manual.",
    };
  }

  const bankCount = movements.length;
  const bankSum = movements.reduce(
    (s, m) => s + Number(m.credit_bs || 0),
    0
  );

  const { rows: accRows } = await pool.query(
    `SELECT id, name FROM finance_bank_accounts WHERE id = $1`,
    [bid]
  );
  const bankAccountName = accRows[0]?.name || null;

  let match;
  if (pm === "pos" && !batchTrim) {
    match = {
      status: "sin_lote",
      hint_es:
        "Para tarjeta (POS) indicá el número de lote del día (el mismo que en Ventas por tipo de pago); el banco lo repite en referencia o descripción y puede liquidar después del fin de semana.",
      diff_txn: 0 - loyTxn,
      diff_bs: Number((0 - loyBs).toFixed(2)),
      pos_lote: true,
    };
  } else {
    match = computeMatchStatus({
      paymentMethod: pm,
      loyTxn,
      loyBs,
      bankCount,
      bankSum,
      posLoteMode: pm === "pos" && Boolean(batchTrim),
    });
  }

  return {
    business_date: d,
    payment_method: pm,
    bank_account_id: bid,
    bank_account_name: bankAccountName,
    bank_query: bankQuery,
    loyverse: {
      txn_count: loyTxn,
      gross_sales_usd: loyGrossUsd,
      importe_pago_bs: loyBs,
    },
    bank: {
      movement_count: bankCount,
      credit_total_bs: Number(bankSum.toFixed(2)),
      movements,
    },
    match,
  };
}
