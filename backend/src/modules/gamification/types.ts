export interface Badge {
  id: string;
  name: string;
  code: string;
  description?: string;
  icon?: string;
}

export interface StudentGamification {
  id: string;
  studentId: string;
  xp: number;
  level: number;
  badges: Badge[];
}
