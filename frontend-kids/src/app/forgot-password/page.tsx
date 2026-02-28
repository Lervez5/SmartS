"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, ArrowRight, Sparkles, KeyRound, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const res = await fetch("http://localhost:4000/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Something went wrong");
            }

            setIsSent(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 selection:bg-primary/20 transition-colors">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_120%,rgba(var(--primary-rgb),0.05),transparent)] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="glass rounded-[2.5rem] p-8 md:p-10 shadow-2xl shadow-primary/5 border border-white/40 dark:border-white/10 relative overflow-hidden">
                    <div className="absolute -top-12 -right-12 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

                    {!isSent ? (
                        <>
                            <div className="text-center mb-10">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500 mb-6 shadow-lg rotate-3"
                                >
                                    <KeyRound className="w-8 h-8" />
                                </motion.div>
                                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Forgot Password?</h1>
                                <p className="text-muted-foreground mt-2 font-medium leading-relaxed">No worries! Enter your email and we'll send you a rescue link.</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Your Email</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@example.com"
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
                                            Send Reset Link
                                            <ArrowRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="text-center py-4">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-500 mb-6"
                            >
                                <CheckCircle2 className="w-8 h-8" />
                            </motion.div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-4">Check Your Inbox!</h2>
                            <p className="text-muted-foreground font-medium mb-8">We've sent a recovery link to <span className="text-slate-900 dark:text-white font-bold">{email}</span>. Please check your spam folder too!</p>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 text-primary font-black text-sm uppercase tracking-widest hover:underline"
                            >
                                Back to Sign In
                            </Link>
                        </div>
                    )}

                    <div className="mt-10 text-center border-t border-slate-100 dark:border-slate-800 pt-8">
                        <p className="text-muted-foreground font-medium">
                            Suddenly remembered?{" "}
                            <Link href="/login" className="text-primary font-bold hover:underline">
                                Sign In
                            </Link>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
