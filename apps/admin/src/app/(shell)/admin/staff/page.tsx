'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@schoolos/ui';

export default function AdminStaffPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">School Staff</h1>
      <Card>
        <CardHeader>
          <CardTitle>All Staff</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Staff management interface.</p>
        </CardContent>
      </Card>
    </div>
  );
}
