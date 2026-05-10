-- Importaciones incrementales: huella por fila para no duplicar al solapar rangos de fechas.
-- Ejecutar en la base de datos de Tivana (psql, DBeaver, etc.).

-- === Banco (BNC) ===
ALTER TABLE finance_bank_movements
  ADD COLUMN IF NOT EXISTS import_fingerprint VARCHAR(64);

-- Evita duplicados por cuenta + huella (filas antiguas con NULL en huella no entran en el índice único en PG estándar)
CREATE UNIQUE INDEX IF NOT EXISTS finance_bank_movements_dedup_uidx
  ON finance_bank_movements (bank_account_id, import_fingerprint);

-- === Loyverse (resúmenes, pagos, líneas de artículo) ===
CREATE TABLE IF NOT EXISTS finance_loyverse_facts (
  id                    BIGSERIAL PRIMARY KEY,
  fact_type             TEXT NOT NULL,
  business_date         DATE,
  payment_method        TEXT,
  item_name             TEXT,
  sku                   TEXT,
  qty_sold              NUMERIC(18, 4),
  gross_sales           NUMERIC(18, 4),
  net_sales             NUMERIC(18, 4),
  gross_profit          NUMERIC(18, 4),
  transactions_count    INTEGER,
  source_file           TEXT,
  sheet_name            TEXT,
  raw_row               JSONB,
  import_fingerprint    VARCHAR(64) NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT finance_loyverse_facts_fingerprint_uidx UNIQUE (import_fingerprint)
);

CREATE INDEX IF NOT EXISTS finance_loyverse_facts_date_idx
  ON finance_loyverse_facts (business_date);

CREATE INDEX IF NOT EXISTS finance_loyverse_facts_type_idx
  ON finance_loyverse_facts (fact_type);
