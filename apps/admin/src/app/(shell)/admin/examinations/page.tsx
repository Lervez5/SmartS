'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@schoolos/ui';

export default function AdminExaminationsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Results</h1>
      <Card>
        <CardHeader>
          <CardTitle>Summative Results</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Manage examinations and results.</p>
        </CardContent>
      </Card>
    </div>
  );
}
