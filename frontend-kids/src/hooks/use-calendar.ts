import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

const API = "http://localhost:4000/api";
const config = { withCredentials: true };

export interface CalendarEventPayload {
    title: string;
    description?: string;
    type: string;
    startDate: string;
    endDate?: string;
    allDay?: boolean;
    classId?: string;
    assignmentId?: string;
    visibility?: "personal" | "class" | "school";
    color?: string;
}

export function useCalendarEvents(start?: string, end?: string) {
    return useQuery({
        queryKey: ["calendar", "events", start, end],
        queryFn: async () => {
            const { data } = await axios.get(`${API}/calendar/events`, {
                ...config,
                params: { start, end },
            });
            return data as {
                id: string;
                title: string;
                description: string | null;
                type: string;
                startDate: string;
                endDate: string | null;
                allDay: boolean;
                color: string;
                visibility: string;
                classId: string | null;
                assignmentId: string | null;
                createdBy: string;
            }[];
        },
        staleTime: 60_000,
    });
}

export function useTodayEvents() {
    return useQuery({
        queryKey: ["calendar", "today"],
        queryFn: async () => {
            const { data } = await axios.get(`${API}/calendar/today`, config);
            return data as any[];
        },
        refetchInterval: 60_000,
    });
}

export function useCreateCalendarEvent() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: CalendarEventPayload) => {
            const { data } = await axios.post(`${API}/calendar/events`, payload, config);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["calendar"] });
        },
    });
}

export function useUpdateCalendarEvent() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...payload }: CalendarEventPayload & { id: string }) => {
            const { data } = await axios.put(`${API}/calendar/events/${id}`, payload, config);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["calendar"] });
        },
    });
}

export function useDeleteCalendarEvent() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await axios.delete(`${API}/calendar/events/${id}`, config);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["calendar"] });
        },
    });
}
