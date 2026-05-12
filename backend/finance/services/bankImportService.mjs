import {
  parseBncExcel,
  extractBncAccountLastFour,
} from "../parsers/bncExcelParser.mjs";
import { classifyBankMovement } from "../classifiers/bankMovementClassifier.mjs";
import { bankMovementFingerprint } from "../utils/importFingerprint.mjs";
import { resolveBankAccountForBncImport } from "./bncAccountResolve.mjs";
import { pool } from "../../db.mjs";
import {
  listFinanceCategoriesForBank,
  assertAllowedBankCategoryName,
  metaForManualBankCategoryFromDb,
} from "./financeCategoriesService.mjs";
import { listRulesForClassification } from "./bankClassificationRulesService.mjs";

export async function importBankExcel({
  filePath,
  sourceFile,
  bankAccountId,
}) {
  const extractedFour = extractBncAccountLastFour(filePath);
  const { bankAccountId: resolvedAccountId, resolution } =
    await resolveBankAccountForBncImport(bankAccountId, extractedFour);

  const movements = parseBncExcel(filePath);

  let classificationRules = [];
  try {
    classificationRules = await listRulesForClassification();
  } catch (err) {
    console.warn(
      "⚠️ Reglas de clasificación no cargadas (¿migración aplicada?):",
      err.message
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const batchRes = await client.query(
      `
      INSERT INTO finance_import_batches (
        import_type,
        bank_account_id,
        original_filename,
        rows_in_file,
        rows_inserted,
        rows_skipped_duplicate
      )
      VALUES ('bnc', $1, $2, $3, 0, 0)
      RETURNING id
      `,
      [resolvedAccountId, sourceFile, movements.length]
    );

    const importBatchId = batchRes.rows[0].id;

    const insertedMovements = [];
    let skippedDuplicate = 0;

    for (const movement of movements) {
      const classification = classifyBankMovement(movement, classificationRules);
      const importFingerprint = bankMovementFingerprint(
        resolvedAccountId,
        movement
      );

      const result = await client.query(
        `
        INSERT INTO finance_bank_movements (
          bank_account_id,
          movement_date,
          transaction_code,
          transaction_type,
          operation_type,
          description,
          reference,
          debit_bs,
          credit_bs,
          balance_bs,
          category,
          subcategory,
          movement_type,
          source_file,
          raw_data,
          import_fingerprint,
          import_batch_id
        )
        VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,
          $16,$17
        )
        ON CONFLICT (bank_account_id, import_fingerprint) DO NOTHING
        RETURNING *
        `,
        [
          resolvedAccountId,
          movement.movement_date || null,
          movement.transaction_code || null,
          movement.transaction_type || null,
          movement.operation_type || null,
          movement.description || null,
          movement.reference || null,
          movement.debit_bs || 0,
          movement.credit_bs || 0,
          movement.balance_bs || 0,
          classification.category,
          classification.subcategory,
          classification.movement_type,
          sourceFile,
          movement.raw_data,
          importFingerprint,
          importBatchId,
        ]
      );

      if (result.rowCount === 0) {
        skippedDuplicate += 1;
      } else {
        insertedMovements.push(result.rows[0]);
      }
    }

    await client.query(
      `
      UPDATE finance_import_batches
      SET rows_inserted = $1,
          rows_skipped_duplicate = $2
      WHERE id = $3
      `,
      [insertedMovements.length, skippedDuplicate, importBatchId]
    );

    await client.query("COMMIT");

    return {
      importBatchId,
      totalInFile: movements.length,
      inserted: insertedMovements.length,
      skippedDuplicate,
      movements: insertedMovements,
      accountResolution: resolution,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listBankImportBatches({ limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

  const { rows } = await pool.query(
    `
    SELECT
      id,
      import_type,
      bank_account_id,
      original_filename,
      rows_in_file,
      rows_inserted,
      rows_skipped_duplicate,
      created_at
    FROM finance_import_batches
    WHERE import_type = 'bnc'
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [safeLimit]
  );

  return rows;
}

export async function listMovementsByBankAccountId(
  bankAccountId,
  { limit = 8000 } = {}
) {
  const accId = Number(bankAccountId);
  if (!Number.isFinite(accId) || accId <= 0) {
    return [];
  }
  const safeLimit = Math.min(Math.max(Number(limit) || 8000, 1), 25000);

  /** Solo movimientos de lotes BNC que siguen existiendo (alineado con «Cargar excel»). */
  const { rows } = await pool.query(
    `
    SELECT
      m.id,
      m.bank_account_id,
      m.movement_date,
      m.transaction_code,
      m.transaction_type,
      m.operation_type,
      m.description,
      m.reference,
      m.debit_bs,
      m.credit_bs,
      m.balance_bs,
      m.category,
      m.subcategory,
      m.movement_type,
      m.source_file,
      m.import_batch_id,
      m.raw_data
    FROM finance_bank_movements m
    INNER JOIN finance_import_batches b
      ON b.id = m.import_batch_id AND b.import_type = 'bnc'
    WHERE m.bank_account_id = $1
    ORDER BY m.movement_date ASC NULLS LAST, m.id ASC
    LIMIT $2
    `,
    [accId, safeLimit]
  );

  return rows;
}

export async function listMovementsByBatchId(batchId) {
  const id = Number(batchId);
  if (!Number.isFinite(id)) {
    return [];
  }

  const { rows } = await pool.query(
    `
    SELECT
      id,
      bank_account_id,
      movement_date,
      transaction_code,
      transaction_type,
      operation_type,
      description,
      reference,
      debit_bs,
      credit_bs,
      balance_bs,
      category,
      subcategory,
      movement_type,
      source_file,
      import_batch_id,
      raw_data
    FROM finance_bank_movements
    WHERE import_batch_id = $1
    ORDER BY movement_date ASC NULLS LAST, id ASC
    `,
    [id]
  );

  return rows;
}

/**
 * Re-runs rule-based + heuristic classification for all movements of an account
 * (same logic as BNC import). Overwrites category / subcategory / movement_type in DB.
 */
export async function reapplyBankClassificationToAccount(bankAccountId) {
  const accId = Number(bankAccountId);
  if (!Number.isFinite(accId) || accId <= 0) {
    throw new Error("Cuenta inválida.");
  }

  const rules = await listRulesForClassification();
  const movements = await listMovementsByBankAccountId(accId, { limit: 25000 });

  const changes = [];
  for (const m of movements) {
    const c = classifyBankMovement(m, rules);
    const subOld =
      m.subcategory == null || m.subcategory === "" ? "—" : String(m.subcategory);
    const subNew =
      c.subcategory == null || c.subcategory === "" ? "—" : String(c.subcategory);
    const mtOld = String(m.movement_type || "").trim();
    const mtNew = String(c.movement_type || "").trim() || "unknown";
    if (
      String(c.category || "") !== String(m.category || "") ||
      subNew !== subOld ||
      mtNew !== mtOld
    ) {
      changes.push({
        id: m.id,
        category: String(c.category || ""),
        subcategory: subNew,
        movement_type: mtNew,
      });
    }
  }

  if (changes.length === 0) {
    return { scanned: movements.length, updated: 0 };
  }

  const client = await pool.connect();
  const CHUNK = 300;
  try {
    await client.query("BEGIN");
    for (let i = 0; i < changes.length; i += CHUNK) {
      const slice = changes.slice(i, i + CHUNK);
      await client.query(
        `
        UPDATE finance_bank_movements m
        SET category = j.category,
            subcategory = j.subcategory,
            movement_type = j.movement_type
        FROM jsonb_to_recordset($1::jsonb) AS j(
          id bigint,
          category text,
          subcategory text,
          movement_type text
        )
        WHERE m.id = j.id
        `,
        [JSON.stringify(slice)]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { scanned: movements.length, updated: changes.length };
}

export async function getBankMovementCategoryOptions() {
  return listFinanceCategoriesForBank();
}

export async function updateBankMovementCategory(movementId, category) {
  const id = Number(movementId);
  if (!Number.isFinite(id)) {
    throw new Error("ID de movimiento inválido.");
  }
  await assertAllowedBankCategoryName(category);
  const { subcategory, movement_type } = await metaForManualBankCategoryFromDb(
    category
  );

  const { rows } = await pool.query(
    `
    UPDATE finance_bank_movements
    SET category = $2,
        subcategory = $3,
        movement_type = $4
    WHERE id = $1
    RETURNING
      id,
      bank_account_id,
      movement_date,
      transaction_code,
      transaction_type,
      operation_type,
      description,
      reference,
      debit_bs,
      credit_bs,
      balance_bs,
      category,
      subcategory,
      movement_type,
      source_file,
      import_batch_id,
      raw_data
    `,
    [id, category, subcategory, movement_type]
  );

  if (rows.length === 0) {
    throw new Error("Movimiento no encontrado.");
  }

  return rows[0];
}

export async function reassignImportBatchAccount(batchId, newBankAccountId) {
  const id = Number(batchId);
  const accId = Number(newBankAccountId);
  if (!Number.isFinite(id) || !Number.isFinite(accId)) {
    throw new Error("Identificadores inválidos.");
  }

  const accOk = await pool.query(
    `
    SELECT id FROM finance_bank_accounts
    WHERE id = $1 AND is_active = true
    `,
    [accId]
  );
  if (accOk.rows.length === 0) {
    throw new Error("Cuenta bancaria no encontrada o inactiva.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const batchRow = await client.query(
      `
      SELECT id, bank_account_id
      FROM finance_import_batches
      WHERE id = $1 AND import_type = 'bnc'
      `,
      [id]
    );

    if (batchRow.rows.length === 0) {
      await client.query("ROLLBACK");
      throw new Error("Lote no encontrado.");
    }

    if (Number(batchRow.rows[0].bank_account_id) === accId) {
      await client.query("COMMIT");
      return {
        batchId: id,
        bankAccountId: accId,
        movementsUpdated: 0,
        unchanged: true,
      };
    }

    await client.query(
      `
      UPDATE finance_import_batches
      SET bank_account_id = $1
      WHERE id = $2
      `,
      [accId, id]
    );

    const moved = await client.query(
      `
      UPDATE finance_bank_movements
      SET bank_account_id = $1
      WHERE import_batch_id = $2
      `,
      [accId, id]
    );

    await client.query("COMMIT");

    return {
      batchId: id,
      bankAccountId: accId,
      movementsUpdated: moved.rowCount,
      unchanged: false,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      throw new Error(
        "No se pudo cambiar la cuenta: algún movimiento duplicaría un registro ya existente en la cuenta destino. Prueba otra cuenta o revisa duplicados."
      );
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteBankImportBatch(batchId) {
  const id = Number(batchId);
  if (!Number.isFinite(id)) return false;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const batchCheck = await client.query(
      `
      SELECT id FROM finance_import_batches
      WHERE id = $1 AND import_type = 'bnc'
      `,
      [id]
    );

    if (batchCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query(
      `DELETE FROM finance_bank_movements WHERE import_batch_id = $1`,
      [id]
    );

    await client.query(
      `DELETE FROM finance_import_batches WHERE id = $1`,
      [id]
    );

    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getBankSummaryByAccount({
  bankAccountId,
  dateFrom,
  dateTo,
}) {
  const params = [];
  let where = "WHERE 1=1";

  if (bankAccountId != null && bankAccountId !== "") {
    params.push(Number(bankAccountId));
    where += ` AND bank_account_id = $${params.length}`;
  }

  if (dateFrom) {
    params.push(dateFrom);
    where += ` AND movement_date >= $${params.length}`;
  }

  if (dateTo) {
    params.push(dateTo);
    where += ` AND movement_date <= $${params.length}`;
  }

  const { rows } = await pool.query(
    `
    SELECT
      COALESCE(category, 'Sin categoría') AS category,
      movement_type,
      COUNT(*)::int AS tx_count,
      COALESCE(SUM(credit_bs), 0)::numeric(18,2) AS total_credit_bs,
      COALESCE(SUM(debit_bs), 0)::numeric(18,2) AS total_debit_bs
    FROM finance_bank_movements
    ${where}
    GROUP BY 1, 2
    ORDER BY category, movement_type
    `,
    params
  );

  return rows;
}
