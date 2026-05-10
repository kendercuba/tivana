-- Reglas por código de transacción (+ filtros opcionales) → categoría / subcategoría.
-- Requiere finance_categories y la tabla finance_categories del migration anterior.

CREATE TABLE IF NOT EXISTS finance_bank_classification_rules (
  id SERIAL PRIMARY KEY,
  sort_order INT NOT NULL DEFAULT 0,
  transaction_code VARCHAR(32) NOT NULL,
  match_transaction_type VARCHAR(120) NOT NULL DEFAULT '',
  match_operation_type VARCHAR(240) NOT NULL DEFAULT '',
  category_name VARCHAR(160) NOT NULL,
  subcategory VARCHAR(160) NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_bank_rule_category
    FOREIGN KEY (category_name)
    REFERENCES finance_categories(name)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS finance_bank_rules_sort_idx
  ON finance_bank_classification_rules (sort_order ASC, id ASC);

CREATE INDEX IF NOT EXISTS finance_bank_rules_code_idx
  ON finance_bank_classification_rules (transaction_code);

COMMENT ON TABLE finance_bank_classification_rules IS
  'Prioridad: sort_order ascendente. Filtros vacíos = no aplican. Comparación sin acentos y sin distinguir mayúsculas.';
