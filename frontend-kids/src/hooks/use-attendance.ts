import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

const API = "http://localhost:4000/api";
const config = { withCredentials: true };

// ─── Teacher Hooks ─────────────────────────────────────────────────────────────

export function useTodayClasses() {
    return useQuery({
        queryKey: ["attendance", "today"],
        queryFn: async () => {
            const { data } = await axios.get(`${API}/attendance/today`, config);
            return data as {
                id: string;
                name: string;
                subject: string;
                schedule: string;
                totalStudents: number;
                markedCount: number;
                isSubmitted: boolean;
            }[];
        },
        refetchInterval: 30000, // refresh every 30s
    });
}

export function useClassRoster(classId: string, date: string, enabled = true) {
    return useQuery({
        queryKey: ["attendance", "roster", classId, date],
        queryFn: async () => {
            const { data } = await axios.get(`${API}/attendance/roster/${classId}`, {
                ...config,
                params: { date },
            });
            return data as {
                student: {
                    id: string;
                    name: string | null;
                    firstName: string | null;
                    lastName: string | null;
                    email: string;
                    avatar: string | null;
                };
                attendance: {
                    id: string;
                    status: string;
                    note: string | null;
                    submittedAt: string | null;
                } | null;
            }[];
        },
        enabled: !!classId && !!date && enabled,
    });
}

export function useMarkAttendance() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: {
            classId: string;
            date: string;
            records: { studentId: string; status: string; note?: string }[];
            isDraft?: boolean;
        }) => {
            const { data } = await axios.post(`${API}/attendance/mark`, payload, config);
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["attendance", "roster", variables.classId] });
            queryClient.invalidateQueries({ queryKey: ["attendance", "today"] });
        },
    });
}

// ─── Student Hooks ─────────────────────────────────────────────────────────────

export function useMyAttendance(params?: { classId?: string; startDate?: string; endDate?: string }) {
    return useQuery({
        queryKey: ["attendance", "me", params],
        queryFn: async () => {
            const { data } = await axios.get(`${API}/attendance/history/me`, {
                ...config,
                params,
            });
            return data as {
                records: {
                    id: string;
                    status: string;
                    note: string | null;
                    date: string;
                    class: { id: string; name: string; subject: { name: string } };
                }[];
                stats: {
                    total: number;
                    present: number;
                    absent: number;
                    percentage: number;
                };
            };
        },
    });
}

// ─── Admin / Reports ───────────────────────────────────────────────────────────

export function useAttendanceReports(params?: {
    classId?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
}) {
    return useQuery({
        queryKey: ["attendance", "reports", params],
        queryFn: async () => {
            const { data } = await axios.get(`${API}/attendance/reports`, {
                ...config,
                params,
            });
            return data;
        },
    });
}
