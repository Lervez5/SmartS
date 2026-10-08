import Link from 'next/link';
import { ResetPasswordForm } from '@schoolos/auth';

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Set New Password</h1>
          <p className="text-sm text-muted-foreground">Enter your new password</p>
        </div>
        <ResetPasswordForm />
        <div className="text-center text-sm">
          <Link href="/login" className="text-primary underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
