-- Zona Market: inventario desde export «Artículos» Loyverse (solo columnas usadas).
-- El Excel/CSV puede traer más columnas; el backend solo lee las mapeadas aquí.
-- Se mantiene `handle` (slug Loyverse) como clave única para actualizar en cada importación.

CREATE TABLE IF NOT EXISTS zm_loyverse_item_imports (
  id              BIGSERIAL PRIMARY KEY,
  imported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_filename TEXT,
  row_count       INTEGER NOT NULL DEFAULT 0,
  store_suffix    TEXT
);

COMMENT ON TABLE zm_loyverse_item_imports IS
  'Auditoría de cada carga del reporte de artículos Loyverse (Zona Market).';

CREATE TABLE IF NOT EXISTS zm_loyverse_items (
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
  'Artículos Loyverse (Zona Market): columnas mínimas persistidas tras cada importación.';

COMMENT ON COLUMN zm_loyverse_items.handle IS
  'Slug Loyverse; obligatorio para identificar filas entre cargas diarias.';
COMMENT ON COLUMN zm_loyverse_items.item_ref IS 'Columna REF del export.';
COMMENT ON COLUMN zm_loyverse_items.price IS 'Precio de venta [tienda] del export.';
COMMENT ON COLUMN zm_loyverse_items.purchase_cost IS 'Solo columna «Coste» del export Loyverse (no «Costo de compra»).';
COMMENT ON COLUMN zm_loyverse_items.quantity_on_hand IS 'En inventario [tienda] del export.';
COMMENT ON COLUMN zm_loyverse_items.low_stock_threshold IS 'Existencias bajas [tienda] del export.';
COMMENT ON COLUMN zm_loyverse_items.optimal_stock IS 'Stock óptimo [tienda] del export.';
