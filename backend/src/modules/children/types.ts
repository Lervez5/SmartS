export interface Child {
  id: string;
  parentId: string;
  name: string;
  dateOfBirth?: Date;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateChildDto {
  parentId: string;
  name: string;
  dateOfBirth?: Date;
  avatar?: string;
}

export interface UpdateChildDto {
  name?: string;
  dateOfBirth?: Date;
  avatar?: string;
}
