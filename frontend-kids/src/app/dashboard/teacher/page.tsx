"use client";

import React, { useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";
import { TeacherView } from "@/features/dashboard/components/teacher-view";

export default function TeacherDashboardPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    
    useEffect(() => {
        if (!user) return;
        
        // Enforce teacher role
        if (user.role !== "teacher") {
            router.push(user.role === "student" ? "/dashboard/student" : user.role === "parent" ? "/parent" : "/admin");
        }
    }, [user, router]);

    return <TeacherView />;
}
