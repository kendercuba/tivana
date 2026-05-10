-- Clasificación automática del reporte Loyverse (cabeceras del archivo).
ALTER TABLE finance_import_batches
  ADD COLUMN IF NOT EXISTS loyverse_detected_format TEXT;

COMMENT ON COLUMN finance_import_batches.loyverse_detected_format IS
  'Loyverse: daily_summary | by_payment | by_item (según cabeceras al importar).';
