import { create } from "zustand";

export type CalendarView = "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek";

export type CalendarEventType =
    | "class_session"
    | "assignment_due"
    | "quiz"
    | "examination"
    | "school_event"
    | "holiday"
    | "personal_reminder"
    | "meeting";

export interface CalendarEvent {
    id: string;
    title: string;
    description?: string;
    type: CalendarEventType;
    startDate: string;
    endDate?: string;
    allDay: boolean;
    classId?: string;
    assignmentId?: string;
    visibility: string;
    color: string;
    createdBy: string;
}

interface CalendarStore {
    activeView: CalendarView;
    selectedDate: Date;
    selectedEvent: CalendarEvent | null;
    isCreateModalOpen: boolean;
    typeFilters: CalendarEventType[];

    setView: (view: CalendarView) => void;
    setSelectedDate: (date: Date) => void;
    selectEvent: (event: CalendarEvent | null) => void;
    openCreateModal: () => void;
    closeCreateModal: () => void;
    toggleTypeFilter: (type: CalendarEventType) => void;
    clearFilters: () => void;
}

export const useCalendarStore = create<CalendarStore>((set) => ({
    activeView: "dayGridMonth",
    selectedDate: new Date(),
    selectedEvent: null,
    isCreateModalOpen: false,
    typeFilters: [],

    setView: (view) => set({ activeView: view }),
    setSelectedDate: (date) => set({ selectedDate: date }),
    selectEvent: (event) => set({ selectedEvent: event }),
    openCreateModal: () => set({ isCreateModalOpen: true }),
    closeCreateModal: () => set({ isCreateModalOpen: false }),
    toggleTypeFilter: (type) =>
        set((state) => ({
            typeFilters: state.typeFilters.includes(type)
                ? state.typeFilters.filter((t) => t !== type)
                : [...state.typeFilters, type],
        })),
    clearFilters: () => set({ typeFilters: [] }),
}));
