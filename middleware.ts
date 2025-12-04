import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "./app/utils/isAdmin";

interface UserSession {
  emailVerified?: boolean;
  email?: string;
  uid?: string;
  [key: string]: any;
}

interface AuthenticationState {
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  hasFullAccess: boolean;
  userEmail?: string;
}

interface PathChecks {
  isAccessiblePath: boolean;
  requiresAuth: boolean;
  requiresAdmin: boolean;
}

/**
 * Extract authentication state from request cookies
 */
function getAuthenticationState(request: NextRequest): AuthenticationState {
  // Get authentication status from simplified auth system
  const simpleSessionCookie = request.cookies.get("simpleUserSession")?.value;

  // Fallback to legacy cookies for backward compatibility
  const sessionToken = request.cookies.get("session")?.value;
  const authenticatedCookie = request.cookies.get("authenticated")?.value === 'true';
  const userSessionCookie = request.cookies.get("userSession")?.value;

  // Check email verification status from simpleUserSession cookie (new system)
  let isEmailVerified = true; // Default to true for backward compatibility
  let userEmail: string | undefined;

  if (simpleSessionCookie) {
    try {
      const userSession: UserSession = JSON.parse(simpleSessionCookie);
      isEmailVerified = userSession.emailVerified !== false; // Default to true if not specified
      userEmail = userSession.email;
    } catch (error) {
      console.log('[Middleware] Error parsing simpleUserSession cookie:', error);
    }
  } else if (userSessionCookie) {
    // Fallback to legacy userSession cookie
    try {
      const userSession: UserSession = JSON.parse(userSessionCookie);
      isEmailVerified = userSession.emailVerified !== false; // Default to true if not specified
      userEmail = userSession.email;
    } catch (error) {
      console.log('[Middleware] Error parsing userSession cookie:', error);
    }
  }

  // User is authenticated if they have any valid session cookie
  const isAuthenticated = !!(simpleSessionCookie || sessionToken || authenticatedCookie);

  return {
    isAuthenticated,
    isEmailVerified,
    hasFullAccess: isAuthenticated && isEmailVerified,
    userEmail
  };
}

/**
 * Check path requirements for authentication and access control
 */
function getPathChecks(path: string): PathChecks {
  // Define paths that are always accessible
  const isAccessiblePath = path === "/auth/login" ||
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
  const requiresAdmin = path.startsWith("/admin") && path !== "/admin-login";

  return {
    isAccessiblePath,
    requiresAuth,
    requiresAdmin
  };
}

export function middleware(request: NextRequest) {
  // Clone the URL so we can modify it
  const url = request.nextUrl.clone();
  const path = url.pathname;

  // DEBUG: Log all OG API requests
  if (path.startsWith('/api/og')) {
    console.log('🖼️ [MIDDLEWARE DEBUG] OG API request:', {
      path,
      method: request.method,
      userAgent: request.headers.get('user-agent'),
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
      cookies: Object.fromEntries(request.cookies.getAll().map(c => [c.name, c.value.substring(0, 20) + '...']))
    });
  }

  // Get authentication state and path requirements
  const auth = getAuthenticationState(request);
  const pathChecks = getPathChecks(path);

  // DEBUG: Log path checks for OG API
  if (path.startsWith('/api/og')) {
    console.log('🖼️ [MIDDLEWARE DEBUG] Path checks for OG:', {
      path,
      isAccessiblePath: pathChecks.isAccessiblePath,
      requiresAuth: pathChecks.requiresAuth,
      requiresAdmin: pathChecks.requiresAdmin,
      authState: auth
    });
  }

  // Debug logging for authentication issues
  if (path.startsWith("/auth/login")) {
    console.log('🔍 Middleware Debug - Login page access:', {
      path,
      sessionToken: !!request.cookies.get("session")?.value,
      authenticatedCookie: request.cookies.get("authenticated")?.value === 'true',
      userSessionCookie: !!request.cookies.get("userSession")?.value,
      isAuthenticated: auth.isAuthenticated,
      isEmailVerified: auth.isEmailVerified
    });
  }

  // Handle URL structure redirects
  const urlRedirect = handleUrlRedirects(path, url);
  if (urlRedirect) {
    return urlRedirect;
  }

  // Handle authentication redirects
  const authRedirect = handleAuthenticationRedirects(path, auth, pathChecks, request);
  if (authRedirect) {
    if (path.startsWith('/api/og')) {
      console.log('🖼️ [MIDDLEWARE DEBUG] Auth redirect triggered for OG:', authRedirect);
    }
    return authRedirect;
  }

  // Handle admin access control
  const adminResponse = handleAdminAccess(path, pathChecks, auth, request);
  if (adminResponse) {
    if (path.startsWith('/api/og')) {
      console.log('🖼️ [MIDDLEWARE DEBUG] Admin response triggered for OG:', adminResponse);
    }
    return adminResponse;
  }

  // DEBUG: Log successful pass-through for OG
  if (path.startsWith('/api/og')) {
    console.log('🖼️ [MIDDLEWARE DEBUG] OG request passed through successfully');
  }

  return NextResponse.next();
}

/**
 * Handle URL structure redirects
 */
function handleUrlRedirects(path: string, url: URL): NextResponse | null {
  // Handle new page creation from inline links (new:title format)
  if (path.startsWith('/new:')) {
    const title = path.substring(5); // Remove '/new:' prefix
    if (title) {
      url.pathname = '/new';
      url.searchParams.set('title', decodeURIComponent(title));
      return NextResponse.redirect(url);
    } else {
      url.pathname = '/new';
      return NextResponse.redirect(url);
    }
  }

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

  // Redirect /g/[id] to /group/[id]
  if (path.startsWith('/g/')) {
    const id = path.replace('/g/', '');
    url.pathname = `/group/${id}`;
    return NextResponse.redirect(url);
  }

  return null;
}

/**
 * Handle authentication-based redirects
 */
function handleAuthenticationRedirects(
  path: string,
  auth: AuthenticationState,
  pathChecks: PathChecks,
  request: NextRequest
): NextResponse | null {
  // Redirect authenticated users away from auth pages
  if (path.startsWith("/auth/") && auth.isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Allow unverified users to access all parts of the app
  // Email verification is now handled only through the banner system

  // Only redirect to login for paths that explicitly require auth
  if (pathChecks.requiresAuth && !auth.isAuthenticated) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("from", path);
    return NextResponse.redirect(loginUrl);
  }

  // Allow unverified users to access protected routes, but they'll see verification alerts
  // Only block from very sensitive operations (handled above)

  return null;
}

/**
 * Handle admin access control and API route headers
 */
function handleAdminAccess(
  path: string,
  pathChecks: PathChecks,
  auth: AuthenticationState,
  request: NextRequest
): NextResponse | null {
  // For admin-only paths, check if the user is an admin
  if (pathChecks.requiresAdmin) {
    const userEmail = auth.userEmail || request.cookies.get("user_email")?.value;
    const adminStatus = isAdmin(userEmail);

    // If not an admin, redirect to home page
    if (!adminStatus) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // For admin API routes, pass user email in headers
  if (path.startsWith('/api/admin/')) {
    const userEmail = getUserEmailForAdmin(request, auth);

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

  return null;
}

/**
 * Extract user email for admin operations from various cookie sources
 */
function getUserEmailForAdmin(request: NextRequest, auth: AuthenticationState): string | undefined {
  // Try to get user email from various cookie sources
  let userEmail = request.cookies.get("user_email")?.value;

  // If not found, try from auth state
  if (!userEmail && auth.userEmail) {
    userEmail = auth.userEmail;
  }

  // If not found, try to get from userSession cookie
  if (!userEmail) {
    const userSessionCookie = request.cookies.get("userSession")?.value;
    if (userSessionCookie) {
      try {
        const sessionData: UserSession = JSON.parse(userSessionCookie);
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

  return userEmail;
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
  // Run middleware on Node.js runtime (Bun doesn't support Vercel middleware yet)
  runtime: "nodejs",
};