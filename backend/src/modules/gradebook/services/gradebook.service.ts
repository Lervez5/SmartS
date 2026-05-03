import { calculateAverage, calculateFinalGrade } from "../utils/grade.utils";

export class GradebookService {
    async getStudentPerformance(studentId: string, classId: string) {

        //Assignment and quiz scores would be fetched from the database in a real application
        const submissions = await prisma.submission.findMany({
            where: {
                studentId,
                classId:{classId}
            }
        });
        
        const assignmentScores = submissions
         .map(s => s.score)
         .filter((score: null) => score !== null) as number[];

         const assignmentAvg = calculateAverage(assignmentScores);

         // Quiz scores would be fetched from the database in a real application
         const quizzes = await prisma.quiz.findMany({
            where: {
               studentId,
                classId:{classId},
                status: 'submitted' 
                }
            });
            const quizScores = quizzes
            .map(q => q.score)
            .filter(score => score !== null) as number[];

            const quizAvg = calculateAverage(quizScores);


            //subject weights would be fetched from the database in a real application
            const classData = await prisma.class.findUnique({
                where: { id: classId },
                include: {
                    subject: true
                }
            });
            const weights = classData?.subject?.weights || { assignment: 0.5, quiz: 0.5 };

            // Final grade calculation would be done using the utility function
            const finalGrade = calculateFinalGrade({
                assignmentAvg,
                quizAvg,
                weights
            });

            return {
                assignmentAvg,
                quizAvg,
                finalGrade
            };

    }
}  