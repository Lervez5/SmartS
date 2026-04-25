export interface Subject {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface CreateSubjectDto {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface UpdateSubjectDto {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
}
