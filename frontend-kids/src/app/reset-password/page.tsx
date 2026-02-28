"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, ArrowRight, Sparkles, ShieldCheck, CheckCircle2 } from "lucide-react";

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const res = await fetch("http://localhost:4000/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Failed to reset password");
            }

            setIsSuccess(true);
            setTimeout(() => router.push("/login"), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="text-center">
                <p className="text-destructive font-bold mb-4">Invalid or missing reset token.</p>
                <Link href="/login" className="text-primary font-bold hover:underline">Back to Login</Link>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md">
            <div className="glass rounded-[2.5rem] p-8 md:p-10 shadow-2xl shadow-primary/5 border border-white/40 dark:border-white/10 relative overflow-hidden">
                {!isSuccess ? (
                    <>
                        <div className="text-center mb-10">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-white mb-6 shadow-xl rotate-3"
                            >
                                <Lock className="w-8 h-8" />
                            </motion.div>
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Set New Password</h1>
                            <p className="text-muted-foreground mt-2 font-medium">Make it strong and easy to remember!</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">New Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-primary/50 focus:bg-white dark:focus:bg-slate-950 rounded-2xl py-4 pl-12 pr-4 outline-none transition-all shadow-sm text-foreground"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Confirm Password</label>
                                <div className="relative group">
                                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="password"
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-primary/50 focus:bg-white dark:focus:bg-slate-950 rounded-2xl py-4 pl-12 pr-4 outline-none transition-all shadow-sm text-foreground"
                                    />
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
                                className="w-full bg-primary text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-primary/20"
                            >
                                {isLoading ? (
                                    <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        Update Password
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="text-center py-8">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-500 mb-6"
                        >
                            <CheckCircle2 className="w-8 h-8" />
                        </motion.div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-4">Password Updated!</h2>
                        <p className="text-muted-foreground font-medium mb-8">Your account is safe. Diverting you to the login page...</p>
                        <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: "100%" }}
                                transition={{ duration: 3 }}
                                className="h-full bg-green-500"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 selection:bg-primary/20 leading-relaxed transition-colors">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_120%,rgba(var(--primary-rgb),0.05),transparent)] pointer-events-none" />

            <Suspense fallback={<div className="text-primary font-bold animate-pulse uppercase tracking-[0.3em]">Loading Security Layer...</div>}>
                <ResetPasswordForm />
            </Suspense>

            <div className="fixed bottom-8 text-center w-full text-muted-foreground/30 font-bold uppercase tracking-[0.2em] text-[10px] pointer-events-none">
                SmartSprout Security Gateway
            </div>
        </div>
    );
}
