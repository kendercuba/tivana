import { pool } from "../../db.mjs";

/**
 * Week = Friday 00:00 through Thursday (inclusive), local calendar dates as YYYY-MM-DD.
 * @param {string} ymd — any day inside the week
 * @returns {{ weekStartFriday: string, weekEndThursday: string }}
 */
export function fridayWeekRangeContaining(ymd) {
  const s = String(ymd || "").slice(0, 10);
  const base = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : new Date().toISOString().slice(0, 10);
  const d = new Date(`${base}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, "0");
    const day = String(t.getDate()).padStart(2, "0");
    return fridayWeekRangeContaining(`${y}-${m}-${day}`);
  }
  const dow = d.getDay();
  const offsetFromFriday = (dow + 7 - 5) % 7;
  d.setDate(d.getDate() - offsetFromFriday);
  const weekStartFriday = d.toISOString().slice(0, 10);
  const end = new Date(`${weekStartFriday}T12:00:00`);
  end.setDate(end.getDate() + 6);
  const weekEndThursday = end.toISOString().slice(0, 10);
  return { weekStartFriday, weekEndThursday };
}

/**
 * @param {{ weekStartFriday?: string|null, bankAccountId?: string|null }} opts
 */
export async function getZmWeeklyFinanceOverview({
  weekStartFriday = null,
  bankAccountId = null,
} = {}) {
  const { weekStartFriday: ws, weekEndThursday: we } = fridayWeekRangeContaining(
    weekStartFriday || undefined
  );

  const bankId =
    bankAccountId != null && bankAccountId !== ""
      ? Number(bankAccountId)
      : null;
  if (bankId != null && (!Number.isFinite(bankId) || bankId <= 0)) {
    throw new Error("bankAccountId inválido.");
  }

  const salesRes = await pool.query(
    `
    WITH ranked AS (
      SELECT
        (f.business_date)::date AS d,
        f.net_sales::numeric AS net_usd,
        ROW_NUMBER() OVER (
          PARTITION BY (f.business_date)::date
          ORDER BY f.import_batch_id DESC NULLS LAST
        ) AS rn
      FROM finance_loyverse_facts f
      INNER JOIN finance_import_batches b
        ON b.id = f.import_batch_id AND b.import_type = 'loyverse'
      WHERE f.fact_type = 'daily_summary'
        AND (f.business_date)::date >= $1::date
        AND (f.business_date)::date <= $2::date
    ),
    daily AS (
      SELECT d, net_usd FROM ranked WHERE rn = 1
    )
    SELECT
      COALESCE(SUM(net_usd), 0)::numeric(18, 6) AS sales_usd_total,
      COALESCE(
        SUM(CASE WHEN r.rate_bs IS NOT NULL THEN net_usd * r.rate_bs ELSE 0 END),
        0
      )::numeric(18, 2) AS sales_bs_with_rate,
      COUNT(*) FILTER (WHERE net_usd IS NOT NULL AND net_usd <> 0)::int AS sales_days_with_data,
      COUNT(*) FILTER (
        WHERE net_usd IS NOT NULL AND net_usd <> 0 AND r.rate_bs IS NULL
      )::int AS sales_days_missing_rate
    FROM daily d
    LEFT JOIN finance_loyverse_daily_exchange_rates r
      ON r.business_date = d.d
    `,
    [ws, we]
  );

  const poRes = await pool.query(
    `
    SELECT
      COALESCE(SUM(l.line_total), 0)::numeric(18, 6) AS po_usd_total,
      COALESCE(
        SUM(l.line_total * COALESCE(r.rate_bs, 0)),
        0
      )::numeric(18, 2) AS po_bs_with_rate,
      COUNT(*) FILTER (
        WHERE l.line_total IS NOT NULL AND l.line_total <> 0 AND r.rate_bs IS NULL
      )::int AS po_lines_missing_rate
    FROM finance_zm_purchase_order_lines l
    INNER JOIN finance_import_batches b
      ON b.id = l.import_batch_id AND b.import_type = 'zm_purchase_orders'
    LEFT JOIN finance_loyverse_daily_exchange_rates r
      ON r.business_date = l.business_date
    WHERE l.business_date >= $1::date AND l.business_date <= $2::date
    `,
    [ws, we]
  );

  const bankParams = [ws, we];
  let bankWhere = `WHERE (m.movement_date)::date >= $1::date AND (m.movement_date)::date <= $2::date`;
  if (bankId != null) {
    bankParams.push(bankId);
    bankWhere += ` AND m.bank_account_id = $${bankParams.length}`;
  }

  const bankRes = await pool.query(
    `
    SELECT
      COALESCE(
        SUM(CASE WHEN COALESCE(m.category, '') = 'Nómina' THEN m.debit_bs ELSE 0 END),
        0
      )::numeric(18, 2) AS nomina_debit_bs,
      COALESCE(
        SUM(
          CASE WHEN COALESCE(m.category, '') = 'Comisión bancaria' THEN m.debit_bs ELSE 0 END
        ),
        0
      )::numeric(18, 2) AS comision_debit_bs,
      COALESCE(
        SUM(
          CASE
            WHEN COALESCE(m.category, '') = 'Compra inventario' THEN m.debit_bs ELSE 0
          END
        ),
        0
      )::numeric(18, 2) AS compra_inventario_debit_bs
    FROM finance_bank_movements m
    ${bankWhere}
    `,
    bankParams
  );

  const s = salesRes.rows[0] || {};
  const p = poRes.rows[0] || {};
  const k = bankRes.rows[0] || {};

  const salesUsd = Number(s.sales_usd_total || 0);
  const salesBs = Number(s.sales_bs_with_rate || 0);
  const poUsd = Number(p.po_usd_total || 0);
  const poBs = Number(p.po_bs_with_rate || 0);
  const nominaBs = Number(k.nomina_debit_bs || 0);
  const comisionBs = Number(k.comision_debit_bs || 0);
  const compraInvBs = Number(k.compra_inventario_debit_bs || 0);

  const indicativeFlowBs =
    salesBs - poBs - nominaBs - comisionBs - compraInvBs;

  return {
    week_start_friday: ws,
    week_end_thursday: we,
    sales_usd_total: salesUsd,
    sales_bs_estimated: salesBs,
    sales_days_with_data: Number(s.sales_days_with_data || 0),
    sales_days_missing_rate: Number(s.sales_days_missing_rate || 0),
    purchase_orders_usd_total: poUsd,
    purchase_orders_bs_estimated: poBs,
    purchase_order_lines_missing_rate: Number(p.po_lines_missing_rate || 0),
    bank_nomina_debit_bs: nominaBs,
    bank_comision_debit_bs: comisionBs,
    bank_compra_inventario_debit_bs: compraInvBs,
    indicative_flow_bs: indicativeFlowBs,
  };
}
