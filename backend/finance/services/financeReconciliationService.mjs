import { pool } from "../../db.mjs";
import { updateBankMovementCategory } from "./bankImportService.mjs";

const WORKSPACE_PO = "zm_purchase";
const PURCHASE_INVENTORY_CATEGORY = "Compra inventario";

function clampInt(n, lo, hi) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return lo;
  return Math.min(Math.max(v, lo), hi);
}

/**
 * Open PO lines in a lookback window (no reconciliation link yet).
 */
export async function getPurchaseReconciliationSummary({ windowDays = 90 } = {}) {
  const wd = clampInt(windowDays, 1, 366);
  const { rows } = await pool.query(
    `
    SELECT
      COUNT(*)::int AS pending_lines,
      COUNT(DISTINCT l.business_date)::int AS pending_days
    FROM finance_zm_purchase_order_lines l
    INNER JOIN finance_import_batches b
      ON b.id = l.import_batch_id AND b.import_type = 'zm_purchase_orders'
    WHERE l.business_date >= (CURRENT_DATE - ($1::int * INTERVAL '1 day'))::date
      AND NOT EXISTS (
        SELECT 1
        FROM finance_reconciliation_links r
        WHERE r.workspace = $2
          AND r.zm_po_line_id = l.id
      )
    `,
    [wd, WORKSPACE_PO]
  );
  const row = rows[0] || {};
  return {
    window_days: wd,
    pending_lines: Number(row.pending_lines || 0),
    pending_days: Number(row.pending_days || 0),
  };
}

/**
 * @param {{ businessDate: string, includeReconciled?: boolean }} p
 */
export async function getPurchaseReconciliationDay({
  businessDate,
  includeReconciled = false,
}) {
  const d = String(businessDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new Error("Fecha inválida.");
  }
  const showAll = Boolean(includeReconciled);

  const { rows: rateRows } = await pool.query(
    `
    SELECT rate_bs::numeric AS rate_bs
    FROM finance_loyverse_daily_exchange_rates
    WHERE business_date = $1::date
    LIMIT 1
    `,
    [d]
  );
  const rateBs = Number(rateRows[0]?.rate_bs || 0);

  const { rows: poRows } = await pool.query(
    `
    SELECT
      l.id,
      l.business_date::text AS business_date,
      l.po_number,
      l.ref_code,
      l.item_name,
      l.line_total::numeric AS line_total,
      (COALESCE(l.line_total, 0)::numeric * $2::numeric)::numeric(18, 2) AS line_total_bs_estimated,
      EXISTS (
        SELECT 1 FROM finance_reconciliation_links r
        WHERE r.workspace = $3 AND r.zm_po_line_id = l.id
      ) AS reconciled
    FROM finance_zm_purchase_order_lines l
    INNER JOIN finance_import_batches b
      ON b.id = l.import_batch_id AND b.import_type = 'zm_purchase_orders'
    WHERE l.business_date = $1::date
    ORDER BY l.id ASC
    `,
    [d, rateBs, WORKSPACE_PO]
  );

  const bankSql = showAll
    ? `
    SELECT
      m.id,
      m.bank_account_id,
      a.name AS bank_account_name,
      (m.movement_date)::date::text AS movement_date,
      m.reference,
      m.description,
      m.transaction_code,
      m.transaction_type,
      m.operation_type,
      m.category,
      m.subcategory,
      m.debit_bs::numeric AS debit_bs,
      EXISTS (
        SELECT 1 FROM finance_reconciliation_links r
        WHERE r.bank_movement_id = m.id AND r.workspace = $1
      ) AS reconciled,
      (
        SELECT r.zm_po_line_id
        FROM finance_reconciliation_links r
        WHERE r.bank_movement_id = m.id AND r.workspace = $1
        LIMIT 1
      ) AS matched_po_line_id
    FROM finance_bank_movements m
    INNER JOIN finance_bank_accounts a ON a.id = m.bank_account_id
    WHERE (m.movement_date)::date = $2::date
      AND COALESCE(m.debit_bs, 0)::numeric > 0
      AND (
        LOWER(
          COALESCE(m.operation_type, '') || ' ' ||
          COALESCE(m.description, '') || ' ' ||
          COALESCE(m.reference, '') || ' ' ||
          COALESCE(m.transaction_type, '')
        ) LIKE ANY (ARRAY[
          '%transfer%', '%tranf%', '%movil%', '%móvil%', '%tarjeta%',
          '%pos%', '%debit%', '%pago%', '%cred inm%', '%inmediat%'
        ])
        OR TRIM(COALESCE(m.transaction_code, '')) IN ('387', '377', '262', '487', '751')
      )
    ORDER BY m.bank_account_id ASC, m.id ASC
    LIMIT 500
    `
    : `
    SELECT
      m.id,
      m.bank_account_id,
      a.name AS bank_account_name,
      (m.movement_date)::date::text AS movement_date,
      m.reference,
      m.description,
      m.transaction_code,
      m.transaction_type,
      m.operation_type,
      m.category,
      m.subcategory,
      m.debit_bs::numeric AS debit_bs,
      EXISTS (
        SELECT 1 FROM finance_reconciliation_links r
        WHERE r.bank_movement_id = m.id AND r.workspace = $1
      ) AS reconciled,
      (
        SELECT r.zm_po_line_id
        FROM finance_reconciliation_links r
        WHERE r.bank_movement_id = m.id AND r.workspace = $1
        LIMIT 1
      ) AS matched_po_line_id
    FROM finance_bank_movements m
    INNER JOIN finance_bank_accounts a ON a.id = m.bank_account_id
    WHERE (m.movement_date)::date = $2::date
      AND COALESCE(m.debit_bs, 0)::numeric > 0
      AND (
        LOWER(
          COALESCE(m.operation_type, '') || ' ' ||
          COALESCE(m.description, '') || ' ' ||
          COALESCE(m.reference, '') || ' ' ||
          COALESCE(m.transaction_type, '')
        ) LIKE ANY (ARRAY[
          '%transfer%', '%tranf%', '%movil%', '%móvil%', '%tarjeta%',
          '%pos%', '%debit%', '%pago%', '%cred inm%', '%inmediat%'
        ])
        OR TRIM(COALESCE(m.transaction_code, '')) IN ('387', '377', '262', '487', '751')
      )
      AND NOT EXISTS (
        SELECT 1 FROM finance_reconciliation_links r2
        WHERE r2.bank_movement_id = m.id AND r2.workspace = $1
      )
    ORDER BY m.bank_account_id ASC, m.id ASC
    LIMIT 500
    `;

  const { rows: bankRows } = await pool.query(bankSql, [WORKSPACE_PO, d]);

  const debitSum = bankRows.reduce(
    (s, r) => s + Number(r.debit_bs || 0),
    0
  );

  return {
    business_date: d,
    rate_bs: rateBs,
    po_lines: poRows,
    bank_movements: bankRows,
    bank: {
      movement_count: bankRows.length,
      debit_total_bs: Number(debitSum.toFixed(2)),
    },
  };
}

export async function createPurchaseReconciliationLink({
  bankMovementId,
  zmPoLineId,
}) {
  const bid = Number(bankMovementId);
  const pid = Number(zmPoLineId);
  if (!Number.isFinite(bid) || bid <= 0) throw new Error("Movimiento bancario inválido.");
  if (!Number.isFinite(pid) || pid <= 0) throw new Error("Línea de compra inválida.");

  const { rows } = await pool.query(
    `
    INSERT INTO finance_reconciliation_links (workspace, bank_movement_id, zm_po_line_id)
    VALUES ($1, $2, $3)
    ON CONFLICT (bank_movement_id) DO UPDATE
      SET zm_po_line_id = EXCLUDED.zm_po_line_id,
          workspace = EXCLUDED.workspace
    RETURNING id, bank_movement_id, zm_po_line_id, created_at
    `,
    [WORKSPACE_PO, bid, pid]
  );
  await updateBankMovementCategory(bid, PURCHASE_INVENTORY_CATEGORY);
  return rows[0];
}

export async function deletePurchaseReconciliationLink({ bankMovementId }) {
  const bid = Number(bankMovementId);
  if (!Number.isFinite(bid) || bid <= 0) throw new Error("Movimiento bancario inválido.");
  const { rowCount } = await pool.query(
    `
    DELETE FROM finance_reconciliation_links
    WHERE bank_movement_id = $1 AND workspace = $2
    `,
    [bid, WORKSPACE_PO]
  );
  return { deleted: rowCount > 0 };
}

/**
 * Creates several OC↔banco links in order (each movement updates category to Compra inventario).
 * @param {{ pairs: { bankMovementId: number, zmPoLineId: number }[] }} p
 */
export async function createPurchaseReconciliationLinksBatch({ pairs }) {
  if (!Array.isArray(pairs) || pairs.length === 0) {
    throw new Error("Enviá al menos un par banco ↔ línea de compra.");
  }
  if (pairs.length > 50) {
    throw new Error("Máximo 50 vínculos por operación.");
  }
  const results = [];
  for (const pair of pairs) {
    const row = await createPurchaseReconciliationLink({
      bankMovementId: pair.bankMovementId ?? pair.bank_movement_id,
      zmPoLineId: pair.zmPoLineId ?? pair.zm_po_line_id,
    });
    results.push(row);
  }
  return { count: results.length, links: results };
}
