'use client';

import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@schoolos/ui';

export default function StudentCoursePage() {
  const params = useParams();
  const courseId = params?.id as string;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Course: {courseId}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Lessons</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Course lessons will appear here.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Your assignments for this course.</p>
        </CardContent>
      </Card>
    </div>
  );
}
