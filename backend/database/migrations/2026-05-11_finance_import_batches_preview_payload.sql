-- Instantánea del archivo parseado por lote (previsualización aunque todo sea duplicado).
ALTER TABLE finance_import_batches
  ADD COLUMN IF NOT EXISTS preview_payload JSONB;

COMMENT ON COLUMN finance_import_batches.preview_payload IS
  'JSON array: filas parseadas del archivo en el momento de la importación (Loyverse u otros).';
