import { prisma } from '../../infrastructure/database';
import { recordAuditLog } from '../audit-logs/service';

const DAY = 24 * 60 * 60 * 1000;

function rangeFrom(query: Record<string, unknown>, defaultDays = 30) {
  const days = query.days ? Number(query.days) : defaultDays;
  const from = query.from ? new Date(String(query.from)) : new Date(Date.now() - days * DAY);
  const to = query.to ? new Date(String(query.to)) : new Date();
  return { from, to };
}

export async function academicReport(query: Record<string, unknown>) {
  const { from, to } = rangeFrom(query);

  const [gradesBySubject, submissions, examinations, enrollments] = await Promise.all([
    prisma.grade.groupBy({
      by: ['subjectId'],
      where: { gradedAt: { gte: from, lte: to } },
      _avg: { value: true },
      _count: true,
    }),
    prisma.submission.groupBy({
      by: ['status'],
      where: { createdAt: { gte: from, lte: to } },
      _count: true,
    }),
    prisma.examAttempt.aggregate({
      where: { createdAt: { gte: from, lte: to } },
      _avg: { score: true },
      _count: true,
    }),
    prisma.enrollment.count({ where: { createdAt: { gte: from, lte: to } } }),
  ]);

  const subjects = await prisma.subject.findMany({
    where: {
      id: {
        in: gradesBySubject.map((g) => g.subjectId).filter(Boolean) as string[],
      },
    },
    select: { id: true, name: true },
  });
  const nameById = new Map(subjects.map((s) => [s.id, s.name]));

  return {
    range: { from, to },
    subjects: gradesBySubject.map((g) => ({
      subjectId: g.subjectId,
      name: nameById.get(g.subjectId as string) ?? 'Unassigned',
      average: g._avg.value ?? 0,
      count: g._count,
    })),
    submissions: submissions.map((s) => ({
      status: s.status,
      count: s._count,
    })),
    examinations: {
      averageScore: examinations._avg.score ?? 0,
      attempts: examinations._count,
    },
    newEnrollments: enrollments,
  };
}

export async function attendanceReport(query: Record<string, unknown>) {
  const { from, to } = rangeFrom(query);

  const [byStatus, byClass, daily] = await Promise.all([
    prisma.attendance.groupBy({
      by: ['status'],
      where: { date: { gte: from, lte: to } },
      _count: true,
    }),
    prisma.attendance.groupBy({
      by: ['classId'],
      where: { date: { gte: from, lte: to } },
      _count: true,
    }),
    prisma.attendance.findMany({
      where: { date: { gte: from, lte: to } },
      select: { date: true, status: true },
    }),
  ]);

  const classes = await prisma.class.findMany({
    where: {
      id: { in: byClass.map((c) => c.classId).filter(Boolean) as string[] },
    },
    select: { id: true, name: true },
  });
  const nameById = new Map(classes.map((c) => [c.id, c.name]));

  const present = byStatus.find((s) => s.status === 'present')?._count ?? 0;
  const total = byStatus.reduce((sum, s) => sum + s._count, 0);

  return {
    range: { from, to },
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    byClass: byClass.map((c) => ({
      classId: c.classId,
      name: nameById.get(c.classId as string) ?? 'Unassigned',
      count: c._count,
    })),
    rate: total > 0 ? Math.round((present / total) * 100) : 0,
    totalRecords: daily.length,
  };
}

export async function financialReport(query: Record<string, unknown>) {
  const { from, to } = rangeFrom(query, 90);

  const [invoices, paid, outstanding, expenses] = await Promise.all([
    prisma.invoice.aggregate({
      where: { issuedAt: { gte: from, lte: to } },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: { status: 'paid', paidAt: { gte: from, lte: to } },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: { status: { not: 'paid' }, issuedAt: { gte: from, lte: to } },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: { createdAt: { gte: from, lte: to } },
      _sum: { amountCents: true },
      _count: true,
    }),
  ]);

  return {
    range: { from, to },
    invoicedCents: invoices._sum.amountCents ?? 0,
    invoicedCount: invoices._count,
    collectedCents: paid._sum.amountCents ?? 0,
    collectedCount: paid._count,
    outstandingCents: outstanding._sum.amountCents ?? 0,
    outstandingCount: outstanding._count,
    expensesCents: expenses._sum?.amountCents ?? 0,
    expensesCount: expenses._count,
  };
}

export async function platformAnalytics() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY);
  const sixtyDaysAgo = new Date(Date.now() - 60 * DAY);

  const [users, activeUsers, courses, classes, recentUsers] = await Promise.all([
    prisma.user.count(),
    // Users created in the window stand in for activity; the User model has
    // no lastLoginAt column.
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.course.count(),
    prisma.class.count(),
    prisma.user.count({
      where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
    }),
  ]);

  const completion = await prisma.courseEnrollment.aggregate({
    _avg: { progress: true },
    _count: true,
  });

  return {
    users: {
      total: users,
      activeLast30Days: activeUsers,
      previous30Days: recentUsers,
    },
    courses: { total: courses },
    classes: { total: classes },
    engagement: {
      averageCourseProgress: completion._avg.progress ?? 0,
      trackedEnrollments: completion._count,
    },
  };
}

export async function triggerExport(
  userId: string,
  body: { reportType?: string; format?: string }
) {
  await recordAuditLog(
    userId,
    'EXPORT_REPORT',
    `Requested ${body.reportType ?? 'unspecified'} report export as ${body.format ?? 'json'}`
  );
  return {
    status: 'queued',
    reportType: body.reportType ?? 'unspecified',
    format: body.format ?? 'json',
    requestedAt: new Date(),
  };
}
