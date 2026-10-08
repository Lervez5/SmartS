import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database';

const DAY = 24 * 60 * 60 * 1000;

export async function getStudentDashboardData(studentId: string) {
  const [upcomingClasses, pendingAssignments, recentGrades, notifications, progress] =
    await Promise.all([
      // Next 5 scheduled classes the student is enrolled in.
      prisma.class.findMany({
        where: {
          enrollments: { some: { studentId } },
          schedule: { gte: new Date() },
        },
        take: 5,
        orderBy: { schedule: 'asc' },
        select: {
          id: true,
          schedule: true,
          name: true,
          subject: { select: { id: true, name: true } },
          teacher: { select: { id: true, name: true } },
        },
      }),

      // Assignments due that this student has not submitted.
      prisma.assignment.findMany({
        where: {
          class: { enrollments: { some: { studentId } } },
          submissions: { none: { studentId } },
          dueDate: { gte: new Date() },
        },
        take: 5,
        orderBy: { dueDate: 'asc' },
        select: { id: true, title: true, dueDate: true },
      }),

      // Most recent graded exam attempts, shaped for the results card.
      prisma.examAttempt.findMany({
        where: { studentId, score: { not: null } },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          score: true,
          createdAt: true,
          examination: { select: { id: true, title: true, maxScore: true } },
        },
      }),

      prisma.notification.findMany({
        where: { userId: studentId, read: false },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, body: true, createdAt: true },
      }),

      // Per-subject course progress for enrolled courses.
      prisma.courseEnrollment.findMany({
        where: { studentId },
        select: {
          id: true,
          progress: true,
          course: {
            select: {
              id: true,
              title: true,
              subject: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

  return {
    upcomingClasses,
    pendingAssignments,
    recentGrades: recentGrades.map((a) => ({
      id: a.id,
      rawScore: a.score,
      createdAt: a.createdAt,
      exercise: {
        lesson: { title: a.examination.title, id: a.examination.id },
      },
    })),
    notifications,
    progress: progress.map((p) => ({
      id: p.id,
      percent: Math.round(p.progress),
      subject: p.course.subject ?? { id: p.course.id, name: p.course.title },
    })),
  };
}

export async function getTeacherDashboardData(teacherId: string) {
  const weekAgo = new Date(Date.now() - 7 * DAY);

  const [classesTaught, pendingGrading, recentSubmissions, attendanceSummary] = await Promise.all([
    prisma.class.findMany({
      where: { teacherId },
      select: {
        id: true,
        name: true,
        gradeLevel: true,
        schedule: true,
        subject: { select: { id: true, name: true } },
        _count: { select: { enrollments: true } },
      },
    }),

    // Submissions still awaiting a mark.
    prisma.submission.findMany({
      where: {
        status: 'pending',
        assignment: { class: { teacherId } },
      },
      take: 10,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        createdAt: true,
        student: { select: { id: true, name: true, email: true } },
        assignment: { select: { id: true, title: true } },
      },
    }),

    prisma.submission.findMany({
      where: { assignment: { class: { teacherId } } },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        score: true,
        status: true,
        createdAt: true,
        student: { select: { id: true, name: true } },
        assignment: { select: { id: true, title: true } },
      },
    }),

    prisma.attendance.groupBy({
      by: ['status'],
      where: { class: { teacherId }, date: { gte: weekAgo } },
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
  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY);

  const [roleCounts, revenue, activity, recentUsers, courseCount, pendingInvitations] =
    await Promise.all([
      // Users grouped by role membership.
      prisma.userRoleMembership
        .groupBy({
          by: ['roleId'],
          _count: true,
        })
        .then(async (rows) => {
          const roles = await prisma.role.findMany({
            where: { id: { in: rows.map((r) => r.roleId) } },
            select: { id: true, name: true },
          });
          const nameById = new Map(roles.map((r) => [r.id, r.name]));
          return rows.map((r) => ({
            roleId: r.roleId,
            name: nameById.get(r.roleId) ?? 'unknown',
            _count: r._count,
          }));
        }),

      // Paid invoice value in the last 30 days.
      prisma.invoice.aggregate({
        where: { status: 'paid', paidAt: { gte: thirtyDaysAgo } },
        _sum: { amountCents: true },
        _count: true,
      }),

      prisma.auditLog.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          details: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }),

      prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          createdAt: true,
          roleMemberships: { select: { role: { select: { name: true } } } },
        },
      }),

      prisma.course.count(),

      prisma.invitation.count({ where: { status: 'pending' } }),
    ]);

  const stats = roleCounts;

  return {
    stats,
    revenue,
    activity,
    recentUsers: recentUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      status: u.status,
      createdAt: u.createdAt,
      role: u.roleMemberships[0]?.role.name ?? 'student',
    })),
    courseCount,
    pendingInvitations,
  };
}

export async function getParentDashboardData(parentUserId: string) {
  // ParentChildLink keys off profile ids, so resolve the caller's profile first.
  const profile = await prisma.parentProfile.findUnique({
    where: { userId: parentUserId },
    select: { id: true },
  });

  if (!profile) {
    return {
      children: [],
      attendanceSummary: [],
      upcomingClasses: [],
      recentGrades: [],
      invoices: [],
    };
  }

  const links = await prisma.parentChildLink.findMany({
    where: { parentId: profile.id },
    select: {
      childId: true,
      child: {
        select: {
          id: true,
          gradeLevel: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  // Child ids are StudentProfile ids; attendance/grades key off the user id.
  const childUserIds = links.map((l) => l.child.user.id);
  const profileByUser = new Map(links.map((l) => [l.child.user.id, l.child]));

  const [attendance, upcomingClasses, grades, invoices] = await Promise.all([
    prisma.attendance.groupBy({
      by: ['status'],
      where: { studentId: { in: childUserIds } },
      _count: true,
    }),
    prisma.class.findMany({
      where: {
        enrollments: { some: { studentId: { in: childUserIds } } },
        schedule: { gte: new Date() },
      },
      take: 10,
      orderBy: { schedule: 'asc' },
      select: {
        id: true,
        name: true,
        schedule: true,
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, name: true } },
      },
    }),
    prisma.grade.findMany({
      where: { studentId: { in: childUserIds } },
      take: 20,
      orderBy: { gradedAt: 'desc' },
      select: {
        id: true,
        studentId: true,
        value: true,
        scale: true,
        gradedAt: true,
        subject: { select: { id: true, name: true } },
      },
    }),
    prisma.invoice.findMany({
      where: { studentId: { in: childUserIds } },
      take: 10,
      orderBy: { issuedAt: 'desc' },
      select: {
        id: true,
        studentId: true,
        number: true,
        amountCents: true,
        status: true,
        issuedAt: true,
        dueDate: true,
      },
    }),
  ]);

  return {
    children: links.map((l) => ({
      id: l.child.user.id,
      name: l.child.user.name,
      email: l.child.user.email,
      gradeLevel: l.child.gradeLevel,
    })),
    attendanceSummary: attendance,
    upcomingClasses,
    recentGrades: grades.map((g) => ({
      ...g,
      childName: profileByUser.get(g.studentId ?? '')?.user.name ?? null,
    })),
    invoices,
  };
}

export type DashboardPrisma = typeof Prisma;
