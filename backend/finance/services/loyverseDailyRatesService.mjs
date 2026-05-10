import { pool } from "../../db.mjs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function listLoyverseDailyRates() {
  const { rows } = await pool.query(
    `
    SELECT business_date::text AS business_date, rate_bs, updated_at
    FROM finance_loyverse_daily_exchange_rates
    ORDER BY business_date DESC
    `
  );
  return rows;
}

/**
 * @param {string} businessDateStr — YYYY-MM-DD
 * @param {number|null|undefined|string} rateBs — Bs; vacío borra el registro del día
 */
export async function upsertLoyverseDailyRate(businessDateStr, rateBs) {
  const d = String(businessDateStr || "").trim();
  if (!DATE_RE.test(d)) {
    throw new Error("Fecha inválida (usa YYYY-MM-DD).");
  }

  if (rateBs === null || rateBs === undefined || rateBs === "") {
    await pool.query(
      `
      DELETE FROM finance_loyverse_daily_exchange_rates
      WHERE business_date = $1::date
      `,
      [d]
    );
    return true;
  }

  const n = Number(rateBs);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("La tasa debe ser un número mayor o igual a cero.");
  }

  await pool.query(
    `
    INSERT INTO finance_loyverse_daily_exchange_rates (business_date, rate_bs, updated_at)
    VALUES ($1::date, $2, NOW())
    ON CONFLICT (business_date) DO UPDATE SET
      rate_bs = EXCLUDED.rate_bs,
      updated_at = NOW()
    `,
    [d, n]
  );

  return true;
}
