import { Role } from "@prisma/client";

export interface User {
  id: string;
  email: string;
  role: Role;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  email: string;
  passwordHash: string;
  role: Role;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export interface UpdateUserDto {
  email?: string;
  passwordHash?: string;
  role?: Role;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}
