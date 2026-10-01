'use client';

import React, { useState } from 'react';
import { authClient, errorMessage } from '../client';
import { AuthForm, AuthInput } from './primitives';

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(data: Record<string, unknown>) {
    setIsLoading(true);
    setError(null);
    try {
      await authClient.forgotPassword(data.email as string);
      setSubmitted(true);
    } catch (err) {
      setError(errorMessage(err, 'Something went wrong'));
    } finally {
      setIsLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center text-sm">
        If the email exists in our system, a reset link has been sent.
      </div>
    );
  }

  return (
    <AuthForm onSubmit={handleSubmit} isLoading={isLoading} error={error}>
      <AuthInput label="Email" type="email" name="email" required autoComplete="email" />
    </AuthForm>
  );
}
