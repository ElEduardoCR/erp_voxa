-- ============================================================
-- SALUD FINANCIERA
-- ============================================================
-- Estados de cuenta de tarjetas (crédito/débito) leídos con IA,
-- movimientos clasificados, y préstamos capturados a mano.

-- Tarjetas / cuentas
CREATE TABLE IF NOT EXISTS public.financial_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,                 -- ej. "BBVA Oro", "Amex Gold"
    type TEXT NOT NULL DEFAULT 'credit' CHECK (type IN ('credit', 'debit')),
    bank TEXT,
    last4 TEXT,
    cut_day INTEGER,                    -- día de corte (1-31)
    credit_limit NUMERIC(14,2),
    color TEXT,                         -- acento opcional para la UI
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Estados de cuenta (uno por tarjeta por periodo)
CREATE TABLE IF NOT EXISTS public.bank_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
    period_label TEXT,                  -- ej. "Junio 2026"
    statement_date DATE,                -- fecha de corte
    due_date DATE,                      -- fecha límite de pago
    previous_balance NUMERIC(14,2),
    new_balance NUMERIC(14,2),          -- saldo / deuda al corte
    minimum_payment NUMERIC(14,2),
    no_interest_payment NUMERIC(14,2),  -- pago para no generar intereses
    credit_limit NUMERIC(14,2),
    total_income NUMERIC(14,2),
    total_expense NUMERIC(14,2),
    bank TEXT,
    last4 TEXT,
    file_url TEXT,
    file_name TEXT,
    raw JSONB,                          -- salida completa de la IA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Movimientos clasificados
CREATE TABLE IF NOT EXISTS public.statement_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id UUID REFERENCES public.bank_statements(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
    tx_date DATE,
    description TEXT,
    amount NUMERIC(14,2),               -- siempre positivo
    type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income', 'payment')),
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Préstamos capturados a mano
CREATE TABLE IF NOT EXISTS public.loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lender TEXT NOT NULL,               -- a quién / institución
    description TEXT,
    principal NUMERIC(14,2),            -- monto original
    balance NUMERIC(14,2),              -- saldo actual
    monthly_payment NUMERIC(14,2),
    next_payment_date DATE,
    interest_rate NUMERIC(6,2),         -- % anual
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_statements_account ON public.bank_statements (account_id);
CREATE INDEX IF NOT EXISTS idx_statements_date ON public.bank_statements (statement_date);
CREATE INDEX IF NOT EXISTS idx_tx_statement ON public.statement_transactions (statement_id);
CREATE INDEX IF NOT EXISTS idx_tx_account ON public.statement_transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_tx_category ON public.statement_transactions (category);
CREATE INDEX IF NOT EXISTS idx_tx_type ON public.statement_transactions (type);

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all financial_accounts" ON public.financial_accounts;
CREATE POLICY "Allow all financial_accounts" ON public.financial_accounts FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all bank_statements" ON public.bank_statements;
CREATE POLICY "Allow all bank_statements" ON public.bank_statements FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all statement_transactions" ON public.statement_transactions;
CREATE POLICY "Allow all statement_transactions" ON public.statement_transactions FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all loans" ON public.loans;
CREATE POLICY "Allow all loans" ON public.loans FOR ALL USING (true) WITH CHECK (true);
