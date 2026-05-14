-- Gastos manuales Zona Market + vínculo opcional a movimiento bancario (conciliación por referencia/monto).
-- Ejecutar en pgAdmin tras finance_bank_accounts y finance_bank_movements.

CREATE TABLE IF NOT EXISTS finance_zm_manual_expenses (
  id                    BIGSERIAL PRIMARY KEY,
  expense_date          DATE NOT NULL,
  amount_bs             NUMERIC(18, 2) NOT NULL,
  concept               TEXT NOT NULL,
  category              TEXT NOT NULL,
  notes                 TEXT,
  bank_account_id       INTEGER REFERENCES finance_bank_accounts (id) ON DELETE SET NULL,
  bank_reference        TEXT,
  matched_movement_id   BIGINT REFERENCES finance_bank_movements (id) ON DELETE SET NULL,
  match_status          TEXT NOT NULL DEFAULT 'pendiente',
  match_note            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT finance_zm_manual_expenses_amount_chk
    CHECK (amount_bs >= 0),
  CONSTRAINT finance_zm_manual_expenses_match_status_chk
    CHECK (
      match_status IN ('pendiente', 'emparejado', 'sin_coincidencia', 'ambigua')
    )
);

CREATE INDEX IF NOT EXISTS finance_zm_manual_expenses_date_idx
  ON finance_zm_manual_expenses (expense_date DESC);

CREATE INDEX IF NOT EXISTS finance_zm_manual_expenses_bank_account_idx
  ON finance_zm_manual_expenses (bank_account_id);

CREATE INDEX IF NOT EXISTS finance_zm_manual_expenses_match_movement_idx
  ON finance_zm_manual_expenses (matched_movement_id)
  WHERE matched_movement_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS finance_zm_manual_expenses_one_expense_per_movement_uidx
  ON finance_zm_manual_expenses (matched_movement_id)
  WHERE matched_movement_id IS NOT NULL;

COMMENT ON TABLE finance_zm_manual_expenses IS
  'Gastos registrados a mano; bank_reference + amount_bs + expense_date se usan para emparejar con finance_bank_movements.';
