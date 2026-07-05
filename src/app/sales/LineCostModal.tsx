"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2, CheckCircle, Wrench } from "lucide-react";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";
import { LineCostConfig, emptyLineCost, lineDirectUnit, machiningMinutesOf } from "@/lib/quoteCosting";

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

const fmt = (n: number) => `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;

type Props = {
    title?: string;
    quantity: number;
    config: LineCostConfig | null;
    onClose: () => void;
    onSave: (config: LineCostConfig) => void;
};

export default function LineCostModal({ title, quantity, config, onClose, onSave }: Props) {
    const [c, setC] = useState<LineCostConfig>(config
        ? { ...emptyLineCost(), ...config, machiningMinutes: machiningMinutesOf(config), extras: config.extras || [] }
        : emptyLineCost());

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const set = (k: keyof LineCostConfig, v: number) => setC(p => ({ ...p, [k]: v }));
    const setExtra = (i: number, ch: Partial<{ label: string; amount: number }>) =>
        setC(p => ({ ...p, extras: p.extras.map((e, ix) => ix === i ? { ...e, ...ch } : e) }));
    const addExtra = () => setC(p => ({ ...p, extras: [...p.extras, { label: "", amount: 0 }] }));
    const removeExtra = (i: number) => setC(p => ({ ...p, extras: p.extras.filter((_, ix) => ix !== i) }));

    const machiningCost = ((Number(c.machiningMinutes) || 0) / 60) * (Number(c.machiningRate) || 0);
    const unit = lineDirectUnit(c);
    const qty = Number(quantity) || 0;

    const numInput = "w-28 bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 text-right focus:outline-none focus:border-emerald-500/50";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[#0F172A] w-full max-w-lg max-h-[92vh] rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col overflow-hidden">
                <div className="flex items-start justify-between p-6 border-b border-slate-800 bg-slate-800/20">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Wrench className="w-5 h-5 text-emerald-400" /> Costo de la pieza</h2>
                        <p className="text-slate-400 text-sm mt-1">{title || "Partida"} — costos por pieza (uso interno).</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 overflow-y-auto space-y-4">
                    <Row label="Material">
                        <div className="flex items-center gap-1"><span className="text-slate-500 text-sm">$</span><input type="number" inputMode="decimal" value={c.material} onChange={e => set("material", Number(e.target.value))} className={numInput} /></div>
                    </Row>

                    <Row label="Maquinado">
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                            <div className="flex items-center gap-1">
                                <input type="number" inputMode="decimal" value={c.machiningMinutes} onChange={e => set("machiningMinutes", Number(e.target.value))} className="w-20 bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 text-right" />
                                <span className="text-xs text-slate-500">min</span>
                            </div>
                            <span className="text-slate-600">×</span>
                            <div className="flex items-center gap-1">
                                <span className="text-slate-500 text-sm">$</span>
                                <input type="number" inputMode="decimal" value={c.machiningRate} onChange={e => set("machiningRate", Number(e.target.value))} className="w-24 bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 text-right" />
                                <span className="text-xs text-slate-500">/hr</span>
                            </div>
                            <span className="text-sm font-medium text-emerald-300 w-24 text-right">{fmt(machiningCost)}</span>
                        </div>
                    </Row>

                    <Row label="Consumibles">
                        <div className="flex items-center gap-1"><span className="text-slate-500 text-sm">$</span><input type="number" inputMode="decimal" value={c.consumables} onChange={e => set("consumables", Number(e.target.value))} className={numInput} /></div>
                    </Row>

                    <Row label="Mano de obra">
                        <div className="flex items-center gap-1"><span className="text-slate-500 text-sm">$</span><input type="number" inputMode="decimal" value={c.labor} onChange={e => set("labor", Number(e.target.value))} className={numInput} /></div>
                    </Row>

                    {/* Extras */}
                    <div className="pt-2 border-t border-slate-700/40">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-300">Costos extra</span>
                            <button onClick={addExtra} className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20"><Plus className="w-3.5 h-3.5" /> Agregar</button>
                        </div>
                        <div className="space-y-2">
                            {c.extras.length === 0 && <p className="text-xs text-slate-500">Sin costos extra.</p>}
                            {c.extras.map((e, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <input value={e.label} onChange={ev => setExtra(i, { label: ev.target.value })} placeholder="Concepto (ej. tratamiento térmico)" className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200" />
                                    <div className="flex items-center gap-1"><span className="text-slate-500 text-sm">$</span><input type="number" inputMode="decimal" value={e.amount} onChange={ev => setExtra(i, { amount: Number(ev.target.value) })} className="w-24 bg-slate-900/60 border border-slate-700/50 rounded-lg px-2 py-2 text-sm text-slate-200 text-right" /></div>
                                    <button onClick={() => removeExtra(i)} className="text-slate-600 hover:text-red-400 p-1.5"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-800 bg-slate-800/40 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Costo por pieza</span>
                        <span className="text-lg font-bold text-emerald-300">{fmt(unit)}</span>
                    </div>
                    {qty > 1 && (
                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>× {qty} piezas</span>
                            <span>{fmt(unit * qty)}</span>
                        </div>
                    )}
                    <div className="flex justify-end gap-3 pt-1">
                        <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700">Cancelar</button>
                        <button onClick={() => onSave(c)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600"><CheckCircle className="w-4 h-4" /> Aplicar</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-300">{label}</span>
            {children}
        </div>
    );
}
