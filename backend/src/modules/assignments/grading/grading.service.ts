import { PrismaClient } from "@prisma/client";
import { createManyNotificationsRepo } from "../../notifications/repository";

const prisma = new PrismaClient();

/**
 * Grade a submission with rubric-based scoring
 */
export async function gradeSubmission(
  submissionId: string,
  score: number,
  feedback: string,
  rubricScores?: any,
  graderId?: string
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      assignment: {
        select: {
          id: true,
          title: true,
          maxScore: true,
        },
      },
    },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  const result = await prisma.submission.update({
    where: { id: submissionId },
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

  // Notify student of grading
  if (submission.studentId) {
    await createManyNotificationsRepo([
      {
        userId: submission.studentId,
        title: `Assignment Graded: ${submission.assignment.title}`,
        body: `Score: ${score}/${submission.assignment.maxScore || 'N/A'} - ${feedback.substring(0, 100)}${feedback.length > 100 ? '...' : ''}`,
      },
    ]);
  }

  return result;
}

/**
 * Bulk grade submissions
 */
export async function bulkGradeSubmissions(
  submissionIds: string[],
  score: number,
  feedback: string,
  rubricScores?: any
) {
  const results = await Promise.all(
    submissionIds.map((id) =>
      gradeSubmission(id, score, feedback, rubricScores)
    )
  );
  return results;
}

/**
 * Get grading report for an assignment
 */
export async function getGradingReport(assignmentId: string) {
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

  const graded = submissions.filter((s) => s.status === "graded");
  const pending = submissions.filter((s) => s.status === "pending");

  const averageScore =
    graded.length > 0
      ? graded.reduce((sum, s) => sum + (s.score || 0), 0) / graded.length
      : 0;

  return {
    total: submissions.length,
    graded: graded.length,
    pending: pending.length,
    averageScore,
    submissions,
  };
}