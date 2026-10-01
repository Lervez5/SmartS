/**
 * Next.js middleware for the Student portal.
 *
 * Enforces:
 * - Public routes are accessible without a session (login, activate, forgot-password, reset-password).
 * - All other routes require authentication.
 * - Portal eligibility: only STUDENT role users may access the Student portal.
 *
 * Note: the backend API is the final authority. This middleware is for UX only.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that are publicly accessible without authentication.
const PUBLIC_ROUTES = ['/', '/login', '/activate-account', '/forgot-password', '/reset-password'];

// The role this portal is designated for.
const PORTAL_ROLE = 'student';

// Portal URLs for cross-portal redirect.
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

  // Skip static assets and Next.js internals.
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon.ico')) {
    return NextResponse.next();
  }

  // Public routes are accessible to everyone.
  for (const publicRoute of PUBLIC_ROUTES) {
    if (pathname.startsWith(publicRoute)) {
      return NextResponse.next();
    }
  }

  // Check if the user has a session by calling the API.
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
    // API unreachable - allow the page to load and let client-side handle it.
    return NextResponse.next();
  }

  if (!response.ok) {
    // Not authenticated, redirect to login.
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  const data = await response.json();
  const user = data.user;

  // Check portal eligibility: only STUDENT role can access the Student portal.
  const userRole = (user?.role || '').toLowerCase();
  if (userRole !== PORTAL_ROLE) {
    // Wrong portal: redirect to the user's correct portal.
    const correctApp = roleToApp(user?.role || '');
    if (correctApp) {
      const targetUrl = PORTAL_URLS[correctApp];
      if (targetUrl) {
        return NextResponse.redirect(new URL(targetUrl));
      }
    }
    // If we can't determine their portal, redirect to login.
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/|_next/static|_next/image|favicon.ico).*)',
  ],
};
