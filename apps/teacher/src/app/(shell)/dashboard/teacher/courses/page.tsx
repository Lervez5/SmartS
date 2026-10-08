'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@schoolos/ui';

interface Course {
  id: string;
  title: string;
  code?: string;
  students: number;
}

export default function TeacherCoursesPage() {
  const courses: Course[] = [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Courses</h1>
      <Card>
        <CardHeader>
          <CardTitle>Assigned Courses</CardTitle>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No courses assigned yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Students</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell>{course.title}</TableCell>
                    <TableCell>{course.code || '-'}</TableCell>
                    <TableCell>{course.students}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
