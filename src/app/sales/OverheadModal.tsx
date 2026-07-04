"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { X, RefreshCw, Layers, CheckCircle, Info } from "lucide-react";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";
import {
    OverheadConfig, OverheadItem, PERIOD_LABELS, DURATION_UNIT_LABELS,
    groupByCategory, itemContribution, overheadTotal, emptyOverheadConfig,
} from "@/lib/overhead";

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

const fmt = (n: number) => `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;

type Props = {
    subtotal: number;
    config: OverheadConfig | null;
    onClose: () => void;
    onSave: (cfg: OverheadConfig) => void;
};

export default function OverheadModal({ subtotal, config, onClose, onSave }: Props) {
    const [cfg, setCfg] = useState<OverheadConfig>(config && config.items.length ? config : { ...emptyOverheadConfig(), enabled: true });
    const [loading, setLoading] = useState(!(config && config.items.length));

    useEffect(() => {
        if (config && config.items.length) return; // ya hay snapshot
        (async () => {
            setLoading(true);
            const { data } = await supabase.from("overhead_costs").select("*").order("sort", { ascending: true });
            const items = ((data as OverheadItem[]) || []).map(i => ({ ...i }));
            setCfg(c => ({ ...c, enabled: true, items }));
            setLoading(false);
        })();
    }, [config]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const total = useMemo(() => overheadTotal(cfg), [cfg]);
    const groups = useMemo(() => groupByCategory(cfg.items), [cfg.items]);

    const patchItem = (idx: number, changes: Partial<OverheadItem>) =>
        setCfg(c => ({ ...c, items: c.items.map((it, i) => i === idx ? { ...it, ...changes } : it) }));

    // índice real dentro de cfg.items (los grupos reordenan)
    const indexOf = (it: OverheadItem) => cfg.items.indexOf(it);

    const save = () => onSave({ ...cfg, total });

    const margen = subtotal - total;
    const margenPct = subtotal > 0 ? (margen / subtotal) * 100 : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[#0F172A] w-full max-w-3xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-slate-800 bg-slate-800/20">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Layers className="w-6 h-6 text-amber-400" /> Overhead del proyecto</h2>
                        <p className="text-slate-400 text-sm mt-1">Uso interno — no se cobra al cliente ni aparece en el PDF. Ajusta montos y duración para este proyecto.</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700"><X className="w-5 h-5" /></button>
                </div>

                {/* Controles */}
                <div className="p-5 border-b border-slate-800 bg-slate-900/30 flex flex-wrap items-center gap-4">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={cfg.enabled} onChange={e => setCfg(c => ({ ...c, enabled: e.target.checked }))} className="w-4 h-4 accent-amber-500" />
                        <span className="text-sm font-medium text-slate-200">Contemplar overhead</span>
                    </label>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">Duración</span>
                        <input type="number" inputMode="decimal" value={cfg.durationValue} onChange={e => setCfg(c => ({ ...c, durationValue: Number(e.target.value) }))} className="w-20 bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 text-right" />
                        <select value={cfg.durationUnit} onChange={e => setCfg(c => ({ ...c, durationUnit: e.target.value as OverheadConfig["durationUnit"] }))} className="bg-slate-900/60 border border-slate-700/50 rounded-lg px-2 py-2 text-sm text-slate-200">
                            {(["week", "month", "day"] as const).map(u => <option key={u} value={u}>{DURATION_UNIT_LABELS[u]}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">Horas</span>
                        <input type="number" inputMode="decimal" value={cfg.hours} onChange={e => setCfg(c => ({ ...c, hours: Number(e.target.value) }))} className="w-20 bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 text-right" title="Horas de trabajo/máquina del proyecto (para costos por hora)" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">Piezas</span>
                        <input type="number" inputMode="decimal" value={cfg.pieces} onChange={e => setCfg(c => ({ ...c, pieces: Number(e.target.value) }))} className="w-20 bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 text-right" title="Piezas del proyecto (para costos por pieza)" />
                    </div>
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto p-5 bg-slate-900/40 space-y-4">
                    {loading ? (
                        <div className="text-center py-10 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-amber-500" />Cargando catálogo…</div>
                    ) : cfg.items.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <p className="text-slate-300 font-medium">No hay costos en el catálogo.</p>
                            <p className="text-sm mt-1">Agrégalos en el módulo de Overhead y vuelve a abrir esto.</p>
                        </div>
                    ) : groups.map(g => (
                        <div key={g.category}>
                            <p className="text-xs font-semibold text-amber-300/80 uppercase tracking-wide mb-2">{g.category}</p>
                            <div className="space-y-1.5">
                                {g.items.map(it => {
                                    const idx = indexOf(it);
                                    const contrib = itemContribution(it, cfg);
                                    return (
                                        <div key={idx} className={cn("flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 border", it.active ? "bg-slate-800/40 border-slate-700/50" : "bg-slate-800/20 border-slate-800 opacity-60")}>
                                            <input type="checkbox" checked={it.active} onChange={e => patchItem(idx, { active: e.target.checked })} className="w-4 h-4 accent-amber-500 flex-shrink-0" />
                                            <span className="flex-1 min-w-[160px] text-sm text-slate-200">{it.name}</span>
                                            <div className="flex items-center gap-1">
                                                <span className="text-slate-500 text-sm">$</span>
                                                <input type="number" inputMode="decimal" value={it.amount} onChange={e => patchItem(idx, { amount: Number(e.target.value) })} className="w-24 bg-slate-900/60 border border-slate-700/50 rounded-lg px-2 py-1.5 text-sm text-slate-200 text-right" />
                                            </div>
                                            <span className="text-xs text-slate-500 w-20">{PERIOD_LABELS[it.period]}</span>
                                            <span className="text-sm font-medium text-amber-300 w-24 text-right">{fmt(contrib)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer / totales */}
                <div className="p-5 border-t border-slate-800 bg-slate-800/40 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                        <span className="text-slate-400">Overhead del proyecto: <span className="text-amber-300 font-bold text-base">{fmt(total)}</span></span>
                        <span className="text-slate-400">Subtotal cotización: <span className="text-slate-200 font-medium">{fmt(subtotal)}</span></span>
                        <span className="text-slate-400">Margen vs overhead: <span className={cn("font-bold", margen >= 0 ? "text-emerald-300" : "text-red-300")}>{fmt(margen)} ({margenPct.toFixed(0)}%)</span></span>
                    </div>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Los costos por año/mes/semana/día se prorratean a la duración; los de por hora/pieza se multiplican por horas/piezas.</p>
                    <div className="flex justify-end gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700">Cancelar</button>
                        <button onClick={save} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-amber-500 hover:bg-amber-600"><CheckCircle className="w-4 h-4" /> Aplicar a la cotización</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
