'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@schoolos/ui';

export default function ParentAttendancePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Children's Attendance</h1>
      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">View attendance for your children.</p>
        </CardContent>
      </Card>
    </div>
  );
}
