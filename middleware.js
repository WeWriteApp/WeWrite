import { NextResponse } from "next/server";

import { isAdmin } from "./app/utils/isAdmin";

export function middleware(request) {
  // Clone the URL so we can modify it
  const url = request.nextUrl.clone();
  const path = url.pathname;

  // Define paths that are always public
  const isPublicPath = path === "/auth/login" ||
                      path === "/auth/register" ||
                      path === "/auth/forgot-password" ||
                      path.startsWith("/api/") ||
                      path.startsWith("/pages/") ||
                      path === "/"; // Allow access to home page

  // Define paths that always require authentication
  const requiresAuth = path === "/new" ||
                      path.startsWith("/dashboard") ||
                      path === "/subscription" ||
                      path === "/subscription/";

  // Define paths that require admin access (only accessible to admin users)
  const requiresAdmin = false; // No paths require admin access by default

  // Groups functionality has been completely removed
  // const isGroupsPath = false;
  // const requiresGroupsAuth = false;

  // Get authentication status from standard cookies
  // Primary: Firebase session cookie (for Firebase auth users)
  // Secondary: authenticated cookie (for session-based auth)
  const sessionToken = request.cookies.get("session")?.value;
  const authenticatedCookie = request.cookies.get("authenticated")?.value === 'true';
  const userSessionCookie = request.cookies.get("userSession")?.value;

  // Check email verification status from userSession cookie
  let isEmailVerified = true; // Default to true for backward compatibility
  if (userSessionCookie) {
    try {
      const userSession = JSON.parse(userSessionCookie);
      isEmailVerified = userSession.emailVerified !== false; // Default to true if not specified
    } catch (error) {
      console.log('[Middleware] Error parsing userSession cookie:', error);
    }
  }

  // User is authenticated if they have either a Firebase session or authenticated cookie
  const isAuthenticated = !!(sessionToken || authenticatedCookie);

  // Debug logging for authentication issues
  if (path.startsWith("/auth/login")) {
    console.log('🔍 Middleware Debug - Login page access:', {
      path,
      sessionToken: !!sessionToken,
      authenticatedCookie,
      userSessionCookie: !!userSessionCookie,
      isAuthenticated,
      isEmailVerified
    });
  }

  // User has full access if authenticated AND email verified
  const hasFullAccess = isAuthenticated && isEmailVerified;

  // URL structure redirects

  // Redirect /pages/[id] to /[id]
  if (path.startsWith('/pages/')) {
    const id = path.replace('/pages/', '');
    // Don't redirect /pages/new
    if (id !== 'new') {
      url.pathname = `/${id}`;
      return NextResponse.redirect(url);
    }
  }

  // Redirect /page/[id] to /[id] (singular form)
  if (path.startsWith('/page/')) {
    const id = path.replace('/page/', '');
    url.pathname = `/${id}`;
    return NextResponse.redirect(url);
  }

  // Redirect /u/[slug] to /user/[id]
  if (path.startsWith('/u/')) {
    const id = path.replace('/u/', '');
    url.pathname = `/user/${id}`;
    return NextResponse.redirect(url);
  }

  // We're not going to redirect /[id] paths in the middleware
  // Instead, we'll let the /[id] route handle the logic of determining
  // whether it's a page, user, or group

  // Groups redirects removed - groups functionality has been completely removed

  // Redirect /g/[id] to /group/[id]
  if (path.startsWith('/g/')) {
    const id = path.replace('/g/', '');
    url.pathname = `/group/${id}`;
    return NextResponse.redirect(url);
  }

  // We're not going to handle URLs with slashes in them in the middleware
  // Instead, we'll let the app/[id]/page.js handle it

  // Authentication redirects

  // Redirect authenticated users away from auth pages (except verify-email)
  // TEMPORARY: Allow login page access for debugging stale sessions
  if (path.startsWith("/auth/") && path !== "/auth/verify-email" && path !== "/auth/login" && isAuthenticated) {
    // If user is authenticated but not verified, redirect to verification
    if (!isEmailVerified) {
      return NextResponse.redirect(new URL("/auth/verify-email", request.url));
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Redirect unverified users to email verification page
  if (isAuthenticated && !isEmailVerified && path !== "/auth/verify-email") {
    return NextResponse.redirect(new URL("/auth/verify-email", request.url));
  }

  // Only redirect to login for paths that explicitly require auth
  if (requiresAuth && !isAuthenticated) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("from", path);
    return NextResponse.redirect(loginUrl);
  }

  // Block unverified users from protected routes
  if (requiresAuth && isAuthenticated && !isEmailVerified) {
    return NextResponse.redirect(new URL("/auth/verify-email", request.url));
  }

  // For admin-only paths, check if the user is an admin
  if (requiresAdmin) {
    // Get the admin status from cookies
    const userEmail = request.cookies.get("user_email")?.value;
    const isAdmin = isAdmin(userEmail);

    // If not an admin, redirect to home page
    if (!isAdmin) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // Groups functionality removed

  // For admin API routes, pass user email in headers
  if (path.startsWith('/api/admin/')) {
    // Try to get user email from various cookie sources
    let userEmail = request.cookies.get("user_email")?.value;

    // If not found, try to get from userSession cookie
    if (!userEmail) {
      const userSessionCookie = request.cookies.get("userSession")?.value;
      if (userSessionCookie) {
        try {
          const sessionData = JSON.parse(userSessionCookie);
          userEmail = sessionData.email;
        } catch (error) {
          console.log('[Middleware] Error parsing userSession cookie:', error);
        }
      }
    }

    // If still not found, try to get from Firebase session cookie
    if (!userEmail) {
      const sessionCookie = request.cookies.get("session")?.value;
      if (sessionCookie) {
        try {
          // For now, we'll just skip the admin check since we have a session
          // In a real implementation, you'd decode the Firebase session token
          console.log('[Middleware] Found Firebase session cookie, allowing admin access for development');
          userEmail = 'jamiegray2234@gmail.com'; // Hardcode for development
        } catch (error) {
          console.log('[Middleware] Error parsing session cookie:', error);
        }
      }
    }

    console.log('[Middleware] Admin API route detected:', path);
    console.log('[Middleware] User email from cookie:', userEmail);

    if (userEmail) {
      const response = NextResponse.next();
      response.headers.set('x-user-email', userEmail);
      console.log('[Middleware] Set x-user-email header:', userEmail);
      return response;
    } else {
      console.log('[Middleware] No user email found in any cookies');
    }
  }

  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};