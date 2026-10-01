'use client';

import { useAuth } from '@schoolos/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@schoolos/ui';

export default function TeacherSettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p>
              <span className="font-medium">Email:</span> {user?.email}
            </p>
            <p>
              <span className="font-medium">Role:</span> {user?.role}
            </p>
            <p>
              <span className="font-medium">Name:</span>{' '}
              {user?.name || user?.firstName || 'Not set'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
