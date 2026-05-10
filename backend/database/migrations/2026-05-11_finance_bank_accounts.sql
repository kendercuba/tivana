-- Cuentas bancarias editables (reemplaza nombres fijos en el front).
-- Ejecutar en pgAdmin sobre la base de Tivana.
--
-- Si la tabla ya existía sin algunas columnas, los ALTER siguientes la
-- completan (CREATE TABLE IF NOT EXISTS no modifica tablas viejas).

CREATE TABLE IF NOT EXISTS finance_bank_accounts (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  notes        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Completar columnas en tablas creadas antes (ej. sin sort_order)
ALTER TABLE finance_bank_accounts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE finance_bank_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE finance_bank_accounts ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE finance_bank_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE finance_bank_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Si en algún momento faltara la columna name (muy raro)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'finance_bank_accounts'
      AND column_name = 'name'
  ) THEN
    ALTER TABLE finance_bank_accounts ADD COLUMN name TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- Tres cuentas iniciales con los mismos IDs que ya usabas (1, 2, 3).
INSERT INTO finance_bank_accounts (id, name, sort_order, is_active)
VALUES
  (1, 'Cuenta Operativa BNC', 1, true),
  (2, 'Cuenta Punto de Venta BNC', 2, true),
  (3, 'Cuenta Reserva BNC', 3, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

SELECT setval(
  pg_get_serial_sequence('finance_bank_accounts', 'id'),
  COALESCE((SELECT MAX(id) FROM finance_bank_accounts), 1)
);
