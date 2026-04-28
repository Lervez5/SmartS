"use client";

import { MetricsDashboard } from "@/features/dashboard/components/metrics-dashboard";

export default function AdminMetricsPage() {
    return (
        <div className="p-4">
            <MetricsDashboard metrics={null} />
        </div>
    );
}
