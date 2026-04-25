import { create } from "zustand";

export type AttendanceStatus = "present" | "absent" | "late" | "excused" | "sick" | "on_leave";

export interface AttendanceRecord {
    studentId: string;
    status: AttendanceStatus;
    note?: string;
}

export interface AttendanceFilters {
    search: string;
    status: AttendanceStatus | "all";
}

interface AttendanceStore {
    selectedClassId: string | null;
    selectedDate: string; // YYYY-MM-DD
    draft: Record<string, AttendanceRecord>; // studentId → record
    isDraft: boolean;
    filters: AttendanceFilters;

    // Actions
    setClass: (classId: string) => void;
    setDate: (date: string) => void;
    markStudent: (studentId: string, status: AttendanceStatus, note?: string) => void;
    bulkMark: (studentIds: string[], status: AttendanceStatus) => void;
    setNote: (studentId: string, note: string) => void;
    setFilter: (filters: Partial<AttendanceFilters>) => void;
    loadExisting: (records: AttendanceRecord[]) => void;
    resetDraft: () => void;
    setIsDraft: (isDraft: boolean) => void;
}

const todayISO = () => new Date().toISOString().split("T")[0];

export const useAttendanceStore = create<AttendanceStore>((set) => ({
    selectedClassId: null,
    selectedDate: todayISO(),
    draft: {},
    isDraft: true,
    filters: { search: "", status: "all" },

    setClass: (classId) => set({ selectedClassId: classId }),
    setDate: (date) => set({ selectedDate: date }),

    markStudent: (studentId, status, note) =>
        set((state) => ({
            draft: {
                ...state.draft,
                [studentId]: { studentId, status, note: note ?? state.draft[studentId]?.note },
            },
        })),

    bulkMark: (studentIds, status) =>
        set((state) => {
            const updated = { ...state.draft };
            for (const id of studentIds) {
                updated[id] = { studentId: id, status, note: updated[id]?.note };
            }
            return { draft: updated };
        }),

    setNote: (studentId, note) =>
        set((state) => ({
            draft: {
                ...state.draft,
                [studentId]: { ...state.draft[studentId], studentId, note },
            },
        })),

    setFilter: (filters) =>
        set((state) => ({ filters: { ...state.filters, ...filters } })),

    loadExisting: (records) => {
        const draft: Record<string, AttendanceRecord> = {};
        for (const r of records) {
            draft[r.studentId] = r;
        }
        set({ draft });
    },

    resetDraft: () => set({ draft: {}, isDraft: true }),
    setIsDraft: (isDraft) => set({ isDraft }),
}));
