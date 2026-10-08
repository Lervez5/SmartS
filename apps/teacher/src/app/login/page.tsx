"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Eye, EyeOff, Loader2, Mail, Lock, AlertCircle } from "lucide-react";
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

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const response = await authService.login(data);
      const { user } = response;

      if (user.role !== "teacher") {
        toast.error("This portal is for teachers only");
        setIsLoading(false);
        return;
      }

      document.cookie = `userRole=${user.role}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;

      login(user);
      toast.success("Welcome back!");
      router.push("/dashboard/teacher");
    } catch (error: any) {
      const message = error.response?.data?.message || "Invalid credentials";
      setError("email", { message });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(at_top_right,_#f0fdf4_0%,_transparent_50%),radial-gradient(at_bottom_left,_#f0f9ff_0%,_transparent_50%)] dark:bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden border border-white/40 dark:border-white/10"
        >
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-8">
            <header className="text-center space-y-2">
              <Link href="/" className="inline-flex flex-col items-center gap-3 mb-4 md:mb-6">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-primary rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-xl shadow-primary/20 rotate-3">
                  <Sparkles className="w-6 h-6 md:w-8 md:h-8" />
                </div>
                <span className="font-extrabold text-xl md:text-2xl tracking-tight text-slate-900 dark:text-white">
                  Smart<span className="text-primary">Sprout</span>
                </span>
              </Link>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Welcome Back!</h1>
              <p className="text-xs md:text-sm text-muted-foreground font-medium">Ready for another learning sprout?</p>
            </header>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@school.edu"
                  className="pl-10"
                  {...register("email")}
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-sm text-primary hover:underline font-bold">
                  Forgot password?
                </Link>
              </div>
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

            <Button
              type="submit"
              className="w-full py-3 text-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Signing in...
                </>
              ) : (
                "Sign In to Sprout"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account?{" "}
            <Link href="/register" className="text-primary font-bold hover:underline">
              Register as teacher
            </Link>
          </p>
          </div>
        </motion.div>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}