import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const db = prisma as any;

export class ReportingRepository {
    async getCourseStats() {
        const [totalCourses, totalEnrollments, averageProgress, distribution] = await Promise.all([
            db.course.count(),
            db.courseEnrollment.count(),
            db.courseEnrollment.aggregate({ _avg: { progress: true } }),
            db.course.groupBy({ by: ['category'], _count: { id: true } })
        ]);

        return { totalCourses, totalEnrollments, averageProgress, distribution };
    }

    async getAttendanceStats() {
        const [totalRecords, distribution] = await Promise.all([
            db.attendance.count(),
            db.attendance.groupBy({ by: ['status'], _count: { id: true } })
        ]);

        return { totalRecords, distribution };
    }

    async getUserStats() {
        return db.user.groupBy({ by: ['role'], _count: { id: true } });
    }

    async getModulePerformance() {
        // Average progress grouped by course/module
        return db.courseEnrollment.groupBy({
            by: ['courseId'],
            _avg: { progress: true },
            _count: { id: true }
        });
    }

    async getEnrollmentTrends() {
        // Count enrollments over time
        return db.courseEnrollment.groupBy({
            by: ['createdAt'],
            _count: { id: true },
            orderBy: { createdAt: 'asc' }
        });
    }
}

export const reportingRepository = new ReportingRepository();
