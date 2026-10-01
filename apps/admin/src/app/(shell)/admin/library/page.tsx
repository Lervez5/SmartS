'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@schoolos/ui';

export default function AdminLibraryPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Library</h1>
      <Card>
        <CardHeader>
          <CardTitle>Library Books</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Manage library inventory.</p>
        </CardContent>
      </Card>
    </div>
  );
}
