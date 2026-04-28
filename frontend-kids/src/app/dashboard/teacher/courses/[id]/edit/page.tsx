"use client";

import { CourseEditor } from "@/features/courses/components/course-editor";
import { useParams } from "next/navigation";

export default function TeacherCourseEditPage() {
    const { id } = useParams() as { id: string };
    return <CourseEditor courseId={id} />;
}
