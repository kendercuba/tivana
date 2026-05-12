import { parseLoyverseExcel } from "../parsers/loyverseExcelParser.mjs";
import { loyverseRowFingerprint } from "../utils/importFingerprint.mjs";
import {
  sanitizeRawRowForJsonb,
  toJsonbParam,
} from "../utils/sanitizeForJsonb.mjs";
import { pool } from "../../db.mjs";

/**
 * Instantánea para la columna JSONB (previsualización).
 * Debe ser un objeto raíz, no un array: `pg` serializa los arrays JS como literales
 * PostgreSQL `{...}`, no como JSON, y `$1::jsonb` falla con "invalid input syntax for json".
 */
function buildLoyversePreviewPayload(facts, sourceFile) {
  return {
    rows: facts.map((f) => {
      const row = {
        fact_type: f.fact_type,
        business_date: f.business_date ?? null,
        payment_method: f.payment_method ?? null,
        item_name: f.item_name ?? null,
        sku: f.sku ?? null,
        qty_sold: f.qty_sold ?? null,
        gross_sales: f.gross_sales ?? null,
        net_sales: f.net_sales ?? null,
        gross_profit: f.gross_profit ?? null,
        refunds: f.refunds ?? null,
        discounts: f.discounts ?? null,
        taxes: f.taxes ?? null,
        margin_pct: f.margin_pct ?? null,
        cost_goods: f.cost_goods ?? null,
        transactions_count: f.transactions_count ?? null,
        source_file: sourceFile,
        sheet_name: f.sheet_name ?? null,
      };
      if (f.fact_type === "payment_breakdown") {
        row.payment_type_label = f.payment_type_label ?? null;
        row.payment_refund_txn_count = f.payment_refund_txn_count ?? null;
        row.payment_refund_amount = f.payment_refund_amount ?? null;
        row.raw_row = sanitizeRawRowForJsonb(f.raw_row);
      }
      return row;
    }),
  };
}

function fingerprintForFact(fact, sourceFile) {
  if (fact.fact_type === "daily_summary") {
    return loyverseRowFingerprint([
      "daily_summary",
      fact.business_date || "",
      fact.net_sales ?? "",
      fact.gross_sales ?? "",
      fact.gross_profit ?? "",
      fact.transactions_count ?? "",
    ]);
  }

  if (fact.fact_type === "payment_breakdown") {
    return loyverseRowFingerprint([
      "payment_breakdown",
      fact.business_date || "",
      fact.payment_method || "",
      fact.net_sales ?? "",
      fact.gross_sales ?? "",
      fact.transactions_count ?? "",
      sourceFile || "",
    ]);
  }

  if (fact.fact_type === "item_line") {
    return loyverseRowFingerprint([
      "item_line",
      fact.business_date || "",
      fact.sku || "",
      fact.item_name || "",
      fact.qty_sold ?? "",
      fact.net_sales ?? "",
      fact.gross_profit ?? "",
    ]);
  }

  return loyverseRowFingerprint([JSON.stringify(fact), sourceFile || ""]);
}

export async function importLoyverseExcel({
  filePath,
  sourceFile,
  reportHint = "auto",
}) {
  const { facts, detectedFormat, parseError } = parseLoyverseExcel(
    filePath,
    reportHint,
    sourceFile
  );

  if (parseError) {
    return {
      importBatchId: null,
      totalInFile: 0,
      inserted: 0,
      skippedDuplicate: 0,
      detectedFormat: detectedFormat || "by_payment",
      rows: [],
      parseError,
    };
  }
  /**
   * Importante: pasar JSON como **string** y castear a jsonb en SQL.
   * Si pasamos un objeto JS, `pg` puede volver a serializarlo de forma incompatible
   * con JSON (p. ej. arrays → formato array de Postgres `{...}`), y Postgres falla
   * con "invalid input syntax for type json".
   */
  const previewJsonText = toJsonbParam(buildLoyversePreviewPayload(facts, sourceFile));

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
        rows_skipped_duplicate,
        preview_payload,
        loyverse_detected_format
      )
      VALUES ('loyverse', NULL, $1, $2, 0, 0, CAST($3 AS JSONB), $4)
      RETURNING id
      `,
      [sourceFile, facts.length, previewJsonText, detectedFormat]
    );

    const importBatchId = batchRes.rows[0].id;

    const insertedRows = [];
    let skippedDuplicate = 0;

    for (const fact of facts) {
      const importFingerprint = fingerprintForFact(fact, sourceFile);

      const result = await client.query(
        `
        INSERT INTO finance_loyverse_facts (
          fact_type,
          business_date,
          payment_method,
          item_name,
          sku,
          qty_sold,
          gross_sales,
          net_sales,
          gross_profit,
          transactions_count,
          source_file,
          sheet_name,
          raw_row,
          import_fingerprint,
          import_batch_id
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
        )
        ON CONFLICT (import_fingerprint) DO NOTHING
        RETURNING *
        `,
        [
          fact.fact_type,
          fact.business_date || null,
          fact.payment_method || null,
          fact.item_name || null,
          fact.sku || null,
          fact.qty_sold,
          fact.gross_sales,
          fact.net_sales,
          fact.gross_profit,
          fact.transactions_count,
          sourceFile,
          fact.sheet_name || null,
          sanitizeRawRowForJsonb(fact.raw_row),
          importFingerprint,
          importBatchId,
        ]
      );

      if (result.rowCount === 0) {
        skippedDuplicate += 1;
      } else {
        insertedRows.push(result.rows[0]);
      }
    }

    await client.query(
      `
      UPDATE finance_import_batches
      SET rows_inserted = $1,
          rows_skipped_duplicate = $2
      WHERE id = $3
      `,
      [insertedRows.length, skippedDuplicate, importBatchId]
    );

    await client.query("COMMIT");

    return {
      importBatchId,
      totalInFile: facts.length,
      inserted: insertedRows.length,
      skippedDuplicate,
      detectedFormat,
      rows: insertedRows,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listLoyverseImportBatches({ limit = 100 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 300);

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
      loyverse_detected_format,
      created_at
    FROM finance_import_batches
    WHERE import_type = 'loyverse'
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [safeLimit]
  );

  return rows;
}

export async function listLoyverseFactsByBatchId(batchId, { limit = 500 } = {}) {
  const id = Number(batchId);
  if (!Number.isFinite(id)) return [];

  const safeLimit = Math.min(Math.max(Number(limit) || 500, 1), 5000);

  const batchPeek = await pool.query(
    `
    SELECT preview_payload
    FROM finance_import_batches
    WHERE id = $1 AND import_type = 'loyverse'
    `,
    [id]
  );

  if (batchPeek.rows.length === 0) return [];

  const snapshot = batchPeek.rows[0].preview_payload;
  const snapshotRows =
    snapshot &&
    typeof snapshot === "object" &&
    Array.isArray(snapshot.rows) &&
    snapshot.rows.length > 0
      ? snapshot.rows
      : Array.isArray(snapshot) && snapshot.length > 0
        ? snapshot
        : [];

  if (snapshotRows.length > 0) {
    const sliced = snapshotRows.slice(0, safeLimit);
    return sliced.map((row, i) => ({
      id: null,
      fact_type: row.fact_type ?? null,
      business_date: row.business_date ?? null,
      payment_method: row.payment_method ?? null,
      item_name: row.item_name ?? null,
      sku: row.sku ?? null,
      qty_sold: row.qty_sold ?? null,
      gross_sales: row.gross_sales ?? null,
      net_sales: row.net_sales ?? null,
      gross_profit: row.gross_profit ?? null,
      refunds: row.refunds ?? null,
      discounts: row.discounts ?? null,
      taxes: row.taxes ?? null,
      margin_pct: row.margin_pct ?? null,
      cost_goods: row.cost_goods ?? null,
      transactions_count: row.transactions_count ?? null,
      source_file: row.source_file ?? null,
      sheet_name: row.sheet_name ?? null,
      raw_row: row.raw_row ?? null,
      payment_type_label: row.payment_type_label ?? null,
      payment_refund_txn_count: row.payment_refund_txn_count ?? null,
      payment_refund_amount: row.payment_refund_amount ?? null,
      import_batch_id: id,
      created_at: null,
      _previewFromFileSnapshot: true,
    }));
  }

  const { rows } = await pool.query(
    `
    SELECT
      id,
      fact_type,
      business_date,
      payment_method,
      item_name,
      sku,
      qty_sold,
      gross_sales,
      net_sales,
      gross_profit,
      transactions_count,
      source_file,
      sheet_name,
      raw_row,
      import_batch_id,
      created_at
    FROM finance_loyverse_facts
    WHERE import_batch_id = $1
    ORDER BY business_date ASC NULLS LAST, id ASC
    LIMIT $2
    `,
    [id, safeLimit]
  );

  return rows;
}

/** Hechos ligados a lotes Loyverse existentes, filtrados por tipo (resumen diario / pago / etc.). */
export async function listLoyverseFactsByFactTypes(
  factTypes,
  { limit = 8000 } = {}
) {
  if (!Array.isArray(factTypes) || factTypes.length === 0) return [];

  const safeLimit = Math.min(Math.max(Number(limit) || 8000, 1), 50000);

  const { rows } = await pool.query(
    `
    SELECT
      f.id,
      f.fact_type,
      f.business_date,
      f.payment_method,
      f.item_name,
      f.sku,
      f.qty_sold,
      f.gross_sales,
      f.net_sales,
      f.gross_profit,
      f.transactions_count,
      f.source_file,
      f.sheet_name,
      f.raw_row,
      f.import_batch_id,
      f.created_at
    FROM finance_loyverse_facts f
    INNER JOIN finance_import_batches b
      ON b.id = f.import_batch_id AND b.import_type = 'loyverse'
    WHERE f.fact_type = ANY($1::text[])
    ORDER BY f.business_date DESC NULLS LAST, f.id DESC
    LIMIT $2
    `,
    [factTypes, safeLimit]
  );

  return rows;
}

export async function deleteLoyverseImportBatch(batchId) {
  const id = Number(batchId);
  if (!Number.isFinite(id)) return false;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const batchCheck = await client.query(
      `
      SELECT id FROM finance_import_batches
      WHERE id = $1 AND import_type = 'loyverse'
      `,
      [id]
    );

    if (batchCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query(
      `DELETE FROM finance_loyverse_facts WHERE import_batch_id = $1`,
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
