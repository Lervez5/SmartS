import { PrismaClient } from "@prisma/client";
import { CreateCourseDto, UpdateCourseDto } from "./types";

const prisma = new PrismaClient();

export async function findAllCourses(filters?: { status?: string, category?: string }) {
  return prisma.course.findMany({
    where: filters,
    include: {
      teacher: {
        select: { id: true, name: true, avatar: true }
      },
      subject: true,
      _count: {
        select: { enrollments: true, modules: true }
      }
    }
  });
}

export async function findCourseById(id: string) {
  return prisma.course.findUnique({
    where: { id },
    include: {
      teacher: {
        select: { id: true, name: true, avatar: true }
      },
      subject: true,
      modules: {
        orderBy: { order: 'asc' },
        include: {
          // @ts-ignore - Bypass IDE stale type cache
          units: {
            orderBy: { order: 'asc' },
            include: {
              lessons: {
                orderBy: { id: 'asc' } 
              },
              assignments: true,
              attendance: true
            }
          }
        }
      } as any,
      enrollments: true
    }
  });
}

export async function createCourse(data: CreateCourseDto) {
  const { modules, ...courseData } = data;
  
  return prisma.course.create({
    data: {
      ...courseData,
      modules: {
        create: (modules || []).map((m, mIdx) => ({
          title: m.title,
          description: m.description,
          order: mIdx,
          units: {
            create: (m.units || []).map((u, uIdx) => ({
              title: u.title,
              description: u.description,
              order: uIdx,
              lessons: {
                create: (u.lessons || []).map(l => ({
                  title: l.title,
                  content: l.content || "",
                  lessonType: l.lessonType,
                  subjectId: l.subjectId || courseData.subjectId
                }))
              }
            }))
          }
        }))
      }
    },
    include: {
      modules: {
        include: {
          // @ts-ignore
          units: {
            include: {
              lessons: true
            }
          }
        }
      } as any
    }
  });
}

export async function updateCourse(id: string, data: UpdateCourseDto) {
  const { modules, ...courseData } = data;

  return prisma.$transaction(async (tx) => {
    // 1. Update basic course info
    const updatedCourse = await tx.course.update({
      where: { id },
      data: courseData
    });

    // 2. If modules are provided, we rebuild the hierarchy
    // WARNING: This deletes existing progress associations if Lesson IDs change.
    // In a production app, we would use upserts, but for the "Builder" phase, this is the requested "Complete Course" functionality.
    if (modules) {
      // Delete existing hierarchy
      // We need to delete in order: Lessons -> Units -> Modules
      const existingModules = await tx.module.findMany({ where: { courseId: id } });
      const existingModuleIds = existingModules.map(m => m.id);
      
      // @ts-ignore
      const existingUnits = await (tx as any).unit.findMany({ where: { moduleId: { in: existingModuleIds } } });
      const existingUnitIds = existingUnits.map((u: any) => u.id);

      // @ts-ignore
      await (tx as any).lesson.deleteMany({ where: { unitId: { in: existingUnitIds } } });
      // @ts-ignore
      await (tx as any).unit.deleteMany({ where: { moduleId: { in: existingModuleIds } } });
      await tx.module.deleteMany({ where: { courseId: id } });

      // Create new hierarchy
      for (const [mIdx, m] of modules.entries()) {
        await tx.module.create({
          data: {
            title: m.title,
            // @ts-ignore
            description: m.description,
            order: mIdx,
            courseId: id,
            // @ts-ignore
            units: {
              create: (m.units || []).map((u, uIdx) => ({
                title: u.title,
                description: u.description,
                order: uIdx,
                lessons: {
                  create: (u.lessons || []).map(l => ({
                    title: l.title,
                    content: l.content || "",
                    lessonType: l.lessonType,
                    subjectId: l.subjectId || updatedCourse.subjectId
                  }))
                }
              }))
            }
          } as any
        });
      }
    }

    return findCourseById(id);
  });
}

export async function deleteCourse(id: string) {
  return prisma.course.delete({
    where: { id }
  });
}

export async function getStudentEnrollments(studentId: string) {
  return prisma.courseEnrollment.findMany({
    where: { studentId },
    include: {
      course: {
        include: {
          teacher: true,
          subject: true
        }
      }
    }
  });
}

export async function updateEnrollmentProgress(enrollmentId: string, progress: number) {
  return prisma.courseEnrollment.update({
    where: { id: enrollmentId },
    data: { progress }
  });
}

export async function findEnrollment(studentId: string, courseId: string) {
    return prisma.courseEnrollment.findFirst({
        where: { studentId, courseId }
    });
}

export async function findModuleById(moduleId: string) {
    return prisma.module.findUnique({
        where: { id: moduleId }
    });
}

export async function updateModuleLock(moduleId: string, isLocked: boolean) {
    return prisma.module.update({
        where: { id: moduleId },
        // @ts-ignore
        data: { isLocked } as any
    });
}
