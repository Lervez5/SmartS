import { subjectProgressForChild, overallSystemStats } from "./repository";
import { ProgressQueryInput } from "./schema";

export function childProgressService(input: ProgressQueryInput) {
  return subjectProgressForChild(input.childId);
}

export function systemStatsService() {
  return overallSystemStats();
}


