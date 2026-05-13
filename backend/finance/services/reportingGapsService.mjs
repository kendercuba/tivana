import { pool } from "../../db.mjs";

/**
 * Max business_date per Loyverse fact type and per bank account (movement_date).
 * Frontend compares against "yesterday" in America/Caracas to count missing calendar days.
 */
export async function getReportingGapsSnapshot() {
  const loyRes = await pool.query(
    `
    SELECT fact_type::text AS fact_type,
           MAX(business_date)::text AS max_business_date
    FROM finance_loyverse_facts
    WHERE fact_type IN ('daily_summary', 'payment_breakdown')
      AND business_date IS NOT NULL
    GROUP BY fact_type
    `
  );

  const byType = Object.fromEntries(
    loyRes.rows.map((r) => [r.fact_type, r.max_business_date])
  );

  const bankRes = await pool.query(
    `
    SELECT
      a.id AS bank_account_id,
      a.name AS bank_account_name,
      MAX((m.movement_date)::date)::text AS max_movement_date
    FROM finance_bank_accounts a
    LEFT JOIN finance_bank_movements m
      ON m.bank_account_id = a.id
      AND m.movement_date IS NOT NULL
    WHERE COALESCE(a.is_active, true) = true
    GROUP BY a.id, a.name
    ORDER BY a.sort_order NULLS LAST, a.id
    `
  );

  const { rows: globalRows } = await pool.query(
    `
    SELECT MAX((movement_date)::date)::text AS max_movement_date
    FROM finance_bank_movements
    WHERE movement_date IS NOT NULL
    `
  );

  return {
    loyverseDailySummaryMaxBusinessDate: byType.daily_summary ?? null,
    loyversePaymentBreakdownMaxBusinessDate: byType.payment_breakdown ?? null,
    bankGlobalMaxMovementDate: globalRows[0]?.max_movement_date ?? null,
    bankAccounts: bankRes.rows.map((r) => ({
      bankAccountId: r.bank_account_id,
      bankAccountName: r.bank_account_name,
      maxMovementDate: r.max_movement_date,
    })),
  };
}
