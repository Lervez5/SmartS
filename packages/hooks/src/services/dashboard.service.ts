import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const config = { withCredentials: true };

export const dashboardService = {
  getStudentDashboard: async () => {
    const { data } = await axios.get(`${API}/dashboard/student`, config);
    return data;
  },

  getTeacherDashboard: async () => {
    const { data } = await axios.get(`${API}/dashboard/teacher`, config);
    return data;
  },

  getAdminDashboard: async () => {
    const { data } = await axios.get(`${API}/dashboard/admin`, config);
    return data;
  },
};