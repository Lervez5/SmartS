import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const db = prisma as any;

export async function getStudentDashboardData(studentId: string) {
  const [upcomingClasses, pendingAssignments, recentGrades, notifications, progress] = await Promise.all([
    // Upcoming classes (next 7 days)
    db.class.findMany({
      where: {
        enrollments: { some: { studentId } },
        schedule: { gte: new Date() },
      },
      take: 5,
      orderBy: { schedule: "asc" },
      include: { teacher: { select: { name: true } }, subject: { select: { name: true } } },
    }),
    // Pending assignments
    db.assignment.findMany({
      where: {
        class: { enrollments: { some: { studentId } } },
        submissions: { none: { studentId } },
        dueDate: { gte: new Date() },
      },
      take: 5,
      orderBy: { dueDate: "asc" },
    }),
    // Recent grades (last 5 attempts)
    db.attempt.findMany({
      where: { child: { userId: studentId } },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { exercise: { include: { lesson: true } } },
    }),
    // Unread notifications
    db.notification.findMany({
      where: { userId: studentId, read: false },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
    // Subject progress
    db.progress.findMany({
      where: { child: { userId: studentId } },
      include: { subject: true },
    }),
  ]);

  return {
    upcomingClasses,
    pendingAssignments,
    recentGrades,
    notifications,
    progress,
  };
}

export async function getTeacherDashboardData(teacherId: string) {
  const [classesTaught, pendingGrading, recentSubmissions, attendanceSummary] = await Promise.all([
    // Classes taught
    db.class.findMany({
      where: { teacherId },
      include: { subject: true, _count: { select: { enrollments: true } } },
    }),
    // Pending grading
    db.submission.findMany({
      where: { assignment: { class: { teacherId } }, status: "pending" },
      take: 10,
      include: { student: { select: { name: true, email: true } }, assignment: true },
    }),
    // Recent submissions
    db.submission.findMany({
      where: { assignment: { class: { teacherId } } },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { student: { select: { name: true } }, assignment: true },
    }),
    // Attendance summary (last 7 days)
    db.attendance.groupBy({
      by: ["status"],
      where: { class: { teacherId }, date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      _count: true,
    }),
  ]);

  return {
    classesTaught,
    pendingGrading,
    recentSubmissions,
    attendanceSummary,
  };
}

export async function getAdminDashboardData() {
  const [stats, revenue, activity, recentUsers, courseStats] = await Promise.all([
    // School statistics
    db.user.groupBy({
      by: ["role"],
      _count: true,
    }),
    // Revenue reports (last 30 days)
    db.payment.aggregate({
      where: { status: "succeeded", createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      _sum: { amountCents: true },
    }),
    // Recent system activity
    db.auditLog.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, email: true, role: true } } },
    }),
    // Recent users
    db.user.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
    // Course statistics
    db.course?.count().catch(() => 0),
  ]);

  return {
    stats,
    revenue,
    activity,
    recentUsers,
    courseCount: courseStats || 0
  };
}
