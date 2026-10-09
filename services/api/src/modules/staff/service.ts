import { prisma } from '../../infrastructure/database';
import { ApiError } from '../../shared/logger';
import { recordAuditLog } from '../../modules/audit-logs/service';
import { ListStaffInput, UpdateStaffInput, CreateStaffInput } from './schema';

export interface StaffMember {
  id: string;
  userId: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  avatar: string | null;
  userStatus: string;
  roles: Array<{ id: string; name: string }>;
  position: string | null;
  department: string | null;
  employeeId: string | null;
  hireDate: string | null;
  status: string;
  assignmentsSummary?: {
    total: number;
    mainTeacherStreams: number;
    assistantTeacherStreams: number;
    subjectTeacherStreams: number;
    learningAreas: number;
  };
}

export interface StaffAssignment {
  id: string;
  responsibility: string;
  status: string;
  canManage: boolean;
  canEnterResults: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  teacher: {
    id: string;
    name: string | null;
    email: string;
  };
  subject: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  academicSession: {
    id: string;
    name: string;
    label: string | null;
    status: string;
  };
  stream: {
    id: string;
    name: string;
    code: string;
    class: {
      id: string;
      name: string;
      gradeLevel: string | null;
    };
  };
}

export async function listStaff(schoolId: string, input: ListStaffInput) {
  const where: Record<string, unknown> = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.accountStatus ? { user: { status: input.accountStatus } } : {}),
    ...(input.role ? { user: { roleMemberships: { some: { role: { name: input.role } } } } } : {}),
    ...(input.search
      ? {
          OR: [
            { position: { contains: input.search, mode: 'insensitive' as const } },
            { department: { contains: input.search, mode: 'insensitive' as const } },
            { employeeId: { contains: input.search, mode: 'insensitive' as const } },
            { user: { name: { contains: input.search, mode: 'insensitive' as const } } },
            { user: { firstName: { contains: input.search, mode: 'insensitive' as const } } },
            { user: { lastName: { contains: input.search, mode: 'insensitive' as const } } },
            { user: { email: { contains: input.search, mode: 'insensitive' as const } } },
            { user: { phone: { contains: input.search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const orderBy = buildOrderBy(input.sort);

  const staff = await prisma.staffProfile.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          avatar: true,
          roleMemberships: { select: { role: { select: { id: true, name: true } } } },
        },
      },
    },
    orderBy,
    ...(input.limit ? { take: input.limit } : {}),
  });

  const userIds = staff.map((s) => s.userId);

  const assignmentsSummary: Record<string, StaffMember['assignmentsSummary']> = {};

  if (input.include === 'assignments' && userIds.length > 0) {
    const allocations = await prisma.streamAllocation.groupBy({
      by: ['teacherId', 'responsibility'],
      where: {
        schoolId,
        teacherId: { in: userIds },
        status: 'active',
      },
      _count: { _all: true },
    });

    const subjectCounts = await prisma.streamAllocation.groupBy({
      by: ['teacherId'],
      where: {
        schoolId,
        teacherId: { in: userIds },
        status: 'active',
        responsibility: 'subject_teacher',
        subjectId: { not: null },
      },
      _count: { subjectId: true },
    });

    const subjectMap = new Map(subjectCounts.map((r) => [r.teacherId, r._count.subjectId]));

    for (const staffMember of staff) {
      const byResponsibility = new Map<string, number>();
      for (const row of allocations) {
        if (row.teacherId === staffMember.userId) {
          byResponsibility.set(row.responsibility, row._count._all);
        }
      }
      const main = byResponsibility.get('main_class_teacher') ?? 0;
      const assistant = byResponsibility.get('assistant_class_teacher') ?? 0;
      const subject = byResponsibility.get('subject_teacher') ?? 0;
      assignmentsSummary[staffMember.userId] = {
        total: main + assistant + subject,
        mainTeacherStreams: main,
        assistantTeacherStreams: assistant,
        subjectTeacherStreams: subject,
        learningAreas: subjectMap.get(staffMember.userId) ?? 0,
      };
    }
  }

  return {
    staff: staff.map((s) => ({
      id: s.id,
      userId: s.userId,
      name: s.user.name,
      firstName: s.user.firstName,
      lastName: s.user.lastName,
      email: s.user.email,
      phone: s.user.phone,
      avatar: s.user.avatar,
      userStatus: s.user.status,
      roles: s.user.roleMemberships.map((m) => m.role),
      position: s.position,
      department: s.department,
      employeeId: s.employeeId,
      hireDate: s.hireDate,
      status: s.status,
      ...(input.include === 'assignments' && assignmentsSummary[s.userId]
        ? { assignmentsSummary: assignmentsSummary[s.userId] }
        : {}),
    })),
  };
}

export async function getStaffMember(schoolId: string, staffId: string) {
  const member = await prisma.staffProfile.findFirst({
    where: { id: staffId, user: { schoolMemberships: { some: { schoolId } } } },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          avatar: true,
          roleMemberships: { select: { role: { select: { id: true, name: true } } } },
        },
      },
    },
  });

  if (!member) return null;

  return {
    id: member.id,
    userId: member.userId,
    name: member.user.name,
    firstName: member.user.firstName,
    lastName: member.user.lastName,
    email: member.user.email,
    phone: member.user.phone,
    avatar: member.user.avatar,
    userStatus: member.user.status,
    roles: member.user.roleMemberships.map((m) => m.role),
    position: member.position,
    department: member.department,
    employeeId: member.employeeId,
    hireDate: member.hireDate,
    status: member.status,
  };
}

export async function createStaff(
  schoolId: string,
  input: CreateStaffInput,
  actorId: string | null
) {
  const user = await prisma.user.findFirst({
    where: { id: input.userId, schoolMemberships: { some: { schoolId } } },
  });
  if (!user) throw new ApiError(404, 'User not found in this school');

  const existing = await prisma.staffProfile.findUnique({
    where: { userId: input.userId },
  });
  if (existing) throw new ApiError(409, 'That user already has a staff profile');

  const staff = await prisma.staffProfile.create({
    data: {
      userId: input.userId,
      position: input.position,
      department: input.department,
      employeeId: input.employeeId,
      hireDate: input.hireDate ? new Date(input.hireDate) : null,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (actorId) {
    await recordAuditLog(actorId, 'staff.created', `Staff profile created for ${user.email}`);
  }

  return staff;
}

export async function updateStaff(
  schoolId: string,
  staffId: string,
  input: UpdateStaffInput,
  actorId: string | null
) {
  const existing = await prisma.staffProfile.findFirst({
    where: { id: staffId, user: { schoolMemberships: { some: { schoolId } } } },
  });
  if (!existing) throw new ApiError(404, 'Staff member not found in this school');

  const staff = await prisma.staffProfile.update({
    where: { id: staffId },
    data: input,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (actorId) {
    await recordAuditLog(actorId, 'staff.updated', `Staff profile updated for ${staff.user.email}`);
  }

  return staff;
}

export async function getStaffAssignments(schoolId: string, userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, schoolMemberships: { some: { schoolId } } },
    select: { id: true, name: true, email: true },
  });
  if (!user) throw new ApiError(404, 'Staff member not found in this school');

  const assignments = await prisma.streamAllocation.findMany({
    where: { schoolId, teacherId: userId },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      subject: { select: { id: true, name: true, code: true } },
      academicYear: { select: { id: true, name: true, label: true, status: true } },
      stream: {
        select: {
          id: true,
          name: true,
          code: true,
          class: { select: { id: true, name: true, gradeLevel: true } },
        },
      },
    },
    orderBy: [
      { academicYear: { startDate: 'desc' } },
      { stream: { class: { name: 'asc' } } },
      { stream: { code: 'asc' } },
      { responsibility: 'asc' },
    ],
  });

  return {
    teacher: user,
    assignments: assignments.map((a) => ({
      id: a.id,
      responsibility: a.responsibility,
      status: a.status,
      canManage: a.canManage,
      canEnterResults: a.canEnterResults,
      effectiveFrom: a.effectiveFrom,
      effectiveTo: a.effectiveTo,
      teacher: a.teacher,
      subject: a.subject,
      academicSession: a.academicYear,
      stream: a.stream,
    })),
  };
}

function buildOrderBy(sort?: string) {
  switch (sort) {
    case 'name_desc':
      return { user: { name: 'desc' as const } };
    case 'newest':
      return { createdAt: 'desc' as const };
    case 'oldest':
      return { createdAt: 'asc' as const };
    case 'hired_asc':
      return { hireDate: 'asc' as const };
    case 'hired_desc':
      return { hireDate: 'desc' as const };
    default:
      return { user: { name: 'asc' as const } };
  }
}
