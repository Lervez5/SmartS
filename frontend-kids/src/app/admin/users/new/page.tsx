"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { UserPlus, Mail, Lock, Shield, ArrowLeft, Loader2, Upload, UserCircle } from "lucide-react";
import Link from "next/link";

export default function AddNewUserPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const [formData, setFormData] = useState({
        email: "",
        password: "",
        role: "student",
        firstName: "",
        lastName: "",
        avatar: "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess(false);
        setIsLoading(true);

        try {
            const res = await fetch("http://localhost:4000/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include", // Requires Admin privileges from HttpOnly Cookie
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Failed to create user");
            }

            setSuccess(true);
            setTimeout(() => {
                router.push("/admin");
            }, 1500);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Provision User</h1>
                    <p className="text-muted-foreground font-medium mt-1">Add a new account to the platform.</p>
                </div>
                <Link href="/admin" className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:scale-105 transition-transform">
                    <ArrowLeft className="w-5 h-5 text-slate-500" />
                </Link>
            </header>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-[2.5rem] p-8 md:p-10 border border-white/20 dark:border-white/10 relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">First Name</label>
                            <input
                                name="firstName"
                                type="text"
                                placeholder="Firstname"
                                value={formData.firstName}
                                onChange={handleChange}
                                className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-primary/50 focus:bg-white dark:focus:bg-slate-950 rounded-2xl py-4 px-6 outline-none transition-all shadow-sm font-medium"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Last Name</label>
                            <input
                                name="lastName"
                                type="text"
                                placeholder="Lastname"
                                value={formData.lastName}
                                onChange={handleChange}
                                className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-primary/50 focus:bg-white dark:focus:bg-slate-950 rounded-2xl py-4 px-6 outline-none transition-all shadow-sm font-medium"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                name="email"
                                type="email"
                                placeholder="user@smartsprout.edu"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-primary/50 focus:bg-white dark:focus:bg-slate-950 rounded-2xl py-4 pl-12 pr-6 outline-none transition-all shadow-sm font-medium"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Profile Picture</label>
                        <div className="flex items-center gap-6">
                            <div className="w-24 h-24 rounded-3xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden transition-all">
                                {formData.avatar ? (
                                    <img src={formData.avatar} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <UserCircle className="w-10 h-10 text-slate-300" />
                                )}
                            </div>
                            <div className="flex-1 space-y-2">
                                <label className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">
                                    <Upload className="w-4 h-4" />
                                    Choose Photo
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;

                                            const uploadData = new FormData();
                                            uploadData.append("file", file);

                                            try {
                                                const res = await fetch("http://localhost:4000/api/upload", {
                                                    method: "POST",
                                                    credentials: "include",
                                                    body: uploadData,
                                                });
                                                const data = await res.json();
                                                if (res.ok) {
                                                    setFormData(prev => ({ ...prev, avatar: data.url }));
                                                } else {
                                                    throw new Error(data.message || "Upload failed");
                                                }
                                            } catch (err: any) {
                                                setError(err.message);
                                            }
                                        }}
                                    />
                                </label>
                                <p className="text-[10px] text-muted-foreground font-medium ml-1">JPG, PNG or WebP. Max 5MB.</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Temporary Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    name="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    minLength={8}
                                    className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-primary/50 focus:bg-white dark:focus:bg-slate-950 rounded-2xl py-4 pl-12 pr-6 outline-none transition-all shadow-sm font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">System Role</label>
                            <div className="relative">
                                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleChange}
                                    className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-primary/50 focus:bg-white dark:focus:bg-slate-950 rounded-2xl py-4 pl-12 pr-6 outline-none transition-all shadow-sm font-medium appearance-none cursor-pointer"
                                    required
                                >
                                    <option value="student">Student</option>
                                    <option value="parent">Parent</option>
                                    <option value="staff">Staff</option>
                                    <option value="admin">Administrator</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl text-sm font-bold animate-in fade-in slide-in-from-top-2">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-600 rounded-2xl text-sm font-bold animate-in fade-in slide-in-from-top-2">
                            User provisioned successfully! Redirecting...
                        </div>
                    )}

                    <div className="pt-6">
                        <button
                            type="submit"
                            disabled={isLoading || success}
                            className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 shadow-xl shadow-primary/20"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : success ? (
                                "Success"
                            ) : (
                                <>
                                    <UserPlus className="w-5 h-5" />
                                    Create User
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
