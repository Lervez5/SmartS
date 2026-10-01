'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@schoolos/ui';

export default function AdminTransportPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Transport</h1>
      <Card>
        <CardHeader>
          <CardTitle>Transport Routes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Manage transport routes and assignments.</p>
        </CardContent>
      </Card>
    </div>
  );
}
