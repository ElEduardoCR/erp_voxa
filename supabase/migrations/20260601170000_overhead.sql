-- ============================================================
-- OVERHEAD / COSTOS INDIRECTOS
-- ============================================================
-- Catálogo global de costos indirectos (renta, sueldos, seguros, etc.)
-- que se reutiliza en cada cotización. En la cotización se guarda un
-- snapshot editable (overhead_config) y el total interno calculado
-- según la duración del proyecto. Es de uso INTERNO: no se cobra al
-- cliente ni aparece en el PDF.

CREATE TABLE IF NOT EXISTS public.overhead_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    -- periodo del costo: se normaliza a la duración del proyecto
    period TEXT NOT NULL DEFAULT 'month'
        CHECK (period IN ('year', 'month', 'week', 'day', 'hour', 'piece', 'project')),
    active BOOLEAN NOT NULL DEFAULT true,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.overhead_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all overhead_costs" ON public.overhead_costs;
CREATE POLICY "Allow all overhead_costs" ON public.overhead_costs FOR ALL USING (true) WITH CHECK (true);

-- Columnas de overhead en cotizaciones (uso interno)
ALTER TABLE public.quotations
    ADD COLUMN IF NOT EXISTS overhead_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS overhead_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS overhead_config JSONB;

-- Semilla del catálogo (solo si está vacío) con la lista completa del negocio.
-- Torno $60/hr, Sierra $20/hr y Empaque $50/pieza ya vienen cargados.
INSERT INTO public.overhead_costs (category, name, amount, period, active, sort)
SELECT * FROM (VALUES
    ('Renta y servicios', 'Renta mensual del taller', 0, 'month', true, 10),
    ('Renta y servicios', 'Luz (CFE)', 0, 'month', true, 11),
    ('Renta y servicios', 'Agua', 0, 'month', true, 12),
    ('Renta y servicios', 'Internet / teléfono', 0, 'month', true, 13),
    ('Renta y servicios', 'Gas (si aplica a algún proceso)', 0, 'month', false, 14),
    ('Mano de obra', 'Sueldo del operador (con prestaciones IMSS/INFONAVIT)', 0, 'month', true, 20),
    ('Mano de obra', 'Aguinaldo, vacaciones y prima (prorrateado)', 0, 'month', true, 21),
    ('Mano de obra', 'Personal administrativo o de apoyo', 0, 'month', false, 22),
    ('Máquina y equipo', 'Torno (por hora)', 60, 'hour', true, 30),
    ('Máquina y equipo', 'Sierra (por hora)', 20, 'hour', true, 31),
    ('Máquina y equipo', 'Mantenimiento preventivo', 0, 'month', true, 32),
    ('Máquina y equipo', 'Refrigerante / aceite soluble', 0, 'month', true, 33),
    ('Máquina y equipo', 'Aire comprimido (compresor)', 0, 'month', true, 34),
    ('Máquina y equipo', 'Depreciación de maquinaria', 0, 'month', false, 35),
    ('Herramienta y consumibles', 'Insertos, brocas, hojas de sierra (por lote)', 0, 'project', true, 40),
    ('Herramienta y consumibles', 'Refacciones menores (mordazas, boquillas)', 0, 'month', true, 41),
    ('Seguros y permisos', 'Seguro del local / maquinaria', 0, 'year', true, 50),
    ('Seguros y permisos', 'Seguro de responsabilidad civil', 0, 'year', false, 51),
    ('Seguros y permisos', 'Permisos municipales / uso de suelo', 0, 'year', true, 52),
    ('Software y licencias', 'CAM/CAD (Fusion 360 u otro)', 0, 'month', true, 60),
    ('Software y licencias', 'ERP/CRM (hosting Supabase/Vercel)', 0, 'month', true, 61),
    ('Software y licencias', 'Software de monitoreo CNC', 0, 'month', false, 62),
    ('Transporte y logística', 'Flete de material', 0, 'project', true, 70),
    ('Transporte y logística', 'Combustible / mantenimiento de vehículo', 0, 'month', true, 71),
    ('Transporte y logística', 'Empaque (por pieza)', 50, 'piece', true, 72),
    ('Financieros', 'Interés de préstamos (ej. crédito BBVA)', 0, 'month', true, 80),
    ('Financieros', 'Costo de fondeo (cobro a 30 días)', 0, 'month', false, 81),
    ('Financieros', 'Comisiones bancarias / terminal', 0, 'month', true, 82),
    ('Administrativos', 'Contador / asesoría fiscal', 0, 'month', true, 90),
    ('Administrativos', 'Papelería y facturación (PAC/CFDI)', 0, 'month', true, 91),
    ('Administrativos', 'ISO 9001 (auditorías anuales)', 0, 'year', false, 92)
) AS v(category, name, amount, period, active, sort)
WHERE NOT EXISTS (SELECT 1 FROM public.overhead_costs);
