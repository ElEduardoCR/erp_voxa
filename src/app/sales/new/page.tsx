"use client";

import { useEffect, useState, Suspense } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Save, Plus, Trash2, Calculator, AlertCircle, RefreshCw, Layers, Settings2, Wrench, Percent } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";
import OverheadModal from "../OverheadModal";
import LineCostModal from "../LineCostModal";
import { OverheadConfig, overheadTotal } from "@/lib/overhead";
import { LineCostConfig, emptyLineCost, computeQuote, lineDirectUnit } from "@/lib/quoteCosting";

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

const itemSchema = z.object({
    description: z.string().min(1, "Descripción requerida"),
    quantity: z.coerce.number().min(1, "Min 1"),
    margin_pct: z.string().optional(),
    cost_config: z.any().optional(),
});

const quotationSchema = z.object({
    client_id: z.string().min(1, "Selecciona un cliente"),
    seller: z.string().optional().or(z.literal('')),
    delivery_time: z.string().optional().or(z.literal('')),
    terms_conditions: z.string().optional().or(z.literal('')),
    items: z.array(itemSchema).min(1, "Agrega al menos una partida"),
});

type QuotationFormValues = z.infer<typeof quotationSchema>;

function QuotationForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get('id');
    const isEditing = !!editId;

    const [clients, setClients] = useState<{ id: string, business_name: string }[]>([]);
    const [isLoadingClients, setIsLoadingClients] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [overheadConfig, setOverheadConfig] = useState<OverheadConfig | null>(null);
    const [showOverhead, setShowOverhead] = useState(false);
    const [generalMargin, setGeneralMargin] = useState<number>(30);
    const [showLineCost, setShowLineCost] = useState<number | null>(null);

    const { register, control, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<QuotationFormValues>({
        resolver: zodResolver(quotationSchema) as any,
        defaultValues: {
            client_id: "",
            seller: "",
            delivery_time: "",
            terms_conditions: "",
            items: [{ description: "", quantity: 1, margin_pct: "", cost_config: emptyLineCost() }],
        }
    });

    const { fields, append, remove } = useFieldArray({ control, name: "items" });
    const watchItems = watch("items");

    // Costeo: costo por línea + overhead prorrateado (por duración) + margen → precio de venta
    const overheadInternal = overheadConfig?.enabled ? overheadTotal(overheadConfig) : 0;
    const costing = computeQuote(
        (watchItems || []).map(it => ({
            quantity: Number(it.quantity) || 0,
            cost: (it.cost_config as LineCostConfig) ?? null,
            marginPct: it.margin_pct === undefined || it.margin_pct === "" ? null : Number(it.margin_pct),
        })),
        overheadInternal,
        Number(generalMargin) || 0,
    );

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);

    useEffect(() => {
        (async () => {
            try {
                const { data, error } = await supabase.from('clients').select('id, business_name').order('business_name', { ascending: true });
                if (error) throw error;
                setClients(data || []);
            } catch (err) {
                console.error("Failed to load clients", err);
            } finally {
                setIsLoadingClients(false);
            }
        })();
    }, []);

    useEffect(() => {
        async function fetchQuote() {
            if (!editId) return;
            try {
                const { data: quote, error: quoteError } = await supabase.from('quotations').select('*').eq('id', editId).single();
                if (quoteError) throw quoteError;
                const { data: items, error: itemsError } = await supabase.from('quotation_items').select('*').eq('quotation_id', editId);
                if (itemsError) throw itemsError;

                reset({
                    client_id: quote.client_id,
                    seller: quote.seller || "",
                    delivery_time: quote.delivery_time || "",
                    terms_conditions: quote.terms_conditions || "",
                    items: (items || []).map((i: any) => ({
                        description: i.description,
                        quantity: i.quantity,
                        margin_pct: i.margin_pct == null ? "" : String(i.margin_pct),
                        // Cotizaciones viejas sin desglose: el precio anterior se toma como "material"
                        cost_config: i.cost_config ?? { ...emptyLineCost(), material: Number(i.unit_price) || 0 },
                    })),
                });
                if (quote.general_margin_pct != null) setGeneralMargin(Number(quote.general_margin_pct));
                if (quote.overhead_config) setOverheadConfig(quote.overhead_config as OverheadConfig);
            } catch (err) {
                console.error("Failed to load quotation", err);
                setErrorMsg("Error al cargar la cotización.");
            }
        }
        fetchQuote();
    }, [editId, reset]);

    const onSubmit = async (data: QuotationFormValues) => {
        setIsSubmitting(true);
        setErrorMsg(null);
        try {
            let currentQuoteId = editId;

            const ovhEnabled = !!overheadConfig?.enabled;
            const ovhTotal = ovhEnabled ? overheadTotal(overheadConfig!) : 0;
            const quoteFields = {
                client_id: data.client_id,
                seller: data.seller || null,
                delivery_time: data.delivery_time || null,
                terms_conditions: data.terms_conditions || null,
                subtotal: costing.subtotal,
                vat_total: costing.vat,
                total: costing.total,
                general_margin_pct: Number(generalMargin) || 0,
                overhead_enabled: ovhEnabled,
                overhead_total: ovhTotal,
                overhead_config: overheadConfig,
            };

            if (isEditing) {
                const { error: quoteError } = await supabase.from('quotations').update({ ...quoteFields, updated_at: new Date().toISOString() }).eq('id', editId);
                if (quoteError) throw quoteError;
                const { error: delError } = await supabase.from('quotation_items').delete().eq('quotation_id', editId);
                if (delError) throw delError;
            } else {
                const { data: insertedQuote, error: quoteError } = await supabase.from('quotations').insert([{ ...quoteFields, status: 'Draft' }]).select().single();
                if (quoteError) throw quoteError;
                currentQuoteId = insertedQuote.id;
            }

            const itemsToInsert = data.items.map((item, i) => {
                const L = costing.lines[i];
                return {
                    quotation_id: currentQuoteId,
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: L?.unitPrice ?? 0,
                    line_total: L?.saleTotal ?? 0,
                    cost_config: item.cost_config ?? null,
                    margin_pct: item.margin_pct === undefined || item.margin_pct === "" ? null : Number(item.margin_pct),
                };
            });
            const { error: itemsError } = await supabase.from('quotation_items').insert(itemsToInsert);
            if (itemsError) throw itemsError;

            router.push('/sales');
        } catch (error: any) {
            console.error("Error saving quotation:", error);
            setErrorMsg(error.message || "No se pudo guardar la cotización");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0B1120] text-slate-200 p-6 md:p-10 font-[family-name:var(--font-sans)]">
            <div className="max-w-5xl mx-auto space-y-8">
                <header className="flex items-center gap-4 bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50 backdrop-blur-sm">
                    <Link href="/sales" className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-slate-400 hover:text-white border border-slate-700"><ArrowLeft className="w-5 h-5" /></Link>
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <Calculator className="w-8 h-8 text-emerald-400" />
                            {isEditing ? "Editar Cotización" : "Nueva Cotización"}
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">El precio de venta se calcula del costo (piezas + overhead) y tu margen.</p>
                    </div>
                </header>

                {errorMsg && (
                    <div className="p-4 rounded-xl border bg-red-500/10 border-red-500/30 text-red-400 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" /> {errorMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-8">
                    {/* Cliente */}
                    <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50 backdrop-blur-sm">
                        <h2 className="text-lg font-semibold text-white mb-4">Cliente</h2>
                        <div className="space-y-2 max-w-xl">
                            <label className="text-sm font-medium text-slate-300 ml-1">Selecciona cliente *</label>
                            <select {...register("client_id")} disabled={isLoadingClients}
                                className={cn("w-full bg-slate-900/50 border rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 transition-all", errors.client_id ? "border-red-500/50 focus:ring-red-500/20" : "border-slate-700 focus:border-emerald-500 focus:ring-emerald-500/20")}>
                                <option value="">Elige un cliente...</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
                            </select>
                            {errors.client_id && <p className="text-red-400 text-xs ml-1">{errors.client_id.message}</p>}
                        </div>
                    </div>

                    {/* Info adicional */}
                    <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50 backdrop-blur-sm">
                        <h2 className="text-lg font-semibold text-white mb-4">Información Adicional</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 ml-1">Vendedor</label>
                                <input {...register("seller")} className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all" placeholder="Nombre del vendedor" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 ml-1">Tiempo de Entrega</label>
                                <input {...register("delivery_time")} className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all" placeholder="Ej: 5 días hábiles, 2 semanas" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium text-slate-300 ml-1">Términos y Condiciones</label>
                                <textarea {...register("terms_conditions")} className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all min-h-[120px]" placeholder="Ej: Precios en MXN, validez 30 días, pago 50% anticipo..." />
                            </div>
                        </div>
                    </div>

                    {/* Partidas */}
                    <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50 backdrop-blur-sm">
                        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                            <h2 className="text-lg font-semibold text-white">Productos / Servicios</h2>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-1.5">
                                    <Percent className="w-4 h-4 text-emerald-400" />
                                    <span className="text-xs text-slate-400">Margen general</span>
                                    <input type="number" inputMode="decimal" value={generalMargin} onChange={e => setGeneralMargin(Number(e.target.value))} className="w-16 bg-slate-900/60 border border-slate-700/50 rounded-md px-2 py-1 text-sm text-slate-200 text-right" />
                                    <span className="text-xs text-slate-500">%</span>
                                </div>
                                <button type="button" onClick={() => append({ description: "", quantity: 1, margin_pct: "", cost_config: emptyLineCost() })} className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 font-medium bg-emerald-500/10 hover:bg-emerald-500/20 px-4 py-2 rounded-lg transition-colors border border-emerald-500/20">
                                    <Plus className="w-4 h-4" /> Agregar partida
                                </button>
                            </div>
                        </div>

                        <div className="hidden md:grid grid-cols-12 gap-3 text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">
                            <div className="col-span-4">Descripción</div>
                            <div className="col-span-1 text-center">Cant.</div>
                            <div className="col-span-2 text-center">Costo</div>
                            <div className="col-span-1 text-center">Margen</div>
                            <div className="col-span-2 text-right">Precio venta u.</div>
                            <div className="col-span-1 text-right">Total</div>
                            <div className="col-span-1"></div>
                        </div>

                        <div className="space-y-3">
                            {fields.map((field, index) => {
                                const L = costing.lines[index];
                                const cfg = (watchItems?.[index]?.cost_config as LineCostConfig) || null;
                                const unitCost = lineDirectUnit(cfg);
                                return (
                                    <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-slate-900/30 p-4 md:p-2 rounded-xl border border-slate-700/30">
                                        <div className="md:col-span-4">
                                            <input {...register(`items.${index}.description` as const)} placeholder="Descripción de la pieza/servicio"
                                                className={cn("w-full bg-slate-900/80 border rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-1", errors.items?.[index]?.description ? "border-red-500 focus:ring-red-500" : "border-slate-700 focus:border-emerald-500 focus:ring-emerald-500")} />
                                        </div>
                                        <div className="md:col-span-1">
                                            <input type="number" step="any" {...register(`items.${index}.quantity` as const, { valueAsNumber: true })}
                                                className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-2 py-2 text-white text-center focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                                        </div>
                                        <div className="md:col-span-2 flex justify-center">
                                            <button type="button" onClick={() => setShowLineCost(index)}
                                                className="w-full inline-flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-2 rounded-lg text-xs border border-slate-700">
                                                <Wrench className="w-3.5 h-3.5 text-emerald-400" /> {unitCost > 0 ? formatCurrency(unitCost) : "Configurar"}
                                            </button>
                                        </div>
                                        <div className="md:col-span-1">
                                            <div className="relative">
                                                <input type="number" step="any" {...register(`items.${index}.margin_pct` as const)} placeholder={`${generalMargin}`}
                                                    className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-2 py-2 text-white text-center text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" title="Margen de esta partida (vacío = margen general)" />
                                            </div>
                                        </div>
                                        <div className="md:col-span-2 text-right text-emerald-400 font-medium text-sm">{formatCurrency(L?.unitPrice ?? 0)}</div>
                                        <div className="md:col-span-1 text-right text-white font-semibold text-sm">{formatCurrency(L?.saleTotal ?? 0)}</div>
                                        <div className="md:col-span-1 flex items-center justify-end">
                                            <button type="button" onClick={() => remove(index)} disabled={fields.length === 1}
                                                className="text-slate-500 hover:text-red-400 disabled:opacity-30 transition-colors p-2 rounded-lg hover:bg-slate-800"><Trash2 className="w-5 h-5" /></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Overhead */}
                    <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50 backdrop-blur-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20"><Layers className="w-5 h-5 text-amber-400" /></div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Overhead (costos fijos)</h2>
                                    <p className="text-slate-400 text-sm mt-0.5 max-w-xl">Renta, luz, agua, gasolina, contador, licencias… Se prorratea por la duración del proyecto y se reparte entre las partidas. Uso interno.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                                {overheadConfig?.enabled && (
                                    <div className="text-right"><p className="text-xs text-slate-500">Overhead</p><p className="text-lg font-bold text-amber-300">{formatCurrency(overheadInternal)}</p></div>
                                )}
                                <button type="button" onClick={() => setShowOverhead(true)} className="inline-flex items-center gap-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 px-5 py-2.5 rounded-xl font-medium text-sm border border-amber-500/25 whitespace-nowrap">
                                    <Settings2 className="w-4 h-4" /> {overheadConfig?.enabled ? "Editar overhead" : "Configurar overhead"}
                                </button>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-700/40">
                            <Link href="/sales/overhead" className="text-xs text-slate-500 hover:text-amber-300">Editar catálogo global de costos fijos →</Link>
                        </div>
                    </div>

                    {/* Totales & guardar */}
                    <div className="flex flex-col md:flex-row justify-between items-end gap-6 bg-slate-800/20 p-6 rounded-3xl border border-slate-700/30">
                        <button type="submit" disabled={isSubmitting} className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white px-10 py-4 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 text-lg">
                            {isSubmitting ? (<><RefreshCw className="w-5 h-5 animate-spin" /> Guardando...</>) : (<><Save className="w-5 h-5" /> {isEditing ? "Actualizar" : "Guardar Cotización"}</>)}
                        </button>

                        <div className="w-full md:w-80 space-y-3 bg-slate-900/50 p-6 rounded-2xl border border-slate-700/50">
                            <div className="flex justify-between items-center text-sm text-slate-400 font-medium">
                                <span>Subtotal (venta)</span><span>{formatCurrency(costing.subtotal)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-slate-400 font-medium pb-3 border-b border-slate-700/50">
                                <span>IVA (16%)</span><span>{formatCurrency(costing.vat)}</span>
                            </div>
                            <div className="flex justify-between items-end text-lg text-white font-bold pt-1">
                                <span>Total</span><span className="text-emerald-400">{formatCurrency(costing.total)}</span>
                            </div>

                            <div className="mt-3 pt-3 border-t border-dashed border-slate-700/50 space-y-2">
                                <div className="flex justify-between items-center text-xs text-amber-300/80 font-medium uppercase tracking-wide">
                                    <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Interno</span><span>no se cobra</span>
                                </div>
                                <div className="flex justify-between items-center text-sm text-slate-400"><span>Costo total</span><span className="text-slate-200 font-medium">{formatCurrency(costing.costTotal)}</span></div>
                                {overheadConfig?.enabled && <div className="flex justify-between items-center text-xs text-slate-500"><span>· incluye overhead</span><span>{formatCurrency(overheadInternal)}</span></div>}
                                <div className="flex justify-between items-center text-sm text-slate-400">
                                    <span>Ganancia</span>
                                    <span className={cn("font-bold", costing.profit >= 0 ? "text-emerald-400" : "text-red-400")}>{formatCurrency(costing.profit)}{costing.subtotal > 0 ? ` (${((costing.profit / costing.subtotal) * 100).toFixed(0)}%)` : ""}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>

                {showLineCost !== null && (() => {
                    const idx = showLineCost;
                    return (
                        <LineCostModal
                            title={watchItems?.[idx]?.description || `Partida ${idx + 1}`}
                            quantity={Number(watchItems?.[idx]?.quantity) || 0}
                            config={(watchItems?.[idx]?.cost_config as LineCostConfig) ?? null}
                            onClose={() => setShowLineCost(null)}
                            onSave={(cfg) => { setValue(`items.${idx}.cost_config`, cfg, { shouldDirty: true }); setShowLineCost(null); }}
                        />
                    );
                })()}

                {showOverhead && (
                    <OverheadModal
                        subtotal={costing.subtotal}
                        config={overheadConfig}
                        onClose={() => setShowOverhead(false)}
                        onSave={(cfg) => { setOverheadConfig(cfg); setShowOverhead(false); }}
                    />
                )}
            </div>
        </div>
    );
}

export default function NewQuotationPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-10 font-[family-name:var(--font-sans)]">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
            </div>
        }>
            <QuotationForm />
        </Suspense>
    );
}
