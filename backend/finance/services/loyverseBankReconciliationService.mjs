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
 * Bank credits that look like Pago Móvil income for BNC-style extracts.
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
      m.operation_type,
      m.credit_bs::numeric AS credit_bs,
      m.debit_bs::numeric AS debit_bs,
      m.category
    FROM finance_bank_movements m
    WHERE m.bank_account_id = $1
      AND (m.movement_date)::date = $2::date
      AND COALESCE(m.credit_bs, 0)::numeric > 0
      AND (
        TRIM(COALESCE(m.transaction_code, '')) = '388'
        OR LOWER(COALESCE(m.operation_type, '')) LIKE '%pago movil%'
        OR LOWER(COALESCE(m.operation_type, '')) LIKE '%pago móvil%'
        OR LOWER(COALESCE(m.description, '')) LIKE '%pago movil%'
        OR LOWER(COALESCE(m.description, '')) LIKE '%pago móvil%'
      )
    ORDER BY m.id ASC
    `,
    [bankAccountId, businessDate]
  );
  return rows;
}

/**
 * Generic credits on account for day (used when payment method is not pago_movil).
 */
async function bankAllCredits(bankAccountId, businessDate) {
  const { rows } = await pool.query(
    `
    SELECT
      m.id,
      (m.movement_date)::date::text AS movement_date,
      m.reference,
      m.description,
      m.transaction_code,
      m.operation_type,
      m.credit_bs::numeric AS credit_bs,
      m.debit_bs::numeric AS debit_bs,
      m.category
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
}) {
  const out = {
    status: "revisar",
    hint_es:
      "Compará conteos y totales; los clientes suelen redondear y el banco puede sumar un poco más que Loyverse.",
    diff_txn: bankCount - loyTxn,
    diff_bs: Number((bankSum - loyBs).toFixed(2)),
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
    out.hint_es =
      "No hay abonos en banco que coincidan con el filtro del día. Revisá la cuenta o el extracto.";
    return out;
  }

  if (paymentMethod !== "pago_movil") {
    out.status = "banco_sin_filtro_pm";
    out.hint_es =
      "Para métodos distintos de Pago Móvil se listan todos los créditos del día en la cuenta; el cotejo es manual.";
    return out;
  }

  const epsLow = Math.max(8, 0.003 * loyBs);
  const epsHigh = Math.max(40, 0.025 * loyBs);

  const sumOk = bankSum >= loyBs - epsLow && bankSum <= loyBs + epsHigh;
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

  const lv = await loyversePaymentAggregate(d, pm);
  const loyTxn = Number(lv.txn_count || 0);
  const loyGrossUsd = Number(lv.gross_sales_usd || 0);
  const loyBs = Number(lv.importe_pago_bs || 0);

  const movements =
    pm === "pago_movil"
      ? await bankPagoMovilCredits(bid, d)
      : await bankAllCredits(bid, d);

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

  const match = computeMatchStatus({
    paymentMethod: pm,
    loyTxn,
    loyBs,
    bankCount,
    bankSum,
  });

  return {
    business_date: d,
    payment_method: pm,
    bank_account_id: bid,
    bank_account_name: bankAccountName,
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
