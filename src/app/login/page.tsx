"use client";

import { useState } from "react";
import { Lock, ArrowRight, Loader2, KeyRound } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectUrl = searchParams.get('redirect') || '/';

    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    let moduleName = "el Sistema Voxa";
    if (redirectUrl.startsWith('/purchases')) moduleName = "Compras";
    if (redirectUrl.startsWith('/sales')) moduleName = "Ventas";
    if (redirectUrl.startsWith('/settings')) moduleName = "Configuración";
    if (redirectUrl.startsWith('/manufacturing/new')) moduleName = "Fabricación";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const result = await loginAction(password, redirectUrl);
            if (result.success && result.redirectTo) {
                router.push(result.redirectTo);
                router.refresh();
            } else {
                setError(result.error || "Error al iniciar sesión.");
            }
        } catch (err: any) {
            setError(err.message || "Error inesperado.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f4f8ff] text-slate-700 flex items-center justify-center p-6 font-[family-name:var(--font-sans)] relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute -top-32 -left-24 w-[34rem] h-[34rem] bg-blue-300/20 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute -bottom-40 -right-24 w-[36rem] h-[36rem] bg-sky-200/30 rounded-full blur-[110px] pointer-events-none"></div>

            <div className="w-full max-w-md bg-white/90 p-10 rounded-[2rem] border border-blue-100 backdrop-blur-xl shadow-[0_24px_70px_rgba(30,64,175,0.12)] relative z-10">
                <div className="flex justify-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                        <KeyRound className="w-8 h-8 text-white" />
                    </div>
                </div>

                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Voxa ERP</h1>
                    <p className="text-slate-500 text-sm">
                        Ingresa la clave para acceder a <strong className="text-slate-800">{moduleName}</strong>
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Contraseña de acceso"
                                className="w-full bg-blue-50/60 border border-blue-100 rounded-xl py-4 pl-12 pr-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
                                autoFocus
                            />
                        </div>
                        {error && (
                            <p className="mt-3 text-sm text-red-400 text-center animate-pulse">{error}</p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || !password}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold transition-all shadow-[0_12px_28px_rgba(37,99,235,0.24)] hover:shadow-[0_16px_34px_rgba(37,99,235,0.3)] flex items-center justify-center gap-2 group"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                Acceder
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#f4f8ff] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
