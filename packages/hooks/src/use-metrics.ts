import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export function usePlatformMetrics() {
    return useQuery({
        queryKey: ["platform-metrics"],
        queryFn: () => axios.get(`${API}/analytics/system/metrics`, { withCredentials: true }).then(r => r.data),
    });
}
