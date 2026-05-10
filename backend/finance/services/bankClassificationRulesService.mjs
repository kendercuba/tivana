import { pool } from "../../db.mjs";

export async function listBankClassificationRules() {
  const { rows } = await pool.query(
    `
    SELECT
      r.id,
      r.sort_order,
      r.transaction_code,
      r.match_transaction_type,
      r.match_operation_type,
      r.category_name,
      r.subcategory,
      r.is_active,
      r.notes,
      r.created_at,
      r.updated_at,
      c.movement_type
    FROM finance_bank_classification_rules r
    LEFT JOIN finance_categories c ON c.name = r.category_name
    ORDER BY r.sort_order ASC, r.id ASC
    `
  );
  return rows;
}

/** Solo reglas activas; incluye movement_type de la categoría (para import). */
export async function listRulesForClassification() {
  const { rows } = await pool.query(
    `
    SELECT
      r.sort_order,
      r.transaction_code,
      r.match_transaction_type,
      r.match_operation_type,
      r.category_name,
      r.subcategory,
      c.movement_type
    FROM finance_bank_classification_rules r
    INNER JOIN finance_categories c ON c.name = r.category_name
    WHERE r.is_active = true
    ORDER BY r.sort_order ASC, r.id ASC
    `
  );
  return rows;
}

async function assertCategoryExists(name) {
  const { rows } = await pool.query(
    `SELECT 1 FROM finance_categories WHERE name = $1`,
    [name]
  );
  if (rows.length === 0) {
    throw new Error(`La categoría «${name}» no existe. Créala primero en «Categorías».`);
  }
}

export async function createBankClassificationRule(body = {}) {
  const transaction_code = String(body.transaction_code ?? "").trim();
  if (!transaction_code) {
    throw new Error("El código de transacción es obligatorio.");
  }

  const match_transaction_type = String(
    body.match_transaction_type ?? ""
  ).trim();
  const match_operation_type = String(
    body.match_operation_type ?? ""
  ).trim();

  const category_name = String(body.category_name ?? "").trim();
  if (!category_name) {
    throw new Error("Debes elegir una categoría.");
  }

  await assertCategoryExists(category_name);

  const subcategory = String(body.subcategory ?? "").trim() || "—";
  const notes = body.notes != null ? String(body.notes).trim() : null;

  let sort_order = Number(body.sort_order);
  if (!Number.isFinite(sort_order)) {
    const maxRes = await pool.query(
      `SELECT COALESCE(MAX(sort_order), 0)::int AS m FROM finance_bank_classification_rules`
    );
    sort_order = (maxRes.rows[0]?.m ?? 0) + 10;
  }

  const is_active =
    body.is_active === undefined ? true : Boolean(body.is_active);

  const { rows } = await pool.query(
    `
    INSERT INTO finance_bank_classification_rules (
      sort_order,
      transaction_code,
      match_transaction_type,
      match_operation_type,
      category_name,
      subcategory,
      is_active,
      notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
    `,
    [
      sort_order,
      transaction_code,
      match_transaction_type,
      match_operation_type,
      category_name,
      subcategory,
      is_active,
      notes,
    ]
  );

  return rows[0];
}

export async function updateBankClassificationRule(id, patch = {}) {
  const rid = Number(id);
  if (!Number.isFinite(rid)) throw new Error("ID inválido.");

  const cur = await pool.query(
    `SELECT * FROM finance_bank_classification_rules WHERE id = $1`,
    [rid]
  );
  if (cur.rows.length === 0) throw new Error("Regla no encontrada.");

  const next = { ...cur.rows[0], ...patch };

  const transaction_code = String(next.transaction_code ?? "").trim();
  if (!transaction_code) throw new Error("El código de transacción es obligatorio.");

  const category_name = String(next.category_name ?? "").trim();
  if (!category_name) throw new Error("Debes elegir una categoría.");
  await assertCategoryExists(category_name);

  const match_transaction_type = String(
    next.match_transaction_type ?? ""
  ).trim();
  const match_operation_type = String(next.match_operation_type ?? "").trim();
  const subcategory = String(next.subcategory ?? "").trim() || "—";
  const notes =
    next.notes != null && next.notes !== ""
      ? String(next.notes).trim()
      : null;

  const sort_order = Number(next.sort_order);
  if (!Number.isFinite(sort_order)) throw new Error("Orden inválido.");

  const is_active = Boolean(next.is_active);

  const { rows } = await pool.query(
    `
    UPDATE finance_bank_classification_rules
    SET
      sort_order = $2,
      transaction_code = $3,
      match_transaction_type = $4,
      match_operation_type = $5,
      category_name = $6,
      subcategory = $7,
      is_active = $8,
      notes = $9,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      rid,
      sort_order,
      transaction_code,
      match_transaction_type,
      match_operation_type,
      category_name,
      subcategory,
      is_active,
      notes,
    ]
  );

  return rows[0];
}

export async function deleteBankClassificationRule(id) {
  const rid = Number(id);
  if (!Number.isFinite(rid)) throw new Error("ID inválido.");

  const r = await pool.query(
    `DELETE FROM finance_bank_classification_rules WHERE id = $1 RETURNING id`,
    [rid]
  );
  if (r.rowCount === 0) throw new Error("Regla no encontrada.");
  return true;
}
