export type UserRole = "super_admin" | "school_admin" | "teacher" | "parent" | "student";

export type UserStatus = "pending" | "active" | "suspended" | "archived";

export type Gender = "male" | "female" | "other";

export interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  avatar?: string | null;
  phone?: string | null;
  status: UserStatus;
  passwordHash?: string | null;
  createdAt: Date;
  updatedAt: Date;
  roleMemberships: UserRoleMembership[];
}

export interface UserRoleMembership {
  id: string;
  userId: string;
  role: Role;
  roleId: string;
  createdAt: Date;
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  permissions: RolePermission[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  domain: string;
}

export interface RolePermission {
  id: string;
  roleId: string;
  permission: Permission;
  permissionId: string;
}

// Role-based permission definitions
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: [
    // All permissions
    "users.read", "users.write", "users.delete",
    "attendance.read", "attendance.write", "attendance.delete",
    "finance.read", "finance.write", "finance.delete",
    "classes.read", "classes.write", "classes.delete",
    "grades.write", "grades.read", "grades.delete",
    "lms.read", "lms.write", "lms.delete",
    "reports.read", "reports.write",
    "settings.read", "settings.write",
    "admin.read", "admin.write",
  ],
  school_admin: [
    // School management permissions
    "users.read", "users.write",
    "attendance.read", "attendance.write",
    "finance.read", "finance.write",
    "classes.read", "classes.write",
    "grades.write", "grades.read",
    "lms.read", "lms.write",
    "reports.read",
    "settings.read", "settings.write",
  ],
  teacher: [
    // Teacher-specific permissions
    "attendance.read", "attendance.write",
    "classes.read",
    "grades.write", "grades.read",
    "lms.read", "lms.write",
    "students.read",
  ],
  parent: [
    // Parent-specific permissions
    "children.read",
    "fees.read",
    "attendance.read",
    "grades.read",
    "announcements.read",
    "messages.read", "messages.write",
  ],
  student: [
    // Student-specific permissions
    "classes.read",
    "assignments.read", "assignments.write",
    "grades.read",
    "attendance.read",
    "announcements.read",
    "lms.read",
  ],
};

// Permission domains
export const PERMISSION_DOMAINS = {
  USERS: "users",
  ATTENDANCE: "attendance",
  FINANCE: "finance",
  CLASSES: "classes",
  GRADES: "grades",
  LMS: "lms",
  REPORTS: "reports",
  SETTINGS: "settings",
  ADMIN: "admin",
  CHILDREN: "children",
  FEES: "fees",
  ANNOUNCEMENTS: "announcements",
  MESSAGES: "messages",
  ASSIGNMENTS: "assignments",
  STUDENTS: "students",
} as const;

// Role descriptions
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  super_admin: "Full system access with all permissions",
  school_admin: "School administration with management permissions",
  teacher: "Teaching staff with classroom and student management",
  parent: "Guardian with access to child's information and communications",
  student: "Learner with access to classes, assignments, and grades",
};
