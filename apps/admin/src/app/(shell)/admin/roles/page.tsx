'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@schoolos/ui';

export default function AdminRolesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Roles</h1>
      <Card>
        <CardHeader>
          <CardTitle>Role Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Manage roles and permissions.</p>
        </CardContent>
      </Card>
    </div>
  );
}
