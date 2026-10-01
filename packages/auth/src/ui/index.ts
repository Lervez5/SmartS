/**
 * The centralized authentication surface.
 *
 * All four applications render these components; none of them implements its
 * own login, password reset or activation form.
 */
export * from './primitives';
export * from './AuthShell';
export * from './ThemeProvider';
export * from './auth-login-form';
export * from './auth-forgot-password-form';
export * from './auth-reset-password-form';
export * from './auth-activate-account-form';
