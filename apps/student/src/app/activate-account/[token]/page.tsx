"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Eye, EyeOff, Loader2, Lock, AlertCircle, CheckCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@schoolos/ui";
import { Input } from "@schoolos/ui";
import { Label } from "@schoolos/ui";
import { authService } from "@schoolos/hooks";
import { useAuthStore } from "@schoolos/auth";
import { Toaster } from "sonner";
import { toast } from "sonner";

const activateSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ActivateForm = z.infer<typeof activateSchema>;

export default function ActivateAccountPage({ params }: { params: Promise<{ token?: string }> }) {
  const router = useRouter();
  const [token, setToken] = useState<string | undefined>(undefined);
  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);
  const { login } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivated, setIsActivated] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<ActivateForm>({
    resolver: zodResolver(activateSchema),
  });

  const onSubmit = async (data: ActivateForm) => {
    if (!token) {
      toast.error("Invalid activation token");
      return;
    }
    setIsLoading(true);
    try {
      const { user } = await authService.activateAccount({ token, password: data.password });

      document.cookie = `userRole=${user.role}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;

      login(user);
      setIsActivated(true);
      toast.success("Account activated successfully!");

      if (user.role === "teacher") {
        router.push("/dashboard/teacher");
      } else if (user.role === "parent") {
        router.push("/parent");
      } else if (user.role === "super_admin" || user.role === "school_admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard/student");
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error?.message || "Failed to activate account";
      setError("password", { message });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isActivated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(at_top_right,_#f0fdf4_0%,_transparent_50%),radial-gradient(at_bottom_left,_#f0f9ff_0%,_transparent_50%)] dark:bg-slate-950 px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="glass rounded-[2rem] p-8 shadow-2xl border border-white/20 dark:border-white/10">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-500 mx-auto mb-6">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Account Activated!</h1>
            <p className="text-muted-foreground mb-6">Welcome to SmartSprout. Redirecting you to your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(at_top_right,_#f0fdf4_0%,_transparent_50%),radial-gradient(at_bottom_left,_#f0f9ff_0%,_transparent_50%)] dark:bg-slate-950 px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="glass rounded-[2rem] p-8 shadow-2xl border border-white/20 dark:border-white/10">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Invalid activation link</h1>
            <p className="text-muted-foreground mb-6">This activation link is invalid or has expired.</p>
            <Link href="/register" className="text-primary font-bold hover:underline">Create a new account</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(at_top_right,_#f0fdf4_0%,_transparent_50%),radial-gradient(at_bottom_left,_#f0f9ff_0%,_transparent_50%)] dark:bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30 rotate-3 transition-transform hover:rotate-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-slate-900 dark:text-white">
              Smart<span className="text-primary">Sprout</span>
            </span>
          </Link>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Activate your account</h1>
          <p className="text-muted-foreground mt-2">Set your password to complete activation</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass rounded-[2rem] p-8 shadow-2xl border border-white/20 dark:border-white/10"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  {...register("password")}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  {...register("confirmPassword")}
                  disabled={isLoading}
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full py-3 text-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Activating...
                </>
              ) : (
                "Activate Account"
              )}
            </Button>
          </form>
        </motion.div>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}