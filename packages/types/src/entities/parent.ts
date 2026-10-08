import type { User } from "./user";

export interface ParentProfile {
  id: string;
  userId: string;
  user?: User;
  occupation?: string | null;
  address?: string | null;
  createdAt: Date;
}

export interface ParentChildLink {
  id: string;
  parentId: string;
  parent?: ParentProfile;
  studentId: string;
  student?: StudentProfile;
  relationship?: string | null;
  createdAt: Date;
}

import type { StudentProfile } from "./student";
