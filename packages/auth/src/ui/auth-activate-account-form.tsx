'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient, errorMessage } from '../client';
import { AuthForm, AuthInput } from './primitives';

export function ActivateAccountForm({ token }: { token: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(data: Record<string, unknown>) {
    setIsLoading(true);
    setError(null);
    try {
      await authClient.activateAccount({
        token,
        password: data.password as string,
      });
      router.push('/login?activated=true');
    } catch (err) {
      setError(errorMessage(err, 'Failed to activate account'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthForm onSubmit={handleSubmit} isLoading={isLoading} error={error}>
      <AuthInput
        label="Password"
        type="password"
        name="password"
        required
        autoComplete="new-password"
      />
    </AuthForm>
  );
}
