import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export const dashboardService = {
  getStudentDashboard: async () => {
    const { data } = await api.get('/dashboard/student');
    return data;
  },
  
  getTeacherDashboard: async () => {
    const { data } = await api.get('/dashboard/teacher');
    return data;
  },
  
  getAdminDashboard: async () => {
    const { data } = await api.get('/dashboard/admin');
    return data;
  },
};
