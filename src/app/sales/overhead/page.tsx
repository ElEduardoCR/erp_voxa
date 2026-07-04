"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
    ArrowLeft, RefreshCw, Plus, Trash2, Save, CheckCircle, AlertCircle, Layers,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";
import {
    OverheadItem, OverheadPeriod, PERIOD_OPTIONS, CATEGORY_ORDER, groupByCategory,
} from "@/lib/overhead";

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

type Row = OverheadItem & { _key: string; _dirty?: boolean };

const fmt = (n: number) => `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `tmp_${Date.now()}_${Math.random()}`);

export default function OverheadCatalogPage() {
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const fetchRows = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("overhead_costs")
                .select("*")
                .order("sort", { ascending: true });
            if (error) throw error;
            setRows(((data as OverheadItem[]) || []).map(r => ({ ...r, _key: r.id || uid() })));
        } catch (e: any) {
            setMsg({ type: "error", text: `No se pudo cargar. ¿Corriste la migración de overhead? (${e.message})` });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRows(); }, []);

    const groups = useMemo(() => groupByCategory(rows as OverheadItem[]).map(g => ({
        category: g.category,
        items: g.items.map(gi => rows.find(r => r._key === (gi as Row)._key) || (gi as Row)),
    })), [rows]);

    const patch = (key: string, changes: Partial<Row>) =>
        setRows(rs => rs.map(r => r._key === key ? { ...r, ...changes, _dirty: true } : r));

    const addRow = (category: string) => {
        const maxSort = Math.max(0, ...rows.map(r => r.sort ?? 0));
        setRows(rs => [...rs, { _key: uid(), category, name: "", amount: 0, period: "month", active: true, sort: maxSort + 1, _dirty: true }]);
    };

    const deleteRow = async (row: Row) => {
        if (!confirm("¿Eliminar este costo del catálogo?")) return;
        if (row.id) {
            const { error } = await supabase.from("overhead_costs").delete().eq("id", row.id);
            if (error) { setMsg({ type: "error", text: error.message }); return; }
        }
        setRows(rs => rs.filter(r => r._key !== row._key));
    };

    const saveAll = async () => {
        setSaving(true);
        setMsg(null);
        try {
            const dirty = rows.filter(r => r._dirty && r.name.trim());
            const toUpdate = dirty.filter(r => r.id);
            const toInsert = dirty.filter(r => !r.id);

            for (const r of toUpdate) {
                const { error } = await supabase.from("overhead_costs")
                    .update({ category: r.category, name: r.name.trim(), amount: Number(r.amount) || 0, period: r.period, active: r.active, sort: r.sort ?? 0 })
                    .eq("id", r.id!);
                if (error) throw error;
            }
            if (toInsert.length) {
                const { error } = await supabase.from("overhead_costs").insert(
                    toInsert.map(r => ({ category: r.category, name: r.name.trim(), amount: Number(r.amount) || 0, period: r.period, active: r.active, sort: r.sort ?? 0 }))
                );
                if (error) throw error;
            }
            setMsg({ type: "success", text: "Catálogo guardado." });
            await fetchRows();
        } catch (e: any) {
            setMsg({ type: "error", text: `No se pudo guardar: ${e.message}` });
        } finally {
            setSaving(false);
        }
    };

    const dirtyCount = rows.filter(r => r._dirty).length;

    return (
        <div className="min-h-screen bg-[#0B1120] text-slate-200 p-6 md:p-10 font-[family-name:var(--font-sans)]">
            <div className="w-full max-w-5xl mx-auto space-y-6">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50">
                    <div className="flex items-center gap-4">
                        <Link href="/sales" className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white border border-slate-700"><ArrowLeft className="w-5 h-5" /></Link>
                        <div>
                            <h1 className="text-3xl font-bold text-white flex items-center gap-3"><Layers className="w-8 h-8 text-amber-400" /> Overhead</h1>
                            <p className="text-slate-400 text-sm mt-1">Catálogo global de costos indirectos. Se reutiliza en cada cotización (ahí puedes ajustar montos por proyecto). Uso interno.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={saveAll} disabled={saving || dirtyCount === 0} className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm disabled:opacity-50">
                            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar{dirtyCount ? ` (${dirtyCount})` : ""}
                        </button>
                        <button onClick={fetchRows} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg" disabled={loading}><RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-amber-400")} /></button>
                    </div>
                </header>

                {msg && (
                    <div className={cn("p-4 rounded-xl border flex items-center gap-3 text-sm", msg.type === "error" ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400")}>
                        {msg.type === "error" ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />} {msg.text}
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-16 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-amber-500" />Cargando...</div>
                ) : (
                    <div className="space-y-5">
                        {groups.map(g => (
                            <div key={g.category} className="bg-slate-800/40 border border-slate-700/50 rounded-3xl overflow-hidden">
                                <div className="px-5 py-3 bg-slate-800/40 border-b border-slate-700/50 flex items-center justify-between">
                                    <h2 className="font-semibold text-slate-200">{g.category}</h2>
                                    <button onClick={() => addRow(g.category)} className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20"><Plus className="w-3.5 h-3.5" /> Agregar</button>
                                </div>
                                <div className="divide-y divide-slate-700/40">
                                    {g.items.map(r => {
                                        const row = r as Row;
                                        return (
                                            <div key={row._key} className={cn("flex flex-wrap items-center gap-2 px-4 py-2.5", !row.active && "opacity-50")}>
                                                <input value={row.name} onChange={e => patch(row._key, { name: e.target.value })} placeholder="Nombre del costo" className="flex-1 min-w-[200px] bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200" />
                                                <div className="flex items-center gap-1">
                                                    <span className="text-slate-500 text-sm">$</span>
                                                    <input type="number" inputMode="decimal" value={row.amount} onChange={e => patch(row._key, { amount: Number(e.target.value) })} className="w-28 bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 text-right" />
                                                </div>
                                                <select value={row.period} onChange={e => patch(row._key, { period: e.target.value as OverheadPeriod })} className="bg-slate-900/60 border border-slate-700/50 rounded-lg px-2 py-2 text-sm text-slate-200">
                                                    {PERIOD_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                                </select>
                                                <button onClick={() => patch(row._key, { active: !row.active })} className={cn("px-3 py-2 rounded-lg text-xs font-medium border", row.active ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" : "bg-slate-700/40 text-slate-400 border-slate-600/40")}>
                                                    {row.active ? "Activo" : "Inactivo"}
                                                </button>
                                                <button onClick={() => deleteRow(row)} className="p-2 text-slate-600 hover:text-red-400 rounded-lg hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        );
                                    })}
                                    {g.items.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">Sin costos en esta categoría.</p>}
                                </div>
                            </div>
                        ))}

                        {/* Agregar categoría nueva */}
                        <NewCategory onAdd={(cat) => addRow(cat)} />
                    </div>
                )}
            </div>
        </div>
    );
}

function NewCategory({ onAdd }: { onAdd: (category: string) => void }) {
    const [cat, setCat] = useState("");
    return (
        <div className="bg-slate-800/30 border border-dashed border-slate-700/60 rounded-2xl p-4 flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-400">¿Otra categoría?</span>
            <input list="ovh-cats" value={cat} onChange={e => setCat(e.target.value)} placeholder="Nombre de categoría" className="flex-1 min-w-[200px] bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200" />
            <datalist id="ovh-cats">{CATEGORY_ORDER.map(c => <option key={c} value={c} />)}</datalist>
            <button onClick={() => { if (cat.trim()) { onAdd(cat.trim()); setCat(""); } }} className="inline-flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 bg-amber-500/10 px-4 py-2 rounded-lg border border-amber-500/20"><Plus className="w-4 h-4" /> Agregar costo</button>
        </div>
    );
}
