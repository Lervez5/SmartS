import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const API = "http://localhost:4000/api";

export function usePlatformMetrics() {
    return useQuery({
        queryKey: ["platform-metrics"],
        queryFn: () => axios.get(`${API}/analytics/system/metrics`, { withCredentials: true }).then(r => r.data),
    });
}
