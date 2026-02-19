import { NextResponse, type NextRequest } from "next/server";

interface UserSession {
  emailVerified?: boolean;
  email?: string;
  uid?: string;
  isAdmin?: boolean;
  [key: string]: any;
}

interface AuthenticationState {
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  hasFullAccess: boolean;
  userEmail?: string;
  /** Admin flag from session cookie (Firestore isAdmin field) */
  sessionIsAdmin?: boolean;
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

  // Check email verification status and admin flag from session cookies
  let isEmailVerified = true; // Default to true for backward compatibility
  let userEmail: string | undefined;
  let sessionIsAdmin: boolean | undefined;

  if (simpleSessionCookie) {
    try {
      // Handle signed cookies (format: base64url(data).signature)
      // Also handle legacy JSON cookies for backward compatibility
      let cookieData: string = simpleSessionCookie;

      // Check if this is a signed cookie (contains a dot and doesn't start with { or [)
      if (!simpleSessionCookie.startsWith('{') && !simpleSessionCookie.startsWith('[') && simpleSessionCookie.includes('.')) {
        // Extract the data part (before the last dot)
        const dotIndex = simpleSessionCookie.lastIndexOf('.');
        const encodedData = simpleSessionCookie.substring(0, dotIndex);

        // Decode base64url to JSON
        try {
          const base64 = encodedData.replace(/-/g, '+').replace(/_/g, '/');
          const padding = base64.length % 4;
          const paddedBase64 = padding ? base64 + '='.repeat(4 - padding) : base64;
          cookieData = atob(paddedBase64);
        } catch {
          // If decoding fails, treat as legacy JSON
          cookieData = simpleSessionCookie;
        }
      }

      const userSession: UserSession = JSON.parse(cookieData);
      isEmailVerified = userSession.emailVerified !== false; // Default to true if not specified
      userEmail = userSession.email;
      sessionIsAdmin = userSession.isAdmin === true;
    } catch (error) {
      // Silent fail - cookie might be in a format we don't understand
      // Auth will still work, just without email verification info
    }
  } else if (userSessionCookie) {
    // Fallback to legacy userSession cookie
    try {
      const userSession: UserSession = JSON.parse(userSessionCookie);
      isEmailVerified = userSession.emailVerified !== false; // Default to true if not specified
      userEmail = userSession.email;
      sessionIsAdmin = userSession.isAdmin === true;
    } catch (error) {
      console.log('[Proxy] Error parsing userSession cookie:', error);
    }
  }

  // User is authenticated if they have any valid session cookie
  const isAuthenticated = !!(simpleSessionCookie || sessionToken || authenticatedCookie);

  return {
    isAuthenticated,
    isEmailVerified,
    hasFullAccess: isAuthenticated && isEmailVerified,
    userEmail,
    sessionIsAdmin
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

export function proxy(request: NextRequest) {
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

  // NOTE: /u/[username] is now the primary user profile route
  // The /user/[id] route redirects TO /u/[username] for backwards compatibility
  // Do NOT redirect /u/ to /user/ anymore

  // Canonical group URL is /g/[id]. /group/[id] is handled by app/group/[id] (redirects to /g/[id]).

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
    // Admin status is determined by the session cookie's isAdmin flag
    // This flag is set by /api/auth/session which checks:
    // 1. Firebase Custom Claims (most secure, cryptographically signed)
    // 2. Firestore isAdmin/role fields
    const hasAdminAccess = auth.sessionIsAdmin === true;

    // If not an admin, redirect to home page
    if (!hasAdminAccess) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // For admin API routes, pass user email in headers
  if (path.startsWith('/api/admin/')) {
    const userEmail = getUserEmailForAdmin(request, auth);

    console.log('[Proxy] Admin API route detected:', path);
    console.log('[Proxy] User email from cookie:', userEmail);

    if (userEmail) {
      const response = NextResponse.next();
      response.headers.set('x-user-email', userEmail);
      console.log('[Proxy] Set x-user-email header:', userEmail);
      return response;
    } else {
      console.log('[Proxy] No user email found in any cookies');
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
        console.log('[Proxy] Error parsing userSession cookie:', error);
      }
    }
  }

  // If still not found, try to get from simpleUserSession cookie
  if (!userEmail) {
    const simpleSessionCookie = request.cookies.get("simpleUserSession")?.value;
    if (simpleSessionCookie) {
      try {
        const sessionData: UserSession = JSON.parse(simpleSessionCookie);
        userEmail = sessionData.email;
      } catch (error) {
        console.log('[Proxy] Error parsing simpleUserSession cookie:', error);
      }
    }
  }

  return userEmail;
}

// Configure which routes to run proxy on
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
  // Note: proxy always runs on Node.js runtime (not Edge)
};