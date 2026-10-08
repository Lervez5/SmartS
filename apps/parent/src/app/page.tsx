'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Navbar } from '@schoolos/ui';
import { useAuthStore, destinationForRole } from '@schoolos/auth';

interface BrandResponse {
  displayName?: string | null;
  name?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  coverImageAltText?: string | null;
  academicSession?: string | null;
}

export default function HomePage() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const [brand, setBrand] = useState<BrandResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/public/branding', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!res.ok) return;
        setBrand((await res.json()) as BrandResponse);
      } catch {
        // Branding is decorative on the landing page.
      }
    })();
    return () => controller.abort();
  }, []);

  // Authenticated users are redirected to their dashboard.
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const destination = destinationForRole(user.role);
    if (destination) window.location.href = destination;
  }, [isAuthenticated, user]);

  const handleActionClick = () => {
    if (isAuthenticated) {
      const destination = destinationForRole(user?.role);
      if (destination) {
        window.location.href = destination;
        return;
      }
    }
    router.push('/login');
  };

  const schoolName = brand?.displayName ?? brand?.name ?? null;
  const session = brand?.academicSession ?? null;

  return (
    <div className="min-h-screen bg-background flex flex-col selection:bg-primary/20 overflow-hidden relative transition-colors">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_120%,rgba(var(--primary-rgb),0.1),transparent)] pointer-events-none" />
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      <Navbar
        showSearch={false}
        schoolName={schoolName}
        logoUrl={brand?.logoUrl ?? null}
        portalLabel="Parent Portal"
        navbarActions={
          isAuthenticated ? (
            <button
              onClick={handleActionClick}
              className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-full font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
            >
              Enter Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <Link
              href="/login"
              className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-full font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
            >
              Sign In <ArrowRight className="w-4 h-4" />
            </Link>
          )
        }
      />
      <main className="flex-1 flex flex-col items-center justify-center pt-28 pb-20 px-6 relative z-10 w-full max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center w-full">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8 text-center lg:text-left"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 text-blue-700 text-sm font-black uppercase tracking-widest border border-blue-500/20 shadow-sm mx-auto lg:mx-0">
              <ShieldCheck className="w-4 h-4" />
              <span>School Management Platform</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-black text-slate-900 dark:text-white leading-[1.1] tracking-tight">
              Stay connected to{'\n'}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">
                your child's
              </span>{' '}
              school journey.
            </h1>

            <p className="text-xl muted font-medium leading-relaxed max-w-2xl mx-auto lg:mx-0">
              {session
                ? `${session} academic session. Monitor attendance, view reports and messages from your child teachers.`
                : 'Monitor attendance, view reports and messages from your child teachers.'}
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <button
                onClick={handleActionClick}
                className="w-full sm:w-auto px-8 py-4 bg-primary text-white rounded-2xl font-black shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 hover:scale-[1.03] active:scale-[0.97] transition-all text-lg"
              >
                {isAuthenticated ? 'Go to My Dashboard' : 'Sign In to Continue'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative hidden md:block"
          >
            <div className="glass rounded-[3rem] p-8 border border-white/40 dark:border-white/10 shadow-2xl shadow-primary/10 relative overflow-hidden backdrop-blur-xl bg-white/30 dark:bg-slate-900/30 aspect-square flex flex-col justify-between">
              <div className="flex-1 rounded-[2rem] bg-gradient-to-br from-primary/10 to-blue-500/10 border-2 border-dashed border-primary/20 flex flex-col items-center justify-center relative z-0">
                <ShieldCheck className="w-32 h-32 text-primary/30" />
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
