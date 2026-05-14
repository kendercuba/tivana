import { pool } from "../../db.mjs";

function monthBounds(monthYyyyMm) {
  const s = String(monthYyyyMm || "").trim().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(s)) {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, "0");
    return { start: `${y}-${m}-01`, month: `${y}-${m}` };
  }
  const [y, m] = s.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  return { start, month: s.slice(0, 7) };
}

function normalizeRefForMatch(raw) {
  const t = String(raw || "").trim();
  if (!t) return { spaced: "", digits: "" };
  const spaced = t.replace(/\s+/g, " ").toLowerCase();
  const digits = t.replace(/\D+/g, "");
  return { spaced, digits };
}

async function assertExpenseCategory(category) {
  const n = String(category || "").trim();
  if (!n) throw new Error("La categoría es obligatoria.");
  const { rows } = await pool.query(
    `
    SELECT 1 FROM finance_categories
    WHERE name = $1 AND movement_type = 'expense'
    `,
    [n]
  );
  if (rows.length === 0) {
    throw new Error(
      "Categoría no válida para gasto. Usá una categoría de tipo gasto (Finanzas → Categorías)."
    );
  }
}

/**
 * Find bank movements matching amount, date window, reference/description, optional account.
 * @returns {Promise<number[]>} movement ids
 */
async function findMovementCandidates(client, {
  expenseId,
  amountBs,
  expenseDate,
  bankAccountId,
  refSpaced,
  refDigits,
}) {
  const amt = Number(amountBs);
  if (!Number.isFinite(amt) || amt <= 0) return [];

  const params = [amt - 0.02, amt + 0.02, expenseDate, expenseId];
  const refParts = [];
  if (refSpaced) {
    params.push(`%${refSpaced}%`);
    const i = params.length;
    refParts.push(
      `regexp_replace(lower(trim(coalesce(m.reference, ''))), '\\s+', ' ', 'g') LIKE $${i}`
    );
    refParts.push(
      `regexp_replace(lower(trim(coalesce(m.description, ''))), '\\s+', ' ', 'g') LIKE $${i}`
    );
  }
  if (refDigits && refDigits.length >= 4) {
    params.push(`%${refDigits}%`);
    const i = params.length;
    refParts.push(`regexp_replace(coalesce(m.reference, ''), '\\D', '', 'g') LIKE $${i}`);
  }
  if (refParts.length === 0) return [];

  const refOr = refParts.join(" OR ");
  let acctSql = "";
  if (bankAccountId != null && Number.isFinite(Number(bankAccountId))) {
    params.push(Number(bankAccountId));
    acctSql = `AND m.bank_account_id = $${params.length}`;
  }

  const sql = `
    SELECT m.id
    FROM finance_bank_movements m
    WHERE m.debit_bs >= $1::numeric AND m.debit_bs <= $2::numeric
      AND (m.movement_date::date BETWEEN $3::date - INTERVAL '7 day' AND $3::date + INTERVAL '7 day')
      AND (${refOr})
      AND NOT EXISTS (
        SELECT 1 FROM finance_zm_manual_expenses o
        WHERE o.matched_movement_id = m.id AND o.id <> $4
      )
      ${acctSql}
    ORDER BY m.movement_date DESC
    LIMIT 8
  `;

  const { rows } = await client.query(sql, params);
  return rows.map((r) => Number(r.id));
}

export async function tryMatchManualExpense(expenseId) {
  const id = Number(expenseId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("ID inválido.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: expRows } = await client.query(
      `SELECT * FROM finance_zm_manual_expenses WHERE id = $1 FOR UPDATE`,
      [id]
    );
    const exp = expRows[0];
    if (!exp) {
      await client.query("ROLLBACK");
      throw new Error("Gasto no encontrado.");
    }

    const { spaced, digits } = normalizeRefForMatch(exp.bank_reference);
    const amount = Number(exp.amount_bs);
    const d = exp.expense_date;
    const bankAccountId = exp.bank_account_id;

    await client.query(
      `
      UPDATE finance_zm_manual_expenses
      SET matched_movement_id = NULL,
          match_status = 'pendiente',
          match_note = NULL,
          updated_at = NOW()
      WHERE id = $1
      `,
      [id]
    );

    if (!spaced && !(digits && digits.length >= 4)) {
      await client.query(
        `
        UPDATE finance_zm_manual_expenses
        SET match_status = 'sin_coincidencia',
            match_note = $2,
            updated_at = NOW()
        WHERE id = $1
        `,
        [id, "Agregá la referencia del pago (p. ej. Pago Móvil) para buscar el movimiento en el banco."]
      );
      await client.query("COMMIT");
      return getManualExpenseById(id);
    }

    const candidateIds = await findMovementCandidates(client, {
      expenseId: id,
      amountBs: amount,
      expenseDate: d,
      bankAccountId,
      refSpaced: spaced,
      refDigits: digits,
    });

    if (candidateIds.length === 0) {
      await client.query(
        `
        UPDATE finance_zm_manual_expenses
        SET match_status = 'sin_coincidencia',
            match_note = $2,
            updated_at = NOW()
        WHERE id = $1
        `,
        [id, "No se encontró un débito en banco con ese monto, fechas cercanas y referencia."]
      );
      await client.query("COMMIT");
      return getManualExpenseById(id);
    }

    if (candidateIds.length > 1) {
      await client.query(
        `
        UPDATE finance_zm_manual_expenses
        SET match_status = 'ambigua',
            match_note = $2,
            updated_at = NOW()
        WHERE id = $1
        `,
        [id, `Hay ${candidateIds.length} movimientos posibles (ids: ${candidateIds.join(", ")}). Afiná referencia o cuenta.`]
      );
      await client.query("COMMIT");
      return getManualExpenseById(id);
    }

    const mid = candidateIds[0];
    await client.query(
      `
      UPDATE finance_zm_manual_expenses
      SET matched_movement_id = $2,
          match_status = 'emparejado',
          match_note = NULL,
          updated_at = NOW()
      WHERE id = $1
      `,
      [id, mid]
    );
    await client.query("COMMIT");
    return getManualExpenseById(id);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function listManualExpenses({ monthYyyyMm } = {}) {
  const { start } = monthBounds(monthYyyyMm);
  const { rows } = await pool.query(
    `
    SELECT
      e.id,
      e.expense_date,
      e.amount_bs,
      e.concept,
      e.category,
      e.notes,
      e.bank_account_id,
      e.bank_reference,
      e.matched_movement_id,
      e.match_status,
      e.match_note,
      e.created_at,
      e.updated_at,
      ba.name AS bank_account_name,
      m.movement_date AS matched_movement_date,
      m.reference AS matched_bank_reference,
      m.description AS matched_bank_description,
      m.debit_bs AS matched_debit_bs
    FROM finance_zm_manual_expenses e
    LEFT JOIN finance_bank_accounts ba ON ba.id = e.bank_account_id
    LEFT JOIN finance_bank_movements m ON m.id = e.matched_movement_id
    WHERE e.expense_date >= $1::date
      AND e.expense_date < ($1::date + INTERVAL '1 month')
    ORDER BY e.expense_date DESC, e.id DESC
    `,
    [start]
  );
  return rows;
}

export async function getManualExpenseById(id) {
  const { rows } = await pool.query(
    `
    SELECT
      e.id,
      e.expense_date,
      e.amount_bs,
      e.concept,
      e.category,
      e.notes,
      e.bank_account_id,
      e.bank_reference,
      e.matched_movement_id,
      e.match_status,
      e.match_note,
      e.created_at,
      e.updated_at,
      ba.name AS bank_account_name,
      m.movement_date AS matched_movement_date,
      m.reference AS matched_bank_reference,
      m.description AS matched_bank_description,
      m.debit_bs AS matched_debit_bs
    FROM finance_zm_manual_expenses e
    LEFT JOIN finance_bank_accounts ba ON ba.id = e.bank_account_id
    LEFT JOIN finance_bank_movements m ON m.id = e.matched_movement_id
    WHERE e.id = $1
    `,
    [id]
  );
  return rows[0] || null;
}

export async function createManualExpense(body) {
  const expense_date = String(body.expense_date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expense_date)) {
    throw new Error("Fecha inválida.");
  }
  const amount_bs = Number(body.amount_bs);
  if (!Number.isFinite(amount_bs) || amount_bs < 0) {
    throw new Error("Monto en Bs inválido.");
  }
  const concept = String(body.concept || "").trim();
  if (!concept) throw new Error("El concepto es obligatorio.");
  const category = String(body.category || "").trim();
  await assertExpenseCategory(category);
  const notes = body.notes != null ? String(body.notes).trim() || null : null;
  const bank_reference =
    body.bank_reference != null ? String(body.bank_reference).trim() || null : null;
  let bank_account_id = null;
  if (body.bank_account_id != null && body.bank_account_id !== "") {
    const n = Number(body.bank_account_id);
    if (!Number.isFinite(n) || n <= 0) throw new Error("Cuenta bancaria inválida.");
    bank_account_id = n;
  }

  const { rows } = await pool.query(
    `
    INSERT INTO finance_zm_manual_expenses (
      expense_date, amount_bs, concept, category, notes,
      bank_account_id, bank_reference
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
    `,
    [
      expense_date,
      amount_bs,
      concept,
      category,
      notes,
      bank_account_id,
      bank_reference,
    ]
  );
  const id = rows[0].id;
  await tryMatchManualExpense(id);
  return getManualExpenseById(id);
}

export async function updateManualExpense(id, body) {
  const existing = await getManualExpenseById(id);
  if (!existing) throw new Error("Gasto no encontrado.");

  const expense_date =
    body.expense_date != null
      ? String(body.expense_date).slice(0, 10)
      : existing.expense_date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expense_date)) {
    throw new Error("Fecha inválida.");
  }

  let amount_bs = existing.amount_bs;
  if (body.amount_bs != null) {
    amount_bs = Number(body.amount_bs);
    if (!Number.isFinite(amount_bs) || amount_bs < 0) {
      throw new Error("Monto en Bs inválido.");
    }
  }

  const concept =
    body.concept != null ? String(body.concept).trim() : existing.concept;
  if (!concept) throw new Error("El concepto es obligatorio.");

  let category = existing.category;
  if (body.category != null) {
    category = String(body.category).trim();
    await assertExpenseCategory(category);
  }

  const notes =
    body.notes !== undefined
      ? body.notes != null
        ? String(body.notes).trim() || null
        : null
      : existing.notes;

  let bank_reference = existing.bank_reference;
  if (body.bank_reference !== undefined) {
    bank_reference =
      body.bank_reference != null && String(body.bank_reference).trim() !== ""
        ? String(body.bank_reference).trim()
        : null;
  }

  let bank_account_id = existing.bank_account_id;
  if (body.bank_account_id !== undefined) {
    if (body.bank_account_id == null || body.bank_account_id === "") {
      bank_account_id = null;
    } else {
      const n = Number(body.bank_account_id);
      if (!Number.isFinite(n) || n <= 0) throw new Error("Cuenta bancaria inválida.");
      bank_account_id = n;
    }
  }

  await pool.query(
    `
    UPDATE finance_zm_manual_expenses
    SET expense_date = $2,
        amount_bs = $3,
        concept = $4,
        category = $5,
        notes = $6,
        bank_account_id = $7,
        bank_reference = $8,
        matched_movement_id = NULL,
        match_status = 'pendiente',
        match_note = NULL,
        updated_at = NOW()
    WHERE id = $1
    `,
    [
      id,
      expense_date,
      amount_bs,
      concept,
      category,
      notes,
      bank_account_id,
      bank_reference,
    ]
  );

  await tryMatchManualExpense(id);
  return getManualExpenseById(id);
}

export async function deleteManualExpense(id) {
  const r = await pool.query(
    `DELETE FROM finance_zm_manual_expenses WHERE id = $1 RETURNING id`,
    [id]
  );
  if (r.rowCount === 0) throw new Error("Gasto no encontrado.");
  return true;
}
