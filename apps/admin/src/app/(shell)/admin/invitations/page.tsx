'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@schoolos/ui';

export default function AdminInvitationsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Invitations</h1>
      <Card>
        <CardHeader>
          <CardTitle>Sent Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Manage user invitations.</p>
        </CardContent>
      </Card>
    </div>
  );
}
