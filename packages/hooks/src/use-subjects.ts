import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export function useSubjects() {
    return useQuery({
        queryKey: ["subjects"],
        queryFn: () => axios.get(`${API}/subjects`, { withCredentials: true }).then(r => r.data.subjects || []),
    });
}
