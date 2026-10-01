import type { Permission } from '@schoolos/auth/permissions';
import type { UserRole } from '@schoolos/auth/roles';
import type { AppId } from '@schoolos/auth/roles';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
  permissions: Permission[];
  appId: AppId;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}
