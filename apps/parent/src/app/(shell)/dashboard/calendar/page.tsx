'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@schoolos/ui';

export default function ParentCalendarPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Calendar</h1>
      <Card>
        <CardHeader>
          <CardTitle>Family Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Upcoming school events and deadlines.</p>
        </CardContent>
      </Card>
    </div>
  );
}
