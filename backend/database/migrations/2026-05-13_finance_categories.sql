-- Categorías editables para movimientos BNC (antes lista fija en código).

CREATE TABLE IF NOT EXISTS finance_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL UNIQUE,
  movement_type VARCHAR(20) NOT NULL
    CHECK (movement_type IN ('income', 'expense', 'transfer', 'unknown')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS finance_categories_sort_idx
  ON finance_categories (sort_order, name);

COMMENT ON TABLE finance_categories IS
  'Nombres de categoría para movimientos bancarios; debe coincidir con classifyBankMovement al importar.';

INSERT INTO finance_categories (name, movement_type, sort_order) VALUES
  ('Venta', 'income', 10),
  ('Comisión bancaria', 'expense', 20),
  ('Transferencia interna', 'transfer', 30),
  ('Gasto operativo', 'expense', 40),
  ('Ingreso por revisar', 'income', 50),
  ('Egreso por revisar', 'expense', 60),
  ('Sin clasificar', 'unknown', 70),
  ('Compra inventario', 'expense', 80),
  ('Nómina', 'expense', 90),
  ('Transferencia enviada por revisar', 'expense', 100)
ON CONFLICT (name) DO NOTHING;
