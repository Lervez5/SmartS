import axios from "axios";
import type { User } from "@schoolos/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export interface AuthResponse {
  user: User;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: string;
}

export const authService = {
  /** POST /auth/login - sets accessToken/refreshToken/userRole cookies on the API. */
  async login(payload: { email: string; password: string }): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>("/auth/login", payload);
    return data;
  },

  /** POST /auth/register */
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>("/auth/register", payload);
    return data;
  },

  /** POST /auth/forgot-password */
  async forgotPassword(payload: { email: string }): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>("/auth/forgot-password", payload);
    return data;
  },

  /** POST /auth/reset-password */
  async resetPassword(payload: { token: string; password: string }): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>("/auth/reset-password", payload);
    return data;
  },

  /** GET /invitations/validate/:token */
  async validateInvitation(token: string): Promise<any> {
    const { data } = await api.get(`/invitations/validate/${token}`);
    return data;
  },

  /** POST /invitations/activate */
  async activateAccount(payload: { token: string; password: string }): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>("/invitations/activate", payload);
    return data;
  },

  /** POST /auth/logout - clears auth cookies. */
  async logout(): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>("/auth/logout");
    return data;
  },
};
