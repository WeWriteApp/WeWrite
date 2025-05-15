import { NextResponse } from "next/server";

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
    const isAdmin = userEmail === "jamiegray2234@gmail.com";

    // Check if the groups feature flag is enabled in cookies (set by client-side code)
    const groupsFeatureEnabled = request.cookies.get("feature_groups")?.value === "true";

    // If not an admin or the feature is disabled, redirect to home page
    if (!isAdmin || !groupsFeatureEnabled) {
      console.log(`[DEBUG] Groups access denied - User: ${userEmail || 'unknown'}, Admin: ${isAdmin}, Feature enabled: ${groupsFeatureEnabled}`);
      return NextResponse.redirect(new URL("/", request.url));
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