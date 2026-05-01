export { router } from "./quiz.route";

// Controller exports (if needed individually)
export {
  createQuizController,
  getQuizController,
  listQuizzesController,
  updateQuizController,
  deleteQuizController,
  createQuestionController,
  getQuestionController,
  listQuestionsController,
  updateQuestionController,
  deleteQuestionController,
  startQuizController,
  submitQuizController,
  getMyAttemptController,
  getMyAttemptsController,
  autoGradeController,
  gradeAnswerController,
  getQuizAttemptsController,
  getQuizAnalyticsController,
  getAttemptWithAnswersController,
} from "./quiz.controller";

// Service exports (for direct use)
export {
  createQuiz,
  getQuizById,
  listQuizzes,
  updateQuiz,
  deleteQuiz,
  getQuizWithQuestionsForStudent,
  getQuizAnalytics,
} from "./quiz.service";

export {
  createQuestion,
  getQuestionById,
  listQuestions,
  updateQuestion,
  deleteQuestion,
} from "./questions/questions.service";

export {
  startAttempt,
  submitAttempt,
  getAttemptById,
  getStudentAttempts,
  getQuizAttempts,
} from "./attemps/attemps.service";

export {
  createAnswer,
  createManyAnswers,
  getAnswersByAttempt,
} from "./answers/answers.service";

export {
  gradeAttempt,
  autoGradeAll,
  gradeSingleAnswer,
} from "./grading/grading.service";
