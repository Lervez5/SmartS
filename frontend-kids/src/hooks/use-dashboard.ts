import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboard.service';
import { useAuthStore } from '../store/auth.store';

export const useStudentDashboard = () => {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['dashboard', 'student'],
    queryFn: dashboardService.getStudentDashboard,
    enabled: user?.role === 'student',
  });
};

export const useTeacherDashboard = () => {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['dashboard', 'teacher'],
    queryFn: dashboardService.getTeacherDashboard,
    enabled: user?.role === 'teacher',
  });
};

export const useAdminDashboard = () => {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: dashboardService.getAdminDashboard,
    enabled: user?.role === 'super_admin' || user?.role === 'school_admin',
  });
};
