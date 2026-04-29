import { PrismaClient } from "@prisma/client";
import { createManyNotificationsRepo } from "../notifications/repository";
import { io } from "../../shared/socket";

const prisma = new PrismaClient();

/**
 * Create an assignment with automatic notifications to enrolled students
 */
export const createAssignment = async (data: {
  title: string;
  description?: string;
  dueDate?: Date;
  classId: string;
  rubric?: any;
  maxScore?: number;
}) => {
  return await prisma.assignment.create({
    data: {
      title: data.title,
      description: data.description,
      dueDate: data.dueDate as Date,
      classId: data.classId,
      rubric: data.rubric,
      maxScore: data.maxScore,
    },
  });
};

export const createAssignmentWithNotifications = async (
  data: {
    title: string;
    description?: string;
    dueDate?: Date;
    classId: string;
    rubric?: any;
    maxScore?: number;
  },
  teacherId: string
) => {
  // Create the assignment
  const assignment = await prisma.assignment.create({
    data: {
      title: data.title,
      description: data.description,
      dueDate: data.dueDate as Date,
      classId: data.classId,
      rubric: data.rubric,
      maxScore: data.maxScore,
    },
  });

  // Fetch enrolled students
  const enrollments = await prisma.enrollment.findMany({
    where: { classId: data.classId },
    select: { studentId: true },
  });

  const studentIds = enrollments.map((e) => e.studentId);

  // Create notifications for each enrolled student (bulk insert)
  if (studentIds.length > 0) {
    await createManyNotificationsRepo(
      studentIds.map((studentId) => ({
        userId: studentId,
        title: `New Assignment: ${data.title}`,
        body:
          data.description ||
          `A new assignment has been posted in your class${data.dueDate ? `, due ${data.dueDate.toLocaleDateString()}` : ''}`,
      }))
    );
  }

  // Get class info for the response
  const classInfo = await prisma.class.findUnique({
    where: { id: data.classId },
    select: { name: true, subjectId: true },
  });

  return {
    assignment,
    notificationsSent: studentIds.length,
    enrolledStudents: studentIds.length,
    className: classInfo?.name,
  };
};

export const getAssignmentsByClassId = async (classId: string) => {
  return await prisma.assignment.findMany({
    where: { classId },
    orderBy: { createdAt: "desc" },
  });
};

export const getAssignmentById = async (id: string) => {
  return await prisma.assignment.findUnique({
    where: { id },
    include: {
      class: {
        select: {
          name: true,
          teacher: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });
};

export const getAssignmentWithSubmissions = async (id: string, classId: string) => {
  return await prisma.assignment.findUnique({
    where: { id, classId },
    include: {
      submissions: {
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      class: {
        select: {
          name: true,
        },
      },
    },
  });
};

/**
 * Get all submissions for an assignment with late status tracking
 */
export const getAssignmentSubmissions = async (assignmentId: string) => {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  });

  const submissions = await prisma.submission.findMany({
    where: { assignmentId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // Determine late status
  const now = new Date();
  const withLateStatus = submissions.map((s) => {
    const submittedAt = s.createdAt;
    const isLate = assignment?.dueDate && submittedAt > assignment.dueDate;
    return {
      ...s,
      isLate,
      daysLate: isLate ? Math.ceil((submittedAt.getTime() - (assignment?.dueDate?.getTime() || 0)) / (1000 * 60 * 60 * 24)) : 0,
    };
  });

  return { submissions: withLateStatus, assignment };
};

export const submitAssignment = async (data: {
  assignmentId: string;
  studentId: string;
  content: string;
  fileUrl?: string;
}) => {
  const submission = await prisma.submission.create({
    data: {
      assignmentId: data.assignmentId,
      studentId: data.studentId,
      content: data.content,
      fileUrl: data.fileUrl,
    },
  });

  // Check if late
  const assignment = await prisma.assignment.findUnique({
    where: { id: data.assignmentId },
  });

  const isLate = assignment?.dueDate && submission.createdAt > assignment.dueDate;

  return { submission, isLate };
};

export const gradeSubmission = async (
  id: string,
  score: number,
  feedback: string,
  rubricScores?: any
) => {
  const result = await prisma.submission.update({
    where: { id },
    data: {
      score,
      feedback,
      rubricScores,
      status: "graded",
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // Notify student via notification
  if (result.studentId) {
    await createManyNotificationsRepo([
      {
        userId: result.studentId,
        title: `Assignment Graded: ${result.assignmentId?.slice(0, 8)}...`,
        body: `Your submission received a score of ${score} - ${feedback}`,
      },
    ]);
  }

  return result;
};

export const getUnsubmittedStudents = async (assignmentId: string) => {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      class: {
        include: {
          enrollments: {
            include: {
              student: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
      submissions: true,
    },
  });

  if (!assignment) return [];

  const submittedStudentIds = new Set(assignment.submissions.map((s) => s.studentId));
  const unsubmitted = assignment.class.enrollments
    .filter((e) => !submittedStudentIds.has(e.studentId))
    .map((e) => e.student);

  return unsubmitted;
};

export const updateAssignment = async (
  id: string,
  data: {
    title?: string;
    description?: string;
    dueDate?: Date;
    rubric?: any;
    maxScore?: number;
  }
) => {
  return await prisma.assignment.update({
    where: { id },
    data,
  });
};

export const deleteAssignment = async (id: string) => {
  return await prisma.assignment.delete({ where: { id } });
};