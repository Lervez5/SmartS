import {
  LayoutDashboard,
  BookOpen,
  Trophy,
  LogOut,
  CreditCard,
  ShieldCheck,
  FileText,
  UserCircle,
  ClipboardList,
  CalendarDays,
  Bell,
  Play,
  MessageCircle,
  Users,
  BarChart3,
  Layers,
} from "lucide-react";
import { NavItem } from "./Sidebar";

export const navigation = [
  { name: "Dashboard", href: "/dashboard/student", icon: LayoutDashboard, roles: ["student"] },
  { name: "Cohorts (Classes)", href: "/dashboard/student/courses", icon: BookOpen, roles: ["student"] },
  { name: "Class Sessions", href: "/dashboard/calendar", icon: CalendarDays, roles: ["student"] },
  { name: "Submissions", href: "/dashboard/student/submissions", icon: FileText, roles: ["student"] },
  { name: "Groups", href: "/dashboard/groups", icon: Users, roles: ["student"] },
  { name: "Community", href: "/dashboard/community", icon: MessageCircle, roles: ["student"] },
  { name: "Certificates", href: "/dashboard/certificates", icon: Trophy, roles: ["student"] },
  
  { name: "Teacher Station", href: "/dashboard/teacher", icon: LayoutDashboard, roles: ["teacher"] },
  { name: "Curriculum Architect", href: "/dashboard/teacher/courses", icon: BookOpen, roles: ["teacher"] },
  { name: "Attendance", href: "/dashboard/attendance", icon: ClipboardList, roles: ["teacher"] },
  { name: "Calendar", href: "/dashboard/calendar", icon: CalendarDays, roles: ["teacher"] },
  { name: "Reminders", href: "/dashboard/reminders", icon: Bell, roles: ["teacher"] },
  
  { name: "Parent Portal", href: "/parent", icon: UserCircle, roles: ["parent"] },
  { name: "Subscriptions", href: "/parent/subscriptions", icon: CreditCard, roles: ["parent"] },
  
  { name: "Admin Center", href: "/admin", icon: ShieldCheck, roles: ["super_admin", "school_admin"] },
  { name: "Cohort Manager", href: "/admin/cohorts", icon: Users, roles: ["super_admin", "school_admin"] },
  { name: "Platform Metrics", href: "/admin/metrics", icon: FileText, roles: ["super_admin", "school_admin"] },
  { name: "Audit Logs", href: "/admin/logs", icon: FileText, roles: ["super_admin", "school_admin"] },
  { name: "Platform Reports", href: "/admin/reporting", icon: BarChart3, roles: ["super_admin", "school_admin"] },
  { name: "Module Management", href: "/admin/modules", icon: Layers, roles: ["super_admin", "school_admin"] },
  { name: "Timetable Import", href: "/admin/timetable/bulk", icon: CalendarDays, roles: ["super_admin", "school_admin"] },
];

export const studentNavigation = navigation.filter(item => item.roles.includes("student"));
export const teacherNavigation = navigation.filter(item => item.roles.includes("teacher"));
export const parentNavigation = navigation.filter(item => item.roles.includes("parent"));
export const adminNavigation = navigation.filter(item => item.roles.includes("super_admin") || item.roles.includes("school_admin"));

export const roleNavigation: Record<string, NavItem[]> = {
  super_admin: adminNavigation,
  school_admin: adminNavigation,
  parent: parentNavigation,
  student: studentNavigation,
  teacher: teacherNavigation,
};