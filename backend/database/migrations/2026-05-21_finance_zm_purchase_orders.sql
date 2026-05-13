-- Órdenes de compra Zona Market: líneas importadas desde CSV/Excel (export tipo Loyverse compras).
-- Ejecutar en pgAdmin tras las migraciones de finance_import_batches.

-- Permitir tipo de importación en lotes
ALTER TABLE finance_import_batches
  DROP CONSTRAINT IF EXISTS finance_import_batches_type_chk;

ALTER TABLE finance_import_batches
  ADD CONSTRAINT finance_import_batches_type_chk
  CHECK (import_type IN ('bnc', 'loyverse', 'zm_purchase_orders'));

CREATE TABLE IF NOT EXISTS finance_zm_purchase_order_lines (
  id                      BIGSERIAL PRIMARY KEY,
  import_batch_id         BIGINT NOT NULL REFERENCES finance_import_batches (id) ON DELETE CASCADE,
  business_date           DATE NOT NULL,
  po_number               TEXT,
  ref_code                TEXT,
  item_name               TEXT NOT NULL,
  variant_name            TEXT,
  barcode                 TEXT,
  quantity                NUMERIC(18, 6) NOT NULL,
  unit_cost               NUMERIC(18, 6) NOT NULL,
  line_total              NUMERIC(18, 6) NOT NULL,
  source_file             TEXT NOT NULL,
  raw_row                 JSONB,
  import_fingerprint      TEXT NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT finance_zm_po_lines_fingerprint_uk UNIQUE (import_fingerprint)
);

CREATE INDEX IF NOT EXISTS finance_zm_po_lines_batch_idx
  ON finance_zm_purchase_order_lines (import_batch_id);

CREATE INDEX IF NOT EXISTS finance_zm_po_lines_date_idx
  ON finance_zm_purchase_order_lines (business_date DESC);

CREATE INDEX IF NOT EXISTS finance_zm_po_lines_po_idx
  ON finance_zm_purchase_order_lines (po_number)
  WHERE po_number IS NOT NULL AND po_number <> '';
