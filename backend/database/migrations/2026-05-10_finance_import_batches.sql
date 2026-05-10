-- Historial de importaciones y vínculo con movimientos bancarios.
-- Ejecutar en pgAdmin: Query Tool → pegar todo → Execute (F5).
-- Si aún no existe finance_loyverse_facts, ejecuta antes 2026-05-09_finance_import_dedup_loyverse.sql
-- o ignora el bloque final de Loyverse si aún no usas esos reportes.

-- === Lotes de importación (cada vez que subes un Excel) ===
CREATE TABLE IF NOT EXISTS finance_import_batches (
  id                       BIGSERIAL PRIMARY KEY,
  import_type              TEXT NOT NULL,
  bank_account_id          INTEGER,
  original_filename        TEXT NOT NULL,
  rows_in_file             INTEGER NOT NULL DEFAULT 0,
  rows_inserted            INTEGER NOT NULL DEFAULT 0,
  rows_skipped_duplicate   INTEGER NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT finance_import_batches_type_chk
    CHECK (import_type IN ('bnc', 'loyverse'))
);

CREATE INDEX IF NOT EXISTS finance_import_batches_created_idx
  ON finance_import_batches (created_at DESC);

CREATE INDEX IF NOT EXISTS finance_import_batches_type_idx
  ON finance_import_batches (import_type);

-- === Enlazar movimientos BNC con el lote que los creó ===
ALTER TABLE finance_bank_movements
  ADD COLUMN IF NOT EXISTS import_batch_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'finance_bank_movements_import_batch_fk'
  ) THEN
    ALTER TABLE finance_bank_movements
      ADD CONSTRAINT finance_bank_movements_import_batch_fk
      FOREIGN KEY (import_batch_id)
      REFERENCES finance_import_batches (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS finance_bank_movements_batch_idx
  ON finance_bank_movements (import_batch_id);

-- === Loyverse (solo si la tabla ya existe) ===
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'finance_loyverse_facts'
  ) THEN
    ALTER TABLE finance_loyverse_facts
      ADD COLUMN IF NOT EXISTS import_batch_id BIGINT;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'finance_loyverse_facts_import_batch_fk'
    ) THEN
      ALTER TABLE finance_loyverse_facts
        ADD CONSTRAINT finance_loyverse_facts_import_batch_fk
        FOREIGN KEY (import_batch_id)
        REFERENCES finance_import_batches (id)
        ON DELETE SET NULL;
    END IF;

    CREATE INDEX IF NOT EXISTS finance_loyverse_facts_batch_idx
      ON finance_loyverse_facts (import_batch_id);
  END IF;
END $$;
