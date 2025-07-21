import { NextRequest, NextResponse } from 'next/server';

/**
 * Simple Middleware for WeWrite
 * 
 * This middleware replaces the complex multi-auth middleware with a simple,
 * reliable authentication check based on session cookies.
 */

interface SimpleAuthState {
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  userEmail?: string;
}

/**
 * Get authentication state from request cookies
 */
function getSimpleAuthState(request: NextRequest): SimpleAuthState {
  const sessionCookie = request.cookies.get('simpleUserSession');
  
  if (!sessionCookie) {
    return {
      isAuthenticated: false,
      isEmailVerified: false
    };
  }

  try {
    const sessionData = JSON.parse(sessionCookie.value);
    
    return {
      isAuthenticated: true,
      isEmailVerified: sessionData.emailVerified !== false, // Default to true if not specified
      userEmail: sessionData.email
    };
  } catch (error) {
    console.log('[Simple Middleware] Error parsing session cookie:', error);
    return {
      isAuthenticated: false,
      isEmailVerified: false
    };
  }
}

/**
 * Check if a path requires authentication
 */
function requiresAuth(path: string): boolean {
  const authRequiredPaths = [
    '/settings',
    '/admin',
    '/api/pages',
    '/api/account',
    '/api/subscription',
    '/api/tokens',
    '/api/analytics'
  ];

  return authRequiredPaths.some(authPath => path.startsWith(authPath));
}

/**
 * Check if a path is an auth page
 */
function isAuthPage(path: string): boolean {
  return path.startsWith('/auth/');
}

/**
 * Check if a path is public (doesn't require auth)
 */
function isPublicPath(path: string): boolean {
  const publicPaths = [
    '/',
    '/auth',
    '/api/auth',
    '/api/health',
    '/manifest.json',
    '/_next',
    '/favicon.ico'
  ];

  return publicPaths.some(publicPath => path.startsWith(publicPath));
}

export function simpleMiddleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const path = url.pathname;

  // Skip middleware for static files and Next.js internals
  if (path.startsWith('/_next') || path.startsWith('/api/_next') || path.includes('.')) {
    return NextResponse.next();
  }

  // Get authentication state
  const auth = getSimpleAuthState(request);

  console.log(`[Simple Middleware] ${path} - Auth: ${auth.isAuthenticated}, Verified: ${auth.isEmailVerified}`);

  // Handle authentication redirects
  
  // 1. Redirect authenticated users away from auth pages (except verify-email)
  if (isAuthPage(path) && path !== '/auth/verify-email' && auth.isAuthenticated) {
    if (!auth.isEmailVerified) {
      // Unverified users go to verification page
      return NextResponse.redirect(new URL('/auth/verify-email', request.url));
    }
    // Verified users go to homepage
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 2. Redirect unverified users to email verification (except for homepage and auth pages)
  if (auth.isAuthenticated && !auth.isEmailVerified && path !== '/auth/verify-email' && path !== '/') {
    return NextResponse.redirect(new URL('/auth/verify-email', request.url));
  }

  // 3. Redirect unauthenticated users to login for protected paths
  if (requiresAuth(path) && !auth.isAuthenticated) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('from', path);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Block unverified users from protected paths
  if (requiresAuth(path) && auth.isAuthenticated && !auth.isEmailVerified) {
    return NextResponse.redirect(new URL('/auth/verify-email', request.url));
  }

  // Allow the request to continue
  return NextResponse.next();
}

// Configure which paths the middleware should run on
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
