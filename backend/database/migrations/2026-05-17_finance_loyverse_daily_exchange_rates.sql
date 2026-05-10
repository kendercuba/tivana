-- Tasa del día (Bs por USD u otra convención): editable por fecha de negocio.
CREATE TABLE IF NOT EXISTS finance_loyverse_daily_exchange_rates (
  business_date DATE PRIMARY KEY,
  rate_bs                  NUMERIC(18, 6),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS finance_loyverse_daily_rates_updated_idx
  ON finance_loyverse_daily_exchange_rates (updated_at DESC);

COMMENT ON TABLE finance_loyverse_daily_exchange_rates IS
  'Tasa diaria en bolívares asociada al día de venta (Loyverse resumen).';
