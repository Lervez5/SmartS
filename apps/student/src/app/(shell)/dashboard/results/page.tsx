'use client';

import { useAuth } from '@schoolos/auth';
import { LearnerResultsView } from '@schoolos/ui';

export default function StudentResultsPage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return <LearnerResultsView learnerId={user.id} />;
}
