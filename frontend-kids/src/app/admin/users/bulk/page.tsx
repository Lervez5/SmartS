"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Users, 
    Upload, 
    FileText, 
    ArrowLeft, 
    Loader2, 
    CheckCircle2, 
    AlertCircle,
    Info,
    Trash2,
    ShieldCheck
} from "lucide-react";
import Link from "next/link";
import axios from "axios";
import { cn } from "@/lib/utils";

import * as XLSX from "xlsx";

export default function BulkImportPage() {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<any[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [resultCount, setResultCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const fileType = selectedFile.name.split('.').pop()?.toLowerCase();
            if (!['json', 'csv', 'xlsx', 'xls'].includes(fileType || '')) {
                setError("Invalid file type. Please upload a JSON, CSV, or Excel file.");
                return;
            }
            setFile(selectedFile);
            setError(null);

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    let users: any[] = [];
                    if (fileType === 'json') {
                        const json = JSON.parse(event.target?.result as string);
                        users = json.users || (Array.isArray(json) ? json : [json]);
                    } else {
                        // Handle CSV and Excel
                        const data = event.target?.result;
                        const workbook = XLSX.read(data, { type: 'binary' });
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        users = XLSX.utils.sheet_to_json(worksheet);
                    }

                    if (users.length === 0) {
                        setError("The file contains no user records.");
                        setPreview(null);
                    } else {
                        // Normalize keys (e.g. FirstName -> firstName, Name -> name)
                        const normalizedUsers = users.map(u => ({
                            email: u.email || u.Email,
                            name: u.name || u.Name || u.firstName || u.FirstName,
                            role: (u.role || u.Role || "student").toLowerCase()
                        })).filter(u => u.email); // Must have email
                        
                        setPreview(normalizedUsers);
                    }
                } catch (e) {
                    console.error("Parse Error:", e);
                    setError("Failed to parse file. Please check the file format.");
                    setPreview(null);
                }
            };

            if (fileType === 'json') {
                reader.readAsText(selectedFile);
            } else {
                reader.readAsBinaryString(selectedFile);
            }
        }
    };

    const handleUpload = async () => {
        if (!preview || preview.length === 0) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await axios.post("http://localhost:4000/api/users/bulk", { users: preview }, {
                withCredentials: true
            });

            setResultCount(response.data.count);
            setSuccess(true);
            setTimeout(() => {
                router.push("/admin");
            }, 2000);
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || "Failed to process batch onboarding.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-20">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                        <Users className="w-8 h-8 text-primary" />
                        Batch Onboarding
                    </h1>
                    <p className="text-muted-foreground mt-1">Provision multiple accounts via secure data stream.</p>
                </div>
                <Link href="/admin" className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:scale-105 transition-transform text-slate-500 dark:text-slate-400">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Action Area */}
                <div className="lg:col-span-7 space-y-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass rounded-[2.5rem] p-8 md:p-10 border border-white/20 dark:border-white/10 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                        
                        <div className="relative z-10 space-y-8">
                            {!success ? (
                                <>
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className={cn(
                                            "border-2 border-dashed rounded-[2.5rem] p-16 text-center cursor-pointer transition-all group",
                                            file ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-800 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                                        )}
                                    >
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            accept=".json,.csv,.xlsx,.xls"
                                            onChange={handleFileChange}
                                        />
                                        <div className="flex flex-col items-center gap-5">
                                            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-inner">
                                                <Upload className="w-10 h-10" />
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-slate-800 dark:text-white">
                                                    {file ? file.name : "Drop JSON, CSV, or Excel file here"}
                                                </p>
                                                <p className="text-sm text-slate-500 mt-2 font-medium">
                                                    Click or drag and drop to select record.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {error && (
                                        <motion.div 
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl text-sm font-bold flex items-center gap-3"
                                        >
                                            <AlertCircle className="w-5 h-5 shrink-0" />
                                            {error}
                                        </motion.div>
                                    )}

                                    <button
                                        onClick={handleUpload}
                                        disabled={!preview || preview.length === 0 || isLoading}
                                        className="w-full py-5 bg-primary text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 shadow-xl shadow-primary/20"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <ShieldCheck className="w-5 h-5" />
                                                Initialize Onboarding
                                            </>
                                        )}
                                    </button>
                                </>
                            ) : (
                                <div className="text-center py-10 space-y-6">
                                    <div className="w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mx-auto border border-green-500/20 shadow-inner animate-bounce">
                                        <CheckCircle2 className="w-12 h-12" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Batch Complete!</h3>
                                        <p className="text-slate-500 font-medium">Successfully provisioned {resultCount} accounts.</p>
                                    </div>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest animate-pulse">Redirecting to Dashboard...</p>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Data Preview Area */}
                    <AnimatePresence>
                        {preview && preview.length > 0 && !success && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="glass rounded-[2.5rem] p-8 border border-white/20 dark:border-white/10 overflow-hidden"
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        Data Summary
                                        <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-black tracking-tighter">
                                            {preview.length} Records
                                        </span>
                                    </h3>
                                    <button 
                                        onClick={() => { setFile(null); setPreview(null); }}
                                        className="text-xs font-bold text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Clear
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {preview.slice(0, 5).map((u, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 bg-white/60 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700 group transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500 dark:text-slate-300 text-xs">
                                                    {u.email.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900 dark:text-white leading-none">{u.name || "User"}</p>
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium">{u.email}</p>
                                                </div>
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-500 dark:text-slate-300">
                                                {u.role || "student"}
                                            </span>
                                        </div>
                                    ))}
                                    {preview.length > 5 && (
                                        <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest pt-4 italic">
                                            + {preview.length - 5} more records in stream
                                        </p>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Information Sidebar */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="glass rounded-[2rem] p-8 border border-white/20 dark:border-white/10 space-y-6">
                        <div className="flex items-center gap-3 text-primary">
                            <Info className="w-6 h-6" />
                            <h4 className="font-bold text-slate-900 dark:text-white">Import Guidelines</h4>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">Required Fields</p>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg text-xs font-mono">
                                        <span className="text-slate-600 dark:text-slate-400">email</span>
                                        <span className="text-emerald-500 font-bold">Required</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg text-xs font-mono">
                                        <span className="text-slate-600 dark:text-slate-400">name <span className="opacity-50 text-[10px]">(or firstName)</span></span>
                                        <span className="text-emerald-500 font-bold">Required</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg text-xs font-mono">
                                        <span className="text-slate-600 dark:text-slate-400">role</span>
                                        <span className="text-slate-400 dark:text-slate-500">Optional (Defaults to student)</span>
                                    </div>
                                </div>
                            </div>

                            <ul className="space-y-3 px-2">
                                {[
                                    "File must be a valid JSON, CSV, or Excel (.xlsx) format.",
                                    "Role must be student, teacher, parent, or admin.",
                                    "Each email must be unique in the system.",
                                    "Invitations will be sent automatically.",
                                    "Tokens are valid for 7 days."
                                ].map((tip, i) => (
                                    <li key={i} className="text-xs text-slate-500 font-medium flex items-start gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                                        {tip}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="bg-slate-900 p-8 rounded-[2rem] text-white space-y-4 shadow-2xl relative overflow-hidden group">
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
                        <h4 className="font-bold text-sm relative z-10">Security Notice</h4>
                        <p className="text-xs text-slate-400 leading-relaxed relative z-10 font-medium">
                            Bulk operations are audited. All invitations generated via this interface are single-use and cryptographically protected. Ensure your data source is verified before initializing onboarding.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
