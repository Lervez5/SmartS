import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { requireRole } from "../../security/rbac";
import {
  createAssignmentWithNotifications,
  getAssignmentsByClassId,
  getAssignmentById,
  getAssignmentWithSubmissions,
  getAssignmentSubmissions,
  submitAssignment,
  gradeSubmission,
  getUnsubmittedStudents,
  updateAssignment,
  deleteAssignment,
} from "./service";
import {
  submitAssignment as submitAssignmentSubService,
  getStudentSubmissions,
  getSubmissionDetails,
} from "./submission/submission.service";
import {
  gradeSubmission as gradeSubmissionService,
  getGradingReport,
} from "./grading/grading.service";
import { ApiError } from "../../shared/errorHandler";
import { Role } from "../../security/rbac";

export async function createAssignmentController(
  req: Request,
  res: Response
) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }

  const allowedRoles: Role[] = ["teacher", "school_admin", "super_admin"];
  if (!req.user.role || !allowedRoles.includes(req.user.role as Role)) {
    throw new ApiError(403, "Forbidden: Insufficient permissions");
  }

  const { title, description, dueDate, classId, rubric, maxScore } = req.body;

  if (!title || !classId) {
    throw new ApiError(400, "Title and classId are required");
  }

  const parsedDueDate = dueDate ? new Date(dueDate) : undefined;
  const parsedRubric = rubric ? JSON.parse(rubric) : undefined;

  const result = await createAssignmentWithNotifications(
    {
      title,
      description,
      dueDate: parsedDueDate,
      classId,
      rubric: parsedRubric,
      maxScore,
    },
    req.user.id
  );

  res.status(201).json({
    message: "Assignment created successfully",
    assignment: result.assignment,
    notificationsSent: result.notificationsSent,
    enrolledStudents: result.enrolledStudents,
    className: result.className,
  });
}

export async function getAssignmentsByClassIdController(
  req: Request,
  res: Response
) {
  const { classId } = req.params;

  if (!classId) {
    throw new ApiError(400, "classId is required");
  }

  const assignments = await getAssignmentsByClassId(classId);

  res.json({ assignments });
}

export async function getAssignmentByIdController(
  req: Request,
  res: Response
) {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, "Assignment ID is required");
  }

  const assignment = await getAssignmentById(id);

  if (!assignment) {
    throw new ApiError(404, "Assignment not found");
  }

  res.json({ assignment });
}

export async function getAssignmentSubmissionsController(
  req: Request,
  res: Response
) {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, "Assignment ID is required");
  }

  const { submissions, assignment } = await getAssignmentSubmissions(id);

  res.json({ assignment, submissions });
}

export async function getAssignmentWithSubmissionsController(
  req: Request,
  res: Response
) {
  const { id } = req.params;
  const { classId } = req.query as { classId: string };

  if (!id || !classId) {
    throw new ApiError(400, "Assignment ID and classId are required");
  }

  const assignment = await getAssignmentWithSubmissions(id, classId);

  if (!assignment) {
    throw new ApiError(404, "Assignment not found");
  }

  res.json({ assignment });
}

export async function getUnsubmittedStudentsController(
  req: Request,
  res: Response
) {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, "Assignment ID is required");
  }

  const unsubmitted = await getUnsubmittedStudents(id);

  res.json({ unsubmitted });
}

// Student submission endpoint
export async function submitAssignmentController(
  req: Request,
  res: Response
) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }

  const { assignmentId } = req.params;
  const { content } = req.body;

  if (!assignmentId) {
    throw new ApiError(400, "Assignment ID is required");
  }
  if (!content) {
    throw new ApiError(400, "Content is required");
  }

  const fileUrl = (req as any).fileUrl || null;

  const prisma = new PrismaClient();

  const result = await submitAssignmentSubService(
    assignmentId,
    req.user.id,
    content,
    fileUrl
  );

  // Check late status
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  });
  const isLate = assignment?.dueDate && result.createdAt > assignment.dueDate;

  res.status(201).json({
    message: "Assignment submitted successfully",
    submission: result,
    isLate,
  });
}

// Get student's own submissions
export async function getMySubmissionsController(
  req: Request,
  res: Response
) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }

  const submissions = await getStudentSubmissions(req.user.id);

  res.json({ submissions });
}

// Get specific submission details
export async function getSubmissionDetailsController(
  req: Request,
  res: Response
) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }

  const { id } = req.params;

  const submission = await getSubmissionDetails(id, req.user.id);

  if (!submission) {
    throw new ApiError(404, "Submission not found");
  }

  res.json({ submission });
}

// Grade submission - teacher endpoint
export async function gradeSubmissionController(
  req: Request,
  res: Response
) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }

  const allowedRoles: Role[] = ["teacher", "school_admin", "super_admin"];
  if (!req.user.role || !allowedRoles.includes(req.user.role as Role)) {
    throw new ApiError(403, "Forbidden: Insufficient permissions");
  }

  const { id } = req.params;
  const { score, feedback, rubricScores } = req.body;

  if (!id) {
    throw new ApiError(400, "Submission ID is required");
  }
  if (score === undefined || score === null) {
    throw new ApiError(400, "Score is required");
  }
  if (!feedback) {
    throw new ApiError(400, "Feedback is required");
  }

  const result = await gradeSubmissionService(
    id,
    score,
    feedback,
    rubricScores,
    req.user.id
  );

  res.json({
    message: "Submission graded successfully",
    submission: result,
  });
}

// Grading report
export async function getGradingReportController(
  req: Request,
  res: Response
) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }

  const allowedRoles: Role[] = ["teacher", "school_admin", "super_admin"];
  if (!req.user.role || !allowedRoles.includes(req.user.role as Role)) {
    throw new ApiError(403, "Forbidden: Insufficient permissions");
  }

  const { id } = req.params;

  const report = await getGradingReport(id);

  res.json({ report });
}

export async function updateAssignmentController(
  req: Request,
  res: Response
) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }

  const allowedRoles: Role[] = ["teacher", "school_admin", "super_admin"];
  if (!req.user.role || !allowedRoles.includes(req.user.role as Role)) {
    throw new ApiError(403, "Forbidden: Insufficient permissions");
  }

  const { id } = req.params;
  const { title, description, dueDate, rubric, maxScore } = req.body;

  if (!id) {
    throw new ApiError(400, "Assignment ID is required");
  }

  const parsedDueDate = dueDate ? new Date(dueDate) : undefined;
  const parsedRubric = rubric ? JSON.parse(rubric) : undefined;

  const result = await updateAssignment(id, {
    title,
    description,
    dueDate: parsedDueDate,
    rubric: parsedRubric,
    maxScore,
  });

  res.json({ message: "Assignment updated successfully", assignment: result });
}

export async function deleteAssignmentController(
  req: Request,
  res: Response
) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }

  const allowedRoles: Role[] = ["teacher", "school_admin", "super_admin"];
  if (!req.user.role || !allowedRoles.includes(req.user.role as Role)) {
    throw new ApiError(403, "Forbidden: Insufficient permissions");
  }

  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, "Assignment ID is required");
  }

  await deleteAssignment(id);

  res.json({ message: "Assignment deleted successfully" });
}