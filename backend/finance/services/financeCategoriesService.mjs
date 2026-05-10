import { pool } from "../../db.mjs";

const SUBCATEGORY_RECLASS = "Reclasificado";

export async function listFinanceCategories() {
  const { rows } = await pool.query(
    `
    SELECT id, name, movement_type, sort_order, created_at, updated_at
    FROM finance_categories
    ORDER BY sort_order ASC, name ASC
    `
  );
  return rows;
}

/** Payload para selects del import y PATCH de movimientos */
export async function listFinanceCategoriesForBank() {
  const rows = await listFinanceCategories();
  return rows.map((r) => ({
    id: r.id,
    value: r.name,
    label: r.name,
    movement_type: r.movement_type,
  }));
}

export async function assertAllowedBankCategoryName(category) {
  const { rows } = await pool.query(
    `SELECT 1 FROM finance_categories WHERE name = $1`,
    [category]
  );
  if (rows.length === 0) {
    throw new Error(
      "Categoría no reconocida. Usa una de las definidas en Finanzas → Categorías."
    );
  }
}

export async function metaForManualBankCategoryFromDb(category) {
  const { rows } = await pool.query(
    `SELECT movement_type FROM finance_categories WHERE name = $1`,
    [category]
  );
  if (rows.length === 0) {
    throw new Error("Categoría no encontrada.");
  }
  return {
    movement_type: rows[0].movement_type,
    subcategory: SUBCATEGORY_RECLASS,
  };
}

export async function createFinanceCategory({
  name,
  movement_type,
  sort_order,
}) {
  const n = String(name || "").trim();
  if (!n) throw new Error("El nombre es obligatorio.");
  const mt = String(movement_type || "").trim();
  if (!["income", "expense", "transfer", "unknown"].includes(mt)) {
    throw new Error("Tipo de movimiento inválido.");
  }
  let order = Number(sort_order);
  if (!Number.isFinite(order)) {
    const maxRes = await pool.query(
      `SELECT COALESCE(MAX(sort_order), 0)::int AS m FROM finance_categories`
    );
    order = (maxRes.rows[0]?.m ?? 0) + 10;
  }

  const { rows } = await pool.query(
    `
    INSERT INTO finance_categories (name, movement_type, sort_order)
    VALUES ($1, $2, $3)
    RETURNING id, name, movement_type, sort_order, created_at, updated_at
    `,
    [n, mt, order]
  );
  return rows[0];
}

export async function updateFinanceCategory(id, patch) {
  const cid = Number(id);
  if (!Number.isFinite(cid)) throw new Error("ID inválido.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cur = await client.query(
      `SELECT id, name FROM finance_categories WHERE id = $1`,
      [cid]
    );
    if (cur.rows.length === 0) {
      await client.query("ROLLBACK");
      throw new Error("Categoría no encontrada.");
    }
    const oldName = cur.rows[0].name;

    const newName =
      patch.name !== undefined ? String(patch.name).trim() : oldName;
    if (!newName) {
      await client.query("ROLLBACK");
      throw new Error("El nombre no puede estar vacío.");
    }

    if (newName !== oldName) {
      const clash = await client.query(
        `SELECT id FROM finance_categories WHERE name = $1 AND id <> $2`,
        [newName, cid]
      );
      if (clash.rows.length > 0) {
        await client.query("ROLLBACK");
        throw new Error(`Ya existe una categoría con el nombre «${newName}».`);
      }
      await client.query(
        `UPDATE finance_bank_movements SET category = $1 WHERE category = $2`,
        [newName, oldName]
      );
    }

    const updates = [];
    const vals = [];
    let pi = 1;

    if (patch.name !== undefined) {
      updates.push(`name = $${pi++}`);
      vals.push(newName);
    }
    if (patch.movement_type !== undefined) {
      const mt = String(patch.movement_type).trim();
      if (!["income", "expense", "transfer", "unknown"].includes(mt)) {
        await client.query("ROLLBACK");
        throw new Error("Tipo de movimiento inválido.");
      }
      updates.push(`movement_type = $${pi++}`);
      vals.push(mt);
    }
    if (patch.sort_order !== undefined) {
      const o = Number(patch.sort_order);
      if (!Number.isFinite(o)) {
        await client.query("ROLLBACK");
        throw new Error("Orden inválido.");
      }
      updates.push(`sort_order = $${pi++}`);
      vals.push(o);
    }

    if (updates.length === 0) {
      await client.query("ROLLBACK");
      throw new Error("Nada que actualizar.");
    }

    updates.push(`updated_at = NOW()`);
    vals.push(cid);
    const whereIdx = vals.length;

    const { rows } = await client.query(
      `
      UPDATE finance_categories
      SET ${updates.join(", ")}
      WHERE id = $${whereIdx}
      RETURNING id, name, movement_type, sort_order, created_at, updated_at
      `,
      vals
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteFinanceCategory(id) {
  const cid = Number(id);
  if (!Number.isFinite(cid)) throw new Error("ID inválido.");

  const nameRes = await pool.query(
    `SELECT name FROM finance_categories WHERE id = $1`,
    [cid]
  );
  if (nameRes.rows.length === 0) {
    throw new Error("Categoría no encontrada.");
  }
  const name = nameRes.rows[0].name;

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS c FROM finance_bank_movements WHERE category = $1`,
    [name]
  );
  const n = countRes.rows[0]?.c ?? 0;
  if (n > 0) {
    throw new Error(
      `No se puede eliminar: hay ${n} movimiento(s) con esta categoría. Cambia la categoría de esos movimientos primero.`
    );
  }

  await pool.query(`DELETE FROM finance_categories WHERE id = $1`, [cid]);
  return true;
}
