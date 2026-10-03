/**
 * Next.js middleware for the Admin portal.
 *
 * Enforces:
 * - Public routes are accessible without a session (login, activate, forgot-password, reset-password).
 * - All other routes require authentication.
 * - Portal eligibility: only SUPER_ADMIN, ACCOUNTANT, and DEAN roles may access the Admin portal.
 *
 * Note: the backend API is the final authority. This middleware is for UX only.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/activate-account', '/forgot-password', '/reset-password'];

// Admin portal accepts: SUPER_ADMIN, ACCOUNTANT, DEAN
const ADMIN_ROLES = new Set(['super_admin', 'accountant', 'dean']);

const PORTAL_URLS: Record<string, string> = {
  student: 'http://localhost:3000',
  teacher: 'http://localhost:3001',
  parent: 'http://localhost:3002',
  admin: 'http://localhost:3003',
};

function roleToApp(role: string): string | null {
  const r = role.toLowerCase();
  if (r === 'teacher') return 'teacher';
  if (r === 'parent') return 'parent';
  if (r === 'student') return 'student';
  return null;
}

function normalizeRole(role: string): string {
  return role.toLowerCase().replace(/[_\s-]+/g, '_');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon.ico')) {
    return NextResponse.next();
  }

  for (const publicRoute of PUBLIC_ROUTES) {
    if (pathname.startsWith(publicRoute)) {
      return NextResponse.next();
    }
  }

  // Admin portal has no landing page: redirect / to /login.
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/auth/me`, {
      credentials: 'include',
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
    });
  } catch {
    return NextResponse.next();
  }

  if (!response.ok) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  // Parsed defensively: an identity we cannot read is an identity we do not
  // have, so it redirects like any other unauthenticated request rather than
  // throwing and returning a 500 error page.
  let user: { role?: string } | undefined;
  try {
    const data = (await response.json()) as { user?: { role?: string } };
    user = data?.user;
  } catch {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  // Check portal eligibility: only ADMIN roles can access the Admin portal.
  const normalizedRole = normalizeRole(user?.role || '');
  if (!ADMIN_ROLES.has(normalizedRole)) {
    // Wrong portal: redirect to the user's correct portal.
    const correctApp = roleToApp(user?.role || '');
    if (correctApp) {
      const targetUrl = PORTAL_URLS[correctApp];
      if (targetUrl) {
        return NextResponse.redirect(new URL(targetUrl));
      }
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico).*)'],
};
