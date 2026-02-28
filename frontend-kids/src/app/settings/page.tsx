"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { User, Mail, Shield, Bell, Save, UserCircle, Briefcase, LogOut, Upload, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

const SECTIONS = [
    { id: "profile", label: "My Profile", icon: User },
    { id: "security", label: "Security", icon: Shield },
    { id: "notifications", label: "Notifications", icon: Bell },
];

export default function SettingsPage() {
    const router = useRouter();
    const { user, login, logout } = useAuthStore();
    const [activeSection, setActiveSection] = useState("profile");
    const [isSaving, setIsSaving] = useState(false);

    // Profile State
    const [name, setName] = useState(user?.name || "");
    const [firstName, setFirstName] = useState(user?.firstName || "");
    const [lastName, setLastName] = useState(user?.lastName || "");
    const [avatar, setAvatar] = useState(user?.avatar || "");

    // Security State
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // Feedback State
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    React.useEffect(() => {
        if (user) {
            setName(user.name || "");
            setFirstName(user.firstName || "");
            setLastName(user.lastName || "");
            setAvatar(user.avatar || "");
        }
    }, [user]);

    const handleSave = async () => {
        setError("");
        setSuccess("");

        if (activeSection === "profile") {
            setIsSaving(true);
            try {
                const res = await fetch("http://localhost:4000/api/users/me", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ name, firstName, lastName, avatar }),
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.message || "Failed to update profile");
                }
                const data = await res.json();
                if (user) {
                    login({
                        ...user,
                        name: data.user.name,
                        firstName: data.user.firstName,
                        lastName: data.user.lastName,
                        avatar: data.user.avatar
                    });
                }
                setSuccess("Profile updated successfully!");
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsSaving(false);
            }
        } else if (activeSection === "security") {
            if (newPassword !== confirmPassword) {
                setError("New passwords do not match.");
                return;
            }
            if (!currentPassword || !newPassword) {
                setError("Please fill in all password fields.");
                return;
            }

            setIsSaving(true);
            try {
                const res = await fetch("http://localhost:4000/api/users/me/password", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ currentPassword, newPassword }),
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.message || "Failed to update password");
                }
                setSuccess("Password updated successfully!");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsSaving(false);
            }
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <header>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Account Settings</h1>
                <p className="text-muted-foreground font-medium mt-1">Manage your identity and learning preferences.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Navigation Sidebar */}
                <div className="space-y-4">
                    <div className="glass rounded-3xl p-4 space-y-1">
                        {SECTIONS.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => {
                                    setActiveSection(section.id);
                                    setError("");
                                    setSuccess("");
                                }}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all",
                                    activeSection === section.id
                                        ? "bg-primary text-white shadow-lg shadow-primary/20"
                                        : "text-muted-foreground hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-primary"
                                )}
                            >
                                <section.icon className="w-5 h-5" />
                                {section.label}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={async () => {
                            try {
                                await fetch("http://localhost:4000/api/auth/logout", {
                                    method: "POST",
                                    credentials: "include"
                                });
                            } catch (e) {
                                console.error(e);
                            }
                            logout();
                            router.push("/login");
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-destructive hover:bg-destructive/10 transition-all"
                    >
                        <LogOut className="w-5 h-5" />
                        Log Out
                    </button>
                </div>

                {/* Content Area */}
                <div className="lg:col-span-3 space-y-8">
                    <div className="glass rounded-[2.5rem] p-8 md:p-10 border border-white/20 dark:border-white/10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                        {activeSection === "profile" && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="space-y-8"
                            >
                                <div className="flex flex-col md:flex-row items-center gap-8">
                                    <div className="relative group">
                                        <div className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-br from-primary to-brand-light flex items-center justify-center text-white text-5xl font-black shadow-2xl overflow-hidden rotate-3 group-hover:rotate-0 transition-transform">
                                            {avatar ? (
                                                <img src={avatar} alt={name} className="w-full h-full object-cover" />
                                            ) : (
                                                user?.name?.[0] || <UserCircle className="w-20 h-20" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-center md:text-left space-y-2">
                                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{user?.name}</h3>
                                        <div className="flex flex-wrap justify-center md:justify-start gap-2">
                                            <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full">{user?.role}</span>
                                            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1">
                                                <Briefcase className="w-3 h-3" />
                                                Verified Account
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">First Name</label>
                                        <input
                                            type="text"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-primary/50 focus:bg-white dark:focus:bg-slate-950 rounded-2xl py-4 px-6 outline-none transition-all shadow-sm font-medium"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Last Name</label>
                                        <input
                                            type="text"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-primary/50 focus:bg-white dark:focus:bg-slate-950 rounded-2xl py-4 px-6 outline-none transition-all shadow-sm font-medium"
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Profile Picture</label>
                                        <div className="flex items-center gap-6">
                                            <div className="w-24 h-24 rounded-3xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden transition-all shadow-inner">
                                                {avatar ? (
                                                    <img src={avatar} alt="Preview" className="w-full h-full object-cover" />
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
                                                                    setAvatar(data.url);
                                                                    setSuccess("Photo selected. Don't forget to save changes!");
                                                                } else {
                                                                    throw new Error(data.message || "Upload failed");
                                                                }
                                                            } catch (err: any) {
                                                                setError(err.message);
                                                            }
                                                        }}
                                                    />
                                                </label>
                                                <p className="text-[10px] text-muted-foreground font-medium ml-1">Recommend 400x400 JPG, PNG or WebP.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Display Name</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-primary/50 focus:bg-white dark:focus:bg-slate-950 rounded-2xl py-4 px-6 outline-none transition-all shadow-sm font-medium"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Email Address</label>
                                        <input
                                            type="email"
                                            readOnly
                                            defaultValue={user?.email}
                                            className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl py-4 px-6 outline-none text-muted-foreground font-medium cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeSection === "security" && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="space-y-8"
                            >
                                <div className="space-y-2 pb-6 border-b border-slate-100">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Security Credentials</h3>
                                    <p className="text-sm text-muted-foreground font-medium">Keep your account guarded with a strong password.</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Current Password</label>
                                        <input
                                            type="password"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-primary/50 focus:bg-white dark:focus:bg-slate-950 rounded-2xl py-4 px-6 outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">New Password</label>
                                            <input
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-primary/50 focus:bg-white dark:focus:bg-slate-950 rounded-2xl py-4 px-6 outline-none transition-all shadow-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Confirm New Password</label>
                                            <input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-primary/50 focus:bg-white dark:focus:bg-slate-950 rounded-2xl py-4 px-6 outline-none transition-all shadow-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {error && (
                            <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl text-sm font-bold">
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 text-green-600 rounded-2xl text-sm font-bold">
                                {success}
                            </div>
                        )}

                        <div className="mt-12 flex justify-end gap-4">
                            <button className="px-8 py-4 rounded-2xl font-bold text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Discard Changes</button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-8 py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-primary/20"
                            >
                                {isSaving ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        Update Settings
                                        <Save className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="glass p-6 rounded-[2rem] flex items-center gap-4 border border-blue-100 dark:border-blue-900/30 bg-blue-50/20 dark:bg-blue-900/10">
                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                                <Shield className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm">Two-Factor Auth</h4>
                                <p className="text-xs text-muted-foreground font-medium">Add an extra layer of protection.</p>
                            </div>
                            <button className="ml-auto text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Enable</button>
                        </div>
                        <div className="glass p-6 rounded-[2rem] flex items-center gap-4 border border-amber-100 dark:border-amber-900/30 bg-amber-50/20 dark:bg-amber-900/10">
                            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
                                <Bell className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm">Learning Alerts</h4>
                                <p className="text-xs text-muted-foreground font-medium">Stay updated on your progress.</p>
                            </div>
                            <button className="ml-auto text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Manage</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
