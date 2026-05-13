-- =============================================================================
-- ZONA MARKET — Pasar de la tabla ANCHA a la tabla REDUCIDA (solo lo que usas)
-- =============================================================================
--
-- Situación: ya ejecutaste el script viejo y tienes zm_loyverse_items con
-- muchas columnas (description, opciones, cost, available_for_sale, etc.).
--
-- Qué hace ESTE script:
--   1) BORRA solo la tabla zm_loyverse_items (y sus índices).
--   2) La vuelve a CREAR con las columnas mínimas que usa el backend ahora.
--
-- NO borra zm_loyverse_item_imports (sigue el historial de “cuándo importaste”).
--
-- IMPORTANTE: se pierden las FILAS de artículos que hubiera en zm_loyverse_items.
-- Después de ejecutarlo, vuelve a subir el CSV/Excel desde la web.
--
-- No hace falta “eliminar columnas una a una”: en PostgreSQL lo más limpio es
-- borrar la tabla y crearla otra vez con la forma nueva.
-- =============================================================================

DROP TABLE IF EXISTS zm_loyverse_items CASCADE;

CREATE TABLE zm_loyverse_items (
  id                  BIGSERIAL PRIMARY KEY,
  handle              TEXT NOT NULL,
  item_ref            TEXT,
  name                TEXT,
  category_name       TEXT,
  price               NUMERIC(18, 6),
  purchase_cost       NUMERIC(18, 6),
  quantity_on_hand    NUMERIC(18, 6),
  low_stock_threshold NUMERIC(18, 6),
  optimal_stock       NUMERIC(18, 6),
  barcode             TEXT,
  last_import_id      BIGINT REFERENCES zm_loyverse_item_imports (id) ON DELETE SET NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT zm_loyverse_items_handle_unique UNIQUE (handle)
);

CREATE INDEX IF NOT EXISTS zm_loyverse_items_category_idx
  ON zm_loyverse_items (category_name);

CREATE INDEX IF NOT EXISTS zm_loyverse_items_last_import_idx
  ON zm_loyverse_items (last_import_id);

COMMENT ON TABLE zm_loyverse_items IS
  'Artículos Loyverse (Zona Market): columnas mínimas tras cada importación.';

COMMENT ON COLUMN zm_loyverse_items.handle IS
  'Slug Loyverse; obligatorio para identificar filas entre cargas diarias.';
COMMENT ON COLUMN zm_loyverse_items.item_ref IS 'Columna REF del export.';
COMMENT ON COLUMN zm_loyverse_items.price IS 'Precio de venta [tienda] del export.';
COMMENT ON COLUMN zm_loyverse_items.purchase_cost IS 'Solo columna «Coste» del export Loyverse (no «Costo de compra»).';
COMMENT ON COLUMN zm_loyverse_items.quantity_on_hand IS 'En inventario [tienda] del export.';
COMMENT ON COLUMN zm_loyverse_items.low_stock_threshold IS 'Existencias bajas [tienda] del export.';
COMMENT ON COLUMN zm_loyverse_items.optimal_stock IS 'Stock óptimo [tienda] del export.';
