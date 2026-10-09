import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database';

const DAY = 24 * 60 * 60 * 1000;

export async function getStudentDashboardData(schoolId: string, studentId: string) {
  const [upcomingClasses, pendingAssignments, recentGrades, notifications, progress] =
    await Promise.all([
      // Next 5 scheduled classes the student is enrolled in. Scoped through the
      // class's school, so a learner enrolled in two schools sees only this one's.
      prisma.class.findMany({
        where: {
          schoolId,
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
          class: { schoolId, enrollments: { some: { studentId } } },
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
        // The course now carries its school, so this no longer spans schools.
        where: { studentId, course: { schoolId } },
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

export async function getTeacherDashboardData(schoolId: string, teacherId: string) {
  const weekAgo = new Date(Date.now() - 7 * DAY);

  // Scoped through the class's school: a teacher can hold allocations in more
  // than one school, and each portal shows only its own.
  const [classesTaught, pendingGrading, recentSubmissions, attendanceSummary] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId, teacherId },
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
        assignment: { class: { schoolId, teacherId } },
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
      where: { assignment: { class: { schoolId, teacherId } } },
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
      where: { class: { schoolId, teacherId }, date: { gte: weekAgo } },
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

export async function getAdminDashboardData(
  schoolId: string,
  academicYearId?: string,
  termId?: string
) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY);

  // Scoped: the session and term the navbar selects belong to one school, so a
  // session id from another school must not drive this school's figures.
  const session = academicYearId
    ? await prisma.academicYear.findFirst({
        where: { id: academicYearId, schoolId },
        select: { id: true, name: true, startDate: true, endDate: true, terms: true },
      })
    : null;

  const term = termId
    ? await prisma.term.findFirst({
        where: {
          id: termId,
          academicYear: { schoolId },
        },
        select: {
          id: true,
          name: true,
          termNumber: true,
          startDate: true,
          endDate: true,
          academicYearId: true,
        },
      })
    : null;

  // Build date windows for the selected period.
  const sessionWindow = session
    ? { gte: session.startDate, lte: session.endDate }
    : { gte: new Date(Date.now() - 365 * DAY), lte: new Date() };

  const termWindow = term ? { gte: term.startDate, lte: term.endDate } : null;

  // Use term window if a term is selected, otherwise session window.
  const financeWindow = termWindow ?? sessionWindow;

  // Who belongs to this school. Invitations and audit rows reference people by
  // a plain id with no relation, so the membership set is resolved once here and
  // matched against rather than re-querying per aggregate.
  const schoolUserIds = (
    await prisma.schoolMembership.findMany({
      where: { schoolId },
      select: { userId: true },
    })
  ).map((row) => row.userId);

  const [
    roleCounts,
    revenue,
    activity,
    recentUsers,
    courseCount,
    pendingInvitations,
    invoices,
    receipts,
    learners,
  ] = await Promise.all([
    // Users grouped by role membership.
    prisma.userRoleMembership
      .groupBy({
        by: ['roleId'],
        where: { user: { schoolMemberships: { some: { schoolId } } } },
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

    // Paid invoice value in the last 30 days (existing behavior).
    prisma.invoice.aggregate({
      where: {
        status: 'paid',
        paidAt: { gte: thirtyDaysAgo },
        student: { schoolMemberships: { some: { schoolId } } },
      },
      _sum: { amountCents: true },
      _count: true,
    }),

    prisma.auditLog.findMany({
      // Audit rows carry no school of their own, so they are scoped through the
      // actor's membership in this school.
      where: { user: { schoolMemberships: { some: { schoolId } } } },
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
      where: { schoolMemberships: { some: { schoolId } } },
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

    prisma.course.count({ where: { schoolId } }),

    prisma.invitation.count({
      // `invitedBy` is a plain id with no relation, so the school's own members
      // are resolved first and the invitations are matched against them.
      where: {
        status: 'pending',
        invitedBy: { in: schoolUserIds },
      },
    }),

    // Finance metrics for the selected period.
    prisma.invoice.findMany({
      where: {
        issuedAt: financeWindow,
        student: { schoolMemberships: { some: { schoolId } } },
        ...(session?.id
          ? {
              student: {
                studentProfile: {
                  enrollmentDate: { gte: session.startDate, lte: session.endDate },
                },
              },
            }
          : {}),
      },
      select: { amountCents: true, status: true, id: true },
    }),

    // Receipts for the selected period.
    prisma.receipt.findMany({
      where: {
        receivedAt: financeWindow,
        invoice: {
          student: { schoolMemberships: { some: { schoolId } } },
        },
        ...(session?.id
          ? {
              invoice: {
                student: {
                  studentProfile: {
                    enrollmentDate: { gte: session.startDate, lte: session.endDate },
                  },
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        amountCents: true,
        method: true,
        paidByName: true,
        receivedAt: true,
        number: true,
        invoice: {
          select: {
            student: { select: { id: true, name: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { receivedAt: 'desc' },
      take: 20,
    }),

    // Active learners: enrolled within the selected session dates. Scoped to
    // the school through the learner's membership.
    session
      ? prisma.studentProfile.count({
          where: {
            user: { schoolMemberships: { some: { schoolId } } },
            enrollmentDate: { gte: session.startDate, lte: session.endDate },
          },
        })
      : Promise.resolve(0),
  ]);

  const invoicedTotal = invoices.reduce((s, i) => s + i.amountCents, 0);
  const paidInvoices = invoices.filter((i) => i.status === 'paid');
  const collectedTotal = paidInvoices.reduce((s, i) => s + i.amountCents, 0);
  const outstandingCount = invoices.length - paidInvoices.length;
  const outstandingTotal = invoicedTotal - collectedTotal;
  const collectionRate =
    invoicedTotal > 0 ? Math.round((collectedTotal / invoicedTotal) * 1000) / 10 : null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayPayments = receipts.filter((r) => r.receivedAt >= todayStart);
  const todayPaymentsTotal = todayPayments.reduce((s, r) => s + r.amountCents, 0);

  const termPayments = receipts.filter((r) => {
    if (!termWindow) return true;
    return r.receivedAt >= termWindow.gte && r.receivedAt <= termWindow.lte;
  });
  const termCollectionsTotal = termPayments.reduce((s, r) => s + r.amountCents, 0);

  // Arrears: outstanding (unpaid) invoices for the selected session.
  const arrearsCount = outstandingCount;
  const arrearsTotal = outstandingTotal;

  // Collections breakdown by payment method.
  const methodBreakdown = new Map<string, { amountCents: number; count: number }>();
  for (const receipt of receipts) {
    const existing = methodBreakdown.get(receipt.method) ?? { amountCents: 0, count: 0 };
    methodBreakdown.set(receipt.method, {
      amountCents: existing.amountCents + receipt.amountCents,
      count: existing.count + 1,
    });
  }
  const collectionsBreakdown = [...methodBreakdown.entries()].map(([method, data]) => ({
    method,
    amountCents: data.amountCents,
    count: data.count,
    percentage:
      termCollectionsTotal > 0
        ? Math.round((data.amountCents / termCollectionsTotal) * 1000) / 10
        : 0,
  }));

  // Teacher activity: count teaching assignments for the selected session/term.
  const teacherAssignments = await prisma.teachingAssignment.groupBy({
    by: ['teacherId'],
    where: {
      ...(session?.id ? { academicYearId: session.id } : {}),
      ...(termId ? { termId } : {}),
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });

  const teacherIds = teacherAssignments.map((t) => t.teacherId).filter(Boolean);
  const teachers = teacherIds.length
    ? await prisma.user.findMany({
        where: { id: { in: teacherIds } },
        select: { id: true, name: true },
      })
    : [];
  const teacherNameById = new Map(teachers.map((t) => [t.id, t.name ?? 'Unknown']));

  const recentPayments = receipts.map((r) => ({
    id: r.id,
    amountCents: r.amountCents,
    method: r.method,
    paidByName: r.paidByName ?? 'Unknown',
    learnerName: r.invoice?.student
      ? (r.invoice.student.name ??
        [r.invoice.student.firstName, r.invoice.student.lastName].filter(Boolean).join(' ') ??
        'Unknown')
      : 'Unknown',
    reference: r.number,
    receivedAt: r.receivedAt.toISOString(),
  }));

  const stats = roleCounts;

  return {
    context: {
      academicYearId: session?.id ?? null,
      termId: term?.id ?? null,
      termName: term?.name ?? null,
      sessionName: session?.name ?? null,
    },
    financial: {
      collectionRate,
      collectedCents: collectedTotal,
      expectedCents: invoicedTotal,
      activeLearners: learners,
      todayPayments: {
        count: todayPayments.length,
        amountCents: todayPaymentsTotal,
      },
      termCollections: {
        count: termPayments.length,
        amountCents: termCollectionsTotal,
      },
      arrears: {
        count: arrearsCount,
        amountCents: arrearsTotal,
      },
    },
    collections: collectionsBreakdown,
    recentPayments,
    teacherActivity: teacherAssignments.map((t) => ({
      teacherId: t.teacherId,
      teacherName: teacherNameById.get(t.teacherId) ?? 'Unknown',
      assessmentCount: t._count.id,
      learnersAssessed: 0,
    })),
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

export async function getParentDashboardData(schoolId: string, parentUserId: string) {
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

  // Every query below is scoped to this school through the child's class,
  // membership or learning area: a guardian with a child in two schools sees
  // only the school whose portal they are in.
  const [attendance, upcomingClasses, grades, invoices] = await Promise.all([
    prisma.attendance.groupBy({
      by: ['status'],
      where: { studentId: { in: childUserIds }, class: { schoolId } },
      _count: true,
    }),
    prisma.class.findMany({
      where: {
        schoolId,
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
      // Scoped through the learning area: a grade belongs to a school by way of
      // the subject it was recorded in.
      where: {
        studentId: { in: childUserIds },
        subject: { schoolId },
      },
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
      where: {
        studentId: { in: childUserIds },
        student: { schoolMemberships: { some: { schoolId } } },
      },
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
