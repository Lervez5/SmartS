import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const accessToken = request.cookies.get('accessToken')?.value;
    let userRole = request.cookies.get('userRole')?.value; // Fallback to mock cookie if it exists

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

    // Public routes (No authentication needed)
    const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password', '/'];
    if (publicRoutes.includes(pathname)) {
        if (accessToken && (pathname === '/login' || pathname === '/register')) {
            // If already logged in, redirect to appropriate dashboard
            if (userRole === 'super_admin' || userRole === 'school_admin' || userRole === 'admin' || userRole === 'staff') {
                return NextResponse.redirect(new URL('/admin', request.url));
            }
            if (userRole === 'parent') return NextResponse.redirect(new URL('/parent', request.url));
            if (userRole === 'teacher') return NextResponse.redirect(new URL('/dashboard/teacher', request.url));
            return NextResponse.redirect(new URL('/dashboard/student', request.url));
        }
        return NextResponse.next();
    }

    // Protected routes
    if (!accessToken) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Role-based protection
    const isAdmin = userRole === 'super_admin' || userRole === 'school_admin' || userRole === 'admin' || userRole === 'staff';
    
    if (pathname.startsWith('/admin') && !isAdmin) {
        return NextResponse.redirect(new URL('/dashboard/student', request.url));
    }

    if (pathname.startsWith('/parent') && userRole !== 'parent') {
        return NextResponse.redirect(new URL('/dashboard/student', request.url));
    }

    if (pathname.startsWith('/dashboard/teacher') && userRole !== 'teacher') {
        return NextResponse.redirect(new URL('/dashboard/student', request.url));
    }

    if (pathname.startsWith('/dashboard/student') && userRole !== 'student') {
        if (isAdmin) return NextResponse.redirect(new URL('/admin', request.url));
        if (userRole === 'parent') return NextResponse.redirect(new URL('/parent', request.url));
        if (userRole === 'teacher') return NextResponse.redirect(new URL('/dashboard/teacher', request.url));
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
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
