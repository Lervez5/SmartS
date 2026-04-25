"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, CheckCircle2, AlertCircle, Loader2, Sparkles, ArrowRight } from "lucide-react";
import axios from "axios";
import { useAuthStore } from "@/store/auth.store";

export default function ActivateAccountPage() {
    const { token } = useParams();
    const router = useRouter();
    const login = useAuthStore((state) => state.login);
    
    const [invitation, setInvitation] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isActivating, setIsActivating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        const validateToken = async () => {
            try {
                const response = await axios.get(`http://localhost:4000/api/invitations/validate/\${token}`);
                setInvitation(response.data);
            } catch (err: any) {
                setError(err.response?.data?.message || "Invalid or expired invitation.");
            } finally {
                setIsLoading(false);
            }
        };
        validateToken();
    }, [token]);

    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        setIsActivating(true);
        setError(null);

        try {
            await axios.post(`http://localhost:4000/api/invitations/activate/\${token}`, { password });
            setIsSuccess(true);
            
            // Wait a moment then redirect to login
            setTimeout(() => {
                router.push("/login");
            }, 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to activate account.");
        } finally {
            setIsActivating(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
            </div>
        );
    }

    if (error && !isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-6">
                <div className="glass p-12 rounded-[2.5rem] text-center max-w-md border border-destructive/20 shadow-2xl">
                    <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-6" />
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Activation Failed</h2>
                    <p className="text-muted-foreground mb-8">{error}</p>
                    <button 
                        onClick={() => router.push("/login")}
                        className="w-full bg-slate-900 dark:bg-slate-800 text-white py-4 rounded-2xl font-black hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-6">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="glass p-12 rounded-[2.5rem] text-center max-w-md border border-green-200 dark:border-green-900/30 shadow-2xl"
                >
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-8">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4">Account Activated!</h2>
                    <p className="text-muted-foreground font-medium mb-8">
                        Welcome to SmartSprout, <strong>{invitation.name}</strong>! Your account is now active. Redirecting you to login...
                    </p>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                            className="h-full bg-green-500"
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 3 }}
                        />
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-6 bg-background">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="glass rounded-[2.5rem] p-10 md:p-12 border border-white/40 dark:border-white/10 shadow-2xl relative overflow-hidden">
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                    
                    <header className="text-center space-y-4 mb-10">
                        <div className="w-16 h-16 bg-primary rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl shadow-primary/20 rotate-3">
                            <Sparkles className="w-8 h-8" />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Activate Account</h1>
                        <p className="text-sm text-muted-foreground font-medium">
                            Welcome, <span className="text-primary font-bold">{invitation.name}</span>! Please set a secure password to activate your <span className="capitalize">{invitation.role}</span> account.
                        </p>
                    </header>

                    <form onSubmit={handleActivate} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">New Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <input 
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-primary rounded-2xl py-4 pl-12 pr-4 outline-none transition-all shadow-sm text-foreground"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Confirm Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <input 
                                        type="password"
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-primary rounded-2xl py-4 pl-12 pr-4 outline-none transition-all shadow-sm text-foreground"
                                    />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl text-sm font-bold flex items-center gap-2">
                                <AlertCircle className="w-5 h-5" />
                                {error}
                            </div>
                        )}

                        <button 
                            type="submit"
                            disabled={isActivating}
                            className="w-full bg-primary text-white py-4 rounded-2xl font-black shadow-xl shadow-primary/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {isActivating ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>
                                    Activate My Account
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </motion.div>
        </main>
    );
}
