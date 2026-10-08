"use client";

import React, { useEffect, useState } from "react";
import { Users, ShieldAlert, History as HistoryIcon, Search, MoreVertical, UserPlus, Loader2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@schoolos/utils";
import { useAuthStore } from "@schoolos/auth";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  isActive: boolean;
  invitationStatus: string;
}

export default function AdminUsersPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!user || (user.role !== "super_admin" && user.role !== "school_admin")) {
      router.push("/login");
      return;
    }
    fetchUsers();
  }, [user, router]);

  async function fetchUsers() {
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
      const res = await fetch(`${API}/users`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    const styles = {
      super_admin: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400",
      school_admin: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400",
      teacher: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
      parent: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
      student: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    };
    return styles[role as keyof typeof styles] || "bg-slate-100 dark:bg-slate-800 text-slate-500";
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            Users
          </h1>
          <p className="text-muted-foreground mt-1">Manage all users across your school.</p>
        </div>
        <Link href="/admin/users/new">
          <button className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform">
            <UserPlus className="w-5 h-5" />
            Add User
          </button>
        </Link>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search users..."
          className="w-full pl-12 pr-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm outline-none focus:border-primary transition-all shadow-sm"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="glass rounded-[2.5rem] border border-white/20 overflow-hidden">
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-12 gap-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <div className="col-span-5">Name</div>
              <div className="col-span-3">Email</div>
              <div className="col-span-2">Role</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((u) => (
                <div key={u.id} className="p-4 hover:bg-white/30 dark:hover:bg-slate-800/30 transition-colors grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-5">
                    <div className="font-bold text-slate-900 dark:text-white">{u.name || "Unnamed User"}</div>
                    <div className="text-xs text-slate-500">Joined {new Date(u.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="col-span-3 text-sm text-slate-600 dark:text-slate-400 truncate">{u.email}</div>
                  <div className="col-span-2">
                    <span className={cn("px-3 py-1 rounded-full text-[10px] font-black", getRoleBadge(u.role))}>
                      {u.role.replace("_", " ")}
                    </span>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center">
                <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500">No users found.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
