import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const API = "http://localhost:4000/api";

export function useTeachers() {
    return useQuery({
        queryKey: ["teachers"],
        queryFn: () => axios.get(`${API}/users?role=teacher`, { withCredentials: true }).then(r => r.data.users || r.data || []),
    });
}
