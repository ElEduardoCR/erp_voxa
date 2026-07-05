// Costeo de cotizaciones: costo por línea + overhead prorrateado + margen → precio de venta.
// Cliente-safe.

export type LineExtra = { label: string; amount: number };

export const DEFAULT_MACHINE_RATE = 1200; // $/hr estándar (editable por línea)

export type LineCostConfig = {
    material: number;          // costo de material (por pieza)
    machiningMinutes: number;  // minutos de maquinado (por pieza)
    machiningRate: number;     // tarifa de máquina ($/hr)
    consumables: number;       // consumibles (por pieza)
    labor: number;             // mano de obra (por pieza)
    extras: LineExtra[];       // costos extra (por pieza)
};

export const emptyLineCost = (): LineCostConfig => ({
    material: 0, machiningMinutes: 0, machiningRate: DEFAULT_MACHINE_RATE, consumables: 0, labor: 0, extras: [],
});

// Minutos de maquinado (acepta el formato anterior en horas por compatibilidad)
export function machiningMinutesOf(c: any): number {
    if (!c) return 0;
    if (c.machiningMinutes != null) return Number(c.machiningMinutes) || 0;
    if (c.machiningHours != null) return (Number(c.machiningHours) || 0) * 60;
    return 0;
}

// Costo directo de UNA pieza según su configuración. El maquinado es minutos × (tarifa/hr ÷ 60).
export function lineDirectUnit(c?: LineCostConfig | null): number {
    if (!c) return 0;
    const extras = (c.extras || []).reduce((a, e) => a + (Number(e.amount) || 0), 0);
    const machining = (machiningMinutesOf(c) / 60) * (Number(c.machiningRate) || 0);
    return (Number(c.material) || 0)
        + machining
        + (Number(c.consumables) || 0)
        + (Number(c.labor) || 0)
        + extras;
}

export type LineInput = {
    quantity: number;
    cost: LineCostConfig | null;
    marginPct: number | null;   // null = usar margen general
};

export type LineResult = {
    quantity: number;
    directUnit: number;
    directTotal: number;    // directUnit × cantidad
    overheadShare: number;  // overhead prorrateado a esta línea
    costTotal: number;      // directTotal + overheadShare
    marginPct: number;
    saleTotal: number;      // costTotal × (1 + margen)
    unitPrice: number;      // saleTotal / cantidad
};

export type QuoteResult = {
    lines: LineResult[];
    subtotal: number;       // suma de precios de venta (sin IVA)
    vat: number;
    total: number;
    costTotal: number;      // costo total (piezas + overhead)
    overheadTotal: number;
    profit: number;         // subtotal − costTotal
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeQuote(lines: LineInput[], overheadTotal: number, generalMargin: number): QuoteResult {
    const base = lines.map(l => {
        const directUnit = lineDirectUnit(l.cost);
        const qty = Number(l.quantity) || 0;
        return { qty, directUnit, directTotal: directUnit * qty, marginPct: l.marginPct == null ? (Number(generalMargin) || 0) : (Number(l.marginPct) || 0) };
    });

    const sumDirect = base.reduce((a, b) => a + b.directTotal, 0);
    const n = base.length || 1;
    const oh = Number(overheadTotal) || 0;

    const resLines: LineResult[] = base.map(b => {
        const overheadShare = oh > 0 ? (sumDirect > 0 ? oh * (b.directTotal / sumDirect) : oh / n) : 0;
        const costTotal = b.directTotal + overheadShare;
        const saleTotal = costTotal * (1 + b.marginPct / 100);
        const unitPrice = b.qty > 0 ? saleTotal / b.qty : saleTotal;
        return {
            quantity: b.qty,
            directUnit: r2(b.directUnit),
            directTotal: r2(b.directTotal),
            overheadShare: r2(overheadShare),
            costTotal: r2(costTotal),
            marginPct: b.marginPct,
            saleTotal: r2(saleTotal),
            unitPrice: r2(unitPrice),
        };
    });

    const subtotal = r2(resLines.reduce((a, l) => a + l.saleTotal, 0));
    const costTotal = r2(resLines.reduce((a, l) => a + l.costTotal, 0));
    const vat = r2(subtotal * 0.16);
    return {
        lines: resLines,
        subtotal,
        vat,
        total: r2(subtotal + vat),
        costTotal,
        overheadTotal: r2(oh),
        profit: r2(subtotal - costTotal),
    };
}
