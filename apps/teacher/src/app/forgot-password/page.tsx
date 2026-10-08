"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Loader2, Mail, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@schoolos/ui";
import { Input } from "@schoolos/ui";
import { Label } from "@schoolos/ui";
import { authService } from "@schoolos/hooks";
import { Toaster } from "sonner";
import { toast } from "sonner";

const forgotSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: ForgotForm) => {
    setIsLoading(true);
    try {
      await authService.forgotPassword({ email: data.email });
      setIsSent(true);
      toast.success("Password reset link sent to your email");
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error?.message || "Failed to send reset link";
      setError("email", { message });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(at_top_right,_#f0fdf4_0%,_transparent_50%),radial-gradient(at_bottom_left,_#f0f9ff_0%,_transparent_50%)] dark:bg-slate-950 px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="glass rounded-[2rem] p-8 shadow-2xl border border-white/20 dark:border-white/10">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-500 mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Check your email</h1>
            <p className="text-muted-foreground mb-6">We've sent a password reset link to your email address.</p>
            <Link href="/login" className="text-primary font-bold hover:underline">Back to Sign In</Link>
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
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Forgot password?</h1>
          <p className="text-muted-foreground mt-2">Enter your email and we'll send you a reset link</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass rounded-[2rem] p-8 shadow-2xl border border-white/20 dark:border-white/10"
        >
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

            <Button
              type="submit"
              className="w-full py-3 text-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                "Send Reset Link"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Remember your password?{" "}
            <Link href="/login" className="text-primary font-bold hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
