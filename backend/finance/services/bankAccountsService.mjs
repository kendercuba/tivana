import { pool } from "../../db.mjs";
import { normalizeBncLastFourInput } from "./bncAccountResolve.mjs";

export async function listBankAccounts({ includeInactive = false } = {}) {
  const where = includeInactive ? "" : "WHERE is_active = true";
  const { rows } = await pool.query(
    `
    SELECT id, name, notes, is_active, sort_order, bnc_last_four, created_at, updated_at
    FROM finance_bank_accounts
    ${where}
    ORDER BY sort_order ASC, id ASC
    `
  );
  return rows;
}

export async function getBankAccountById(id) {
  const { rows } = await pool.query(
    `SELECT * FROM finance_bank_accounts WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function createBankAccount({ name, notes, bnc_last_four }) {
  const trimmed = String(name || "").trim();
  if (!trimmed) {
    throw new Error("El nombre de la cuenta es obligatorio.");
  }

  const bncFour = normalizeBncLastFourInput(bnc_last_four);

  const maxRes = await pool.query(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM finance_bank_accounts`
  );
  const sort_order = maxRes.rows[0].n;

  const { rows } = await pool.query(
    `
    INSERT INTO finance_bank_accounts (name, notes, sort_order, bnc_last_four)
    VALUES ($1, $2, $3, $4)
    RETURNING *
    `,
    [trimmed, notes ? String(notes).trim() || null : null, sort_order, bncFour]
  );

  return rows[0];
}

export async function updateBankAccount(id, patch) {
  const numId = Number(id);
  if (!Number.isFinite(numId)) return null;

  const fields = [];
  const values = [];
  let i = 1;

  if (patch.name !== undefined) {
    const t = String(patch.name).trim();
    if (!t) throw new Error("El nombre no puede quedar vacío.");
    fields.push(`name = $${i++}`);
    values.push(t);
  }
  if (patch.notes !== undefined) {
    fields.push(`notes = $${i++}`);
    values.push(
      patch.notes === null || patch.notes === ""
        ? null
        : String(patch.notes).trim()
    );
  }
  if (patch.is_active !== undefined) {
    fields.push(`is_active = $${i++}`);
    values.push(Boolean(patch.is_active));
  }
  if (patch.sort_order !== undefined) {
    const n = Number(patch.sort_order);
    if (!Number.isFinite(n)) throw new Error("sort_order inválido.");
    fields.push(`sort_order = $${i++}`);
    values.push(n);
  }
  if (patch.bnc_last_four !== undefined) {
    const v = patch.bnc_last_four;
    const normalized =
      v === null || v === ""
        ? null
        : normalizeBncLastFourInput(v);
    if (v !== null && v !== "" && normalized === null) {
      throw new Error(
        "Últimos dígitos BNC: introduce al menos 4 números (ej. los de ***3923)."
      );
    }
    fields.push(`bnc_last_four = $${i++}`);
    values.push(normalized);
  }

  if (fields.length === 0) {
    return getBankAccountById(numId);
  }

  fields.push(`updated_at = NOW()`);
  values.push(numId);

  const { rows } = await pool.query(
    `
    UPDATE finance_bank_accounts
    SET ${fields.join(", ")}
    WHERE id = $${i}
    RETURNING *
    `,
    values
  );

  return rows[0] || null;
}

export async function deleteBankAccount(id) {
  const numId = Number(id);
  if (!Number.isFinite(numId)) return false;

  const mov = await pool.query(
    `SELECT COUNT(*)::int AS c FROM finance_bank_movements WHERE bank_account_id = $1`,
    [numId]
  );
  const batches = await pool.query(
    `SELECT COUNT(*)::int AS c FROM finance_import_batches WHERE bank_account_id = $1`,
    [numId]
  );

  if (mov.rows[0].c > 0 || batches.rows[0].c > 0) {
    throw new Error(
      "No se puede eliminar: hay movimientos bancarios o importaciones asociadas. Desactiva la cuenta o borra esos datos antes."
    );
  }

  const { rowCount } = await pool.query(
    `DELETE FROM finance_bank_accounts WHERE id = $1`,
    [numId]
  );
  return rowCount > 0;
}
