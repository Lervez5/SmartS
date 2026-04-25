"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, User, Lock, ArrowRight, Shield } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { authService } from "@/services/auth.service";

export default function LoginPage() {
    const router = useRouter();
    const login = useAuthStore((state) => state.login);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const data = await authService.login({ email, password });
            login(data.user);

            // Redirect based on role
            if (data.user.role === "super_admin" || data.user.role === "school_admin") {
                router.push("/admin");
            } else if (data.user.role === "teacher") {
                router.push("/dashboard/teacher");
            } else if (data.user.role === "parent") {
                router.push("/parent");
            } else {
                router.push("/dashboard/student");
            }
        } catch (err: any) {
            const message = err.response?.data?.message || err.message || "Login failed. Please check your connection.";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center p-6 bg-background transition-colors">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="glass rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden group border border-white/40 dark:border-white/10">
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative z-10 space-y-8">
                        <header className="text-center space-y-2">
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-primary rounded-xl md:rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl shadow-primary/20 mb-4 md:mb-6 rotate-3">
                                <Sparkles className="w-6 h-6 md:w-8 md:h-8" />
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Welcome Back!</h1>
                            <p className="text-xs md:text-sm text-muted-foreground font-medium">Ready for another learning sprout?</p>
                        </header>

                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Email Address</label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="hello@smartsprout.com"
                                            className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-primary focus:bg-white dark:focus:bg-slate-950 rounded-2xl py-4 pl-12 pr-4 outline-none transition-all shadow-sm text-foreground"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between items-center ml-1">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-500">Password</label>
                                        <Link href="/forgot-password" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
                                            Forgot?
                                        </Link>
                                    </div>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-primary focus:bg-white dark:focus:bg-slate-950 rounded-2xl py-4 pl-12 pr-4 outline-none transition-all shadow-sm text-foreground"
                                        />
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl text-sm font-bold">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-primary text-white rounded-2xl py-4 font-black shadow-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-primary/20"
                            >
                                {isLoading ? (
                                    <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        Sign In to Sprout
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="text-center border-t border-slate-100 dark:border-slate-800 pt-8">
                            <p className="text-muted-foreground font-medium text-sm italic">
                                LMS Provisioned Access Only. Contact your administrator to join.
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </main>
    );
}
