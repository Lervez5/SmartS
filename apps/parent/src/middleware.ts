/**
 * Next.js middleware for the Parent portal.
 *
 * Enforces:
 * - Public routes are accessible without a session (login, activate, forgot-password, reset-password).
 * - All other routes require authentication.
 * - Portal eligibility: only PARENT role users may access the Parent portal.
 *
 * Note: the backend API is the final authority. This middleware is for UX only.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/activate-account', '/forgot-password', '/reset-password'];

const PORTAL_ROLE = 'parent';

const PORTAL_URLS: Record<string, string> = {
  student: 'http://localhost:3000',
  teacher: 'http://localhost:3001',
  parent: 'http://localhost:3002',
  admin: 'http://localhost:3003',
};

function roleToApp(role: string): string | null {
  const r = role.toLowerCase();
  if (r === 'super_admin' || r === 'super admin' || r === 'superadmin' || r === 'admin')
    return 'admin';
  if (r === 'accountant') return 'admin';
  if (r === 'dean') return 'admin';
  if (r === 'teacher') return 'teacher';
  if (r === 'parent') return 'parent';
  if (r === 'student') return 'student';
  return null;
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

  // Non-student portals have no landing page: redirect / to /login.
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

  const data = await response.json();
  const user = data.user;

  const userRole = (user?.role || '').toLowerCase();
  if (userRole !== PORTAL_ROLE) {
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
