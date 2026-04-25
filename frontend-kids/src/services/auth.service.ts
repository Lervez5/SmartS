import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export const authService = {
  login: async (payload: any) => {
    const { data } = await api.post('/auth/login', payload);
    return data;
  },
  logout: async () => {
    const { data } = await api.post('/auth/logout');
    return data;
  },
  me: async () => {
    const { data } = await api.get('/auth/me');
    return data;
  }
};
