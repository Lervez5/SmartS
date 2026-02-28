"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { User, Mail, Lock, ArrowRight, Sparkles, ShieldCheck, UserPlus } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

const ROLES = [
    { value: "student", label: "Student", icon: "🌱", description: "Learn and grow with fun exercises" },
    { value: "parent", label: "Parent", icon: "👨‍👩‍👧", description: "Manage subscriptions and track progress" }
];

export default function RegisterPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("student");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const login = useAuthStore((state) => state.login);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const res = await fetch("http://localhost:4000/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ name, email, password, role }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Registration failed");
            }

            const data = await res.json();
            login(data.user);

            // Redirect based on role
            if (data.user.role === "admin" || data.user.role === "staff") router.push("/admin");
            else if (data.user.role === "parent") router.push("/parent");
            else router.push("/dashboard/student");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 selection:bg-primary/20 transition-colors">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_120%,rgba(var(--primary-rgb),0.1),transparent)] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl"
            >
                <div className="glass rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-primary/5 border border-white/40 dark:border-white/10 relative overflow-hidden">
                    {/* Decorative Elements */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-brand-light/20 rounded-full blur-3xl pointer-events-none" />

                    <div className="text-center mb-10">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-white mb-6 shadow-xl rotate-3"
                        >
                            <UserPlus className="w-8 h-8" />
                        </motion.div>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Join SmartSprout</h1>
                        <p className="text-muted-foreground mt-2 font-medium">Start your learning adventure today!</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Full Name</label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Your Name"
                                            className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-primary/50 focus:bg-white dark:focus:bg-slate-950 rounded-2xl py-4 pl-12 pr-4 outline-none transition-all shadow-sm text-foreground"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Email Address</label>
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

                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Password</label>
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
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Select Your Role</label>
                                <div className="grid grid-cols-1 gap-3">
                                    {ROLES.map((r) => (
                                        <button
                                            key={r.value}
                                            type="button"
                                            onClick={() => setRole(r.value)}
                                            className={cn(
                                                "flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group",
                                                role === r.value
                                                    ? "bg-primary/5 border-primary shadow-sm"
                                                    : "bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-colors",
                                                role === r.value ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                            )}>
                                                {r.icon}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{r.label}</div>
                                                <div className="text-[10px] text-muted-foreground font-medium">{r.description}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl text-sm font-bold flex items-center gap-2"
                            >
                                <ShieldCheck className="w-5 h-5" />
                                {error}
                            </motion.div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-primary text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-xl shadow-primary/20"
                        >
                            {isLoading ? (
                                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    Create My Account
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-10 text-center">
                        <p className="text-muted-foreground font-medium">
                            Already have an account?{" "}
                            <Link href="/login" className="text-primary font-bold hover:underline">
                                Sign In
                            </Link>
                        </p>
                    </div>
                </div>

                <div className="mt-8 flex items-center justify-center gap-8 text-muted-foreground/40 font-bold uppercase tracking-[0.2em] text-[10px]">
                    <span className="flex items-center gap-2 saturate-0 opacity-50"><Sparkles className="w-3 h-3" /> Secure Account</span>
                    <span className="flex items-center gap-2 saturate-0 opacity-50"><ShieldCheck className="w-3 h-3" /> Family Safe</span>
                </div>
            </motion.div>
        </div>
    );
}
