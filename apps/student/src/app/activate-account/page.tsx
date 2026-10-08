export default function ActivateAccountPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Activate Your Account</h1>
          <p className="text-sm text-muted-foreground">
            Enter the activation token sent to your email
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          If you have an activation link, navigate to /activate-account/[token] with your token.
        </p>
      </div>
    </div>
  );
}
