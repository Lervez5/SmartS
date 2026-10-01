'use client';

import { ActivateAccountForm } from '@schoolos/auth';
import { useParams } from 'next/navigation';

export default function ActivateAccountTokenPage() {
  const params = useParams();
  const token = params?.token as string;

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-destructive">Invalid activation token</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Activate Your Account</h1>
          <p className="text-sm text-muted-foreground">Set your password to activate</p>
        </div>
        <ActivateAccountForm token={token} />
      </div>
    </div>
  );
}
