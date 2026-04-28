import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const db = prisma as any;

export class MetricsService {
    /** Get platform-wide metrics for admins */
    async getPlatformMetrics() {
        const [studentCount, courseCount, lessonLogsCount, attendanceRecords] = await Promise.all([
            db.user.count({ where: { role: 'student' } }),
            db.course.count(),
            db.lessonAccessLog.count(),
            db.attendance.findMany({
                select: { status: true }
            })
        ]);

        const attendanceTotal = (attendanceRecords as any[]).length;
        const presentCount = (attendanceRecords as any[]).filter((r: any) => r.status === 'present' || r.status === 'late').length;
        const platformAttendanceRate = attendanceTotal > 0 ? (presentCount / attendanceTotal) * 100 : 0;

        // Completion metrics
        const enrollments = await db.courseEnrollment.findMany({
            select: { progress: true }
        });
        const enrollmentsArray = enrollments as any[];
        const avgCompletion = enrollmentsArray.length > 0 
            ? enrollmentsArray.reduce((sum: number, e: any) => sum + e.progress, 0) / enrollmentsArray.length 
            : 0;

        return {
            students: studentCount,
            courses: courseCount,
            totalEngagement: lessonLogsCount,
            attendanceRate: Math.round(platformAttendanceRate),
            averageCourseCompletion: Math.round(avgCompletion)
        };
    }

    /** Get engagement patterns by hour */
    async getAccessPatterns() {
        const logs = await db.lessonAccessLog.findMany({
            select: { accessedAt: true },
            take: 1000,
            orderBy: { accessedAt: 'desc' }
        });

        const hourlyDistribution = new Array(24).fill(0);
        (logs as any[]).forEach((log: any) => {
            const hour = new Date(log.accessedAt).getHours();
            hourlyDistribution[hour]++;
        });

        return hourlyDistribution;
    }
}

export const metricsService = new MetricsService();
