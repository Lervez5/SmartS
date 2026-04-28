import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const API = "http://localhost:4000/api";

export function useAcademicReport() {
    return useQuery({
        queryKey: ["report", "academic"],
        queryFn: () => axios.get(`${API}/reporting/academic`, { withCredentials: true }).then(r => r.data),
    });
}

export function useAttendanceReport() {
    return useQuery({
        queryKey: ["report", "attendance"],
        queryFn: () => axios.get(`${API}/reporting/attendance`, { withCredentials: true }).then(r => r.data),
    });
}

export function useFinancialReport() {
    return useQuery({
        queryKey: ["report", "financial"],
        queryFn: () => axios.get(`${API}/reporting/financial`, { withCredentials: true }).then(r => r.data),
    });
}

export function usePlatformAnalytics() {
    return useQuery({
        queryKey: ["report", "analytics"],
        queryFn: () => axios.get(`${API}/reporting/analytics`, { withCredentials: true }).then(r => r.data),
    });
}
