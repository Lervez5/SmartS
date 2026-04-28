import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

const API = "http://localhost:4000/api";

export function useTeacherCohorts() {
    return useQuery({
        queryKey: ["teacher-cohorts"],
        queryFn: () => axios.get(`${API}/classes/teacher/my-cohorts`, { withCredentials: true }).then(r => r.data),
    });
}

export function useAllCohorts() {
    return useQuery({
        queryKey: ["admin-all-cohorts"],
        queryFn: () => axios.get(`${API}/classes/admin/all-cohorts`, { withCredentials: true }).then(r => r.data),
    });
}

export function useCohortDetails(id: string) {
    return useQuery({
        queryKey: ["cohort", id],
        queryFn: () => axios.get(`${API}/classes/${id}`, { withCredentials: true }).then(r => r.data),
        enabled: !!id,
    });
}

export function useUpdateCohort() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => 
            axios.put(`${API}/classes/${id}`, data, { withCredentials: true }).then(r => r.data),
        onSuccess: (_, variables) => {
            qc.invalidateQueries({ queryKey: ["teacher-cohorts"] });
            qc.invalidateQueries({ queryKey: ["admin-all-cohorts"] });
            qc.invalidateQueries({ queryKey: ["cohort", variables.id] });
        },
    });
}
