import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

const API = "http://localhost:4000/api";

export function useCourses() {
    return useQuery({
        queryKey: ["courses"],
        queryFn: () => axios.get(`${API}/courses`, { withCredentials: true }).then(r => r.data),
    });
}

export function useCourseDetails(id: string) {
    return useQuery({
        queryKey: ["course", id],
        queryFn: () => axios.get(`${API}/courses/${id}`, { withCredentials: true }).then(r => r.data),
        enabled: !!id && id !== "demo",
    });
}

export function useCreateCourse() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: any) => axios.post(`${API}/courses`, data, { withCredentials: true }).then(r => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["courses"] }),
    });
}

export function useUpdateCourse() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => 
            axios.put(`${API}/courses/${id}`, data, { withCredentials: true }).then(r => r.data),
        onSuccess: (_, variables) => {
            qc.invalidateQueries({ queryKey: ["courses"] });
            qc.invalidateQueries({ queryKey: ["course", variables.id] });
        },
    });
}
export function useStudentEnrollments(userId: string) {
    return useQuery({
        queryKey: ["student-enrollments", userId],
        queryFn: () => axios.get(`${API}/courses/student/my-courses`, { withCredentials: true }).then(r => r.data),
        enabled: !!userId,
    });
}

export function useCompleteLesson() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ courseId, lessonId }: { courseId: string, lessonId: string }) => 
            axios.post(`${API}/courses/${courseId}/lessons/${lessonId}/complete`, {}, { withCredentials: true }).then(r => r.data),
        onSuccess: (_, variables) => {
            qc.invalidateQueries({ queryKey: ["student-enrollments"] });
            qc.invalidateQueries({ queryKey: ["course", variables.courseId] });
        },
    });
}
