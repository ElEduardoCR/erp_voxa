-- ============================================================
-- COSTEO POR LÍNEA + MARGEN + LIMPIEZA DE OVERHEAD
-- ============================================================
-- Cada partida de la cotización guarda su desglose de costo
-- (material, maquinado, consumibles, mano de obra, extras) y su
-- margen. El overhead queda SOLO con costos fijos (se prorratea por
-- la duración del proyecto). El precio de venta = (costo + overhead)
-- × (1 + margen).

ALTER TABLE public.quotation_items
    ADD COLUMN IF NOT EXISTS cost_config JSONB,
    ADD COLUMN IF NOT EXISTS margin_pct NUMERIC(6,2);

ALTER TABLE public.quotations
    ADD COLUMN IF NOT EXISTS general_margin_pct NUMERIC(6,2) NOT NULL DEFAULT 0;

-- El overhead ahora es SOLO costos fijos "sí o sí".
-- La mano de obra, consumibles y los costos por hora/pieza se
-- configuran en cada línea, así que se quitan del catálogo de overhead.
DELETE FROM public.overhead_costs
WHERE category IN ('Mano de obra', 'Herramienta y consumibles')
   OR period IN ('hour', 'piece');
