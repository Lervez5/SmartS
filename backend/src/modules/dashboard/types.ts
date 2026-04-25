export interface StudentDashboardData {
  upcomingClasses: any[];
  pendingAssignments: any[];
  recentGrades: any[];
  progress: any[];
}

export interface TeacherDashboardData {
  classesToday: any[];
  pendingGrading: any[];
  studentPerformance: any[];
}

export interface AdminDashboardData {
  stats: any[];
  revenue: any;
  recentUsers: any[];
  activity: any[];
}
