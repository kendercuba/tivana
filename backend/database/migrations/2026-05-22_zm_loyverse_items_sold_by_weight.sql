-- Loyverse export «Artículos»: columna «Vendido por peso» (Y/N).
-- Ejecutar en pgAdmin tras las migraciones de zm_loyverse_items.

ALTER TABLE zm_loyverse_items
  ADD COLUMN IF NOT EXISTS sold_by_weight BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN zm_loyverse_items.sold_by_weight IS
  'Export Loyverse «Vendido por peso»: true = Y (cantidad en kg), false = N (unidad).';
