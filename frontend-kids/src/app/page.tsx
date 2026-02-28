"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, BookOpen, ShieldCheck, Gamepad2, PlayCircle } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";

export default function HomePage() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();

  const handleActionClick = () => {
    if (isAuthenticated) {
      router.push(user?.role === "parent" ? "/parent" : (user?.role === "admin" || user?.role === "staff" ? "/admin" : "/dashboard/student"));
    } else {
      router.push("/register");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col selection:bg-primary/20 overflow-hidden relative transition-colors">
      {/* Background Orbs matching Auth pages */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_120%,rgba(var(--primary-rgb),0.1),transparent)] pointer-events-none" />
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Custom Minimal Navbar */}
      <header className="fixed top-0 inset-x-0 z-50 transition-all duration-300 backdrop-blur-md bg-white/40 dark:bg-slate-950/40 border-b border-white/20 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30 rotate-3 transition-transform hover:rotate-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-slate-900 dark:text-white">
              Smart<span className="text-primary">Sprout</span>
            </span>
          </Link>

          <nav className="flex items-center gap-6">
            {isAuthenticated ? (
              <button
                onClick={handleActionClick}
                className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-full font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
              >
                Enter Learning Hub <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-bold text-slate-600 hover:text-primary transition-colors hidden sm:block"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-full font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                >
                  Join for Free <Sparkles className="w-4 h-4" />
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center pt-32 pb-20 px-6 relative z-10 w-full max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center w-full">
          {/* Left Column: Copy & Actions */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8 text-center lg:text-left"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 text-blue-700 text-sm font-black uppercase tracking-widest border border-blue-500/20 shadow-sm mx-auto lg:mx-0">
              <ShieldCheck className="w-4 h-4" />
              <span>Safe & Fun Environment</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-black text-slate-900 dark:text-white leading-[1.1] tracking-tight">
              Where brilliant <br className="hidden lg:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">
                little minds
              </span> grow.
            </h1>

            <p className="text-xl text-muted-foreground font-medium leading-relaxed max-w-2xl mx-auto lg:mx-0">
              Your playful space to grow your skills, unlock exciting badges, and explore a whole new universe of learning powered by adaptive AI.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <button
                onClick={handleActionClick}
                className="w-full sm:w-auto px-8 py-4 bg-primary text-white rounded-2xl font-black shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 hover:scale-[1.03] active:scale-[0.97] transition-all text-lg"
              >
                {isAuthenticated ? "Go to My Dashboard" : "Start Learning Today"}
                <ArrowRight className="w-5 h-5" />
              </button>
              {!isAuthenticated && (
                <button
                  className="w-full sm:w-auto px-8 py-4 bg-white/60 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 rounded-2xl font-black glass border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 hover:bg-white dark:hover:bg-slate-900 hover:scale-105 transition-all shadow-sm"
                >
                  <PlayCircle className="w-5 h-5 text-primary" />
                  Watch Demo
                </button>
              )}
            </div>

            <div className="flex items-center gap-6 justify-center lg:justify-start pt-4 text-sm font-bold text-slate-500">
              <span className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Interactive Lessons</span>
              <span className="flex items-center gap-2"><Gamepad2 className="w-4 h-4 text-primary" /> Fun Quizzes</span>
            </div>
          </motion.div>

          {/* Right Column: Visual Elements */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative hidden md:block"
          >
            <div className="glass rounded-[3rem] p-8 border border-white/40 dark:border-white/10 shadow-2xl shadow-primary/10 relative overflow-hidden backdrop-blur-xl bg-white/30 dark:bg-slate-900/30 aspect-square flex flex-col justify-between">

              {/* Decorative Floating Cards */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="absolute top-12 -right-8 glass rounded-2xl p-4 border border-white/50 dark:border-white/10 shadow-xl bg-white/70 dark:bg-slate-900/70 flex items-center gap-3 pr-8 shadow-green-500/10"
              >
                <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-500">🏆</div>
                <div>
                  <div className="text-xs font-black uppercase text-slate-400">Achievement</div>
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-200">Math Master</div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1 }}
                className="absolute bottom-24 -left-12 glass rounded-2xl p-4 border border-white/50 shadow-xl bg-white/70 flex items-center gap-3 pr-8 z-10 shadow-blue-500/10"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-500">✨</div>
                <div>
                  <div className="text-xs font-black uppercase text-slate-400">Level Up</div>
                  <div className="text-sm font-bold text-slate-800">You reached Level 5!</div>
                </div>
              </motion.div>

              {/* Center Graphic Frame */}
              <div className="flex-1 rounded-[2rem] bg-gradient-to-br from-primary/10 to-blue-500/10 border-2 border-dashed border-primary/20 flex flex-col items-center justify-center relative z-0">
                <Sparkles className="w-32 h-32 text-primary/30" />
                <div className="absolute inset-0 flex items-center justify-center mix-blend-overlay opacity-30">
                  <div className="w-full h-full bg-[radial-gradient(circle_at_center,theme(colors.primary.DEFAULT)_1px,transparent_1px)] [background-size:24px_24px]" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
