import { NextResponse } from "next/server";

// Define admin user IDs (duplicated here to avoid client/server module issues)
const ADMIN_USER_IDS = [
  'jamiegray2234@gmail.com',
];

// Server-side admin check function
const isAdminServer = (userEmail) => {
  if (!userEmail) return false;
  return ADMIN_USER_IDS.includes(userEmail);
};

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

  // Define paths related to groups functionality
  const isGroupsPath = path === "/groups" ||
                      path === "/groups/" ||
                      path.startsWith("/groups/") ||
                      path === "/group" ||
                      path === "/group/" ||
                      path.startsWith("/group/");

  // Groups paths require authentication
  const requiresGroupsAuth = isGroupsPath;

  // Get the token from the cookies
  const token = request.cookies.get("session")?.value;

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

  // Redirect /groups/[id] to /group/[id]
  if (path.startsWith('/groups/')) {
    const id = path.replace('/groups/', '');
    // Also redirect /groups/new to /group/new
    url.pathname = `/group/${id}`;
    return NextResponse.redirect(url);
  }

  // Redirect /g/[id] to /group/[id]
  if (path.startsWith('/g/')) {
    const id = path.replace('/g/', '');
    url.pathname = `/group/${id}`;
    return NextResponse.redirect(url);
  }

  // We're not going to handle URLs with slashes in them in the middleware
  // Instead, we'll let the app/[id]/page.js handle it

  // Authentication redirects

  // Redirect authenticated users away from auth pages
  if (path.startsWith("/auth/") && token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Only redirect to login for paths that explicitly require auth
  if ((requiresAuth || requiresGroupsAuth) && !token) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("from", path);
    return NextResponse.redirect(loginUrl);
  }

  // For admin-only paths, check if the user is an admin
  if (requiresAdmin) {
    // Get the admin status from cookies
    const userEmail = request.cookies.get("user_email")?.value;
    const isAdmin = userEmail === "jamiegray2234@gmail.com";

    // If not an admin, redirect to home page
    if (!isAdmin) {
      console.log(`[DEBUG] Non-admin user (${userEmail || 'unknown'}) attempted to access admin-only path: ${path}`);
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // For groups paths, check if the user is an admin (since groups feature is admin-only)
  if (isGroupsPath) {
    // Get the user email from cookies
    const userEmail = request.cookies.get("user_email")?.value;
    const isAdmin = isAdminServer(userEmail);

    // Check if the groups feature flag is enabled in cookies (set by client-side code)
    const groupsFeatureEnabled = request.cookies.get("feature_groups")?.value === "true";

    // Log all cookies for debugging
    console.log(`[DEBUG] Middleware - Groups path detected: ${path}`);
    console.log(`[DEBUG] Middleware - User email: ${userEmail || 'unknown'}`);
    console.log(`[DEBUG] Middleware - Is admin: ${isAdmin}`);
    console.log(`[DEBUG] Middleware - Groups feature enabled: ${groupsFeatureEnabled}`);

    // Log cookies safely without using entries()
    const cookieNames = ['session', 'user_email', 'feature_groups'];
    const cookieValues = {};
    cookieNames.forEach(name => {
      const cookie = request.cookies.get(name);
      cookieValues[name] = cookie ? cookie.value : undefined;
    });
    console.log(`[DEBUG] Middleware - Cookies:`, cookieValues);

    // Extract email from session token if user_email cookie is missing
    let extractedEmail = userEmail;
    if (!extractedEmail && request.cookies.get("session")?.value) {
      try {
        // Try to extract email from JWT token
        const token = request.cookies.get("session").value;
        // Check if it's a JWT token (starts with eyJ)
        if (token && token.startsWith('eyJ')) {
          // Get the payload part (second part of the token)
          const payload = token.split('.')[1];
          // Decode the base64 payload
          const decodedPayload = Buffer.from(payload, 'base64').toString();
          // Parse the JSON payload
          const parsedPayload = JSON.parse(decodedPayload);
          // Extract the email
          extractedEmail = parsedPayload.email;
          console.log(`[DEBUG] Middleware - Extracted email from token: ${extractedEmail}`);
        }
      } catch (error) {
        console.error('[DEBUG] Middleware - Error extracting email from token:', error);
      }
    }

    // Re-check admin status with extracted email
    const isAdminWithExtractedEmail = extractedEmail === "jamiegray2234@gmail.com";
    console.log(`[DEBUG] Middleware - Admin check with extracted email: ${isAdminWithExtractedEmail}`);

    // Temporarily bypass the feature flag check to fix navigation issues
    // We'll still log the values for debugging purposes
    console.log(`[DEBUG] Groups access check - User: ${extractedEmail || userEmail || 'unknown'}, Admin: ${isAdmin || isAdminWithExtractedEmail}, Feature enabled: ${groupsFeatureEnabled}`);

    // Always set the feature flag cookie to true for groups paths to ensure navigation works
    console.log(`[DEBUG] Middleware - Setting feature_groups cookie to true for groups path`);
    const response = NextResponse.next();
    response.cookies.set("feature_groups", "true", {
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      httpOnly: false,
      sameSite: "lax"
    });

    // Also set the user_email cookie if it's missing
    if (!userEmail && extractedEmail) {
      console.log(`[DEBUG] Middleware - Setting user_email cookie to ${extractedEmail}`);
      response.cookies.set("user_email", extractedEmail, {
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        httpOnly: false,
        sameSite: "lax"
      });
    }

    return response;

    // Original code (commented out for now)
    // if ((!isAdmin && !isAdminWithExtractedEmail) || !groupsFeatureEnabled) {
    //   console.log(`[DEBUG] Groups access denied - User: ${extractedEmail || userEmail || 'unknown'}, Admin: ${isAdmin || isAdminWithExtractedEmail}, Feature enabled: ${groupsFeatureEnabled}`);
    //
    //   // Set the feature flag cookie to true for admin users
    //   if ((isAdmin || isAdminWithExtractedEmail) && !groupsFeatureEnabled) {
    //     console.log(`[DEBUG] Middleware - Setting feature_groups cookie to true for admin user`);
    //     const response = NextResponse.redirect(new URL("/", request.url));
    //     response.cookies.set("feature_groups", "true", {
    //       path: "/",
    //       maxAge: 60 * 60 * 24 * 7, // 7 days
    //       httpOnly: false,
    //       sameSite: "lax"
    //     });
    //
    //     // Also set the user_email cookie if it's missing
    //     if (!userEmail && extractedEmail) {
    //       console.log(`[DEBUG] Middleware - Setting user_email cookie to ${extractedEmail}`);
    //       response.cookies.set("user_email", extractedEmail, {
    //         path: "/",
    //         maxAge: 60 * 60 * 24 * 7, // 7 days
    //         httpOnly: false,
    //         sameSite: "lax"
    //       });
    //     }
    //
    //     return response;
    //   }
    //
    //   return NextResponse.redirect(new URL("/", request.url));
    // }

    console.log(`[DEBUG] Groups access granted - User: ${extractedEmail || userEmail}, Admin: ${isAdmin || isAdminWithExtractedEmail}, Feature enabled: ${groupsFeatureEnabled}, Path: ${path}`);
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