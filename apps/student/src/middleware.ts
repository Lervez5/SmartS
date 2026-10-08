import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const accessToken = request.cookies.get('accessToken')?.value;
  let userRole = request.cookies.get('userRole')?.value;

  if (accessToken) {
    try {
      const parts = accessToken.split('.');
      if (parts.length === 3) {
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const paddedBase64 = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
        const payloadStr = atob(paddedBase64);
        const payloadObj = JSON.parse(payloadStr);
        if (payloadObj && payloadObj.role) {
          userRole = payloadObj.role;
        }
      }
    } catch (e) {
      console.error("Failed to decode middleware JWT payload:", e);
    }
  }

  // Public routes (No authentication needed) - Student app has landing page
  const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/activate-account'];
  if (publicRoutes.some(route => pathname === route || pathname.startsWith('/activate-account'))) {
    if (accessToken && (pathname === '/login' || pathname === '/register')) {
      // If already logged in, redirect to appropriate dashboard
      if (userRole === 'super_admin' || userRole === 'school_admin') {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      if (userRole === 'parent') return NextResponse.redirect(new URL('/parent', request.url));
      if (userRole === 'teacher') return NextResponse.redirect(new URL('/dashboard/teacher', request.url));
      return NextResponse.redirect(new URL('/dashboard/student', request.url));
    }
    return NextResponse.next();
  }

  // Protected routes - require authentication
  if (!accessToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role-based protection for student app
  // Student app: allow student, teacher, admin (they can view student dashboard)
  // But redirect parent to parent app
  if (pathname.startsWith('/dashboard/student') && userRole !== 'student') {
    if (userRole === 'parent') return NextResponse.redirect(new URL('/parent', request.url));
    if (userRole === 'teacher') return NextResponse.redirect(new URL('/dashboard/teacher', request.url));
    if (userRole === 'super_admin' || userRole === 'school_admin') return NextResponse.redirect(new URL('/admin', request.url));
  }

  // Block access to teacher routes
  if (pathname.startsWith('/dashboard/teacher')) {
    return NextResponse.redirect(new URL('/dashboard/student', request.url));
  }

  // Block access to parent routes
  if (pathname.startsWith('/parent')) {
    return NextResponse.redirect(new URL('/dashboard/student', request.url));
  }

  // Block access to admin routes
  if (pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/dashboard/student', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};