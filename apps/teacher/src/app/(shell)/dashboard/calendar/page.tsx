'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@schoolos/ui';

export default function TeacherCalendarPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Calendar</h1>
      <Card>
        <CardHeader>
          <CardTitle>Teaching Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Your class schedule and events.</p>
        </CardContent>
      </Card>
    </div>
  );
}
