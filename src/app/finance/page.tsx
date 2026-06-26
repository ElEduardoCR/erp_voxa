"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
    ArrowLeft, RefreshCw, HeartPulse, CreditCard, Wallet, Landmark, Plus, X,
    UploadCloud, FileText, AlertCircle, CheckCircle, CalendarClock, TrendingUp,
    TrendingDown, Trash2, PiggyBank, Tags, Search, Copy,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

const BUCKET = "purchase_files";
const PREFIX = "bank_statements";

type Account = {
    id: string;
    name: string;
    type: "credit" | "debit";
    bank: string | null;
    last4: string | null;
    cut_day: number | null;
    credit_limit: number | null;
    created_at: string;
};

type Statement = {
    id: string;
    account_id: string | null;
    period_label: string | null;
    statement_date: string | null;
    due_date: string | null;
    previous_balance: number | null;
    new_balance: number | null;
    minimum_payment: number | null;
    no_interest_payment: number | null;
    credit_limit: number | null;
    total_income: number | null;
    total_expense: number | null;
    bank: string | null;
    last4: string | null;
    file_url: string | null;
    file_name: string | null;
    created_at: string;
};

type Tx = {
    id: string;
    statement_id: string | null;
    account_id: string | null;
    tx_date: string | null;
    description: string | null;
    amount: number | null;
    type: "expense" | "income" | "payment";
    category: string | null;
};

type Loan = {
    id: string;
    lender: string;
    description: string | null;
    principal: number | null;
    balance: number | null;
    monthly_payment: number | null;
    next_payment_date: string | null;
    interest_rate: number | null;
    notes: string | null;
};

const fmtMoney = (n: number | null | undefined) =>
    n == null ? "—" : `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (s: string | null | undefined) =>
    !s ? "—" : new Date(s + (s.length === 10 ? "T00:00:00" : "")).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

const CAT_COLORS: Record<string, string> = {
    "comida": "bg-orange-500/10 text-orange-300 border-orange-500/20",
    "supermercado": "bg-lime-500/10 text-lime-300 border-lime-500/20",
    "gasolina": "bg-red-500/10 text-red-300 border-red-500/20",
    "transporte": "bg-sky-500/10 text-sky-300 border-sky-500/20",
    "servicios": "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
    "salud": "bg-rose-500/10 text-rose-300 border-rose-500/20",
    "entretenimiento": "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20",
    "compras": "bg-violet-500/10 text-violet-300 border-violet-500/20",
    "viajes": "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
    "educacion": "bg-blue-500/10 text-blue-300 border-blue-500/20",
    "pagos a terceros": "bg-amber-500/10 text-amber-300 border-amber-500/20",
    "ingresos de terceros": "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    "pago de tarjeta": "bg-teal-500/10 text-teal-300 border-teal-500/20",
    "intereses y comisiones": "bg-pink-500/10 text-pink-300 border-pink-500/20",
    "efectivo": "bg-slate-500/10 text-slate-300 border-slate-500/20",
    "otros": "bg-slate-600/10 text-slate-400 border-slate-600/20",
};
const catColor = (c: string | null) => CAT_COLORS[(c || "otros").toLowerCase()] || CAT_COLORS["otros"];

export default function FinancePage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [statements, setStatements] = useState<Statement[]>([]);
    const [txs, setTxs] = useState<Tx[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

    // Subida
    const [uploadAccountId, setUploadAccountId] = useState("");
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [results, setResults] = useState<{ name: string; ok: boolean; dup?: boolean; text: string }[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);

    // Modales
    const [showAccount, setShowAccount] = useState(false);
    const [showLoan, setShowLoan] = useState(false);

    // Filtros de movimientos
    const [fAccount, setFAccount] = useState("all");
    const [fCategory, setFCategory] = useState("all");
    const [fType, setFType] = useState<"all" | "expense" | "income" | "payment">("all");
    const [search, setSearch] = useState("");

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [a, s, t, l] = await Promise.all([
                supabase.from("financial_accounts").select("*").order("created_at", { ascending: true }),
                supabase.from("bank_statements").select("*").order("statement_date", { ascending: false, nullsFirst: false }),
                supabase.from("statement_transactions").select("*").order("tx_date", { ascending: false, nullsFirst: false }).limit(5000),
                supabase.from("loans").select("*").order("next_payment_date", { ascending: true, nullsFirst: false }),
            ]);
            if (a.error) throw a.error;
            setAccounts((a.data as Account[]) || []);
            setStatements((s.data as Statement[]) || []);
            setTxs((t.data as Tx[]) || []);
            setLoans((l.data as Loan[]) || []);
        } catch (e: any) {
            setMsg({ type: "error", text: `No se pudo cargar. ¿Ya corriste la migración de salud financiera? (${e.message})` });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const accountById = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);

    // Estado de cuenta más reciente por tarjeta
    const latestByAccount = useMemo(() => {
        const m = new Map<string, Statement>();
        for (const s of statements) {
            if (!s.account_id) continue;
            const cur = m.get(s.account_id);
            const sd = s.statement_date || s.created_at;
            const cd = cur ? (cur.statement_date || cur.created_at) : "";
            if (!cur || new Date(sd).getTime() > new Date(cd).getTime()) m.set(s.account_id, s);
        }
        return m;
    }, [statements]);

    const resumen = useMemo(() => {
        let deudaCredito = 0;
        let limiteCredito = 0;
        for (const a of accounts) {
            if (a.type !== "credit") continue;
            const st = latestByAccount.get(a.id);
            deudaCredito += Number(st?.new_balance) || 0;
            limiteCredito += Number(a.credit_limit ?? st?.credit_limit) || 0;
        }
        const deudaPrestamos = loans.reduce((acc, l) => acc + (Number(l.balance) || 0), 0);

        // Próximos pagos
        type Pago = { label: string; sub: string; date: string | null; amount: number; kind: "tarjeta" | "prestamo" };
        const pagos: Pago[] = [];
        for (const a of accounts) {
            if (a.type !== "credit") continue;
            const st = latestByAccount.get(a.id);
            if (!st) continue;
            const amount = Number(st.no_interest_payment ?? st.minimum_payment ?? st.new_balance) || 0;
            if (amount <= 0 && !st.due_date) continue;
            pagos.push({ label: a.name, sub: st.no_interest_payment != null ? "Para no generar intereses" : st.minimum_payment != null ? "Pago mínimo" : "Saldo", date: st.due_date, amount, kind: "tarjeta" });
        }
        for (const l of loans) {
            if (!l.next_payment_date && !l.monthly_payment) continue;
            pagos.push({ label: l.lender, sub: "Préstamo", date: l.next_payment_date, amount: Number(l.monthly_payment) || 0, kind: "prestamo" });
        }
        pagos.sort((x, y) => {
            if (!x.date) return 1;
            if (!y.date) return -1;
            return new Date(x.date).getTime() - new Date(y.date).getTime();
        });

        return { deudaCredito, limiteCredito, deudaPrestamos, deudaTotal: deudaCredito + deudaPrestamos, pagos };
    }, [accounts, latestByAccount, loans]);

    // Filtros de movimientos
    const filteredTxs = useMemo(() => {
        return txs.filter(t => {
            if (fAccount !== "all" && t.account_id !== fAccount) return false;
            if (fCategory !== "all" && (t.category || "otros").toLowerCase() !== fCategory) return false;
            if (fType !== "all" && t.type !== fType) return false;
            if (search.trim()) {
                const q = search.trim().toLowerCase();
                if (!(t.description || "").toLowerCase().includes(q)) return false;
            }
            return true;
        });
    }, [txs, fAccount, fCategory, fType, search]);

    const catBreakdown = useMemo(() => {
        const m = new Map<string, number>();
        for (const t of filteredTxs) {
            if (t.type !== "expense") continue;
            const c = (t.category || "otros").toLowerCase();
            m.set(c, (m.get(c) || 0) + (Number(t.amount) || 0));
        }
        return Array.from(m.entries()).map(([cat, total]) => ({ cat, total })).sort((a, b) => b.total - a.total);
    }, [filteredTxs]);

    const totals = useMemo(() => {
        let ingresos = 0, egresos = 0, pagosTarjeta = 0;
        for (const t of filteredTxs) {
            const amt = Number(t.amount) || 0;
            if (t.type === "income") ingresos += amt;
            else if (t.type === "expense") egresos += amt;
            else pagosTarjeta += amt;
        }
        return { ingresos, egresos, pagosTarjeta };
    }, [filteredTxs]);

    const maxCat = Math.max(1, ...catBreakdown.map(c => c.total));
    const allCategories = useMemo(() => {
        const set = new Set<string>();
        for (const t of txs) set.add((t.category || "otros").toLowerCase());
        return Array.from(set).sort();
    }, [txs]);

    // ===== Acciones =====
    const handleStatementsUpload = async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;
        const pdfs = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith(".pdf"));
        if (pdfs.length === 0) { setMsg({ type: "error", text: "Selecciona archivos PDF." }); return; }

        setProcessing(true);
        setResults([]);
        setProgress({ done: 0, total: pdfs.length });
        setMsg({ type: "info", text: `Analizando ${pdfs.length} estado(s) de cuenta con la IA…` });

        const out: { name: string; ok: boolean; dup?: boolean; text: string }[] = [];
        for (let i = 0; i < pdfs.length; i++) {
            const file = pdfs[i];
            try {
                const folder = uploadAccountId || "auto";
                const path = `${PREFIX}/${folder}/${Date.now()}_${i}_${file.name.replace(/[^\w.\-]/g, "_")}`;
                const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: "application/pdf" });
                if (upErr) throw upErr;
                const fileUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

                const res = await fetch("/api/finance/parse-statement", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ fileUrl, fileName: file.name, accountId: uploadAccountId || null }),
                });
                const json = await res.json();
                if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
                const s = json.summary || {};
                if (json.duplicate) {
                    const motivo = json.reason === "file" ? "archivo idéntico" : "mismo corte ya cargado";
                    out.push({ name: file.name, ok: true, dup: true, text: `Duplicado (${motivo}) — se omitió${s.account_name ? ` · ${s.account_name}` : ""}` });
                } else {
                    const parts = [
                        s.account_name || "Tarjeta",
                        `${s.transactions} mov.`,
                        s.new_balance != null ? `saldo ${fmtMoney(s.new_balance)}` : null,
                        s.due_date ? `pago ${fmtDate(s.due_date)}` : null,
                        s.account_created ? "🆕 tarjeta nueva" : null,
                    ].filter(Boolean);
                    out.push({ name: file.name, ok: true, text: parts.join(" · ") });
                }
            } catch (e: any) {
                out.push({ name: file.name, ok: false, text: e.message });
            }
            setProgress({ done: i + 1, total: pdfs.length });
            setResults([...out]);
        }

        setProcessing(false);
        setProgress(null);
        const okCount = out.filter(r => r.ok && !r.dup).length;
        const dupCount = out.filter(r => r.dup).length;
        const errCount = out.filter(r => !r.ok).length;
        setMsg({
            type: errCount > 0 ? "error" : dupCount > 0 ? "info" : "success",
            text: `Listo: ${okCount} analizado(s)${dupCount ? `, ${dupCount} duplicado(s) omitido(s)` : ""}${errCount ? `, ${errCount} con error` : ""} (de ${pdfs.length}).`,
        });
        await fetchAll();
    };

    const deleteAccount = async (id: string) => {
        if (!confirm("¿Eliminar esta tarjeta y todos sus estados de cuenta y movimientos?")) return;
        const { error } = await supabase.from("financial_accounts").delete().eq("id", id);
        if (error) { setMsg({ type: "error", text: error.message }); return; }
        if (uploadAccountId === id) setUploadAccountId("");
        fetchAll();
    };

    const deleteLoan = async (id: string) => {
        if (!confirm("¿Eliminar este préstamo?")) return;
        const { error } = await supabase.from("loans").delete().eq("id", id);
        if (error) { setMsg({ type: "error", text: error.message }); return; }
        fetchAll();
    };

    return (
        <div className="min-h-screen bg-[#0B1120] text-slate-200 p-6 md:p-10 font-[family-name:var(--font-sans)]">
            <div className="w-full space-y-8">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-slate-400 hover:text-white border border-slate-700"><ArrowLeft className="w-5 h-5" /></Link>
                        <div>
                            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                <HeartPulse className="w-8 h-8 text-emerald-400" />
                                Salud Financiera
                            </h1>
                            <p className="text-slate-400 text-sm mt-1">Sube el estado de cuenta de cada tarjeta y la IA clasifica tus ingresos y egresos, tu deuda y tus próximos pagos.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setShowLoan(true)} className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl font-medium text-sm border border-slate-700">
                            <PiggyBank className="w-4 h-4 text-amber-400" /> Agregar préstamo
                        </button>
                        <button onClick={fetchAll} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" disabled={loading}>
                            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-emerald-400")} />
                        </button>
                    </div>
                </header>

                {msg && (
                    <div className={cn(
                        "p-4 rounded-xl border flex items-center gap-3",
                        msg.type === "error" ? "bg-red-500/10 border-red-500/30 text-red-400"
                            : msg.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                : "bg-sky-500/10 border-sky-500/30 text-sky-300"
                    )}>
                        {msg.type === "error" ? <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            : msg.type === "success" ? <CheckCircle className="w-5 h-5 flex-shrink-0" />
                                : <RefreshCw className="w-5 h-5 flex-shrink-0 animate-spin" />}
                        <span className="text-sm">{msg.text}</span>
                    </div>
                )}

                {/* Resumen */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 bg-gradient-to-br from-red-500/10 to-rose-500/5 border border-red-500/30 rounded-3xl p-6 shadow-lg shadow-black/20">
                        <div className="flex items-center gap-3 text-red-300/80 text-sm font-semibold uppercase tracking-wider">
                            <CreditCard className="w-5 h-5" /> Deuda en tarjetas
                        </div>
                        <p className="text-4xl font-bold text-white tracking-tight mt-4">{fmtMoney(resumen.deudaCredito)}</p>
                        <p className="text-slate-400 text-sm mt-2">
                            {resumen.limiteCredito > 0 ? `${Math.round((resumen.deudaCredito / resumen.limiteCredito) * 100)}% de tu línea (${fmtMoney(resumen.limiteCredito)})` : "Suma del último corte de cada tarjeta"}
                        </p>
                    </div>
                    <div className="md:col-span-1 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/30 rounded-3xl p-6 shadow-lg shadow-black/20">
                        <div className="flex items-center gap-3 text-amber-300/80 text-sm font-semibold uppercase tracking-wider">
                            <PiggyBank className="w-5 h-5" /> Préstamos
                        </div>
                        <p className="text-4xl font-bold text-white tracking-tight mt-4">{fmtMoney(resumen.deudaPrestamos)}</p>
                        <p className="text-slate-400 text-sm mt-2">{loans.length} préstamo(s) registrado(s)</p>
                    </div>
                    <div className="md:col-span-1 bg-gradient-to-br from-slate-700/30 to-slate-800/20 border border-slate-600/40 rounded-3xl p-6 shadow-lg shadow-black/20">
                        <div className="flex items-center gap-3 text-slate-300/80 text-sm font-semibold uppercase tracking-wider">
                            <Landmark className="w-5 h-5" /> Deuda total
                        </div>
                        <p className="text-4xl font-bold text-white tracking-tight mt-4">{fmtMoney(resumen.deudaTotal)}</p>
                        <p className="text-slate-400 text-sm mt-2">Tarjetas + préstamos</p>
                    </div>
                </section>

                {/* Subir estado de cuenta */}
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-6 backdrop-blur-sm">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                        <div className="flex items-start gap-3">
                            <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20"><UploadCloud className="w-5 h-5 text-emerald-400" /></div>
                            <div>
                                <h3 className="text-base font-semibold text-white">Subir estados de cuenta (PDF)</h3>
                                <p className="text-slate-400 text-sm mt-0.5 max-w-xl">Sube uno o varios PDF a la vez. Si dejas la tarjeta en "Detectar", la IA identifica a qué tarjeta pertenece cada uno por su banco y últimos 4 (y la crea si no existe).</p>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                            <select
                                value={uploadAccountId}
                                onChange={(e) => setUploadAccountId(e.target.value)}
                                disabled={processing}
                                className="bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 min-w-[200px] disabled:opacity-50"
                            >
                                <option value="">🔎 Detectar tarjeta automáticamente</option>
                                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.last4 ? ` ••${a.last4}` : ""}</option>)}
                            </select>
                            <button
                                onClick={() => fileRef.current?.click()}
                                disabled={processing}
                                className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                                {processing ? <><RefreshCw className="w-4 h-4 animate-spin" /> Analizando…</> : <><FileText className="w-4 h-4" /> Elegir PDFs</>}
                            </button>
                            <button onClick={() => setShowAccount(true)} disabled={processing} className="inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl font-medium text-sm border border-slate-700 whitespace-nowrap disabled:opacity-50">
                                <Plus className="w-4 h-4 text-emerald-400" /> Nueva tarjeta
                            </button>
                            <input ref={fileRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={(e) => { handleStatementsUpload(e.target.files); e.target.value = ""; }} />
                        </div>
                    </div>

                    {/* Progreso */}
                    {progress && (
                        <div className="mt-5">
                            <div className="flex items-center justify-between text-sm text-slate-400 mb-2">
                                <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin text-emerald-400" /> Analizando estados de cuenta…</span>
                                <span className="font-medium text-slate-200">{progress.done} / {progress.total}</span>
                            </div>
                            <div className="h-2.5 bg-slate-900/60 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
                            </div>
                        </div>
                    )}

                    {/* Resultados por archivo */}
                    {results.length > 0 && (
                        <div className="mt-5 space-y-2">
                            {results.map((r, i) => (
                                <div key={i} className={cn(
                                    "flex items-start gap-2 text-sm rounded-lg px-3 py-2 border",
                                    r.dup ? "bg-amber-500/5 border-amber-500/20" : r.ok ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"
                                )}>
                                    {r.dup ? <Copy className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" /> : r.ok ? <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />}
                                    <div className="min-w-0">
                                        <p className="text-slate-300 truncate">{r.name}</p>
                                        <p className={cn("text-xs", r.dup ? "text-amber-300" : r.ok ? "text-slate-400" : "text-red-300")}>{r.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Tarjetas registradas */}
                    {accounts.length > 0 && (
                        <div className="mt-5">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                <span className="text-sm font-medium text-slate-300">Tus tarjetas</span>
                                <span className="inline-flex items-center gap-2 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-1.5">
                                    <CreditCard className="w-4 h-4 text-red-400" />
                                    <span className="text-red-300/80">Deuda total tarjetas de crédito:</span>
                                    <span className="text-red-300 font-bold">{fmtMoney(resumen.deudaCredito)}</span>
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {accounts.map(a => {
                                    const st = latestByAccount.get(a.id);
                                    const isCredit = a.type === "credit";
                                    return (
                                        <div key={a.id} className="bg-slate-900/40 border border-slate-700/50 rounded-2xl p-4 flex flex-col gap-2">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-2">
                                                    {isCredit ? <CreditCard className="w-4 h-4 text-red-400" /> : <Wallet className="w-4 h-4 text-sky-400" />}
                                                    <span className="font-semibold text-slate-100 text-sm">{a.name}</span>
                                                    {a.last4 && <span className="text-xs text-slate-500 font-mono">••{a.last4}</span>}
                                                </div>
                                                <button onClick={() => deleteAccount(a.id)} className="text-slate-600 hover:text-red-400 p-1 rounded-md hover:bg-slate-800"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className={cn("px-2 py-0.5 rounded-full border", isCredit ? "bg-red-500/10 text-red-300 border-red-500/20" : "bg-sky-500/10 text-sky-300 border-sky-500/20")}>
                                                    {isCredit ? "Crédito" : "Débito"}
                                                </span>
                                                {st ? (
                                                    <span className="text-slate-400">{isCredit ? "Deuda" : "Saldo"}: <span className={cn("font-semibold", isCredit ? "text-red-300" : "text-slate-200")}>{fmtMoney(st.new_balance)}</span></span>
                                                ) : (
                                                    <span className="text-slate-600">Sin estados de cuenta</span>
                                                )}
                                            </div>
                                            {st?.due_date && (
                                                <p className="text-xs text-amber-300/80 flex items-center gap-1"><CalendarClock className="w-3 h-3" /> Pago: {fmtDate(st.due_date)}</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Próximos pagos */}
                <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-slate-200 flex items-center gap-2"><CalendarClock className="w-5 h-5 text-amber-400" /> Próximos pagos</h2>
                    {resumen.pagos.length === 0 ? (
                        <p className="text-slate-500 text-sm bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">Aún no hay pagos próximos. Sube estados de cuenta o agrega préstamos.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {resumen.pagos.map((p, i) => (
                                <div key={i} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-slate-100">{p.label}</span>
                                        <span className={cn("text-xs px-2 py-0.5 rounded-full border", p.kind === "prestamo" ? "bg-amber-500/10 text-amber-300 border-amber-500/20" : "bg-red-500/10 text-red-300 border-red-500/20")}>{p.kind === "prestamo" ? "Préstamo" : "Tarjeta"}</span>
                                    </div>
                                    <p className="text-2xl font-bold text-white tracking-tight">{fmtMoney(p.amount)}</p>
                                    <p className="text-xs text-slate-400">{p.sub}</p>
                                    <p className={cn("text-sm font-medium mt-1 flex items-center gap-1.5", p.date ? "text-amber-300" : "text-slate-500")}>
                                        <CalendarClock className="w-3.5 h-3.5" /> {p.date ? fmtDate(p.date) : "Sin fecha"}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Préstamos */}
                {loans.length > 0 && (
                    <section className="space-y-4">
                        <h2 className="text-xl font-semibold text-slate-200 flex items-center gap-2"><PiggyBank className="w-5 h-5 text-amber-400" /> Préstamos</h2>
                        <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl overflow-hidden backdrop-blur-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs font-semibold tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4">Acreedor</th>
                                            <th className="px-6 py-4">Descripción</th>
                                            <th className="px-6 py-4 text-right">Saldo</th>
                                            <th className="px-6 py-4 text-right">Pago mensual</th>
                                            <th className="px-6 py-4">Próximo pago</th>
                                            <th className="px-6 py-4 text-right">Tasa</th>
                                            <th className="px-6 py-4 text-right"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {loans.map(l => (
                                            <tr key={l.id} className="hover:bg-slate-800/80 transition-colors">
                                                <td className="px-6 py-4 font-medium text-slate-100">{l.lender}</td>
                                                <td className="px-6 py-4 text-slate-400 max-w-[260px] truncate">{l.description || "—"}</td>
                                                <td className="px-6 py-4 text-right font-medium text-amber-300">{fmtMoney(l.balance)}</td>
                                                <td className="px-6 py-4 text-right text-slate-200">{fmtMoney(l.monthly_payment)}</td>
                                                <td className="px-6 py-4 text-slate-400">{fmtDate(l.next_payment_date)}</td>
                                                <td className="px-6 py-4 text-right text-slate-400">{l.interest_rate != null ? `${l.interest_rate}%` : "—"}</td>
                                                <td className="px-6 py-4 text-right"><button onClick={() => deleteLoan(l.id)} className="text-slate-600 hover:text-red-400 p-1 rounded-md hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                )}

                {/* Gasto por categoría + totales */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-slate-800/40 border border-slate-700/50 rounded-3xl p-6 backdrop-blur-sm">
                        <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2 mb-4"><Tags className="w-5 h-5 text-emerald-400" /> Gasto por categoría {(fAccount !== "all" || fType !== "all" || fCategory !== "all" || search) && <span className="text-xs text-slate-500">(filtrado)</span>}</h2>
                        {catBreakdown.length === 0 ? (
                            <p className="text-slate-500 text-sm">Sin egresos para mostrar.</p>
                        ) : (
                            <div className="space-y-2.5">
                                {catBreakdown.map(c => (
                                    <div key={c.cat} className="flex items-center gap-3">
                                        <span className="w-40 text-sm text-slate-300 capitalize flex-shrink-0 truncate">{c.cat}</span>
                                        <div className="flex-1 h-6 bg-slate-900/50 rounded-lg overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-emerald-500/60 to-teal-500/60 rounded-lg" style={{ width: `${(c.total / maxCat) * 100}%` }} />
                                        </div>
                                        <span className="w-32 text-right text-sm font-medium text-slate-200 flex-shrink-0">{fmtMoney(c.total)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="space-y-4">
                        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/30 rounded-3xl p-5">
                            <div className="flex items-center gap-2 text-emerald-300/80 text-xs font-semibold uppercase tracking-wider"><TrendingUp className="w-4 h-4" /> Ingresos</div>
                            <p className="text-2xl font-bold text-white mt-2">{fmtMoney(totals.ingresos)}</p>
                        </div>
                        <div className="bg-gradient-to-br from-red-500/10 to-rose-500/5 border border-red-500/30 rounded-3xl p-5">
                            <div className="flex items-center gap-2 text-red-300/80 text-xs font-semibold uppercase tracking-wider"><TrendingDown className="w-4 h-4" /> Egresos</div>
                            <p className="text-2xl font-bold text-white mt-2">{fmtMoney(totals.egresos)}</p>
                        </div>
                        <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-5">
                            <div className="flex items-center gap-2 text-teal-300/80 text-xs font-semibold uppercase tracking-wider"><CreditCard className="w-4 h-4" /> Pagos a tarjeta</div>
                            <p className="text-2xl font-bold text-white mt-2">{fmtMoney(totals.pagosTarjeta)}</p>
                        </div>
                    </div>
                </section>

                {/* Movimientos */}
                <section className="space-y-4">
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-5 backdrop-blur-sm flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[220px]">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar concepto..." className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50" />
                        </div>
                        <select value={fAccount} onChange={(e) => setFAccount(e.target.value)} className="bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-sm text-slate-200">
                            <option value="all">Todas las tarjetas</option>
                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        <select value={fCategory} onChange={(e) => setFCategory(e.target.value)} className="bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-sm text-slate-200 capitalize">
                            <option value="all">Todas las categorías</option>
                            {allCategories.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                        </select>
                        <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-700/50 rounded-xl p-1">
                            {([["all", "Todos"], ["expense", "Egresos"], ["income", "Ingresos"], ["payment", "Pagos"]] as const).map(([k, label]) => (
                                <button key={k} onClick={() => setFType(k)} className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors", fType === k ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:text-white")}>{label}</button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl overflow-hidden backdrop-blur-sm">
                        <div className="p-5 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/20">
                            <h2 className="text-lg font-semibold text-white">Movimientos <span className="text-sm font-normal text-slate-400">{filteredTxs.length}</span></h2>
                        </div>
                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs font-semibold tracking-wider sticky top-0">
                                    <tr>
                                        <th className="px-6 py-4">Fecha</th>
                                        <th className="px-6 py-4">Concepto</th>
                                        <th className="px-6 py-4">Tarjeta</th>
                                        <th className="px-6 py-4">Categoría</th>
                                        <th className="px-6 py-4 text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {loading ? (
                                        <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-emerald-500" />Cargando...</td></tr>
                                    ) : filteredTxs.length === 0 ? (
                                        <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                            <div className="bg-slate-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700"><FileText className="w-8 h-8 text-slate-500" /></div>
                                            <p className="text-lg text-slate-300 font-medium">Sin movimientos</p>
                                            <p className="text-sm mt-1">Sube un estado de cuenta para empezar.</p>
                                        </td></tr>
                                    ) : (
                                        filteredTxs.map(t => {
                                            const acc = t.account_id ? accountById.get(t.account_id) : null;
                                            return (
                                                <tr key={t.id} className="hover:bg-slate-800/80 transition-colors">
                                                    <td className="px-6 py-3.5 text-slate-400">{fmtDate(t.tx_date)}</td>
                                                    <td className="px-6 py-3.5 text-slate-200 max-w-[360px] truncate" title={t.description || ""}>{t.description || "—"}</td>
                                                    <td className="px-6 py-3.5 text-slate-400">{acc?.name || "—"}</td>
                                                    <td className="px-6 py-3.5"><span className={cn("text-xs font-medium px-2.5 py-1 rounded-full border capitalize", catColor(t.category))}>{t.category || "otros"}</span></td>
                                                    <td className={cn("px-6 py-3.5 text-right font-medium", t.type === "income" ? "text-emerald-400" : t.type === "payment" ? "text-teal-300" : "text-slate-200")}>
                                                        {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}{fmtMoney(t.amount)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <p className="text-xs text-slate-500 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" /> Los PDF se guardan en tu almacenamiento de Supabase. Como contienen datos sensibles, considera usar un bucket privado.
                </p>
            </div>

            {showAccount && <AddAccountModal onClose={() => setShowAccount(false)} onSaved={() => { setShowAccount(false); fetchAll(); }} />}
            {showLoan && <AddLoanModal onClose={() => setShowLoan(false)} onSaved={() => { setShowLoan(false); fetchAll(); }} />}
        </div>
    );
}

// ===================== Modal: Nueva tarjeta =====================
function AddAccountModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
    const [name, setName] = useState("");
    const [type, setType] = useState<"credit" | "debit">("credit");
    const [bank, setBank] = useState("");
    const [last4, setLast4] = useState("");
    const [cutDay, setCutDay] = useState("");
    const [creditLimit, setCreditLimit] = useState("");
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const save = async () => {
        if (!name.trim()) { setErr("Ponle un nombre a la tarjeta."); return; }
        setSaving(true); setErr(null);
        const { error } = await supabase.from("financial_accounts").insert({
            name: name.trim(),
            type,
            bank: bank.trim() || null,
            last4: last4.trim() || null,
            cut_day: cutDay ? Number(cutDay) : null,
            credit_limit: creditLimit ? Number(creditLimit) : null,
        });
        setSaving(false);
        if (error) { setErr(error.message); return; }
        onSaved();
    };

    return (
        <ModalShell title="Nueva tarjeta" onClose={onClose}>
            <div className="space-y-4">
                <Field label="Nombre *"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. BBVA Oro, Amex Gold" className={inputCls} /></Field>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Tipo">
                        <select value={type} onChange={(e) => setType(e.target.value as any)} className={inputCls}>
                            <option value="credit">Crédito</option>
                            <option value="debit">Débito</option>
                        </select>
                    </Field>
                    <Field label="Banco"><input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="BBVA, Santander…" className={inputCls} /></Field>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <Field label="Últimos 4"><input value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" className={inputCls} /></Field>
                    <Field label="Día de corte"><input value={cutDay} onChange={(e) => setCutDay(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="15" className={inputCls} /></Field>
                    <Field label="Línea de crédito"><input value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} inputMode="decimal" placeholder="50000" className={inputCls} /></Field>
                </div>
                {err && <p className="text-sm text-red-400">{err}</p>}
            </div>
            <ModalFooter onClose={onClose} onSave={save} saving={saving} />
        </ModalShell>
    );
}

// ===================== Modal: Nuevo préstamo =====================
function AddLoanModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
    const [lender, setLender] = useState("");
    const [description, setDescription] = useState("");
    const [principal, setPrincipal] = useState("");
    const [balance, setBalance] = useState("");
    const [monthly, setMonthly] = useState("");
    const [nextDate, setNextDate] = useState("");
    const [rate, setRate] = useState("");
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const save = async () => {
        if (!lender.trim()) { setErr("¿A quién le debes? Pon el acreedor."); return; }
        setSaving(true); setErr(null);
        const { error } = await supabase.from("loans").insert({
            lender: lender.trim(),
            description: description.trim() || null,
            principal: principal ? Number(principal) : null,
            balance: balance ? Number(balance) : null,
            monthly_payment: monthly ? Number(monthly) : null,
            next_payment_date: nextDate || null,
            interest_rate: rate ? Number(rate) : null,
            notes: notes.trim() || null,
        });
        setSaving(false);
        if (error) { setErr(error.message); return; }
        onSaved();
    };

    return (
        <ModalShell title="Agregar préstamo" onClose={onClose}>
            <div className="space-y-4">
                <Field label="Acreedor *"><input value={lender} onChange={(e) => setLender(e.target.value)} placeholder="Banco, persona, financiera…" className={inputCls} /></Field>
                <Field label="Descripción"><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Crédito de auto, préstamo personal…" className={inputCls} /></Field>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Monto original"><input value={principal} onChange={(e) => setPrincipal(e.target.value)} inputMode="decimal" placeholder="100000" className={inputCls} /></Field>
                    <Field label="Saldo actual"><input value={balance} onChange={(e) => setBalance(e.target.value)} inputMode="decimal" placeholder="80000" className={inputCls} /></Field>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <Field label="Pago mensual"><input value={monthly} onChange={(e) => setMonthly(e.target.value)} inputMode="decimal" placeholder="5000" className={inputCls} /></Field>
                    <Field label="Próximo pago"><input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} className={inputCls} /></Field>
                    <Field label="Tasa % anual"><input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" placeholder="12" className={inputCls} /></Field>
                </div>
                <Field label="Notas"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={cn(inputCls, "resize-none")} /></Field>
                {err && <p className="text-sm text-red-400">{err}</p>}
            </div>
            <ModalFooter onClose={onClose} onSave={save} saving={saving} />
        </ModalShell>
    );
}

// ===================== Helpers de UI =====================
const inputCls = "w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="text-xs text-slate-400 font-medium block mb-1.5">{label}</span>
            {children}
        </label>
    );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[#0F172A] w-full max-w-lg rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-white">{title}</h2>
                    <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
}

function ModalFooter({ onClose, onSave, saving }: { onClose: () => void; onSave: () => void; saving: boolean }) {
    return (
        <div className="flex justify-end gap-3 mt-6">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700">Cancelar</button>
            <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Guardar
            </button>
        </div>
    );
}
