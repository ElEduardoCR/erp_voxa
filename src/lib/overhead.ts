// Tipos y cálculo de overhead (costos indirectos). Cliente-safe.

export type OverheadPeriod = "year" | "month" | "week" | "day" | "hour" | "piece" | "project";

export type OverheadItem = {
    id?: string;
    category: string;
    name: string;
    amount: number;
    period: OverheadPeriod;
    active: boolean;
    sort?: number;
};

export type OverheadConfig = {
    enabled: boolean;
    durationValue: number;              // duración del proyecto
    durationUnit: "week" | "month" | "day";
    hours: number;                      // horas del proyecto (para costos por hora)
    pieces: number;                     // piezas del proyecto (para costos por pieza)
    items: OverheadItem[];              // snapshot editable por cotización
    total: number;                      // total calculado (interno)
};

export const PERIOD_LABELS: Record<OverheadPeriod, string> = {
    year: "por año",
    month: "por mes",
    week: "por semana",
    day: "por día",
    hour: "por hora",
    piece: "por pieza",
    project: "por proyecto",
};

export const PERIOD_OPTIONS: { value: OverheadPeriod; label: string }[] =
    (Object.keys(PERIOD_LABELS) as OverheadPeriod[]).map(v => ({ value: v, label: PERIOD_LABELS[v] }));

export const DURATION_UNIT_LABELS: Record<OverheadConfig["durationUnit"], string> = {
    week: "semana(s)",
    month: "mes(es)",
    day: "día(s)",
};

// Orden sugerido de categorías (las no listadas van al final)
export const CATEGORY_ORDER = [
    "Renta y servicios",
    "Mano de obra",
    "Máquina y equipo",
    "Herramienta y consumibles",
    "Seguros y permisos",
    "Software y licencias",
    "Transporte y logística",
    "Financieros",
    "Administrativos",
];

// Duración del proyecto convertida a días calendario
export function durationInDays(cfg: Pick<OverheadConfig, "durationValue" | "durationUnit">): number {
    const v = Number(cfg.durationValue) || 0;
    if (cfg.durationUnit === "week") return v * 7;
    if (cfg.durationUnit === "month") return v * 30;
    return v; // día
}

// Cuánto aporta un costo al overhead del proyecto
export function itemContribution(it: OverheadItem, cfg: OverheadConfig): number {
    if (!it.active) return 0;
    const amt = Number(it.amount) || 0;
    const days = durationInDays(cfg);
    switch (it.period) {
        case "year": return amt * (days / 365);
        case "month": return amt * (days / 30);
        case "week": return amt * (days / 7);
        case "day": return amt * days;
        case "hour": return amt * (Number(cfg.hours) || 0);
        case "piece": return amt * (Number(cfg.pieces) || 0);
        case "project": return amt;
        default: return 0;
    }
}

export function overheadTotal(cfg: OverheadConfig): number {
    return cfg.items.reduce((acc, it) => acc + itemContribution(it, cfg), 0);
}

export function groupByCategory(items: OverheadItem[]): { category: string; items: OverheadItem[] }[] {
    const map = new Map<string, OverheadItem[]>();
    for (const it of items) {
        const arr = map.get(it.category) || [];
        arr.push(it);
        map.set(it.category, arr);
    }
    const cats = Array.from(map.keys()).sort((a, b) => {
        const ia = CATEGORY_ORDER.indexOf(a); const ib = CATEGORY_ORDER.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b);
    });
    return cats.map(category => ({
        category,
        items: (map.get(category) || []).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)),
    }));
}

export const emptyOverheadConfig = (): OverheadConfig => ({
    enabled: false,
    durationValue: 1,
    durationUnit: "week",
    hours: 0,
    pieces: 0,
    items: [],
    total: 0,
});
