import { reportingRepository } from "./repository";
import { redisClient } from "../../shared/redis";

export class ReportingService {
    private CACHE_TTL = 300; // 5 minutes

    async getAcademicReport() {
        const cacheKey = "report:academic";
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const stats = await reportingRepository.getCourseStats();
        const report = {
            summary: {
                totalCourses: stats.totalCourses,
                totalEnrollments: stats.totalEnrollments,
                averageProgress: stats.averageProgress._avg.progress || 0
            },
            distribution: stats.distribution
        };

        await redisClient.setex(cacheKey, this.CACHE_TTL, JSON.stringify(report));
        return report;
    }

    async getAttendanceReport() {
        const cacheKey = "report:attendance";
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const stats = await reportingRepository.getAttendanceStats();
        const report = {
            totalRecords: stats.totalRecords,
            statusDistribution: stats.distribution
        };

        await redisClient.setex(cacheKey, this.CACHE_TTL, JSON.stringify(report));
        return report;
    }

    async getFinancialReport() {
        return {
            totalRevenue: 0,
            pendingInvoices: 0,
            paidInvoices: 0,
            trends: []
        };
    }

    async getPlatformAnalytics() {
        const cacheKey = "report:analytics";
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const [userRoles, modulePerformance, enrollmentTrends] = await Promise.all([
            reportingRepository.getUserStats(),
            reportingRepository.getModulePerformance(),
            reportingRepository.getEnrollmentTrends()
        ]);

        const analytics = {
            userRoles,
            modulePerformance,
            enrollmentTrends
        };

        await redisClient.setex(cacheKey, this.CACHE_TTL, JSON.stringify(analytics));
        return analytics;
    }
}

export const reportingService = new ReportingService();
