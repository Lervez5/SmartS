"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { UserPlus, Mail, Lock, Shield, ArrowLeft, Loader2, UserCircle, CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";

const inputClass = "w-full bg-white/70 dark:bg-slate-800/70 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-200 dark:border-slate-700 focus:border-primary/60 dark:focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-2xl py-4 px-6 outline-none transition-all shadow-sm font-medium";
const inputWithIconClass = "w-full bg-white/70 dark:bg-slate-800/70 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-200 dark:border-slate-700 focus:border-primary/60 dark:focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-2xl py-4 pl-12 pr-6 outline-none transition-all shadow-sm font-medium";
const labelClass = "text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1";

export default function AddNewUserPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const [formData, setFormData] = useState({
        email: "",
        role: "teacher",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");
        
        try {
            const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
            const res = await fetch(`${API}/users`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    email: formData.email,
                    role: formData.role,
                    sendInvite: true,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Failed to create user");
            }

            setSuccess(true);
            setTimeout(() => router.push("/admin/users"), 1500);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-4xl mx-auto py-12 px-4">
                <Link href="/admin/users" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mb-6">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Users
                </Link>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass rounded-[2.5rem] p-8 md:p-12 border border-white/20 dark:border-white/10"
                >
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                            <UserPlus className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white">Invite New User</h1>
                            <p className="text-sm text-muted-foreground font-medium">They'll receive an email with activation instructions.</p>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl text-sm font-bold">
                            {error}
                        </div>
                    )}

                    {success ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-12"
                        >
                            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-500 mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">User Invited!</h2>
                            <p className="text-muted-foreground">They will receive an email with activation instructions shortly.</p>
                            <Link href="/admin/users">
                                <button className="mt-6 px-6 py-3 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest">
                                    Back to Users
                                </button>
                            </Link>
                        </motion.div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className={labelClass}>Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                                        placeholder="user@school.edu"
                                        className={inputWithIconClass}
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className={labelClass}>Role</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData(p => ({ ...p, role: e.target.value }))}
                                    className={inputClass}
                                    disabled={isLoading}
                                >
                                    <option value="teacher">Teacher</option>
                                    <option value="school_admin">School Admin</option>
                                    <option value="parent">Parent</option>
                                    <option value="student">Student</option>
                                </select>
                            </div>

                            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
                                >
                                    {isLoading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <SendIcon className="w-5 h-5" />
                                            Send Invitation
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </motion.div>
            </div>
        </div>
    );
}

function SendIcon(props: any) {
    return (
        <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
        </svg>
    );
}
