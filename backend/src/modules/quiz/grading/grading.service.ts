import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Grading Service
 * Handles auto-grading for objective questions and manual grading workflows
 */

export async function gradeAttempt(attemptId: string, graderId?: string) {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: {
        include: {
          question: true,
        },
      },
      quiz: {
        include: {
          questions: {
            include: {
              question: true,
            },
          },
        },
      },
    },
  });

  if (!attempt) {
    throw new Error("Attempt not found");
  }

  let totalScore = 0;
  let fullyGraded = true;

  for (const answer of attempt.answers) {
    const question = answer.question;

    // If answer already graded (has score), accumulate
    if (answer.score !== null && answer.score !== undefined) {
      totalScore += answer.score;
      continue;
    }

    // Auto-grade objective questions if possible
    if (question.type === "mcq" || question.type === "true_false") {
      if (question.correctAnswer) {
        const isCorrect = JSON.stringify(answer.response) === JSON.stringify(question.correctAnswer);
        const points = getPointsForQuestion(attempt.quiz.questions, question.id);

        await prisma.quizAnswer.update({
          where: { id: answer.id },
          data: {
            isCorrect,
            score: isCorrect ? points : 0,
          },
        });

        totalScore += isCorrect ? points : 0;
      } else {
        fullyGraded = false; // missing correct answer
      }
    } else {
      // short_answer, essay require manual grading
      fullyGraded = false;
    }
  }

  // Update attempt total score
  const updatedAttempt = await prisma.quizAttempt.update({
    where: { id: attemptId },
    data: {
      score: totalScore,
      status: fullyGraded ? "graded" : "submitted",
    },
  });

  return updatedAttempt;
}

export async function gradeSingleAnswer(
  answerId: string,
  { score, feedback, isCorrect }: { score?: number; feedback?: string; isCorrect?: boolean }
) {
  const answer = await prisma.quizAnswer.findUnique({
    where: { id: answerId },
    include: {
      attempt: true,
      question: true,
    },
  });

  if (!answer) {
    throw new Error("Answer not found");
  }

  await prisma.quizAnswer.update({
    where: { id: answerId },
    data: {
      ...(score !== undefined && { score }),
      ...(feedback !== undefined && { feedback }),
      ...(isCorrect !== undefined && { isCorrect }),
    },
  });

  // Recalculate total attempt score
  const allAnswers = await prisma.quizAnswer.findMany({
    where: { attemptId: answer.attemptId },
    include: {
      question: true,
    },
  });

  let totalScore = 0;
  let allGraded = true;

  for (const a of allAnswers) {
    if (a.score !== null && a.score !== undefined) {
      totalScore += a.score;
    } else {
      allGraded = false;
    }
  }

  const status = allGraded ? "graded" : "submitted";

  return await prisma.quizAttempt.update({
    where: { id: answer.attemptId },
    data: {
      score: totalScore,
      status,
    },
  });
}

export async function autoGradeAll(attemptId: string) {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: {
        include: {
          question: true,
        },
      },
      quiz: {
        include: {
          questions: {
            include: {
              question: true,
            },
          },
        },
      },
    },
  });

  if (!attempt) {
    throw new Error("Attempt not found");
  }

  let totalScore = 0;
  const autoGradedAnswers: string[] = [];

  for (const answer of attempt.answers) {
    if (answer.score !== null && answer.score !== undefined) {
      totalScore += answer.score;
      continue;
    }

    const question = answer.question;

    if (question.type === "mcq" || question.type === "true_false") {
      if (question.correctAnswer) {
        const isCorrect = JSON.stringify(answer.response) === JSON.stringify(question.correctAnswer);
        const points = getPointsForQuestion(attempt.quiz.questions, question.id);

        await prisma.quizAnswer.update({
          where: { id: answer.id },
          data: {
            isCorrect,
            score: isCorrect ? points : 0,
          },
        });

        totalScore += isCorrect ? points : 0;
        autoGradedAnswers.push(answer.id);
      }
    }
  }

  // Determine final status: if all possible auto-graded questions are graded, mark as submitted awaiting manual
  const hasManual = attempt.answers.some((a) => {
    const q = a.question;
    return q.type === "short" || q.type === "essy";
  });

  const status = hasManual ? "submitted" : "graded";

  return await prisma.quizAttempt.update({
    where: { id: attemptId },
    data: {
      score: totalScore,
      status,
    },
  });
}

function getPointsForQuestion(quizQuestions: any[], questionId: string): number {
  const qq = quizQuestions.find((q) => q.questionId === questionId);
  return qq?.points || 1;
}

export async function getAttemptScoreBreakdown(attemptId: string) {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: {
        include: {
          question: true,
        },
      },
    },
  });

  if (!attempt) {
    throw new Error("Attempt not found");
  }

  const breakdown = attempt.answers.map((answer) => ({
    questionId: answer.questionId,
    questionType: answer.question.type,
    response: answer.response,
    correctAnswer: answer.question.correctAnswer,
    score: answer.score,
    maxScore: getPointsForQuestionFromAnswer(answer),
    isCorrect: answer.isCorrect,
    isGraded: answer.score !== null && answer.score !== undefined,
  }));

  return {
    attemptId: attempt.id,
    totalScore: attempt.score,
    status: attempt.status,
    breakdown,
  };
}

function getPointsForQuestionFromAnswer(answer: any): number {
  // Fetch quizQuestions to get points
  return 1; // simplified - will be looked up elsewhere
}
