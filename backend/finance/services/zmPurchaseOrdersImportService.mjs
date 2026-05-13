import { parseZmPurchaseOrdersFile } from "../parsers/zmPurchaseOrdersParser.mjs";
import { loyverseRowFingerprint } from "../utils/importFingerprint.mjs";
import {
  sanitizeRawRowForJsonb,
  toJsonbParam,
} from "../utils/sanitizeForJsonb.mjs";
import { pool } from "../../db.mjs";

function buildPreviewPayload(lines, sourceFile, maxRows = 400) {
  const slice = lines.slice(0, maxRows);
  return {
    rows: slice.map((line) => ({
      business_date: line.business_date,
      po_number: line.po_number,
      ref_code: line.ref_code,
      item_name: line.item_name,
      variant_name: line.variant_name,
      barcode: line.barcode,
      quantity: line.quantity,
      unit_cost: line.unit_cost,
      line_total: line.line_total,
      source_file: sourceFile,
      raw_row: sanitizeRawRowForJsonb(line.raw_row),
    })),
  };
}

function fingerprintForLine(line, sourceFile) {
  return loyverseRowFingerprint([
    "zm_po_line",
    line.business_date || "",
    line.po_number || "",
    line.ref_code || "",
    line.item_name || "",
    line.variant_name || "",
    line.barcode || "",
    String(line.quantity ?? ""),
    String(line.unit_cost ?? ""),
    String(line.line_total ?? ""),
    sourceFile || "",
  ]);
}

export async function importZmPurchaseOrdersFile({
  filePath,
  sourceFile,
}) {
  const { lines, parseError } = parseZmPurchaseOrdersFile(
    filePath,
    sourceFile
  );

  if (parseError) {
    return {
      importBatchId: null,
      totalInFile: 0,
      inserted: 0,
      skippedDuplicate: 0,
      rows: [],
      parseError,
    };
  }

  const previewJsonText = toJsonbParam(
    buildPreviewPayload(lines, sourceFile)
  );

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
      VALUES ('zm_purchase_orders', NULL, $1, $2, 0, 0, CAST($3 AS JSONB), NULL)
      RETURNING id
      `,
      [sourceFile, lines.length, previewJsonText]
    );

    const importBatchId = batchRes.rows[0].id;
    const insertedRows = [];
    let skippedDuplicate = 0;

    for (const line of lines) {
      const importFingerprint = fingerprintForLine(line, sourceFile);

      const result = await client.query(
        `
        INSERT INTO finance_zm_purchase_order_lines (
          import_batch_id,
          business_date,
          po_number,
          ref_code,
          item_name,
          variant_name,
          barcode,
          quantity,
          unit_cost,
          line_total,
          source_file,
          raw_row,
          import_fingerprint
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (import_fingerprint) DO NOTHING
        RETURNING *
        `,
        [
          importBatchId,
          line.business_date,
          line.po_number,
          line.ref_code,
          line.item_name,
          line.variant_name,
          line.barcode,
          line.quantity,
          line.unit_cost,
          line.line_total,
          sourceFile,
          sanitizeRawRowForJsonb(line.raw_row),
          importFingerprint,
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
      totalInFile: lines.length,
      inserted: insertedRows.length,
      skippedDuplicate,
      rows: insertedRows,
      parseError: null,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listZmPurchaseOrderBatches({ limit = 100 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 300);

  const { rows } = await pool.query(
    `
    SELECT
      b.id,
      b.import_type,
      b.bank_account_id,
      b.original_filename,
      b.rows_in_file,
      b.rows_inserted,
      b.rows_skipped_duplicate,
      b.loyverse_detected_format,
      b.created_at,
      dr.data_date_min,
      dr.data_date_max
    FROM finance_import_batches b
    LEFT JOIN (
      SELECT
        import_batch_id,
        MIN(business_date)::text AS data_date_min,
        MAX(business_date)::text AS data_date_max
      FROM finance_zm_purchase_order_lines
      WHERE import_batch_id IS NOT NULL
      GROUP BY import_batch_id
    ) dr ON dr.import_batch_id = b.id
    WHERE b.import_type = 'zm_purchase_orders'
    ORDER BY b.created_at DESC
    LIMIT $1
    `,
    [safeLimit]
  );

  return rows;
}

export async function listZmPurchaseOrderLinesByBatchId(
  batchId,
  { limit = 500 } = {}
) {
  const id = Number(batchId);
  if (!Number.isFinite(id)) return [];

  const safeLimit = Math.min(Math.max(Number(limit) || 500, 1), 5000);

  const batchPeek = await pool.query(
    `
    SELECT preview_payload
    FROM finance_import_batches
    WHERE id = $1 AND import_type = 'zm_purchase_orders'
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
      : [];

  if (snapshotRows.length > 0) {
    const sliced = snapshotRows.slice(0, safeLimit);
    return sliced.map((row) => ({
      id: null,
      business_date: row.business_date ?? null,
      po_number: row.po_number ?? null,
      ref_code: row.ref_code ?? null,
      item_name: row.item_name ?? null,
      variant_name: row.variant_name ?? null,
      barcode: row.barcode ?? null,
      quantity: row.quantity ?? null,
      unit_cost: row.unit_cost ?? null,
      line_total: row.line_total ?? null,
      source_file: row.source_file ?? null,
      raw_row: row.raw_row ?? null,
      import_batch_id: id,
      created_at: null,
      article_sold_by_weight: null,
      _previewFromFileSnapshot: true,
    }));
  }

  const { rows } = await pool.query(
    `
    SELECT
      l.id,
      l.import_batch_id,
      l.business_date,
      l.po_number,
      l.ref_code,
      l.item_name,
      l.variant_name,
      l.barcode,
      l.quantity,
      l.unit_cost,
      l.line_total,
      l.source_file,
      l.raw_row,
      l.created_at,
      art.sold_by_weight AS article_sold_by_weight
    FROM finance_zm_purchase_order_lines l
    LEFT JOIN LATERAL (
      SELECT z.sold_by_weight
      FROM zm_loyverse_items z
      WHERE z.item_ref IS NOT NULL
        AND l.ref_code IS NOT NULL
        AND btrim(l.ref_code::text) <> ''
        AND (
          z.item_ref = btrim(l.ref_code::text)
          OR (
            z.item_ref ~ '^[0-9]+$'
            AND btrim(l.ref_code::text) ~ '^[0-9]+$'
            AND (z.item_ref::bigint = (btrim(l.ref_code::text))::bigint)
          )
        )
      ORDER BY z.updated_at DESC NULLS LAST
      LIMIT 1
    ) art ON true
    WHERE l.import_batch_id = $1
    ORDER BY l.business_date ASC NULLS LAST, l.id ASC
    LIMIT $2
    `,
    [id, safeLimit]
  );

  return rows;
}

export async function getZmPurchaseOrderDateBounds() {
  const { rows } = await pool.query(
    `
    SELECT
      MIN(l.business_date)::text AS data_date_min,
      MAX(l.business_date)::text AS data_date_max
    FROM finance_zm_purchase_order_lines l
    INNER JOIN finance_import_batches b
      ON b.id = l.import_batch_id AND b.import_type = 'zm_purchase_orders'
    `
  );
  return rows[0] || { data_date_min: null, data_date_max: null };
}

/**
 * @param {{ startYmd: string, endYmd: string, limit?: number }} range
 */
export async function listZmPurchaseOrderLinesInDateRange({
  startYmd,
  endYmd,
  limit = 20000,
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20000, 1), 50000);
  const lo = String(startYmd || "").slice(0, 10);
  const hi = String(endYmd || "").slice(0, 10);
  if (!lo || !hi) return [];

  const { rows } = await pool.query(
    `
    SELECT
      l.id,
      l.import_batch_id,
      l.business_date,
      l.po_number,
      l.ref_code,
      l.item_name,
      l.variant_name,
      l.barcode,
      l.quantity,
      l.unit_cost,
      l.line_total,
      l.source_file,
      l.raw_row,
      l.created_at,
      art.sold_by_weight AS article_sold_by_weight
    FROM finance_zm_purchase_order_lines l
    INNER JOIN finance_import_batches b
      ON b.id = l.import_batch_id AND b.import_type = 'zm_purchase_orders'
    LEFT JOIN LATERAL (
      SELECT z.sold_by_weight
      FROM zm_loyverse_items z
      WHERE z.item_ref IS NOT NULL
        AND l.ref_code IS NOT NULL
        AND btrim(l.ref_code::text) <> ''
        AND (
          z.item_ref = btrim(l.ref_code::text)
          OR (
            z.item_ref ~ '^[0-9]+$'
            AND btrim(l.ref_code::text) ~ '^[0-9]+$'
            AND (z.item_ref::bigint = (btrim(l.ref_code::text))::bigint)
          )
        )
      ORDER BY z.updated_at DESC NULLS LAST
      LIMIT 1
    ) art ON true
    WHERE l.business_date >= $1::date AND l.business_date <= $2::date
    ORDER BY l.business_date DESC, l.id DESC
    LIMIT $3
    `,
    [lo, hi, safeLimit]
  );

  return rows;
}

export async function deleteZmPurchaseOrderBatch(batchId) {
  const id = Number(batchId);
  if (!Number.isFinite(id)) return false;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const batchCheck = await client.query(
      `
      SELECT id FROM finance_import_batches
      WHERE id = $1 AND import_type = 'zm_purchase_orders'
      `,
      [id]
    );

    if (batchCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query(
      `DELETE FROM finance_zm_purchase_order_lines WHERE import_batch_id = $1`,
      [id]
    );

    await client.query(`DELETE FROM finance_import_batches WHERE id = $1`, [
      id,
    ]);

    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
