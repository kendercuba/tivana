-- Coincidencia automática en import BNC: últimos dígitos como en el Excel (ej. ***3923 → 3923).
ALTER TABLE finance_bank_accounts
  ADD COLUMN IF NOT EXISTS bnc_last_four VARCHAR(4);

COMMENT ON COLUMN finance_bank_accounts.bnc_last_four IS
  'Últimos 4 dígitos del Nro. Cuenta en el estado BNC (mismo valor que ***XXXX en el Excel).';
