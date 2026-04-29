import { PrismaClient } from "@prisma/client";
import { createManyNotificationsRepo } from "../../notifications/repository";

const prisma = new PrismaClient();

/**
 * Submit an assignment response
 * Handles file uploads via URL reference
 */
export async function submitAssignment(
  assignmentId: string,
  studentId: string,
  content: string,
  fileUrl?: string
) {
  // Check if already submitted
  const existing = await prisma.submission.findFirst({
    where: { assignmentId, studentId },
  });

  if (existing) {
    // Update existing submission
    return await prisma.submission.update({
      where: { id: existing.id },
      data: {
        content,
        fileUrl,
      },
    });
  }

  return await prisma.submission.create({
    data: {
      assignmentId,
      studentId,
      content,
      fileUrl,
    },
  });
}

/**
 * Get all submissions by student
 */
export async function getStudentSubmissions(studentId: string) {
  return await prisma.submission.findMany({
    where: { studentId },
    include: {
      assignment: {
        include: {
          class: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get submission details
 */
export async function getSubmissionDetails(submissionId: string, studentId?: string) {
  const where: any = { id: submissionId };
  if (studentId) {
    where.studentId = studentId;
  }
  return await prisma.submission.findFirst({
    where,
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      assignment: {
        include: {
          class: {
            select: {
              name: true,
              teacher: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
    },
  });
}
