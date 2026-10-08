"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@schoolos/auth";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
    const { user, isAuthenticated } = useAuthStore();
    const router = useRouter();

    useEffect(() => {
        if (!isAuthenticated) {
            router.push("/login");
            return;
        }

        if (user) {
            if (user.role === "student") {
                router.push("/dashboard/student");
            } else if (user.role === "parent") {
                router.push("/parent");
            } else if (user.role === "super_admin" || user.role === "school_admin") {
                router.push("/admin");
            } else {
                router.push("/dashboard/teacher");
            }
        }
    }, [user, isAuthenticated, router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-slate-500 font-bold">Redirecting to your dashboard...</p>
        </div>
    );
}
