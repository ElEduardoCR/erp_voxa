-- ============================================================
-- SALUD FINANCIERA: evitar estados de cuenta duplicados
-- ============================================================
-- Guarda el hash del PDF para detectar si subes el mismo archivo
-- dos veces. La detección por periodo (tarjeta + fecha de corte)
-- se hace en el endpoint.

ALTER TABLE public.bank_statements
    ADD COLUMN IF NOT EXISTS file_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_statements_file_hash ON public.bank_statements (file_hash);
