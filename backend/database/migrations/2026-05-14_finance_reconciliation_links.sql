-- Vínculos manuales compra (línea OC ZM) ↔ movimiento banco (débito).
-- Ejecutar en pgAdmin tras finance_bank_movements y finance_zm_purchase_order_lines.

CREATE TABLE IF NOT EXISTS finance_reconciliation_links (
  id                  BIGSERIAL PRIMARY KEY,
  workspace           TEXT NOT NULL DEFAULT 'zm_purchase',
  bank_movement_id    BIGINT NOT NULL REFERENCES finance_bank_movements (id) ON DELETE CASCADE,
  zm_po_line_id       BIGINT NOT NULL REFERENCES finance_zm_purchase_order_lines (id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT finance_reconciliation_links_workspace_chk
    CHECK (workspace = 'zm_purchase'),
  CONSTRAINT finance_reconciliation_links_bank_uk UNIQUE (bank_movement_id)
);

CREATE INDEX IF NOT EXISTS finance_reconciliation_links_po_idx
  ON finance_reconciliation_links (zm_po_line_id);

COMMENT ON TABLE finance_reconciliation_links IS
  'Conciliación manual: un movimiento bancario (débito) enlazado a una línea de orden de compra ZM.';
