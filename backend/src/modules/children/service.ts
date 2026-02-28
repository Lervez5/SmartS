import { ApiError } from "../../shared/errorHandler";
import { CreateChildInput, UpdateChildInput } from "./schema";
import {
  createChildRepo,
  getChildById,
  listChildrenByParent,
  listChildrenForAdmin,
  updateChildRepo,
} from "./repository";

export async function createChildService(input: CreateChildInput) {
  const child = await createChildRepo({
    userId: input.userId,
    firstName: input.firstName,
    lastName: input.lastName,
    birthDate: new Date(input.birthDate),
  });
  return child;
}

export async function listChildrenForUser(userId: string, role: "admin" | "parent" | "student") {
  if (role === "admin") {
    return listChildrenForAdmin();
  }
  if (role === "parent") {
    return listChildrenByParent(userId);
  }
  const child = await getChildById(userId);
  return child ? [child] : [];
}

export async function updateChildService(
  id: string,
  input: UpdateChildInput,
  requesterId: string,
  role: "admin" | "parent" | "student"
) {
  const child = await getChildById(id);
  if (!child) {
    throw new ApiError(404, "Child not found");
  }
  if (role === "student" && requesterId !== child.id) {
    throw new ApiError(403, "Cannot modify another student's profile");
  }
  const data: { firstName?: string; lastName?: string; birthDate?: Date } = {};
  if (input.firstName) data.firstName = input.firstName;
  if (input.lastName) data.lastName = input.lastName;
  if (input.birthDate) data.birthDate = new Date(input.birthDate);
  return updateChildRepo(id, data);
}


